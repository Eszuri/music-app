use tauri::AppHandle;

use crate::ai_lyrics_plugin_manager;
use crate::sidecar;
use crate::sidecar_lyrics;
use crate::sidecar_wallpaper;
use crate::unified_engine_manager;
use crate::wallpaper_plugin_manager;

// ─── Unified Audio Engine Plugin (WASAPI Exclusive, Equalizer DSP, Tag Editor) ───

#[tauri::command]
pub fn get_bit_perfect_plugin_status(app: AppHandle) -> Result<unified_engine_manager::PluginStatus, String> {
    unified_engine_manager::get_status(&app)
}

#[tauri::command]
pub async fn download_bit_perfect_plugin(
    app: AppHandle,
    url: Option<String>,
) -> Result<unified_engine_manager::PluginStatus, String> {
    let app_clone = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        unified_engine_manager::download_and_install(&app_clone, url)
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
}

#[tauri::command]
pub fn cancel_bit_perfect_plugin_download() {
    unified_engine_manager::cancel_download();
}

#[tauri::command]
pub async fn install_bit_perfect_plugin_from_file(
    app: AppHandle,
    path: String,
) -> Result<unified_engine_manager::PluginStatus, String> {
    let app_clone = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        unified_engine_manager::install_from_file(&app_clone, &path)
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
}

#[tauri::command]
pub async fn uninstall_bit_perfect_plugin(app: AppHandle) -> Result<(), String> {
    sidecar::stop_engine()?;
    let app_clone = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        unified_engine_manager::uninstall(&app_clone)?;
        let mut config = crate::commands::config::load_config(&app_clone);
        config.output_mode = "default".to_string();
        config.output_device = None;
        let _ = crate::commands::config::save_config(&app_clone, &config);
        Ok::<(), String>(())
    })
    .await
    .map_err(|e| format!("Task error: {}", e))??;
    Ok(())
}

// ─── Equalizer DSP Bridge ───────────────────────────────────────────────────

#[tauri::command]
pub fn get_equalizer_plugin_status(app: AppHandle) -> Result<unified_engine_manager::PluginStatus, String> {
    unified_engine_manager::get_status(&app)
}

#[tauri::command]
pub async fn download_equalizer_plugin(
    app: AppHandle,
    url: Option<String>,
) -> Result<unified_engine_manager::PluginStatus, String> {
    download_bit_perfect_plugin(app, url).await
}

#[tauri::command]
pub fn cancel_equalizer_plugin_download() {
    unified_engine_manager::cancel_download();
}

#[tauri::command]
pub async fn install_equalizer_plugin_from_file(
    app: AppHandle,
    path: String,
) -> Result<unified_engine_manager::PluginStatus, String> {
    install_bit_perfect_plugin_from_file(app, path).await
}

#[tauri::command]
pub async fn uninstall_equalizer_plugin(app: AppHandle) -> Result<(), String> {
    uninstall_bit_perfect_plugin(app).await
}

#[tauri::command]
pub fn get_dsp_curve(
    app: AppHandle,
    band_mode: i32,
    bands: Vec<f64>,
    preamp: f64,
) -> Result<unified_engine_manager::DspCurveResult, String> {
    unified_engine_manager::get_dsp_curve(&app, band_mode, bands, preamp)
}

// ─── Tag Editor Bridge ──────────────────────────────────────────────────────

#[tauri::command]
pub fn get_tag_editor_plugin_status(app: AppHandle) -> Result<unified_engine_manager::PluginStatus, String> {
    unified_engine_manager::get_status(&app)
}

#[tauri::command]
pub async fn download_tag_editor_plugin(
    app: AppHandle,
    url: Option<String>,
) -> Result<unified_engine_manager::PluginStatus, String> {
    download_bit_perfect_plugin(app, url).await
}

#[tauri::command]
pub fn cancel_tag_editor_plugin_download() {
    unified_engine_manager::cancel_download();
}

#[tauri::command]
pub async fn install_tag_editor_plugin_from_file(
    app: AppHandle,
    path: String,
) -> Result<unified_engine_manager::PluginStatus, String> {
    install_bit_perfect_plugin_from_file(app, path).await
}

