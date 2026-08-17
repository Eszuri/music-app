use tauri::AppHandle;

use crate::ai_lyrics_plugin_manager;
use crate::plugin_manager;
use crate::sidecar;
use crate::sidecar_lyrics;

// ─── Bit-Perfect plugin (C# sidecar engine) ─────────────────────────────────

#[tauri::command]
pub fn get_bit_perfect_plugin_status(app: AppHandle) -> Result<plugin_manager::PluginStatus, String> {
    plugin_manager::get_status(&app)
}

#[tauri::command]
pub async fn download_bit_perfect_plugin(
    app: AppHandle,
    url: Option<String>,
) -> Result<plugin_manager::PluginStatus, String> {
    let app_clone = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        plugin_manager::download_and_install(&app_clone, url)
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
}

#[tauri::command]
pub fn cancel_bit_perfect_plugin_download() {
    plugin_manager::cancel_download();
}

#[tauri::command]
pub async fn install_bit_perfect_plugin_from_file(
    app: AppHandle,
    path: String,
) -> Result<plugin_manager::PluginStatus, String> {
    let app_clone = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        plugin_manager::install_from_file(&app_clone, &path)
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
}

#[tauri::command]
pub async fn uninstall_bit_perfect_plugin(app: AppHandle) -> Result<(), String> {
    sidecar::stop_engine()?;
    let app_clone = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        plugin_manager::uninstall(&app_clone)?;
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

// ─── Equalizer DSP plugin ───────────────────────────────────────────────────

#[tauri::command]
pub fn get_equalizer_plugin_status(app: AppHandle) -> Result<crate::equalizer_plugin_manager::PluginStatus, String> {
    crate::equalizer_plugin_manager::get_status(&app)
}

#[tauri::command]
pub async fn download_equalizer_plugin(
    app: AppHandle,
    url: Option<String>,
) -> Result<crate::equalizer_plugin_manager::PluginStatus, String> {
    let app_clone = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        crate::equalizer_plugin_manager::download_and_install(&app_clone, url)
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
}

#[tauri::command]
pub fn cancel_equalizer_plugin_download() {
    crate::equalizer_plugin_manager::cancel_download();
}

#[tauri::command]
pub async fn install_equalizer_plugin_from_file(
    app: AppHandle,
    path: String,
) -> Result<crate::equalizer_plugin_manager::PluginStatus, String> {
    let app_clone = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        crate::equalizer_plugin_manager::install_from_file(&app_clone, &path)
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
}

#[tauri::command]
pub async fn uninstall_equalizer_plugin(app: AppHandle) -> Result<(), String> {
    let app_clone = app.clone();
    tauri::async_runtime::spawn_blocking(move || crate::equalizer_plugin_manager::uninstall(&app_clone))
        .await
        .map_err(|e| format!("Task error: {}", e))?
}

#[tauri::command]
pub fn get_dsp_curve(
    app: AppHandle,
    band_mode: i32,
    bands: Vec<f64>,
    preamp: f64,
) -> Result<crate::equalizer_plugin_manager::DspCurveResult, String> {
    crate::equalizer_plugin_manager::get_dsp_curve(&app, band_mode, bands, preamp)
}

// ─── Tag Editor plugin ──────────────────────────────────────────────────────

#[tauri::command]
pub fn get_tag_editor_plugin_status(app: AppHandle) -> Result<crate::tag_editor_plugin_manager::PluginStatus, String> {
    crate::tag_editor_plugin_manager::get_status(&app)
}

#[tauri::command]
pub async fn download_tag_editor_plugin(
    app: AppHandle,
    url: Option<String>,
) -> Result<crate::tag_editor_plugin_manager::PluginStatus, String> {
    let app_clone = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        crate::tag_editor_plugin_manager::download_and_install(&app_clone, url)
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
}

#[tauri::command]
pub fn cancel_tag_editor_plugin_download() {
    crate::tag_editor_plugin_manager::cancel_download();
}

#[tauri::command]
pub async fn install_tag_editor_plugin_from_file(
    app: AppHandle,
    path: String,
) -> Result<crate::tag_editor_plugin_manager::PluginStatus, String> {
    let app_clone = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        crate::tag_editor_plugin_manager::install_from_file(&app_clone, &path)
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
}

#[tauri::command]
pub async fn uninstall_tag_editor_plugin(app: AppHandle) -> Result<(), String> {
    let app_clone = app.clone();
    tauri::async_runtime::spawn_blocking(move || crate::tag_editor_plugin_manager::uninstall(&app_clone))
        .await
        .map_err(|e| format!("Task error: {}", e))?
}

