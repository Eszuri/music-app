use base64::Engine;
use lofty::file::AudioFile;
use lofty::file::TaggedFileExt;
use lofty::read_from_path;
use lofty::tag::Accessor;
use rayon::prelude::*;
use serde::Serialize;
use std::ffi::OsStr;
use std::fs;
use std::path::Path;
use std::time::SystemTime;
use tauri::AppHandle;

use crate::sidecar;

#[derive(Serialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub ext: String,
    pub mtime: u64,
    pub size: u64,
    pub ctime: u64,
    pub display_name: String,
    pub sort_key: String,
}

#[derive(Serialize)]
pub struct SongMetadata {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub duration: Option<f64>,
    pub cover_b64: Option<String>,
    pub cover_mime: Option<String>,
    pub genre: Option<String>,
    pub year: Option<u32>,
    pub track_number: Option<u32>,
    pub total_tracks: Option<u32>,
    pub disc_number: Option<u32>,
    pub total_discs: Option<u32>,
    pub comment: Option<String>,
    pub bitrate: Option<u32>,
    pub sample_rate: Option<u32>,
    pub channels: Option<u8>,
    pub bit_depth: Option<u8>,
}

fn file_display_name(path: &Path, filename: &str, name_source: &str) -> String {
    if name_source == "title" {
        if let Ok(tagged_file) = read_from_path(path) {
            if let Some(tag) = tagged_file.primary_tag().or_else(|| tagged_file.first_tag()) {
                if let Some(title) = tag.title() {
                    let t = title.trim();
                    if !t.is_empty() {
                        return t.to_string();
                    }
                }
            }
        }
    }
    Path::new(filename)
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| filename.to_string())
}