#[tauri::command]
pub async fn uninstall_tag_editor_plugin(app: AppHandle) -> Result<(), String> {
    uninstall_bit_perfect_plugin(app).await
}

// ─── AI Lyrics plugin (C# Whisper.net sidecar) ──────────────────────────────

#[tauri::command]
pub fn get_ai_lyrics_plugin_status(app: AppHandle) -> Result<ai_lyrics_plugin_manager::PluginStatus, String> {
    ai_lyrics_plugin_manager::get_status(&app)
}

#[tauri::command]
pub async fn download_ai_lyrics_plugin(
    app: AppHandle,
    url: Option<String>,
) -> Result<ai_lyrics_plugin_manager::PluginStatus, String> {
    let app_clone = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        ai_lyrics_plugin_manager::download_and_install(&app_clone, url)
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
}

#[tauri::command]
pub fn cancel_ai_lyrics_plugin_download() {
    ai_lyrics_plugin_manager::cancel_download();
}

#[tauri::command]
pub async fn install_ai_lyrics_plugin_from_file(
    app: AppHandle,
    path: String,
) -> Result<ai_lyrics_plugin_manager::PluginStatus, String> {
    let app_clone = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        ai_lyrics_plugin_manager::install_from_file(&app_clone, &path)
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
}

#[tauri::command]
pub async fn uninstall_ai_lyrics_plugin(app: AppHandle) -> Result<(), String> {
    sidecar_lyrics::stop_engine();
    let app_clone = app.clone();
    tauri::async_runtime::spawn_blocking(move || ai_lyrics_plugin_manager::uninstall(&app_clone))
        .await
        .map_err(|e| format!("Task error: {}", e))?
}

#[tauri::command]
pub fn get_downloaded_ai_models(app: AppHandle) -> Vec<String> {
    let mut downloaded = Vec::new();
    if let Ok(dir) = ai_lyrics_plugin_manager::plugin_dir(&app) {
        let models_dir = dir.join("models");
        let model_codes = ["vocal", "tiny", "base", "small", "medium", "large-v3-turbo", "large-v3"];
        for code in &model_codes {
            let path = if *code == "vocal" {
                let p1 = models_dir.join("htdemucs_ft_vocals.onnx");
                let p2 = models_dir.join("htdemucs.onnx");
                if p1.exists() { p1 } else { p2 }
            } else {
                models_dir.join(format!("ggml-{}.bin", code))
            };
            if path.exists() {
                if let Ok(meta) = std::fs::metadata(&path) {
                    if meta.len() > 10 * 1024 * 1024 {
                        downloaded.push(code.to_string());
                    }
                }
            }
        }
    }
    downloaded
}

// ─── Wallpaper Engine Plugin (C++20 Direct3D 11 / HLSL Sidecar) ─────────────

#[tauri::command]
pub fn get_wallpaper_plugin_status(app: AppHandle) -> Result<wallpaper_plugin_manager::PluginStatus, String> {
    wallpaper_plugin_manager::get_status(&app)
}

#[tauri::command]
pub async fn download_wallpaper_plugin(
    app: AppHandle,
    url: Option<String>,
) -> Result<wallpaper_plugin_manager::PluginStatus, String> {
    let app_clone = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        wallpaper_plugin_manager::download_and_install(&app_clone, url)
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
}

#[tauri::command]
pub fn cancel_wallpaper_plugin_download() {
    wallpaper_plugin_manager::cancel_download();
}

#[tauri::command]
pub async fn install_wallpaper_plugin_from_file(
    app: AppHandle,
    path: String,
) -> Result<wallpaper_plugin_manager::PluginStatus, String> {
    let app_clone = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        wallpaper_plugin_manager::install_from_file(&app_clone, &path)
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
}

#[tauri::command]
pub async fn uninstall_wallpaper_plugin(app: AppHandle) -> Result<(), String> {
    sidecar_wallpaper::stop_engine();
    let app_clone = app.clone();
    tauri::async_runtime::spawn_blocking(move || wallpaper_plugin_manager::uninstall(&app_clone))
        .await
        .map_err(|e| format!("Task error: {}", e))?
}

