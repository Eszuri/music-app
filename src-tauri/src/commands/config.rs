use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct EqualizerConfig {
    pub enabled: bool,
    pub preset: String,
    pub bands: Vec<f64>,
    pub pre_amp: f64,
}

impl Default for EqualizerConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            preset: "flat".to_string(),
            bands: vec![0.0; 10],
            pre_amp: 0.0,
        }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct SessionConfig {
    pub file_path: String,
    pub current_time: f64,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct StreamEntryConfig {
    pub id: String,
    pub title: String,
    pub url: String,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct SymvoniaConfig {
    pub music_folder: Option<String>,
    pub language: String,
    pub accent_color: String,
    pub custom_accent_hex: String,
    pub layout_mode: String,
    pub auto_wallpaper: bool,
    pub reset_on_close: bool,
    pub default_wallpaper: Option<String>,
    pub volume_mode: String,
    pub app_volume: f64,
    pub volume_step: u32,
    pub volume_limit: u32,
    pub pause_if_muted: bool,
    pub fade_audio: bool,
    pub fade_duration: u32,
    pub folder_sort: String,
    pub file_sort: String,
    pub sort_dir: String,
    pub name_source: String,
    pub formats: Vec<String>,
    pub shuffle: bool,
    pub repeat: String,
    pub shortcuts: HashMap<String, String>,
    pub sidebar_width: u32,
    pub meta_width: u32,
    pub autohide_delay_ms: u32,
    pub output_mode: String,
    pub output_device: Option<String>,
    pub equalizer: EqualizerConfig,
    pub gain_boost: f64,
    pub ai_lyrics_model: String,
    pub ai_isolate_vocals: bool,
    pub active_metadata_tab: String,
    pub last_session: Option<SessionConfig>,
    pub stream_history: Vec<StreamEntryConfig>,
    pub fullscreen: bool,
    pub skipped_update_version: Option<String>,
}

impl Default for SymvoniaConfig {
    fn default() -> Self {
        let mut shortcuts = HashMap::new();
        shortcuts.insert("playPause".to_string(), " ".to_string());
        shortcuts.insert("next".to_string(), "n".to_string());
        shortcuts.insert("prev".to_string(), "p".to_string());
        shortcuts.insert("volumeUp".to_string(), "ArrowRight".to_string());
        shortcuts.insert("volumeDown".to_string(), "ArrowLeft".to_string());

        Self {
            music_folder: None,
            language: "en".to_string(),
            accent_color: "sky".to_string(),
            custom_accent_hex: "#0284c7".to_string(),
            layout_mode: "default".to_string(),
            auto_wallpaper: true,
            reset_on_close: true,
            default_wallpaper: None,
            volume_mode: "app".to_string(),
            app_volume: 1.0,
            volume_step: 2,
            volume_limit: 0,
            pause_if_muted: true,
            fade_audio: true,
            fade_duration: 500,
            folder_sort: "name".to_string(),
            file_sort: "name".to_string(),
            sort_dir: "asc".to_string(),
            name_source: "filename".to_string(),
            formats: vec![
                "mp3".to_string(),
                "flac".to_string(),
                "ogg".to_string(),
                "wav".to_string(),
                "m4a".to_string(),
                "wma".to_string(),
            ],
            shuffle: false,
            repeat: "off".to_string(),
            shortcuts,
            sidebar_width: 360,
            meta_width: 360,
            autohide_delay_ms: 3000,
            output_mode: "default".to_string(),
            output_device: None,
            equalizer: EqualizerConfig::default(),
            gain_boost: 1.0,
            ai_lyrics_model: "base".to_string(),
            ai_isolate_vocals: false,
            active_metadata_tab: "info".to_string(),
            last_session: None,
            stream_history: Vec::new(),
            fullscreen: false,
            skipped_update_version: None,
        }
    }
}

impl SymvoniaConfig {
    /// Sanitize and clamp all configuration values to valid safe boundaries
    pub fn sanitize(&mut self) {
        // App volume clamping: 0.0 to 1.0
        self.app_volume = self.app_volume.clamp(0.0, 1.0);

        // Volume step clamping: 1 to 10
        self.volume_step = self.volume_step.clamp(1, 10);

        // Volume limit: 0 to 100
        self.volume_limit = self.volume_limit.clamp(0, 100);

        // Language validation: only 'id' or 'en'
        if self.language != "id" && self.language != "en" {
            self.language = "en".to_string();
        }

        // Layout mode validation: 'default' or 'spotify'
        if self.layout_mode != "default" && self.layout_mode != "spotify" {
            self.layout_mode = "default".to_string();
        }

        // Volume mode: 'app' or 'system'
        if self.volume_mode != "app" && self.volume_mode != "system" {
            self.volume_mode = "app".to_string();
        }

        // Custom accent hex validation
        if !self.custom_accent_hex.starts_with('#') || self.custom_accent_hex.len() != 7 {
            self.custom_accent_hex = "#0284c7".to_string();
        }

        // Fade duration clamping: 50ms to 5000ms
        self.fade_duration = self.fade_duration.clamp(50, 5000);

        // Sort dir validation
        if self.sort_dir != "asc" && self.sort_dir != "desc" {
            self.sort_dir = "asc".to_string();
        }

        // Repeat mode validation
        if self.repeat != "off" && self.repeat != "all" && self.repeat != "one" {
            self.repeat = "off".to_string();
        }

        // Ensure default shortcuts exist
        let defaults = SymvoniaConfig::default().shortcuts;
        for (k, v) in defaults {
            self.shortcuts.entry(k).or_insert(v);
        }

        // Ensure default formats exist if empty
        if self.formats.is_empty() {
            self.formats = SymvoniaConfig::default().formats;
        }

        // Equalizer bands validation supports the frontend's 5/10/15/31 band modes.
        if !matches!(self.equalizer.bands.len(), 5 | 10 | 15 | 31) {
            self.equalizer.bands = vec![0.0; 10];
        }
        for band in &mut self.equalizer.bands {
            *band = band.clamp(-12.0, 12.0);
        }
        self.equalizer.pre_amp = self.equalizer.pre_amp.clamp(-12.0, 12.0);

        // Gain boost is a linear ratio: 100% to 300%.
        self.gain_boost = self.gain_boost.clamp(1.0, 3.0);
    }
}

/// Get the configuration file path in AppData directory
pub fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app_data_dir: {}", e))?;
    if !dir.exists() {
        let _ = fs::create_dir_all(&dir);
    }
    Ok(dir.join("config.json"))
}

/// Load configuration with self-healing recovery and auto-backup
pub fn load_config(app: &AppHandle) -> SymvoniaConfig {
    let path = match config_path(app) {
        Ok(p) => p,
        Err(_) => return SymvoniaConfig::default(),
    };

    if !path.exists() {
        let default_config = SymvoniaConfig::default();
        let _ = save_config(app, &default_config);
        return default_config;
    }

    match fs::read_to_string(&path) {
        Ok(content) => match serde_json::from_str::<SymvoniaConfig>(&content) {
            Ok(mut config) => {
                config.sanitize();
                config
            }
            Err(err) => {
                eprintln!(
                    "[Symvonia Config] Warning: Failed to parse config.json: {}. Creating backup...",
                    err
                );
                // Create backup of corrupted file
                let timestamp = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_secs())
                    .unwrap_or(0);
                if let Some(parent) = path.parent() {
                    let backup_path = parent.join(format!("config.json.corrupted.{}.bak", timestamp));
                    let _ = fs::copy(&path, backup_path);
                }

                // Create fresh valid config and save
                let default_config = SymvoniaConfig::default();
                let _ = save_config(app, &default_config);
                default_config
            }
        },
        Err(e) => {
            eprintln!("[Symvonia Config] Warning: Failed to read config.json: {}", e);
            SymvoniaConfig::default()
        }
    }
}

