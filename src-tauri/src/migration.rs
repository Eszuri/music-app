use std::fs;
use tauri::{AppHandle, Manager};

/// Runs once on Tauri startup to cleanly migrate existing plugin installations
/// from legacy folders (bit-perfect, equalizer, tag-editor) into the unified
/// `plugins/engine/` directory.
pub fn migrate_legacy_plugins(app: &AppHandle) -> Result<(), String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {}", e))?;

    let plugins_dir = base.join("plugins");
    if !plugins_dir.exists() {
        return Ok(());
    }

    let old_audio_dir = plugins_dir.join("bit-perfect");
    let old_audio_exe = old_audio_dir.join("symvonia-audio-engine.exe");
    let old_eq_dir = plugins_dir.join("equalizer");
    let old_eq_exe = old_eq_dir.join("symvonia-equalizer.exe");
    let old_tags_dir = plugins_dir.join("tag-editor");
    let old_tags_exe = old_tags_dir.join("symvonia-tag-editor.exe");

    let new_engine_dir = plugins_dir.join("engine");
    let new_engine_exe = new_engine_dir.join("symvonia-audio-engine.exe");

    // If new unified engine does not exist yet, but legacy audio engine exists, auto-migrate it
    if !new_engine_exe.exists() && old_audio_exe.exists() {
        let _ = fs::create_dir_all(&new_engine_dir);
        if fs::rename(&old_audio_exe, &new_engine_exe).is_err() {
            let _ = fs::copy(&old_audio_exe, &new_engine_exe);
            let _ = fs::remove_file(&old_audio_exe);
        }
        eprintln!("[migration] Auto-migrated audio engine to {:?}", new_engine_exe);
    }

    // Clean up obsolete equalizer & tag-editor standalone binaries
    if old_eq_exe.exists() {
        let _ = fs::remove_file(&old_eq_exe);
    }
    if old_eq_dir.exists() {
        let _ = fs::remove_dir_all(&old_eq_dir);
    }

    if old_tags_exe.exists() {
        let _ = fs::remove_file(&old_tags_exe);
    }
    if old_tags_dir.exists() {
        let _ = fs::remove_dir_all(&old_tags_dir);
    }

    if old_audio_dir.exists() && !old_audio_exe.exists() {
        let _ = fs::remove_dir_all(&old_audio_dir);
    }

    Ok(())
}
