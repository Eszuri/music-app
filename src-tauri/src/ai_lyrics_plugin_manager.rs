use std::fs;
use std::io::{BufRead, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use serde::Serialize;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter, Manager};

static DOWNLOAD_CANCELLED: AtomicBool = AtomicBool::new(false);

pub fn cancel_download() {
    DOWNLOAD_CANCELLED.store(true, Ordering::SeqCst);
}

pub const PLUGIN_DOWNLOAD_URL: &str =
    "https://github.com/Eszuri/symvonia/releases/latest/download/symvonia-ai-lyrics.exe";

pub const PLUGIN_EXPECTED_SHA256: &str = "";

pub const PLUGIN_EXE_NAME: &str = "symvonia-ai-lyrics.exe";

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

/// Directory where the AI lyrics plugin exe lives: <app_data>/plugins/ai-lyrics/
pub fn plugin_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {}", e))?;
    Ok(base.join("plugins").join("ai-lyrics"))
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
    let url = url.unwrap_or_else(|| PLUGIN_DOWNLOAD_URL.to_string());
    let dir = plugin_dir(app)?;
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create plugin dir: {}", e))?;

    let tmp_path = dir.join(format!("{}.download", PLUGIN_EXE_NAME));
    let final_path = dir.join(PLUGIN_EXE_NAME);

    let response = match ureq::get(&url).call() {
        Ok(res) => res,
        Err(e) => {
            let candidate_paths = [
                PathBuf::from("plugin/src-ai-lyrics/publish/symvonia-ai-lyrics.exe"),
                PathBuf::from("../plugin/src-ai-lyrics/publish/symvonia-ai-lyrics.exe"),
                PathBuf::from("../../plugin/src-ai-lyrics/publish/symvonia-ai-lyrics.exe"),
            ];
            for candidate in &candidate_paths {
                if candidate.exists() {
                    if let Ok(status) = install_from_file(app, &candidate.to_string_lossy()) {
                        return Ok(status);
                    }
                }
            }
            return Err(format!("Download failed: {}", e));
        }
    };

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
                "ai-lyrics-download-progress",
                DownloadProgress { downloaded: 0, total: 0 },
            );
            return Err("Pengunduhan plugin AI Lirik dibatalkan oleh pengguna.".into());
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
                "ai-lyrics-download-progress",
                DownloadProgress { downloaded: 0, total: 0 },
            );
            return Err("Pengunduhan plugin AI Lirik dibatalkan oleh pengguna.".into());
        }

        file.write_all(&buf[..n])
            .map_err(|e| format!("Failed to write temp file: {}", e))?;
        downloaded += n as u64;
        if last_emit.elapsed().as_millis() >= 100 {
            last_emit = std::time::Instant::now();
            let _ = app.emit(
                "ai-lyrics-download-progress",
                DownloadProgress { downloaded, total },
            );
        }
    }

    if DOWNLOAD_CANCELLED.load(Ordering::SeqCst) {
        drop(file);
        let _ = fs::remove_file(&tmp_path);
        return Err("Pengunduhan plugin AI Lirik dibatalkan oleh pengguna.".into());
    }

    file.flush().ok();
    drop(file);
    let _ = app.emit(
        "ai-lyrics-download-progress",
        DownloadProgress { downloaded, total },
    );

    if total > 0 && downloaded != total {
        let _ = fs::remove_file(&tmp_path);
        return Err(format!(
            "Incomplete download: got {} of {} bytes",
            downloaded, total
        ));
    }

    if !PLUGIN_EXPECTED_SHA256.is_empty() {
        let actual = compute_sha256(&tmp_path)?;
        if !actual.eq_ignore_ascii_case(PLUGIN_EXPECTED_SHA256) {
            let _ = fs::remove_file(&tmp_path);
            return Err(format!(
                "Hash mismatch. Expected {}, got {}.",
                PLUGIN_EXPECTED_SHA256, actual
            ));
        }
    }

    fs::rename(&tmp_path, &final_path)
        .map_err(|e| format!("Failed to move plugin into place: {}", e))?;

    get_status(app)
}

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

