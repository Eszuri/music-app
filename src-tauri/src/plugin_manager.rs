use std::fs;
use std::io::{Read, Write};
use std::path::PathBuf;

use serde::Serialize;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter, Manager};

/// Download URL for the self-contained C# audio engine (GitHub Releases).
pub const PLUGIN_DOWNLOAD_URL: &str =
    "https://github.com/Eszuri/symvonia/releases/latest/download/symvonia-audio-engine.exe";

/// Expected SHA-256 of the downloaded exe. Empty = skip verification
/// (only until the first official release pins a hash).
pub const PLUGIN_EXPECTED_SHA256: &str = "";

pub const PLUGIN_EXE_NAME: &str = "symvonia-audio-engine.exe";

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
    let url = url.unwrap_or_else(|| PLUGIN_DOWNLOAD_URL.to_string());
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
        let n = reader
            .read(&mut buf)
            .map_err(|e| format!("Download stream error: {}", e))?;
        if n == 0 {
            break;
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

    // Hash verification (mandatory once a hash is pinned).
    if !PLUGIN_EXPECTED_SHA256.is_empty() {
        let actual = compute_sha256(&tmp_path)?;
        if !actual.eq_ignore_ascii_case(PLUGIN_EXPECTED_SHA256) {
            let _ = fs::remove_file(&tmp_path);
            return Err(format!(
                "Hash mismatch. Expected {}, got {}. The file may be corrupted or tampered with.",
                PLUGIN_EXPECTED_SHA256, actual
            ));
        }
    }

    fs::rename(&tmp_path, &final_path)
        .map_err(|e| format!("Failed to move plugin into place: {}", e))?;

    get_status(app)
}

/// Installs the plugin from a local exe file (used for development/testing
/// and for users who prefer sideloading over downloading).
pub fn install_from_file(app: &AppHandle, source: &str) -> Result<PluginStatus, String> {
    let src = PathBuf::from(source);
    if !src.exists() {
        return Err(format!("Source file not found: {}", source));
    }
    let dir = plugin_dir(app)?;
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create plugin dir: {}", e))?;
    let dest = dir.join(PLUGIN_EXE_NAME);
    fs::copy(&src, &dest).map_err(|e| format!("Failed to copy plugin exe: {}", e))?;
    get_status(app)
}

pub fn uninstall(app: &AppHandle) -> Result<(), String> {
    let exe = plugin_exe_path(app)?;
    if exe.exists() {
        fs::remove_file(&exe).map_err(|e| format!("Failed to remove plugin: {}", e))?;
    }
    Ok(())
}
