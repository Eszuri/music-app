use std::io::{Read, Seek};
use std::sync::atomic::Ordering;
use tauri::Manager;

pub mod ai_lyrics_plugin_manager;
pub mod audio;
pub mod commands;
pub mod plugin_manager;
pub mod sidecar;
pub mod sidecar_lyrics;

pub use commands::*;

fn decode_percent(s: &str) -> String {
    let mut bytes = Vec::new();
    let input = s.as_bytes();
    let mut i = 0;
    while i < input.len() {
        if input[i] == b'%' && i + 2 < input.len() {
            if let (Ok(h), Ok(l)) = (
                std::str::from_utf8(&input[i + 1..i + 2]),
                std::str::from_utf8(&input[i + 2..i + 3]),
            ) {
                let hex_str = format!("{}{}", h, l);
                if let Ok(val) = u8::from_str_radix(&hex_str, 16) {
                    bytes.push(val);
                    i += 3;
                    continue;
                }
            }
        }
        bytes.push(input[i]);
        i += 1;
    }
    String::from_utf8_lossy(&bytes).to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // When a second instance is launched, focus the existing main window
            // instead of starting a duplicate process.
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .invoke_handler(tauri::generate_handler![
            list_files,
            get_metadata,
            get_lyrics,
            fetch_online_lyrics,
            search_online_lyrics,
            save_lrc_file,
            save_metadata,
            get_system_volume,
            set_system_volume,
            get_system_mute,
            set_system_mute,
            register_volume_callback,
            unregister_volume_callback,
            set_wallpaper,
            clear_wallpaper,
            pick_folder,
            pick_wallpaper,
            pick_audio_file,
            pick_single_file,
            open_devtools,
            save_cover_image,
            set_default_wallpaper_path,
            get_default_wallpaper_path,
            set_reset_on_close,
            open_webview_stream,
            get_bit_perfect_plugin_status,
            download_bit_perfect_plugin,
            cancel_bit_perfect_plugin_download,
            install_bit_perfect_plugin_from_file,
            uninstall_bit_perfect_plugin,
            send_audio_command,
            stop_audio_engine,
            is_audio_engine_running,
            get_ai_lyrics_plugin_status,
            download_ai_lyrics_plugin,
            cancel_ai_lyrics_plugin_download,
            install_ai_lyrics_plugin_from_file,
            uninstall_ai_lyrics_plugin,
            generate_ai_lyrics,
            extract_vocal_ai,
            cancel_ai_lyrics,
            get_ai_lyrics_current_state,
            get_downloaded_ai_models,
            download_ai_model,
            cancel_ai_model_download,
            delete_ai_model,
            open_ai_models_folder,
            import_ai_model_file,
            open_external_url,
            get_system_specs
        ])
        .register_uri_scheme_protocol("stream", |_app, request| {
            if request.method() == tauri::http::Method::OPTIONS {
                return tauri::http::Response::builder()
                    .status(200)
                    .header("Access-Control-Allow-Origin", "*")
                    .header("Access-Control-Allow-Methods", "GET, OPTIONS, HEAD")
                    .header("Access-Control-Allow-Headers", "*")
                    .body(Vec::new())
                    .unwrap();
            }

            let raw_path = request.uri().path();
            let decoded = decode_percent(raw_path);
            let clean_path = if cfg!(windows) && decoded.starts_with('/') && decoded.chars().nth(2) == Some(':') {
                &decoded[1..]
            } else {
                &decoded[..]
            };

            let path_buf = std::path::PathBuf::from(clean_path);
            if !path_buf.exists() || !path_buf.is_file() {
                return tauri::http::Response::builder()
                    .status(404)
                    .header("Access-Control-Allow-Origin", "*")
                    .body(Vec::new())
                    .unwrap();
            }

            let file_size = match std::fs::metadata(&path_buf) {
                Ok(m) => m.len(),
                Err(_) => return tauri::http::Response::builder()
                    .status(500)
                    .header("Access-Control-Allow-Origin", "*")
                    .body(Vec::new())
                    .unwrap(),
            };

            let ext = path_buf
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();
            let mime = match ext.as_str() {
                "mp3" => "audio/mpeg",
                "flac" => "audio/flac",
                "wav" => "audio/wav",
                "ogg" => "audio/ogg",
                "m4a" | "aac" | "mp4" => "audio/mp4",
                "opus" => "audio/opus",
                "webm" => "audio/webm",
                _ => "audio/mpeg",
            };

            let range_header = request.headers().get("range").and_then(|v| v.to_str().ok());

            let mut file = match std::fs::File::open(&path_buf) {
                Ok(f) => f,
                Err(_) => return tauri::http::Response::builder()
                    .status(500)
                    .header("Access-Control-Allow-Origin", "*")
                    .body(Vec::new())
                    .unwrap(),
            };

            if let Some(range_str) = range_header {
                if let Some(spec) = range_str.strip_prefix("bytes=") {
                    let parts: Vec<&str> = spec.split('-').collect();
                    let start: u64 = parts.first().and_then(|s| s.parse().ok()).unwrap_or(0);
                    let mut end: u64 = parts.get(1).and_then(|s| s.parse().ok()).unwrap_or(file_size.saturating_sub(1));
                    if end >= file_size {
                        end = file_size.saturating_sub(1);
                    }

                    if start <= end && start < file_size {
                        let max_chunk = 2 * 1024 * 1024;
                        let chunk_end = std::cmp::min(end, start + max_chunk - 1);
                        let length = (chunk_end - start + 1) as usize;

                        if file.seek(std::io::SeekFrom::Start(start)).is_ok() {
                            let mut buffer = vec![0u8; length];
                            if file.read_exact(&mut buffer).is_ok() {
                                return tauri::http::Response::builder()
                                    .status(206)
                                    .header("Access-Control-Allow-Origin", "*")
                                    .header("Accept-Ranges", "bytes")
                                    .header("Content-Range", format!("bytes {}-{}/{}", start, chunk_end, file_size))
                                    .header("Content-Length", length.to_string())
                                    .header("Content-Type", mime)
                                    .body(buffer)
                                    .unwrap();
                            }
                        }
                    }
                }
            }

            let mut data = Vec::new();
            if file.read_to_end(&mut data).is_ok() {
                tauri::http::Response::builder()
                    .status(200)
                    .header("Access-Control-Allow-Origin", "*")
                    .header("Accept-Ranges", "bytes")
                    .header("Content-Length", file_size.to_string())
                    .header("Content-Type", mime)
                    .body(data)
                    .unwrap()
            } else {
                tauri::http::Response::builder()
                    .status(500)
                    .header("Access-Control-Allow-Origin", "*")
                    .body(Vec::new())
                    .unwrap()
            }
        })
        .plugin(tauri_plugin_updater::Builder::default().build())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            let window = app.get_webview_window("main").unwrap();
            let icon_bytes = include_bytes!("../icons/icon.png");
            let img = image::load_from_memory(icon_bytes).unwrap().to_rgba8();
            let (w, h) = (img.width(), img.height());
            let icon = tauri::image::Image::new(img.as_raw(), w, h);
            window.set_icon(icon).unwrap();
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|_handle, event| {
        #[cfg(windows)]
        if let tauri::RunEvent::Exit = event {
            // Kill all sidecar engines and downloads so they never outlive the host app.
            let _ = sidecar::stop_engine();
            sidecar_lyrics::stop_engine();
            plugin_manager::cancel_download();
            ai_lyrics_plugin_manager::cancel_download();
            if commands::wallpaper::RESET_ON_CLOSE.load(Ordering::SeqCst) {
                let has_default = commands::wallpaper::DEFAULT_WALLPAPER_PATH.lock()
                    .map(|p| p.is_some())
                    .unwrap_or(false);
                if has_default {
                    let _ = commands::wallpaper::clear_wallpaper_internal();
                }
            }
        }
    });
}
