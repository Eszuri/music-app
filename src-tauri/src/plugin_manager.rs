use std::fs;
use std::io::{BufRead, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter, Manager};

static DOWNLOAD_CANCELLED: AtomicBool = AtomicBool::new(false);

pub fn cancel_download() {
    DOWNLOAD_CANCELLED.store(true, Ordering::SeqCst);
}

/// Download URL for the self-contained C# audio engine (GitHub Releases).
pub const PLUGIN_DOWNLOAD_URL: &str =
    "https://github.com/Eszuri/symvonia/releases/latest/download/symvonia-audio-engine.exe";

pub const PLUGIN_EXPECTED_SHA256: &str = match option_env!("SYMVONIA_AUDIO_PLUGIN_SHA256") {
    Some(value) => value,
    None => "",
};

pub const PLUGIN_EXE_NAME: &str = "symvonia-audio-engine.exe";

fn default_plugin_download_url() -> String {
    match option_env!("SYMVONIA_PLUGIN_RELEASE_TAG") {
        Some(tag) if !tag.is_empty() => format!(
            "https://github.com/Eszuri/symvonia/releases/download/{tag}/{PLUGIN_EXE_NAME}"
        ),
        _ => PLUGIN_DOWNLOAD_URL.to_string(),
    }
}

fn verify_download_hash(path: &Path, expected: &str) -> Result<(), String> {
    if expected.is_empty() {
        return Ok(());
    }
    if expected.len() != 64 || !expected.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err("Configured plugin SHA-256 must contain exactly 64 hexadecimal characters.".into());
    }

    let actual = compute_sha256(&path.to_path_buf())?;
    if !actual.eq_ignore_ascii_case(expected) {
        return Err(format!(
            "Hash mismatch. Expected {}, got {}. The file may be corrupted or tampered with.",
            expected, actual
        ));
    }
    Ok(())
}

#[derive(Serialize, Clone)]
pub struct PluginStatus {
    pub installed: bool,
    pub path: Option<String>,
    pub size_bytes: Option<u64>,
    pub sha256: Option<String>,
}

#[derive(Serialize, Clone)]
struct DownloadProgress {
    downloaded: u64,
    total: u64,
}

/// Directory where the plugin exe lives: <app_data>/plugins/bit-perfect/
pub fn plugin_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {}", e))?;
    Ok(base.join("plugins").join("bit-perfect"))
}

pub fn plugin_exe_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(plugin_dir(app)?.join(PLUGIN_EXE_NAME))
}

pub fn get_status(app: &AppHandle) -> Result<PluginStatus, String> {
    let exe = plugin_exe_path(app)?;
    if !exe.exists() {
        return Ok(PluginStatus {
            installed: false,
            path: None,
            size_bytes: None,
            sha256: None,
        });
    }
    let size = fs::metadata(&exe).ok().map(|m| m.len());
    Ok(PluginStatus {
        installed: true,
        path: Some(exe.to_string_lossy().to_string()),
        size_bytes: size,
        sha256: None, // hash is computed lazily on demand (it's a 60+ MB file)
    })
}

pub fn compute_sha256(path: &PathBuf) -> Result<String, String> {
    let mut file = fs::File::open(path).map_err(|e| format!("Failed to open exe: {}", e))?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 65536];
    loop {
        let n = file
            .read(&mut buf)
            .map_err(|e| format!("Failed to read exe: {}", e))?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(hasher
        .finalize()
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect::<String>())
}

