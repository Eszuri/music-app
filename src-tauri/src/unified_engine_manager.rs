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

#[derive(Serialize, Clone, Debug)]
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

/// Directory where the unified audio engine plugin lives: <app_data>/plugins/engine/
pub fn plugin_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {}", e))?;
    Ok(base.join("plugins").join("engine"))
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
        sha256: None,
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
                && (response.version == "1.0.0" || response.version == "2.0.0")
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
            while start.elapsed().as_millis() < 8000 {
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

pub fn is_dev_mode() -> bool {
    cfg!(debug_assertions)
}

pub fn verify_with_cache(path: &Path) -> Result<(), String> {
    if is_dev_mode() {
        return Ok(());
    }

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

pub fn install_from_file(app: &AppHandle, source: &str) -> Result<PluginStatus, String> {
    let src = PathBuf::from(source);
    validate_manual_import_source(&src)?;

    if !is_dev_mode() {
        verify_download_hash(&src, PLUGIN_EXPECTED_SHA256)?;
        verify_plugin_executable(&src)?;
    }

    let dir = plugin_dir(app)?;
    fs::create_dir_all(&dir).map_err(|e| format!("Gagal membuat folder plugin: {}", e))?;

    let dest = dir.join(PLUGIN_EXE_NAME);
    invalidate_cache();
    fs::copy(&src, &dest).map_err(|e| format!("Gagal menyalin berkas plugin: {}", e))?;

    if !is_dev_mode() {
        let _ = verify_with_cache(&dest);
    }

    get_status(app)
}

pub fn uninstall(app: &AppHandle) -> Result<(), String> {
    invalidate_cache();
    let exe = plugin_exe_path(app)?;
    if exe.exists() {
        fs::remove_file(&exe).map_err(|e| format!("Gagal menghapus berkas plugin: {}", e))?;
    }
    // Also remove legacy exe if exists
    if let Ok(base) = app.path().app_data_dir() {
        let legacy = base.join("plugins").join("bit-perfect").join(PLUGIN_EXE_NAME);
        if legacy.exists() {
            let _ = fs::remove_file(legacy);
        }
    }
    Ok(())
}

// ─── Equalizer DSP Bridge ───────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DspCurveResult {
    #[serde(rename = "bandMode")]
    pub band_mode: i32,
    pub curve: Vec<f64>,
    #[serde(rename = "suggestedAutoPreamp")]
    pub suggested_auto_preamp: f64,
}

pub fn get_dsp_curve(
    app: &AppHandle,
    band_mode: i32,
    bands: Vec<f64>,
    preamp: f64,
) -> Result<DspCurveResult, String> {
    let exe = plugin_exe_path(app)?;
    if !exe.exists() {
        return Err("Plugin Audio Engine belum terinstall".into());
    }

    let payload = serde_json::json!({
        "command": "get_curve",
        "bandMode": band_mode,
        "bands": bands,
        "preamp": preamp
    });

    let mut command = Command::new(&exe);
    command
        .stdout(Stdio::piped())
        .stdin(Stdio::piped())
        .stderr(Stdio::null());

    #[cfg(target_os = "windows")]
    command.creation_flags(CREATE_NO_WINDOW);

    let mut child = command.spawn().map_err(|e| format!("Gagal menjalankan Audio Engine: {}", e))?;

    if let Some(mut stdin) = child.stdin.take() {
        let json_line = format!("{}\n", payload);
        let _ = stdin.write_all(json_line.as_bytes());
        let _ = stdin.flush();
    }

    if let Some(stdout) = child.stdout.take() {
        let mut reader = std::io::BufReader::new(stdout);
        let mut line = String::new();
        let start = std::time::Instant::now();
        while start.elapsed().as_millis() < 8000 {
            let mut l = String::new();
            if reader.read_line(&mut l).unwrap_or(0) > 0 {
                let trimmed = l.trim();
                if trimmed.contains(r#""event":"ready""#) {
                    continue;
                }
                line = trimmed.to_string();
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(20));
        }
        let _ = child.kill();

        if let Ok(res) = serde_json::from_str::<DspCurveResult>(&line) {
            return Ok(res);
        }
    } else {
        let _ = child.kill();
    }

    Err("Gagal mendapatkan respon kalkulasi kurva dari DSP engine".into())
}

// ─── Tag Editor Bridge ──────────────────────────────────────────────────────

#[derive(Serialize)]
struct WriteTagsPayload<'a> {
    command: &'a str,
    #[serde(rename = "filePath")]
    file_path: &'a str,
    tags: serde_json::Value,
    artwork: serde_json::Value,
}