pub fn verify_plugin_executable(src: &Path) -> Result<(), String> {
    if !src.exists() {
        return Err(format!("Berkas tidak ditemukan: {}", src.display()));
    }

    let meta = fs::metadata(src).map_err(|e| format!("Gagal membaca metadata berkas: {}", e))?;
    let len = meta.len();
    if !(500 * 1024..=500 * 1024 * 1024).contains(&len) {
        return Err(format!(
            "Ukuran berkas ({:.2} MB) tidak valid untuk plugin Symvonia AI Lyrics Engine.",
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
    if pe_offset + 4 <= n && &header[pe_offset..pe_offset + 4] != b"PE\0\0" {
        return Err("Berkas bukan merupakan PE Executable Windows yang valid (Missing PE signature).".into());
    }

    let nonce: u64 = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos() as u64)
        .unwrap_or(123456789);
    let token = format!("symvonia_ai_token_{:x}", nonce);

    let mut cmd = Command::new(src);
    cmd.arg("--verify").arg(&token);
    cmd.stdout(Stdio::piped()).stderr(Stdio::null()).stdin(Stdio::null());

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    if let Ok(mut child) = cmd.spawn() {
        if let Some(stdout) = child.stdout.take() {
            let mut reader = std::io::BufReader::new(stdout);
            let mut line = String::new();

            let start = std::time::Instant::now();
            let mut read_success = false;

            while start.elapsed().as_millis() < 2500 {
                if reader.read_line(&mut line).unwrap_or(0) > 0 {
                    read_success = true;
                    break;
                }
                std::thread::sleep(std::time::Duration::from_millis(50));
            }
            let _ = child.kill();

            if read_success && (line.contains(&token) || line.contains("verify_response") || line.contains("AI Lyrics")) {
                return Ok(());
            }
        } else {
            let _ = child.kill();
        }
    }

    Err("Verifikasi Gagal: Berkas yang dipilih bukan merupakan plugin Symvonia AI Lyrics Engine yang valid.".into())
}

fn copy_dir_all(src: impl AsRef<Path>, dst: impl AsRef<Path>) -> std::io::Result<()> {
    fs::create_dir_all(&dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        if ty.is_dir() {
            copy_dir_all(entry.path(), dst.as_ref().join(entry.file_name()))?;
        } else {
            fs::copy(entry.path(), dst.as_ref().join(entry.file_name()))?;
        }
    }
    Ok(())
}

fn kill_existing_plugin_process() {
    crate::sidecar_lyrics::stop_engine();
    #[cfg(target_os = "windows")]
    {
        let _ = Command::new("taskkill")
            .args(["/F", "/IM", "symvonia-ai-lyrics.exe", "/T"])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
}

pub fn install_from_file(app: &AppHandle, source: &str) -> Result<PluginStatus, String> {
    let src = PathBuf::from(source);
    verify_plugin_executable(&src)?;

    kill_existing_plugin_process();

    let dir = plugin_dir(app)?;
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create plugin dir: {}", e))?;
    let dest = dir.join(PLUGIN_EXE_NAME);
    fs::copy(&src, &dest).map_err(|e| format!("Failed to copy plugin exe: {}", e))?;

    if let Some(parent) = src.parent() {
        let runtimes_src = parent.join("runtimes");
        if runtimes_src.exists() && runtimes_src.is_dir() {
            let runtimes_dst = dir.join("runtimes");
            let _ = copy_dir_all(&runtimes_src, &runtimes_dst);
        }
        let win_x64_dst = dir.join("runtimes").join("win-x64");
        let _ = fs::create_dir_all(&win_x64_dst);

        if let Ok(entries) = fs::read_dir(parent) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    if let Some(ext) = path.extension() {
                        if ext.to_string_lossy().eq_ignore_ascii_case("dll") {
                            let filename = entry.file_name();
                            let dst_root = dir.join(&filename);
                            let dst_win_x64 = win_x64_dst.join(&filename);
                            let _ = fs::copy(&path, &dst_root);
                            let _ = fs::copy(&path, &dst_win_x64);
                        }
                    }
                }
            }
        }
    }

    get_status(app)
}

pub fn uninstall(app: &AppHandle) -> Result<(), String> {
    kill_existing_plugin_process();
    let exe = plugin_exe_path(app)?;
    if exe.exists() {
        fs::remove_file(&exe).map_err(|e| format!("Failed to remove plugin: {}", e))?;
    }
    let runtimes_dir = plugin_dir(app)?.join("runtimes");
    if runtimes_dir.exists() {
        let _ = fs::remove_dir_all(&runtimes_dir);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn test_plugin_exe_name() {
        assert_eq!(PLUGIN_EXE_NAME, "symvonia-ai-lyrics.exe");
    }

    #[test]
    fn test_verify_nonexistent_file() {
        let non_existent = Path::new("non_existent_symvonia_file.exe");
        let result = verify_plugin_executable(non_existent);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("tidak ditemukan"));
    }

    #[test]
    fn test_verify_invalid_file_size() {
        let temp_dir = std::env::temp_dir();
        let temp_file = temp_dir.join("test_small_plugin.exe");
        let mut file = fs::File::create(&temp_file).unwrap();
        file.write_all(b"MZ short").unwrap();
        drop(file);

        let result = verify_plugin_executable(&temp_file);
        let _ = fs::remove_file(&temp_file);

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Ukuran berkas"));
    }

    #[test]
    fn test_sha256_computation() {
        let temp_dir = std::env::temp_dir();
        let temp_file = temp_dir.join("test_sha_plugin.tmp");
        let mut file = fs::File::create(&temp_file).unwrap();
        file.write_all(b"Symvonia AI Lyrics Unit Test").unwrap();
        drop(file);

        let sha = compute_sha256(&temp_file).unwrap();
        let _ = fs::remove_file(&temp_file);

        assert_eq!(sha.len(), 64);
    }
}
