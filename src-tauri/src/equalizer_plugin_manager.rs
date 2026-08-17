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
    "https://github.com/Eszuri/symvonia/releases/latest/download/symvonia-equalizer.exe";

pub const PLUGIN_EXPECTED_SHA256: &str = match option_env!("SYMVONIA_EQUALIZER_PLUGIN_SHA256") {
    Some(value) => value,
    None => "",
};

pub const PLUGIN_EXE_NAME: &str = "symvonia-equalizer.exe";

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
    pub version: Option<String>,
    pub size: Option<u64>,
}

#[derive(Serialize, Clone)]
struct DownloadProgress {
    downloaded: u64,
    total: u64,
}

pub fn plugin_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app_data_dir: {}", e))?;
    Ok(app_data.join("plugins").join("equalizer"))
}

pub fn plugin_exe_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(plugin_dir(app)?.join(PLUGIN_EXE_NAME))
}

pub fn get_status(app: &AppHandle) -> Result<PluginStatus, String> {
    let exe = plugin_exe_path(app)?;
    if exe.exists() {
        let meta = fs::metadata(&exe).ok();
        let size = meta.as_ref().map(|m| m.len());
        Ok(PluginStatus {
            installed: true,
            path: Some(exe.to_string_lossy().to_string()),
            version: Some("1.0.0".to_string()),
            size,
        })
    } else {
        Ok(PluginStatus {
            installed: false,
            path: None,
            version: None,
            size: None,
        })
    }
}

pub fn compute_sha256(path: &PathBuf) -> Result<String, String> {
    let mut file = fs::File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 8192];
    loop {
        let bytes_read = file
            .read(&mut buffer)
            .map_err(|e| format!("Read error: {}", e))?;
        if bytes_read == 0 {
            break;
        }
        hasher.update(&buffer[..bytes_read]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

fn validate_download_url(url: &str) -> Result<(), String> {
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err("Hanya URL dengan protokol HTTP atau HTTPS yang didukung.".into());
    }
    if url.len() < 10 {
        return Err("Format URL unduhan tidak valid.".into());
    }
    Ok(())
}

fn validate_plugin_file(src: &Path) -> Result<(), String> {
    if !src.exists() {
        return Err("File sumber tidak ditemukan.".into());
    }
    if !src.is_file() {
        return Err("Jalur yang diberikan bukan merupakan berkas reguler.".into());
    }
    let ext = src
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_lowercase();
    if ext != "exe" {
        return Err("Berkas plugin harus berformat .exe".into());
    }
    Ok(())
}

fn validate_manual_import_source(src: &Path) -> Result<(), String> {
    validate_plugin_file(src)?;
    let canonical = src
        .canonicalize()
        .map_err(|e| format!("Gagal memverifikasi path file sumber: {}", e))?;
    if !canonical.exists() {
        return Err("File sumber tidak valid atau tidak dapat diakses.".into());
    }
    Ok(())
}

pub fn download_and_install(app: &AppHandle, custom_url: Option<String>) -> Result<PluginStatus, String> {
    let url_str = custom_url
        .filter(|u| !u.trim().is_empty())
        .unwrap_or_else(default_plugin_download_url);
    validate_download_url(&url_str)?;

    DOWNLOAD_CANCELLED.store(false, Ordering::SeqCst);

    let dir = plugin_dir(app)?;
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create plugin dir: {}", e))?;

    let final_path = dir.join(PLUGIN_EXE_NAME);
    let tmp_path = dir.join(format!("{}.tmp", PLUGIN_EXE_NAME));

    let response = ureq::get(&url_str)
        .call()
        .map_err(|e| format!("Download request failed: {}", e))?;

    let total: u64 = response
        .header("Content-Length")
        .and_then(|l| l.parse().ok())
        .unwrap_or(0);

    let mut reader = response.into_reader();
    let mut file = fs::File::create(&tmp_path)
        .map_err(|e| format!("Failed to create temp file: {}", e))?;

    let mut buffer = [0u8; 16384];
    let mut downloaded: u64 = 0;
    let mut last_emit = std::time::Instant::now();

    loop {
        if DOWNLOAD_CANCELLED.load(Ordering::SeqCst) {
            drop(file);
            let _ = fs::remove_file(&tmp_path);
            let _ = app.emit("equalizer-download-cancelled", ());
            return Err("Download cancelled by user".to_string());
        }

        let bytes_read = reader
            .read(&mut buffer)
            .map_err(|e| format!("Download read error: {}", e))?;
        if bytes_read == 0 {
            break;
        }

        file.write_all(&buffer[..bytes_read])
            .map_err(|e| format!("File write error: {}", e))?;
        downloaded += bytes_read as u64;

        if last_emit.elapsed().as_millis() >= 100 {
            let _ = app.emit(
                "equalizer-download-progress",
                DownloadProgress { downloaded, total },
            );
            last_emit = std::time::Instant::now();
        }
    }

    file.flush().ok();
    drop(file);
    let _ = app.emit(
        "equalizer-download-progress",
        DownloadProgress { downloaded, total },
    );

    if total > 0 && downloaded != total {
        let _ = fs::remove_file(&tmp_path);
        return Err(format!("Incomplete download: got {} of {} bytes", downloaded, total));
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
                && response.engine == "Symvonia Equalizer DSP Engine"
                && response.version == "1.0.0"
        })
        .unwrap_or(false)
}