/// Atomically save configuration to disk
pub fn save_config(app: &AppHandle, config: &SymvoniaConfig) -> Result<(), String> {
    let path = config_path(app)?;
    let temp_path = path.with_extension("json.tmp");

    let mut sanitized = config.clone();
    sanitized.sanitize();

    let json_bytes = serde_json::to_vec_pretty(&sanitized)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    fs::write(&temp_path, json_bytes)
        .map_err(|e| format!("Failed to write temp config file: {}", e))?;

    fs::rename(&temp_path, &path)
        .map_err(|e| format!("Failed to atomically replace config file: {}", e))?;

    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageUsage {
    pub config_bytes: u64,
    pub plugins_bytes: u64,
    pub models_bytes: u64,
    pub total_bytes: u64,
    pub config_path: String,
    pub app_data_dir: String,
}

fn calculate_dir_size(path: &Path) -> u64 {
    if !path.exists() {
        return 0;
    }
    if path.is_file() {
        return fs::metadata(path).map(|m| m.len()).unwrap_or(0);
    }
    let mut total = 0;
    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_dir() {
                total += calculate_dir_size(&p);
            } else if let Ok(m) = entry.metadata() {
                total += m.len();
            }
        }
    }
    total
}

// =========================================================================
// Tauri IPC Command Handlers
// =========================================================================