/// Downloads the plugin exe to a temp file, verifies the hash, then moves it
/// into place. Emits `bit-perfect-download-progress` events along the way.
pub fn download_and_install(app: &AppHandle, url: Option<String>) -> Result<PluginStatus, String> {
    DOWNLOAD_CANCELLED.store(false, Ordering::SeqCst);
    let url = url.unwrap_or_else(default_plugin_download_url);
    let dir = plugin_dir(app)?;
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create plugin dir: {}", e))?;

    let tmp_path = dir.join(format!("{}.download", PLUGIN_EXE_NAME));
    let final_path = dir.join(PLUGIN_EXE_NAME);

    let response = ureq::get(&url)
        .call()
        .map_err(|e| format!("Download failed: {}", e))?;

    let total: u64 = response
        .header("Content-Length")
        .and_then(|v| v.parse().ok())
        .unwrap_or(0);

    let mut reader = response.into_reader();
    let mut file = fs::File::create(&tmp_path)
        .map_err(|e| format!("Failed to create temp file: {}", e))?;

    let mut downloaded: u64 = 0;
    let mut buf = [0u8; 65536];
    let mut last_emit = std::time::Instant::now();
    loop {
        if DOWNLOAD_CANCELLED.load(Ordering::SeqCst) {
            drop(file);
            let _ = fs::remove_file(&tmp_path);
            let _ = app.emit(
                "bit-perfect-download-progress",
                DownloadProgress { downloaded: 0, total: 0 },
            );
            return Err("Pengunduhan plugin dibatalkan oleh pengguna.".into());
        }

        let n = match reader.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => n,
            Err(e) => {
                drop(file);
                let _ = fs::remove_file(&tmp_path);
                return Err(format!("Download stream error: {}", e));
            }
        };

        if DOWNLOAD_CANCELLED.load(Ordering::SeqCst) {
            drop(file);
            let _ = fs::remove_file(&tmp_path);
            let _ = app.emit(
                "bit-perfect-download-progress",
                DownloadProgress { downloaded: 0, total: 0 },
            );
            return Err("Pengunduhan plugin dibatalkan oleh pengguna.".into());
        }

        file.write_all(&buf[..n])
            .map_err(|e| format!("Failed to write temp file: {}", e))?;
        downloaded += n as u64;
        if last_emit.elapsed().as_millis() >= 100 {
            last_emit = std::time::Instant::now();
            let _ = app.emit(
                "bit-perfect-download-progress",
                DownloadProgress { downloaded, total },
            );
        }
    }

    if DOWNLOAD_CANCELLED.load(Ordering::SeqCst) {
        drop(file);
        let _ = fs::remove_file(&tmp_path);
        return Err("Pengunduhan plugin dibatalkan oleh pengguna.".into());
    }

    file.flush().ok();
    drop(file);
    let _ = app.emit(
        "bit-perfect-download-progress",
        DownloadProgress { downloaded, total },
    );

    if total > 0 && downloaded != total {
        let _ = fs::remove_file(&tmp_path);
        return Err(format!(
            "Incomplete download: got {} of {} bytes",
            downloaded, total
        ));
    }

    if let Err(error) = verify_download_hash(&tmp_path, PLUGIN_EXPECTED_SHA256) {
        let _ = fs::remove_file(&tmp_path);
        return Err(error);
    }
    if let Err(error) = verify_plugin_executable(&tmp_path) {
        let _ = fs::remove_file(&tmp_path);
        return Err(error);
    }

    invalidate_cache();
    fs::rename(&tmp_path, &final_path)
        .map_err(|e| format!("Failed to move plugin into place: {}", e))?;
    let _ = verify_with_cache(&final_path);

    get_status(app)
}

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Deserialize)]
struct VerifyResponse {
    event: String,
    token: String,
    engine: String,
    version: String,
}

fn verify_response_line(line: &str, token: &str) -> bool {
    serde_json::from_str::<VerifyResponse>(line)
        .map(|response| {
            response.event == "verify_response"
                && response.token == token
                && response.engine == "Symvonia Audio Engine"
                && response.version == "1.0.0"
        })
        .unwrap_or(false)
}

fn validate_plugin_file(src: &Path) -> Result<(), String> {
    if !src.is_file() {
        return Err(format!("Berkas plugin tidak ditemukan atau bukan file biasa: {}", src.display()));
    }
    Ok(())
}

fn validate_manual_import_source(src: &Path) -> Result<(), String> {
    validate_plugin_file(src)?;
    if !src.extension().is_some_and(|extension| extension.eq_ignore_ascii_case("exe")) {
        return Err("Berkas plugin harus berekstensi .exe.".into());
    }
    Ok(())
}