pub fn verify_plugin_executable(src: &Path) -> Result<(), String> {
    validate_plugin_file(src)?;

    let meta = fs::metadata(src).map_err(|e| format!("Gagal membaca metadata berkas: {}", e))?;
    let len = meta.len();
    if !(500 * 1024..=500 * 1024 * 1024).contains(&len) {
        return Err(format!(
            "Ukuran berkas ({:.2} MB) tidak valid untuk plugin Symvonia Equalizer DSP (harus 0.5 MB - 500 MB).",
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
    let token = format!("symvonia_eq_token_{nonce:x}");
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

    Err("Verifikasi gagal: file bukan plugin Symvonia Equalizer DSP Engine yang valid.".into())
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
    let dir = plugin_dir(app)?;
    if dir.exists() {
        fs::remove_dir_all(&dir).map_err(|e| format!("Failed to remove plugin dir: {}", e))?;
    }
    Ok(())
}

#[derive(Deserialize, Serialize, Clone, Debug)]
pub struct DspCurveResult {
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
        return Err("Plugin Equalizer belum terinstall".into());
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

    let mut child = command.spawn().map_err(|e| format!("Gagal menjalankan Equalizer DSP engine: {}", e))?;

    if let Some(mut stdin) = child.stdin.take() {
        let json_line = format!("{}\n", payload);
        let _ = stdin.write_all(json_line.as_bytes());
        let _ = stdin.flush();
    }

    if let Some(stdout) = child.stdout.take() {
        let mut reader = std::io::BufReader::new(stdout);
        let mut line = String::new();
        let _ = reader.read_line(&mut line);
        let _ = child.kill();

        if let Ok(res) = serde_json::from_str::<DspCurveResult>(&line) {
            return Ok(res);
        }
    } else {
        let _ = child.kill();
    }

    Err("Gagal mendapatkan respon kalkulasi kurva dari DSP engine".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_plugin_exe_name() {
        assert_eq!(PLUGIN_EXE_NAME, "symvonia-equalizer.exe");
    }

    #[test]
    fn verify_response_requires_equalizer_identity() {
        let token = "test_token_123";
        let valid_json = format!(
            r#"{{"event":"verify_response","token":"{}","engine":"Symvonia Equalizer DSP Engine","version":"1.0.0"}}"#,
            token
        );
        assert!(verify_response_line(&valid_json, token));

        let wrong_engine_json = format!(
            r#"{{"event":"verify_response","token":"{}","engine":"Symvonia Audio Engine","version":"1.0.0"}}"#,
            token
        );
        assert!(!verify_response_line(&wrong_engine_json, token));
    }

    #[test]
    fn test_verify_real_published_equalizer_exe() {
        let published_exe = Path::new("../plugin/src-equalizer/publish/symvonia-equalizer.exe");
        if published_exe.exists() {
            let res = verify_plugin_executable(published_exe);
            assert!(res.is_ok(), "Verification failed: {:?}", res.err());
        }
    }
}