#[tauri::command]
pub fn get_app_config(app: AppHandle) -> Result<SymvoniaConfig, String> {
    Ok(load_config(&app))
}

#[tauri::command]
pub fn save_app_config(app: AppHandle, config: SymvoniaConfig) -> Result<(), String> {
    save_config(&app, &config)
}

#[tauri::command]
pub fn set_app_config_key(
    app: AppHandle,
    key: String,
    value: serde_json::Value,
) -> Result<(), String> {
    let mut config = load_config(&app);
    let mut config_val = serde_json::to_value(&config)
        .map_err(|e| format!("Failed to serialize current config: {}", e))?;

    if let serde_json::Value::Object(ref mut map) = config_val {
        map.insert(key, value);
        if let Ok(updated) = serde_json::from_value::<SymvoniaConfig>(config_val) {
            config = updated;
        }
    }

    save_config(&app, &config)
}

#[tauri::command]
pub fn reset_app_config(app: AppHandle) -> Result<SymvoniaConfig, String> {
    let default_config = SymvoniaConfig::default();
    save_config(&app, &default_config)?;
    Ok(default_config)
}

#[tauri::command]
pub fn open_config_folder(app: AppHandle) -> Result<(), String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app_data_dir: {}", e))?;
    if !dir.exists() {
        let _ = fs::create_dir_all(&dir);
    }
    #[cfg(windows)]
    {
        let _ = std::process::Command::new("explorer")
            .arg(dir.to_string_lossy().to_string())
            .spawn();
    }
    Ok(())
}

#[tauri::command]
pub fn get_storage_usage(app: AppHandle) -> Result<StorageUsage, String> {
    let base_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app_data_dir: {}", e))?;
    let config_p = base_dir.join("config.json");
    let plugins_dir = base_dir.join("plugins");
    let models_dir = plugins_dir.join("ai-lyrics").join("models");

    let config_bytes = if config_p.exists() {
        fs::metadata(&config_p).map(|m| m.len()).unwrap_or(0)
    } else {
        0
    };
    let models_bytes = calculate_dir_size(&models_dir);
    let plugins_bytes = calculate_dir_size(&plugins_dir).saturating_sub(models_bytes);
    let total_bytes = calculate_dir_size(&base_dir);

    Ok(StorageUsage {
        config_bytes,
        plugins_bytes,
        models_bytes,
        total_bytes,
        config_path: config_p.to_string_lossy().to_string(),
        app_data_dir: base_dir.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn clean_ai_models_data(app: AppHandle) -> Result<(), String> {
    let base_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app_data_dir: {}", e))?;
    let models_dir = base_dir.join("plugins").join("ai-lyrics").join("models");
    if models_dir.exists() {
        fs::remove_dir_all(&models_dir).map_err(|e| format!("Failed to delete models: {}", e))?;
    }
    let _ = app.emit("ai-lyrics-models-changed", ());
    Ok(())
}

#[tauri::command]
pub fn clean_all_app_data(app: AppHandle) -> Result<(), String> {
    let base_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app_data_dir: {}", e))?;
    if base_dir.exists() {
        // Remove contents
        if let Ok(entries) = fs::read_dir(&base_dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_dir() {
                    let _ = fs::remove_dir_all(p);
                } else {
                    let _ = fs::remove_file(p);
                }
            }
        }
    }
    // Re-initialize default config
    let default_config = SymvoniaConfig::default();
    let _ = save_config(&app, &default_config);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_preserves_supported_equalizer_band_modes() {
        for count in [5, 10, 15, 31] {
            let mut config = SymvoniaConfig::default();
            config.equalizer.bands = vec![20.0; count];
            config.sanitize();
            assert_eq!(config.equalizer.bands.len(), count);
            assert!(config.equalizer.bands.iter().all(|band| *band == 12.0));
        }
    }

    #[test]
    fn sanitize_resets_invalid_equalizer_band_mode() {
        let mut config = SymvoniaConfig::default();
        config.equalizer.bands = vec![1.0; 7];
        config.sanitize();
        assert_eq!(config.equalizer.bands, vec![0.0; 10]);
    }

    #[test]
    fn sanitize_clamps_gain_boost_ratio() {
        let mut low_config = SymvoniaConfig {
            gain_boost: 0.0,
            ..Default::default()
        };
        low_config.sanitize();
        assert_eq!(low_config.gain_boost, 1.0);

        let mut high_config = SymvoniaConfig {
            gain_boost: 4.0,
            ..Default::default()
        };
        high_config.sanitize();
        assert_eq!(high_config.gain_boost, 3.0);
    }
}