fn list_files_inner(
    path: String,
    folder_sort: String,
    file_sort: String,
    sort_dir: String,
    name_source: String,
    formats: Vec<String>,
) -> Result<Vec<FileEntry>, String> {
    let entries = fs::read_dir(&path).map_err(|e| format!("Failed to read directory: {}", e))?;

    let dir_entries: Vec<_> = entries
        .filter_map(|e| e.ok())
        .filter(|e| {
            let name = e.file_name();
            let name_str = name.to_string_lossy();
            !name_str.starts_with('.')
        })
        .collect();

    let mut files: Vec<FileEntry> = dir_entries
        .into_par_iter()
        .filter_map(|entry| {
            let path_buf = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            let metadata = entry.metadata().ok()?;
            let is_dir = metadata.is_dir();

            let ext = path_buf
                .extension()
                .unwrap_or(OsStr::new(""))
                .to_string_lossy()
                .to_lowercase();

            if is_dir || formats.iter().any(|f| f == &ext) {
                let mtime = metadata
                    .modified()
                    .unwrap_or(SystemTime::UNIX_EPOCH)
                    .duration_since(SystemTime::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs();
                let ctime = metadata
                    .created()
                    .unwrap_or(SystemTime::UNIX_EPOCH)
                    .duration_since(SystemTime::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs();
                let size = metadata.len();

                let (display_name, sort_key) = if is_dir {
                    let dn = name.clone();
                    let sk = name.to_lowercase();
                    (dn, sk)
                } else {
                    let dn = file_display_name(&path_buf, &name, &name_source);
                    let sk = dn.to_lowercase();
                    (dn, sk)
                };

                Some(FileEntry {
                    name,
                    path: path_buf.to_string_lossy().to_string(),
                    is_dir,
                    ext,
                    mtime,
                    size,
                    ctime,
                    display_name,
                    sort_key,
                })
            } else {
                None
            }
        })
        .collect();

    let desc = sort_dir == "desc";
    let fsort = file_sort;
    let fosort = folder_sort;
    files.sort_by(|a, b| {
        if a.is_dir != b.is_dir {
            b.is_dir.cmp(&a.is_dir)
        } else {
            let key = if a.is_dir { &fosort } else { &fsort };
            let cmp = match key.as_str() {
                "name" => a.sort_key.cmp(&b.sort_key),
                "size" => a.size.cmp(&b.size),
                "ext" => a.ext.cmp(&b.ext),
                "ctime" => a.ctime.cmp(&b.ctime),
                _ => a.mtime.cmp(&b.mtime),
            };
            if desc { cmp.reverse() } else { cmp }
        }
    });

    Ok(files)
}

#[tauri::command]
pub async fn list_files(
    path: String,
    folder_sort: String,
    file_sort: String,
    sort_dir: String,
    name_source: String,
    formats: Vec<String>,
) -> Result<Vec<FileEntry>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        list_files_inner(path, folder_sort, file_sort, sort_dir, name_source, formats)
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
}

#[tauri::command]
pub fn get_metadata(file_path: String) -> Result<SongMetadata, String> {
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err("File not found".to_string());
    }

    let tagged_file = match read_from_path(path) {
        Ok(t) => t,
        Err(_) => {
            if let Ok(probe) = lofty::probe::Probe::open(path) {
                let probe = probe.options(lofty::config::ParseOptions::new().parsing_mode(lofty::config::ParsingMode::Relaxed));
                match probe.read() {
                    Ok(t) => t,
                    Err(_) => {
                        return Ok(SongMetadata {
                            title: None,
                            artist: None,
                            album: None,
                            duration: None,
                            cover_b64: None,
                            cover_mime: None,
                            genre: None,
                            year: None,
                            track_number: None,
                            total_tracks: None,
                            disc_number: None,
                            total_discs: None,
                            comment: None,
                            bitrate: None,
                            sample_rate: None,
                            channels: None,
                            bit_depth: None,
                        });
                    }
                }
            } else {
                return Ok(SongMetadata {
                    title: None,
                    artist: None,
                    album: None,
                    duration: None,
                    cover_b64: None,
                    cover_mime: None,
                    genre: None,
                    year: None,
                    track_number: None,
                    total_tracks: None,
                    disc_number: None,
                    total_discs: None,
                    comment: None,
                    bitrate: None,
                    sample_rate: None,
                    channels: None,
                    bit_depth: None,
                });
            }
        }
    };

    let props = tagged_file.properties();
    let duration = props.duration().as_secs_f64();
    let bitrate = props.audio_bitrate();
    let sample_rate = props.sample_rate();
    let channels = props.channels();
    let bit_depth = props.bit_depth();

    let tag = tagged_file.primary_tag().or_else(|| tagged_file.first_tag());

    let (title, artist, album, genre, year, track_number, total_tracks, disc_number, total_discs, comment) = tag
        .map(|t| {
            (
                t.title().map(|s| s.trim().to_string()).filter(|s| !s.is_empty()),
                t.artist().map(|s| s.trim().to_string()).filter(|s| !s.is_empty()),
                t.album().map(|s| s.trim().to_string()).filter(|s| !s.is_empty()),
                t.genre().map(|s| s.trim().to_string()).filter(|s| !s.is_empty()),
                t.year(),
                t.track(),
                t.track_total(),
                t.disk(),
                t.disk_total(),
                t.comment().map(|s| s.trim().to_string()).filter(|s| !s.is_empty()),
            )
        })
        .unwrap_or((None, None, None, None, None, None, None, None, None, None));

    let (cover_b64, cover_mime) = if let Some(t) = tag {
        if let Some(pic) = t.pictures().first() {
            let engine = base64::engine::general_purpose::STANDARD;
            let b64 = Some(engine.encode(pic.data()));
            let mime = pic.mime_type().map(|m| m.to_string());
            (b64, mime)
        } else {
            (None, None)
        }
    } else {
        (None, None)
    };

    Ok(SongMetadata {
        title,
        artist,
        album,
        duration: if duration > 0.0 { Some(duration) } else { None },
        cover_b64,
        cover_mime,
        genre,
        year,
        track_number,
        total_tracks,
        disc_number,
        total_discs,
        comment,
        bitrate,
        sample_rate,
        channels,
        bit_depth,
    })
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn save_metadata(
    app: tauri::AppHandle,
    file_path: String,
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
    crate::tag_editor_plugin_manager::write_tags_via_plugin(
        &app,
        &file_path,
        title,
        artist,
        album,
        genre,
        year,
        track_number,
        total_tracks,
        disc_number,
        total_discs,
        comment,
        cover_b64,
        cover_mime,
    )
}

#[tauri::command]
pub async fn save_cover_image(cover_b64: String, mime: String) -> Result<(), String> {
    let engine = base64::engine::general_purpose::STANDARD;
    let data = engine.decode(&cover_b64).map_err(|e| format!("Base64 decode error: {}", e))?;

    let ext = match mime.as_str() {
        "image/jpeg" | "image/jpg" => "jpg",
        "image/png" => "png",
        "image/webp" => "webp",
        "image/bmp" => "bmp",
        "image/gif" => "gif",
        _ => "png",
    };

    let file = rfd::AsyncFileDialog::new()
        .set_title("Save Cover Image")
        .set_file_name(format!("cover.{}", ext))
        .add_filter("Image", &[ext])
        .save_file()
        .await;

    if let Some(path) = file {
        fs::write(path.path(), &data).map_err(|e| format!("Failed to save file: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub fn send_audio_command(app: AppHandle, json: String) -> Result<(), String> {
    sidecar::send_command(&app, &json)
}

#[tauri::command]
pub fn stop_audio_engine() -> Result<(), String> {
    sidecar::stop_engine()
}

#[tauri::command]
pub fn is_audio_engine_running() -> bool {
    sidecar::is_running()
}