/// Verifies that a local file is a valid Symvonia Audio Engine executable.
pub fn verify_plugin_executable(src: &Path) -> Result<(), String> {
    validate_plugin_file(src)?;

    let meta = fs::metadata(src).map_err(|e| format!("Gagal membaca metadata berkas: {}", e))?;
    let len = meta.len();
    if !(500 * 1024..=500 * 1024 * 1024).contains(&len) {
        return Err(format!(
            "Ukuran berkas ({:.2} MB) tidak valid untuk plugin Symvonia Audio Engine (harus 0.5 MB - 500 MB).",
            len as f64 / (1024.0 * 1024.0)
        ));
    }

    let mut file = fs::File::open(src).map_err(|e| format!("Gagal membuka berkas: {}", e))?;
    let mut header = [0u8; 512];
    let n = file.read(&mut header).map_err(|e| format!("Gagal membaca header berkas: {}", e))?;
    if n < 64 || &header[0..2] != b"MZ" {
        return Err("Berkas bukan merupakan executable Windows yang valid (Missing MZ header).".into());
    }

    let pe_offset = u32::from_le_bytes([header[60], header[61], header[62], header[63]]) as usize;
    if pe_offset + 4 > n || &header[pe_offset..pe_offset + 4] != b"PE\0\0" {
        return Err("Berkas bukan merupakan PE Executable Windows yang valid (Missing PE signature).".into());
    }

    let nonce = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_nanos() as u64)
        .unwrap_or(123456789);
    let token = format!("symvonia_token_{nonce:x}");
    let mut command = Command::new(src);
    command
        .arg("--verify")
        .arg(&token)
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .stdin(Stdio::null());

    #[cfg(target_os = "windows")]
    command.creation_flags(CREATE_NO_WINDOW);

    if let Ok(mut child) = command.spawn() {
        if let Some(stdout) = child.stdout.take() {
            let mut reader = std::io::BufReader::new(stdout);
            let mut line = String::new();
            let start = std::time::Instant::now();
            while start.elapsed().as_millis() < 2500 {
                if reader.read_line(&mut line).unwrap_or(0) > 0 {
                    break;
                }
                std::thread::sleep(std::time::Duration::from_millis(50));
            }
            let _ = child.kill();
            if verify_response_line(&line, &token) {
                return Ok(());
            }
        } else {
            let _ = child.kill();
        }
    }

    Err("Verifikasi gagal: file bukan plugin Symvonia Audio Engine yang valid.".into())
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FileFingerprint {
    pub path: PathBuf,
    pub size: u64,
    pub modified: std::time::SystemTime,
}

static VERIFIED_CACHE: Mutex<Option<FileFingerprint>> = Mutex::new(None);

pub fn invalidate_cache() {
    if let Ok(mut guard) = VERIFIED_CACHE.lock() {
        *guard = None;
    }
}

/// Verifies the plugin executable before execution using an in-memory fingerprint cache.
/// Returns Ok(()) in <0.05ms if the file size and modification time have not changed.
/// If the file is modified or replaced manually, it re-runs full verification and updates the cache.
pub fn verify_with_cache(path: &Path) -> Result<(), String> {
    let meta = fs::metadata(path)
        .map_err(|e| format!("Gagal membaca metadata berkas plugin ({}): {}", path.display(), e))?;
    let size = meta.len();
    let modified = meta
        .modified()
        .map_err(|e| format!("Gagal membaca timestamp berkas plugin: {}", e))?;

    if let Ok(guard) = VERIFIED_CACHE.lock() {
        if let Some(cached) = guard.as_ref() {
            if cached.path == path && cached.size == size && cached.modified == modified {
                return Ok(());
            }
        }
    }

    verify_plugin_executable(path)?;

    if let Ok(mut guard) = VERIFIED_CACHE.lock() {
        *guard = Some(FileFingerprint {
            path: path.to_path_buf(),
            size,
            modified,
        });
    }

    Ok(())
}

/// Installs the plugin from a local exe file (used for development/testing
/// and for users who prefer sideloading over downloading).
pub fn install_from_file(app: &AppHandle, source: &str) -> Result<PluginStatus, String> {
    let src = PathBuf::from(source);
    validate_manual_import_source(&src)?;
    verify_download_hash(&src, PLUGIN_EXPECTED_SHA256)?;
    verify_plugin_executable(&src)?;

    invalidate_cache();
    let dir = plugin_dir(app)?;
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create plugin dir: {}", e))?;
    let dest = dir.join(PLUGIN_EXE_NAME);
    fs::copy(&src, &dest).map_err(|e| format!("Failed to copy plugin exe: {}", e))?;
    let _ = verify_with_cache(&dest);
    get_status(app)
}