#[derive(Deserialize)]
struct WriteResultEvent {
    success: bool,
    error: Option<String>,
}

#[allow(clippy::too_many_arguments)]
pub fn write_tags_via_plugin(
    app: &AppHandle,
    file_path: &str,
    title: Option<String>,
    artist: Option<String>,
    album: Option<String>,
    genre: Option<String>,
    year: Option<u32>,
    track_number: Option<u32>,
    total_tracks: Option<u32>,
    disc_number: Option<u32>,
    total_discs: Option<u32>,
    comment: Option<String>,
    cover_b64: Option<String>,
    cover_mime: Option<String>,
) -> Result<(), String> {
    let exe = plugin_exe_path(app)?;
    if !exe.exists() {
        return Err("Plugin Audio Engine belum terinstall. Silakan pasang plugin Audio Engine di Pengaturan.".into());
    }

    let tags_obj = serde_json::json!({
        "title": title,
        "artist": artist,
        "album": album,
        "genre": genre,
        "year": year,
        "trackNumber": track_number,
        "totalTracks": total_tracks,
        "discNumber": disc_number,
        "totalDiscs": total_discs,
        "comment": comment,
    });

    let artwork_obj = match (cover_b64, cover_mime) {
        (Some(b64), mime) if !b64.is_empty() => serde_json::json!({
            "action": "set",
            "mime": mime.unwrap_or_else(|| "image/jpeg".to_string()),
            "dataBase64": b64
        }),
        _ => serde_json::json!({
            "action": "keep"
        }),
    };

    let payload = WriteTagsPayload {
        command: "write_tags",
        file_path,
        tags: tags_obj,
        artwork: artwork_obj,
    };

    let mut command = Command::new(&exe);
    command
        .stdout(Stdio::piped())
        .stdin(Stdio::piped())
        .stderr(Stdio::null());

    #[cfg(target_os = "windows")]
    command.creation_flags(CREATE_NO_WINDOW);

    let mut child = command.spawn().map_err(|e| format!("Gagal menjalankan Audio Engine: {}", e))?;

    if let Some(mut stdin) = child.stdin.take() {
        let json_line = serde_json::to_string(&payload).map_err(|e| format!("JSON error: {}", e))?;
        let _ = stdin.write_all(json_line.as_bytes());
        let _ = stdin.write_all(b"\n");
        let _ = stdin.flush();
    }

    if let Some(stdout) = child.stdout.take() {
        let mut reader = std::io::BufReader::new(stdout);
        let mut line = String::new();
        let start = std::time::Instant::now();
        while start.elapsed().as_millis() < 8000 {
            let mut l = String::new();
            if reader.read_line(&mut l).unwrap_or(0) > 0 {
                let trimmed = l.trim();
                if trimmed.contains(r#""event":"ready""#) {
                    continue;
                }
                line = trimmed.to_string();
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(20));
        }
        let _ = child.kill();

        if let Ok(res) = serde_json::from_str::<WriteResultEvent>(&line) {
            if res.success {
                return Ok(());
            } else {
                return Err(res.error.unwrap_or_else(|| "Gagal menyimpan metadata".to_string()));
            }
        }
    } else {
        let _ = child.kill();
    }

    Err("Gagal mendapatkan konfirmasi penulisan tag dari Audio Engine".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_plugin_exe_name() {
        assert_eq!(PLUGIN_EXE_NAME, "symvonia-audio-engine.exe");
    }

    #[test]
    fn verify_response_requires_audio_engine_identity() {
        let token = "test_token_123";
        let valid_v2 = format!(r#"{{"event":"verify_response","token":"{token}","engine":"Symvonia Audio Engine","version":"2.0.0"}}"#);
        let valid_v1 = format!(r#"{{"event":"verify_response","token":"{token}","engine":"Symvonia Audio Engine","version":"1.0.0"}}"#);
        let wrong_engine = format!(r#"{{"event":"verify_response","token":"{token}","engine":"Other Engine","version":"2.0.0"}}"#);
        let wrong_token = format!(r#"{{"event":"verify_response","token":"wrong","engine":"Symvonia Audio Engine","version":"2.0.0"}}"#);

        assert!(verify_response_line(&valid_v2, token));
        assert!(verify_response_line(&valid_v1, token));
        assert!(!verify_response_line(&wrong_engine, token));
        assert!(!verify_response_line(&wrong_token, token));
    }

    #[test]
    fn verify_download_hash_accepts_matching_case_insensitive_hash() {
        let temp_dir = std::env::temp_dir();
        let file_path = temp_dir.join("test_hash_matching_unified.tmp");
        fs::write(&file_path, b"test content for hash verification unified").unwrap();

        let real_hash = compute_sha256(&file_path).unwrap();
        assert!(verify_download_hash(&file_path, &real_hash).is_ok());
        assert!(verify_download_hash(&file_path, &real_hash.to_uppercase()).is_ok());

        let _ = fs::remove_file(file_path);
    }

    #[test]
    fn test_fingerprint_cache_invalidation_and_hit() {
        let temp_dir = std::env::temp_dir();
        let file_path = temp_dir.join("test_fp_unified.tmp");
        fs::write(&file_path, b"test content").unwrap();

        let meta = fs::metadata(&file_path).unwrap();
        let size = meta.len();
        let modified = meta.modified().unwrap();

        let fp = FileFingerprint {
            path: file_path.clone(),
            size,
            modified,
        };

        assert_eq!(fp.path, file_path);
        assert_eq!(fp.size, size);
        assert_eq!(fp.modified, modified);

        let _ = fs::remove_file(file_path);
    }

    #[test]
    fn test_verify_real_published_unified_audio_engine_exe() {
        let candidates = [
            PathBuf::from("../plugin/src-engine/publish").join(PLUGIN_EXE_NAME),
            PathBuf::from("plugin/src-engine/publish").join(PLUGIN_EXE_NAME),
        ];

        for path in &candidates {
            if path.exists() {
                assert!(
                    verify_plugin_executable(path).is_ok(),
                    "Failed to verify published unified audio engine binary at {:?}",
                    path
                );
                return;
            }
        }
    }

    #[test]
    fn test_real_binary_get_curve_execution() {
        let candidates = [
            PathBuf::from("../plugin/src-engine/publish").join(PLUGIN_EXE_NAME),
            PathBuf::from("plugin/src-engine/publish").join(PLUGIN_EXE_NAME),
        ];

        for path in &candidates {
            if path.exists() {
                let payload = serde_json::json!({
                    "command": "get_curve",
                    "bandMode": 10,
                    "bands": [0.0, 2.0, 4.0, 2.0, 0.0, -2.0, -4.0, -2.0, 0.0, 2.0],
                    "preamp": 0.0
                });

                let mut command = Command::new(path);
                command
                    .stdout(Stdio::piped())
                    .stdin(Stdio::piped())
                    .stderr(Stdio::null());

                #[cfg(target_os = "windows")]
                command.creation_flags(CREATE_NO_WINDOW);

                let mut child = command.spawn().expect("Failed to spawn unified engine");
                if let Some(mut stdin) = child.stdin.take() {
                    let line = format!("{}\n", payload);
                    let _ = stdin.write_all(line.as_bytes());
                    let _ = stdin.flush();
                }

                if let Some(stdout) = child.stdout.take() {
                    let mut reader = std::io::BufReader::new(stdout);
                    let start = std::time::Instant::now();
                    let mut response_line = String::new();
                    while start.elapsed().as_millis() < 8000 {
                        let mut l = String::new();
                        if reader.read_line(&mut l).unwrap_or(0) > 0 {
                            let trimmed = l.trim();
                            if trimmed.contains(r#""event":"ready""#) {
                                continue;
                            }
                            response_line = trimmed.to_string();
                            break;
                        }
                        std::thread::sleep(std::time::Duration::from_millis(20));
                    }
                    let _ = child.kill();
                    let result: DspCurveResult = serde_json::from_str(&response_line).expect("Failed to parse DspCurveResult");
                    assert_eq!(result.band_mode, 10);
                    assert_eq!(result.curve.len(), 128);
                    assert!(result.suggested_auto_preamp <= 0.0);
                    return;
                }
            }
        }
    }
}
