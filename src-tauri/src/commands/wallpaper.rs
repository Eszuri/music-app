use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

#[cfg(windows)]
use std::ffi::OsStr;
#[cfg(windows)]
use std::os::windows::ffi::OsStrExt;

#[cfg(windows)]
#[link(name = "user32")]
extern "system" {
    fn SystemParametersInfoW(
        uiAction: u32,
        uiParam: u32,
        pvParam: *const u16,
        fWinIni: u32,
    ) -> i32;
}

pub static RESET_ON_CLOSE: AtomicBool = AtomicBool::new(true);
pub static DEFAULT_WALLPAPER_PATH: Mutex<Option<String>> = Mutex::new(None);

#[tauri::command]
pub fn set_reset_on_close(enabled: bool) {
    RESET_ON_CLOSE.store(enabled, Ordering::SeqCst);
}

#[tauri::command]
pub async fn pick_wallpaper() -> Result<Option<String>, String> {
    let file = rfd::AsyncFileDialog::new()
        .set_title("Pilih gambar wallpaper default")
        .add_filter("Images", &["png", "jpg", "jpeg", "bmp", "webp"])
        .pick_file()
        .await;
    Ok(file.map(|f| f.path().to_string_lossy().to_string()))
}

#[tauri::command]
pub fn set_default_wallpaper_path(path: Option<String>) -> Result<(), String> {
    let mut guard = DEFAULT_WALLPAPER_PATH.lock().map_err(|e| e.to_string())?;
    *guard = path;
    Ok(())
}

#[tauri::command]
pub fn get_default_wallpaper_path() -> Result<Option<String>, String> {
    let guard = DEFAULT_WALLPAPER_PATH.lock().map_err(|e| e.to_string())?;
    Ok(guard.clone())
}

#[cfg(windows)]
pub fn apply_wallpaper(bmp_path: &Path) -> Result<(), String> {
    let path_wide: Vec<u16> = OsStr::new(&bmp_path.to_string_lossy().as_ref())
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    const SPI_SETDESKWALLPAPER: u32 = 0x0014;
    const SPIF_UPDATEINIFILE: u32 = 0x01;

    let result = unsafe {
        SystemParametersInfoW(
            SPI_SETDESKWALLPAPER,
            0,
            path_wide.as_ptr(),
            SPIF_UPDATEINIFILE,
        )
    };

    if result != 0 { Ok(()) } else { Err("Failed to set wallpaper".into()) }
}

#[cfg(not(windows))]
pub fn apply_wallpaper(_bmp_path: &Path) -> Result<(), String> {
    Ok(())
}

pub fn clear_wallpaper_internal() -> Result<(), String> {
    let guard = DEFAULT_WALLPAPER_PATH.lock().map_err(|e| e.to_string())?;
    if let Some(img_path) = guard.as_ref() {
        let path = Path::new(img_path);
        if !path.exists() {
            return Err("Default wallpaper file not found".to_string());
        }
        let img = image::open(path).map_err(|e| format!("Failed to open image: {}", e))?;
        let temp_dir = std::env::temp_dir();
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0);
        let bmp_path = temp_dir.join(format!("mw-def-{}.bmp", timestamp));

        img.save_with_format(&bmp_path, image::ImageFormat::Bmp)
            .map_err(|e| format!("Failed to save BMP: {}", e))?;

        let res = apply_wallpaper(&bmp_path);

        if let Ok(entries) = std::fs::read_dir(&temp_dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if let Some(name) = p.file_name().and_then(|n| n.to_str()) {
                    if (name.starts_with("mw-def-") || name == "mw-def.bmp") && name.ends_with(".bmp") && p != bmp_path {
                        let _ = std::fs::remove_file(p);
                    }
                }
            }
        }

        res
    } else {
        Ok(())
    }
}

#[tauri::command]
pub async fn clear_wallpaper() -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        clear_wallpaper_internal()
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
}

#[tauri::command]
pub async fn set_wallpaper(cover_b64: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        use base64::Engine;
        let engine = base64::engine::general_purpose::STANDARD;
        let data = engine.decode(&cover_b64).map_err(|e| format!("Base64 decode error: {}", e))?;

        let img = image::load_from_memory(&data)
            .map_err(|e| format!("Failed to decode image: {}", e))?;

        let temp_dir = std::env::temp_dir();
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0);
        let bmp_path = temp_dir.join(format!("mw-cover-{}.bmp", timestamp));

        img.save_with_format(&bmp_path, image::ImageFormat::Bmp)
            .map_err(|e| format!("Gagal save BMP: {}", e))?;

        let res = apply_wallpaper(&bmp_path);

        if let Ok(entries) = std::fs::read_dir(&temp_dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if let Some(name) = p.file_name().and_then(|n| n.to_str()) {
                    if (name.starts_with("mw-cover-") || name == "mw-cover.bmp") && name.ends_with(".bmp") && p != bmp_path {
                        let _ = std::fs::remove_file(p);
                    }
                }
            }
        }

        res
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
}