pub fn uninstall(app: &AppHandle) -> Result<(), String> {
    invalidate_cache();
    let exe = plugin_exe_path(app)?;
    if exe.exists() {
        fs::remove_file(&exe).map_err(|e| format!("Failed to remove plugin: {}", e))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn verify_response_requires_audio_engine_identity() {
        let token = "symvonia_token_test";
        let valid = r#"{"event":"verify_response","token":"symvonia_token_test","engine":"Symvonia Audio Engine","version":"1.0.0"}"#;
        let ai = r#"{"event":"verify_response","token":"symvonia_token_test","engine":"Symvonia AI Lyrics Engine","version":"1.0.0"}"#;
        let wrong_token = r#"{"event":"verify_response","token":"other","engine":"Symvonia Audio Engine","version":"1.0.0"}"#;
        let wrong_event = r#"{"event":"ready","token":"symvonia_token_test","engine":"Symvonia Audio Engine","version":"1.0.0"}"#;
        let wrong_version = r#"{"event":"verify_response","token":"symvonia_token_test","engine":"Symvonia Audio Engine","version":"2.0.0"}"#;

        assert!(verify_response_line(valid, token));
        assert!(!verify_response_line(ai, token));
        assert!(!verify_response_line(wrong_token, token));
        assert!(!verify_response_line(wrong_event, token));
        assert!(!verify_response_line(wrong_version, token));
        assert!(!verify_response_line("not-json", token));
    }

    #[test]
    fn verify_download_hash_accepts_matching_case_insensitive_hash() {
        let temp_file = std::env::temp_dir().join("symvonia-audio-hash-test.tmp");
        let mut file = fs::File::create(&temp_file).unwrap();
        file.write_all(b"Symvonia Audio Engine Unit Test").unwrap();
        drop(file);

        let hash = compute_sha256(&temp_file).unwrap();
        assert!(verify_download_hash(&temp_file, &hash).is_ok());
        assert!(verify_download_hash(&temp_file, &hash.to_uppercase()).is_ok());

        let _ = fs::remove_file(temp_file);
    }

    #[test]
    fn verify_download_hash_rejects_mismatch_and_invalid_format() {
        let temp_file = std::env::temp_dir().join("symvonia-audio-hash-test-invalid.tmp");
        fs::write(&temp_file, b"Symvonia Audio Engine Unit Test").unwrap();

        assert!(verify_download_hash(&temp_file, &"0".repeat(64)).is_err());
        assert!(verify_download_hash(&temp_file, "not-a-sha256").is_err());

        let _ = fs::remove_file(temp_file);
    }

    #[test]
    fn fingerprint_cache_invalidation_and_hit() {
        invalidate_cache();
        assert!(VERIFIED_CACHE.lock().unwrap().is_none());

        let temp_file = std::env::temp_dir().join("symvonia-audio-fp-test.tmp");
        let mut file = fs::File::create(&temp_file).unwrap();
        file.write_all(b"Fingerprint Test Content").unwrap();
        drop(file);

        let meta = fs::metadata(&temp_file).unwrap();
        let size = meta.len();
        let modified = meta.modified().unwrap();

        // Seed cache
        if let Ok(mut guard) = VERIFIED_CACHE.lock() {
            *guard = Some(FileFingerprint {
                path: temp_file.clone(),
                size,
                modified,
            });
        }

        // Cache hit test
        let cache_guard = VERIFIED_CACHE.lock().unwrap();
        let cached = cache_guard.as_ref().unwrap();
        assert_eq!(cached.path, temp_file);
        assert_eq!(cached.size, size);
        assert_eq!(cached.modified, modified);
        drop(cache_guard);

        // Invalidation test
        invalidate_cache();
        assert!(VERIFIED_CACHE.lock().unwrap().is_none());

        let _ = fs::remove_file(temp_file);
    }
}
