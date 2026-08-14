use rayon::prelude::*;
use std::ffi::OsStr;
use std::fs;
use std::io::{Read, Seek};
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, SystemTime};

mod plugin_manager;
mod sidecar;
mod ai_lyrics_plugin_manager;
mod sidecar_lyrics;



#[cfg(windows)]
use std::os::windows::ffi::OsStrExt;

use base64::Engine;
use lofty::file::AudioFile;
use lofty::file::TaggedFileExt;
use lofty::read_from_path;
use lofty::tag::Accessor;
use id3::TagLike;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder, Url};

#[cfg(windows)]
use windows::core::implement;
#[cfg(windows)]
use windows::Win32::Media::Audio::Endpoints::{
    IAudioEndpointVolume, IAudioEndpointVolumeCallback, IAudioEndpointVolumeCallback_Impl,
};
#[cfg(windows)]
use windows::Win32::Media::Audio::AUDIO_VOLUME_NOTIFICATION_DATA;
#[cfg(windows)]
use windows::Win32::System::Com::{CLSCTX_INPROC_SERVER, CoCreateInstance, CoInitializeEx, COINIT_APARTMENTTHREADED};
#[cfg(windows)]
use windows::Win32::Media::Audio::{IMMDeviceEnumerator, MMDeviceEnumerator, eRender, eMultimedia};

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

#[derive(Serialize)]
struct FileEntry {
    name: String,
    path: String,
    is_dir: bool,
    ext: String,
    mtime: u64,
    size: u64,
    ctime: u64,
    display_name: String,
    sort_key: String,
}

static RESET_ON_CLOSE: AtomicBool = AtomicBool::new(true);
static DEFAULT_WALLPAPER_PATH: Mutex<Option<String>> = Mutex::new(None);

#[cfg(windows)]
static VOLUME_CALLBACK_REGISTERED: AtomicBool = AtomicBool::new(false);

#[tauri::command]
fn set_reset_on_close(enabled: bool) {
    RESET_ON_CLOSE.store(enabled, Ordering::SeqCst);
}

#[cfg(windows)]
#[derive(Serialize, Clone)]
struct VolumeChangeEvent {
    volume: u32,
    muted: bool,
}

#[cfg(windows)]
#[implement(IAudioEndpointVolumeCallback)]
struct VolumeCallback {
    app_handle: AppHandle,
}

#[cfg(windows)]
#[allow(non_snake_case)]
impl IAudioEndpointVolumeCallback_Impl for VolumeCallback_Impl {
    fn OnNotify(&self, pnotify: *mut AUDIO_VOLUME_NOTIFICATION_DATA) -> windows::core::Result<()> {
        unsafe {
            if pnotify.is_null() {
                return Ok(());
            }
            
            let notification = &*pnotify;
            let volume_pct = (notification.fMasterVolume * 100.0).round() as u32;
            let is_muted = notification.bMuted.as_bool();
            
            let _ = self.app_handle.emit("system-volume-changed", VolumeChangeEvent {
                volume: volume_pct.clamp(0, 100),
                muted: is_muted,
            });
        }
        Ok(())
    }
}

#[cfg(windows)]
struct VolumeCallbackWrapper {
    callback: IAudioEndpointVolumeCallback,
    endpoint: IAudioEndpointVolume,
}

#[cfg(windows)]
impl Drop for VolumeCallbackWrapper {
    fn drop(&mut self) {
        unsafe {
            let _ = self.endpoint.UnregisterControlChangeNotify(&self.callback);
        }
    }
}

#[derive(Serialize)]
struct LyricsResult {
    raw_text: String,
    source: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct LrclibItem {
    id: Option<u64>,
    #[serde(rename = "trackName")]
    track_name: Option<String>,
    #[serde(rename = "artistName")]
    artist_name: Option<String>,
    #[serde(rename = "albumName")]
    album_name: Option<String>,
    duration: Option<f64>,
    instrumental: Option<bool>,
    #[serde(rename = "plainLyrics")]
    plain_lyrics: Option<String>,
    #[serde(rename = "syncedLyrics")]
    synced_lyrics: Option<String>,
}

fn url_encode(input: &str) -> String {
    let mut encoded = String::new();
    for byte in input.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(byte as char);
            }
            _ => {
                encoded.push_str(&format!("%{:02X}", byte));
            }
        }
    }
    encoded
}

#[derive(Serialize)]
struct SongMetadata {
    title: Option<String>,
    artist: Option<String>,
    album: Option<String>,
    duration: Option<f64>,
    cover_b64: Option<String>,
    cover_mime: Option<String>,
    genre: Option<String>,
    year: Option<u32>,
    track_number: Option<u32>,
    total_tracks: Option<u32>,
    disc_number: Option<u32>,
    total_discs: Option<u32>,
    comment: Option<String>,
    bitrate: Option<u32>,
    sample_rate: Option<u32>,
    channels: Option<u8>,
    bit_depth: Option<u8>,
}

#[tauri::command]
async fn pick_folder() -> Result<Option<String>, String> {
    let folder = rfd::AsyncFileDialog::new()
        .set_title("Pilih folder musik")
        .pick_folder()
        .await;

    Ok(folder.map(|f| f.path().to_string_lossy().to_string()))
}

#[tauri::command]
async fn pick_wallpaper() -> Result<Option<String>, String> {
    let file = rfd::AsyncFileDialog::new()
        .set_title("Pilih gambar wallpaper default")
        .add_filter("Images", &["png", "jpg", "jpeg", "bmp", "webp"])
        .pick_file()
        .await;
    Ok(file.map(|f| f.path().to_string_lossy().to_string()))
}

#[tauri::command]
async fn pick_audio_file() -> Result<Option<String>, String> {
    let file = rfd::AsyncFileDialog::new()
        .set_title("Pilih file audio")
        .add_filter("Audio", &["mp3", "flac", "wav", "m4a", "aac", "ogg", "opus", "wma"])
        .pick_file()
        .await;
    Ok(file.map(|f| f.path().to_string_lossy().to_string()))
}

#[tauri::command]
async fn pick_single_file(
    title: Option<String>,
    filters: Option<Vec<serde_json::Value>>,
) -> Result<Option<String>, String> {
    let mut dialog = rfd::AsyncFileDialog::new()
        .set_title(title.as_deref().unwrap_or("Pilih file"));

    if let Some(filters) = filters {
        for f in &filters {
            let name = f.get("name").and_then(|v| v.as_str()).unwrap_or("File");
            let exts: Vec<&str> = f
                .get("extensions")
                .and_then(|v| v.as_array())
                .map(|arr| arr.iter().filter_map(|x| x.as_str()).collect())
                .unwrap_or_default();
            if !exts.is_empty() {
                dialog = dialog.add_filter(name, &exts);
            }
        }
    }

    let file = dialog.pick_file().await;
    Ok(file.map(|f| f.path().to_string_lossy().to_string()))
}

#[tauri::command]
async fn open_devtools(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.open_devtools();
        Ok(())
    } else {
        Err("Main webview window not found".to_string())
    }
}

#[tauri::command]
async fn save_cover_image(cover_b64: String, mime: String) -> Result<(), String> {
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
        .set_file_name(&format!("cover.{}", ext))
        .add_filter("Image", &[ext])
        .save_file()
        .await;

    if let Some(path) = file {
        fs::write(path.path(), &data).map_err(|e| format!("Failed to save file: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
fn set_default_wallpaper_path(path: Option<String>) -> Result<(), String> {
    let mut guard = DEFAULT_WALLPAPER_PATH.lock().map_err(|e| e.to_string())?;
    *guard = path;
    Ok(())
}

#[tauri::command]
fn get_default_wallpaper_path() -> Result<Option<String>, String> {
    let guard = DEFAULT_WALLPAPER_PATH.lock().map_err(|e| e.to_string())?;
    Ok(guard.clone())
}

fn file_display_name(path: &Path, filename: &str, name_source: &str) -> String {
    if name_source == "title" {
        if let Ok(tagged_file) = read_from_path(path) {
            if let Some(tag) = tagged_file.primary_tag() {
                if let Some(title) = tag.title() {
                    let t = title.trim();
                    if !t.is_empty() {
                        return t.to_string();
                    }
                }
            }
        }
    }
    // Fallback: filename without extension
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
async fn list_files(
    path: String,
    folder_sort: String,
    file_sort: String,
    sort_dir: String,
    name_source: String,
    formats: Vec<String>,
) -> Result<Vec<FileEntry>, String> {
    // Move heavy work (filesystem + metadata reads + sort) off the async runtime
    // onto the blocking thread pool so the UI thread doesn't stall.
    tauri::async_runtime::spawn_blocking(move || {
        list_files_inner(path, folder_sort, file_sort, sort_dir, name_source, formats)
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
}

#[tauri::command]
fn get_metadata(file_path: String) -> Result<SongMetadata, String> {
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
fn get_lyrics(file_path: String) -> Result<Option<LyricsResult>, String> {
    let path = Path::new(&file_path);
    if !path.exists() {
        return Ok(None);
    }

    // 1. Check for .lrc file in the same directory
    let lrc_path = path.with_extension("lrc");
    if lrc_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&lrc_path) {
            if !content.trim().is_empty() {
                return Ok(Some(LyricsResult {
                    raw_text: content,
                    source: "lrc_file".to_string(),
                }));
            }
        }
    }

    // 2. Check for embedded lyrics tag via lofty
    if let Ok(tagged_file) = read_from_path(path) {
        if let Some(tag) = tagged_file.primary_tag().or_else(|| tagged_file.first_tag()) {
            for item in tag.items() {
                let key_str = format!("{:?}", item.key());
                if key_str.contains("Lyrics") || key_str.contains("UnsyncLyrics") {
                    if let lofty::tag::ItemValue::Text(val) = item.value() {
                        if !val.trim().is_empty() {
                            return Ok(Some(LyricsResult {
                                raw_text: val.clone(),
                                source: "embedded".to_string(),
                            }));
                        }
                    }
                }
            }
        }
    }

    Ok(None)
}

#[tauri::command]
fn search_online_lyrics(query: String) -> Result<Vec<LrclibItem>, String> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return Ok(Vec::new());
    }
    let url = format!("https://lrclib.net/api/search?q={}", url_encode(trimmed));
    let req = ureq::get(&url).set("User-Agent", "Symvonia/1.0.2 (https://github.com/Eszuri/symvonia)");
    match req.call() {
        Ok(res) => {
            let body = res.into_string().map_err(|e| format!("Failed to read response: {}", e))?;
            let items: Vec<LrclibItem> = serde_json::from_str(&body).map_err(|e| format!("Failed to parse search response: {}", e))?;
            Ok(items)
        }
        Err(e) => Err(format!("Search request failed: {}", e)),
    }
}

#[tauri::command]
fn fetch_online_lyrics(
    track_name: String,
    artist_name: Option<String>,
    album_name: Option<String>,
    duration: Option<f64>,
) -> Result<Option<LyricsResult>, String> {
    if track_name.trim().is_empty() {
        return Ok(None);
    }
    let mut query_params = vec![format!("track_name={}", url_encode(track_name.trim()))];
    if let Some(artist) = &artist_name {
        if !artist.trim().is_empty() {
            query_params.push(format!("artist_name={}", url_encode(artist.trim())));
        }
    }
    if let Some(album) = &album_name {
        if !album.trim().is_empty() {
            query_params.push(format!("album_name={}", url_encode(album.trim())));
        }
    }
    if let Some(dur) = duration {
        if dur > 0.0 {
            query_params.push(format!("duration={}", dur.round() as u64));
        }
    }

    let get_url = format!("https://lrclib.net/api/get?{}", query_params.join("&"));
    let req = ureq::get(&get_url).set("User-Agent", "Symvonia/1.0.2 (https://github.com/Eszuri/symvonia)");

    if let Ok(res) = req.call() {
        if let Ok(body) = res.into_string() {
            if let Ok(item) = serde_json::from_str::<LrclibItem>(&body) {
                let text = item.synced_lyrics.or(item.plain_lyrics);
                if let Some(raw_text) = text {
                    if !raw_text.trim().is_empty() {
                        return Ok(Some(LyricsResult {
                            raw_text,
                            source: "lrclib".to_string(),
                        }));
                    }
                }
            }
        }
    }

    // Fallback search
    let search_q = format!("{} {}", track_name.trim(), artist_name.as_deref().unwrap_or("").trim());
    if let Ok(items) = search_online_lyrics(search_q) {
        for item in items {
            let text = item.synced_lyrics.or(item.plain_lyrics);
            if let Some(raw_text) = text {
                if !raw_text.trim().is_empty() {
                    return Ok(Some(LyricsResult {
                        raw_text,
                        source: "lrclib".to_string(),
                    }));
                }
            }
        }
    }

    Ok(None)
}

#[tauri::command]
fn save_lrc_file(file_path: String, lrc_content: String) -> Result<(), String> {
    let audio_path = Path::new(&file_path);
    if !audio_path.exists() {
        return Err("File audio tidak ditemukan".to_string());
    }
    let lrc_path = audio_path.with_extension("lrc");
    std::fs::write(&lrc_path, lrc_content).map_err(|e| format!("Gagal menyimpan file LRC: {}", e))?;
    Ok(())
}

#[tauri::command]
fn save_metadata(
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
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err("File not found".to_string());
    }

    let is_mp3 = path.extension().and_then(|s| s.to_str()).map(|s| s.eq_ignore_ascii_case("mp3")).unwrap_or(false);

    if is_mp3 {
        let mut id3_tag = id3::Tag::read_from_path(path).unwrap_or_else(|_| id3::Tag::new());
        if let Some(t) = &title { id3_tag.set_title(t); } else { id3_tag.remove_title(); }
        if let Some(a) = &artist { id3_tag.set_artist(a); } else { id3_tag.remove_artist(); }
        if let Some(al) = &album { id3_tag.set_album(al); } else { id3_tag.remove_album(); }
        if let Some(g) = &genre { id3_tag.set_genre(g); } else { id3_tag.remove_genre(); }
        if let Some(y) = year { id3_tag.set_year(y as i32); } else { id3_tag.remove_year(); }
        if let Some(tn) = track_number { id3_tag.set_track(tn); } else { id3_tag.remove_track(); }
        if let Some(tt) = total_tracks { id3_tag.set_total_tracks(tt); } else { id3_tag.remove_total_tracks(); }
        if let Some(dn) = disc_number { id3_tag.set_disc(dn); } else { id3_tag.remove_disc(); }
        if let Some(td) = total_discs { id3_tag.set_total_discs(td); } else { id3_tag.remove_total_discs(); }
        if let Some(c) = &comment {
            id3_tag.remove_comment(None, None);
            id3_tag.add_frame(id3::frame::Comment {
                lang: "eng".to_string(),
                description: String::new(),
                text: c.clone(),
            });
        } else {
            id3_tag.remove_comment(None, None);
        }

        if let (Some(b64), Some(mime)) = (&cover_b64, &cover_mime) {
            let engine = base64::engine::general_purpose::STANDARD;
            if let Ok(bytes) = engine.decode(b64) {
                id3_tag.remove_picture_by_type(id3::frame::PictureType::CoverFront);
                id3_tag.add_frame(id3::frame::Picture {
                    mime_type: mime.clone(),
                    picture_type: id3::frame::PictureType::CoverFront,
                    description: String::new(),
                    data: bytes,
                });
            }
        }
        if let Ok(()) = id3_tag.write_to_path(path, id3::Version::Id3v24) {
            return Ok(());
        }
        if let Ok(()) = id3_tag.write_to_path(path, id3::Version::Id3v23) {
            return Ok(());
        }

        let mut clean_tag = id3::Tag::new();
        if let Some(t) = &title { clean_tag.set_title(t); }
        if let Some(a) = &artist { clean_tag.set_artist(a); }
        if let Some(al) = &album { clean_tag.set_album(al); }
        if let Some(g) = &genre { clean_tag.set_genre(g); }
        if let Some(y) = year { clean_tag.set_year(y as i32); }
        if let Some(tn) = track_number { clean_tag.set_track(tn); }
        if let Some(tt) = total_tracks { clean_tag.set_total_tracks(tt); }
        if let Some(dn) = disc_number { clean_tag.set_disc(dn); }
        if let Some(td) = total_discs { clean_tag.set_total_discs(td); }
        if let Some(c) = &comment {
            clean_tag.add_frame(id3::frame::Comment {
                lang: "eng".to_string(),
                description: String::new(),
                text: c.clone(),
            });
        }
        if let (Some(b64), Some(mime)) = (&cover_b64, &cover_mime) {
            let engine = base64::engine::general_purpose::STANDARD;
            if let Ok(bytes) = engine.decode(b64) {
                clean_tag.add_frame(id3::frame::Picture {
                    mime_type: mime.clone(),
                    picture_type: id3::frame::PictureType::CoverFront,
                    description: String::new(),
                    data: bytes,
                });
            }
        }
        if let Ok(()) = clean_tag.write_to_path(path, id3::Version::Id3v23) {
            return Ok(());
        }
    }

    let mut tagged_file = match read_from_path(path) {
        Ok(t) => t,
        Err(_) => {
            lofty::probe::Probe::open(path)
                .map_err(|e| format!("Failed to open file: {}", e))?
                .options(lofty::config::ParseOptions::new().parsing_mode(lofty::config::ParsingMode::Relaxed))
                .read()
                .map_err(|e| format!("Failed to read metadata: {}", e))?
        }
    };

    let tag_type = tagged_file.primary_tag_type();
    if tagged_file.primary_tag().is_none() {
        tagged_file.insert_tag(lofty::tag::Tag::new(tag_type));
    }

    if let Some(tag) = tagged_file.primary_tag_mut() {
        if let Some(t) = title { tag.set_title(t); } else { tag.remove_title(); }
        if let Some(a) = artist { tag.set_artist(a); } else { tag.remove_artist(); }
        if let Some(al) = album { tag.set_album(al); } else { tag.remove_album(); }
        if let Some(g) = genre { tag.set_genre(g); } else { tag.remove_genre(); }
        if let Some(y) = year { tag.set_year(y); } else { tag.remove_year(); }
        if let Some(tn) = track_number { tag.set_track(tn); } else { tag.remove_track(); }
        if let Some(tt) = total_tracks { tag.set_track_total(tt); } else { tag.remove_track_total(); }
        if let Some(dn) = disc_number { tag.set_disk(dn); } else { tag.remove_disk(); }
        if let Some(td) = total_discs { tag.set_disk_total(td); } else { tag.remove_disk_total(); }
        if let Some(c) = comment { tag.set_comment(c); } else { tag.remove_comment(); }

        tag.remove_picture_type(lofty::picture::PictureType::CoverFront);

        if let (Some(b64), Some(mime)) = (cover_b64, cover_mime) {
            let engine = base64::engine::general_purpose::STANDARD;
            if let Ok(bytes) = engine.decode(&b64) {
                let mime_type = match mime.as_str() {
                    "image/png" => lofty::picture::MimeType::Png,
                    "image/jpeg" | "image/jpg" => lofty::picture::MimeType::Jpeg,
                    other => lofty::picture::MimeType::Unknown(other.to_string()),
                };
                let pic = lofty::picture::Picture::new_unchecked(
                    lofty::picture::PictureType::CoverFront,
                    Some(mime_type),
                    None,
                    bytes,
                );
                tag.push_picture(pic);
            }
        }
    }

    tagged_file.save_to_path(path, lofty::config::WriteOptions::default()).map_err(|e| format!("Failed to save metadata: {}", e))?;
    Ok(())
}

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

#[cfg(windows)]
fn apply_wallpaper(bmp_path: &Path) -> Result<(), String> {
    let path_wide: Vec<u16> = OsStr::new(&bmp_path.to_string_lossy().as_ref())
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    const SPI_SETDESKWALLPAPER: u32 = 0x0014;
    const SPIF_UPDATEINIFILE: u32 = 0x01;
    // SPIF_SENDCHANGE removed — it broadcasts WM_SETTINGCHANGE to all windows
    // synchronously, causing a system-wide stall that freezes the Tauri webview
    // for ~200-500ms. SPIF_UPDATEINIFILE alone persists the setting without the
    // broadcast penalty. The wallpaper will still change immediately on-screen.

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

#[cfg(windows)]
fn clear_wallpaper_internal() -> Result<(), String> {
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
async fn clear_wallpaper() -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        clear_wallpaper_internal()
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
}

#[cfg(windows)]
unsafe fn with_endpoint_volume<F, T>(f: F) -> Result<T, String>
where
    F: FnOnce(&windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume) -> Result<T, String>,
{
    let _ = windows::Win32::System::Com::CoInitializeEx(
        None,
        windows::Win32::System::Com::COINIT_APARTMENTTHREADED,
    );

    let enumerator: windows::Win32::Media::Audio::IMMDeviceEnumerator =
        windows::Win32::System::Com::CoCreateInstance(
            &windows::Win32::Media::Audio::MMDeviceEnumerator,
            None,
            windows::Win32::System::Com::CLSCTX_INPROC_SERVER,
        )
        .map_err(|e| format!("CoCreateInstance IMMDeviceEnumerator failed: {}", e))?;

    let device = enumerator
        .GetDefaultAudioEndpoint(
            windows::Win32::Media::Audio::eRender,
            windows::Win32::Media::Audio::eMultimedia,
        )
        .map_err(|e| format!("GetDefaultAudioEndpoint failed: {}", e))?;

    let endpoint: windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume = device
        .Activate(
            windows::Win32::System::Com::CLSCTX_INPROC_SERVER,
            None,
        )
        .map_err(|e| format!("Activate IAudioEndpointVolume failed: {}", e))?;

    f(&endpoint)
}

#[tauri::command]
fn get_system_volume() -> Result<u32, String> {
    #[cfg(windows)]
    {
        unsafe {
            with_endpoint_volume(|endpoint| {
                let level = endpoint
                    .GetMasterVolumeLevelScalar()
                    .map_err(|e| format!("GetMasterVolumeLevelScalar failed: {}", e))?;
                let pct = (level as f64 * 100.0).round() as u32;
                Ok(pct.clamp(0, 100))
            })
        }
    }
    #[cfg(not(windows))]
    {
        Err("System volume only available on Windows".to_string())
    }
}

#[tauri::command]
fn set_system_volume(value: u32) -> Result<(), String> {
    #[cfg(windows)]
    {
        unsafe {
            with_endpoint_volume(|endpoint| {
                let pct = value.clamp(0, 100) as f32 / 100.0;
                endpoint
                    .SetMasterVolumeLevelScalar(pct, std::ptr::null())
                    .map_err(|e| format!("SetMasterVolumeLevelScalar failed: {}", e))
            })
        }
    }
    #[cfg(not(windows))]
    {
        Err("System volume only available on Windows".to_string())
    }
}

#[tauri::command]
fn get_system_mute() -> Result<bool, String> {
    #[cfg(windows)]
    {
        unsafe {
            with_endpoint_volume(|endpoint| {
                let muted = endpoint
                    .GetMute()
                    .map_err(|e| format!("GetMute failed: {}", e))?;
                Ok(muted.as_bool())
            })
        }
    }
    #[cfg(not(windows))]
    {
        Err("System mute only available on Windows".to_string())
    }
}

#[tauri::command]
fn set_system_mute(mute: bool) -> Result<(), String> {
    #[cfg(windows)]
    {
        unsafe {
            with_endpoint_volume(|endpoint| {
                endpoint
                    .SetMute(windows::Win32::Foundation::BOOL::from(mute), std::ptr::null())
                    .map_err(|e| format!("SetMute failed: {}", e))
            })
        }
    }
    #[cfg(not(windows))]
    {
        Err("System mute only available on Windows".to_string())
    }
}

#[cfg(windows)]
#[tauri::command]
fn register_volume_callback(app: AppHandle) -> Result<(), String> {
    // Prevent multiple registrations
    if VOLUME_CALLBACK_REGISTERED.load(Ordering::SeqCst) {
        return Ok(());
    }

    std::thread::spawn(move || {
        unsafe {
            let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);

            let enumerator: IMMDeviceEnumerator = match CoCreateInstance(
                &MMDeviceEnumerator,
                None,
                CLSCTX_INPROC_SERVER,
            ) {
                Ok(e) => e,
                Err(_) => return,
            };

            let device = match enumerator.GetDefaultAudioEndpoint(eRender, eMultimedia) {
                Ok(d) => d,
                Err(_) => return,
            };

            let endpoint: IAudioEndpointVolume = match device.Activate(CLSCTX_INPROC_SERVER, None) {
                Ok(e) => e,
                Err(_) => return,
            };

            let callback_impl = VolumeCallback {
                app_handle: app.clone(),
            };
            let callback: IAudioEndpointVolumeCallback = callback_impl.into();

            if endpoint.RegisterControlChangeNotify(&callback).is_ok() {
                VOLUME_CALLBACK_REGISTERED.store(true, Ordering::SeqCst);
                
                // Keep callback alive by leaking it
                // This is intentional - callback must live for the entire app lifetime
                let _ = Box::leak(Box::new(VolumeCallbackWrapper {
                    callback,
                    endpoint,
                }));

                // Keep COM apartment alive
                loop {
                    std::thread::sleep(Duration::from_secs(1));
                    if !VOLUME_CALLBACK_REGISTERED.load(Ordering::SeqCst) {
                        break;
                    }
                }
            }
        }
    });

    Ok(())
}

#[cfg(not(windows))]
#[tauri::command]
fn register_volume_callback(_app: AppHandle) -> Result<(), String> {
    Err("Volume callback only available on Windows".to_string())
}

#[cfg(windows)]
#[tauri::command]
fn unregister_volume_callback() -> Result<(), String> {
    VOLUME_CALLBACK_REGISTERED.store(false, Ordering::SeqCst);
    Ok(())
}

#[cfg(not(windows))]
#[tauri::command]
fn unregister_volume_callback() -> Result<(), String> {
    Err("Volume callback only available on Windows".to_string())
}

#[tauri::command]
async fn set_wallpaper(cover_b64: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
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

// ─── Bit-Perfect plugin (C# sidecar engine) ─────────────────────────────────

#[tauri::command]
fn get_bit_perfect_plugin_status(app: AppHandle) -> Result<plugin_manager::PluginStatus, String> {
    plugin_manager::get_status(&app)
}

#[tauri::command]
async fn download_bit_perfect_plugin(
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
fn cancel_bit_perfect_plugin_download() {
    plugin_manager::cancel_download();
}

/// Installs the engine from a local exe path (development / sideload).
#[tauri::command]
async fn install_bit_perfect_plugin_from_file(
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
async fn uninstall_bit_perfect_plugin(app: AppHandle) -> Result<(), String> {
    sidecar::stop_engine()?;
    let app_clone = app.clone();
    tauri::async_runtime::spawn_blocking(move || plugin_manager::uninstall(&app_clone))
        .await
        .map_err(|e| format!("Task error: {}", e))?
}

// ─── AI Lyrics plugin (C# Whisper.net sidecar) ──────────────────────────────

#[tauri::command]
fn get_ai_lyrics_plugin_status(app: AppHandle) -> Result<ai_lyrics_plugin_manager::PluginStatus, String> {
    ai_lyrics_plugin_manager::get_status(&app)
}

#[tauri::command]
async fn download_ai_lyrics_plugin(
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
fn cancel_ai_lyrics_plugin_download() {
    ai_lyrics_plugin_manager::cancel_download();
}

#[tauri::command]
async fn install_ai_lyrics_plugin_from_file(
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
async fn uninstall_ai_lyrics_plugin(app: AppHandle) -> Result<(), String> {
    sidecar_lyrics::stop_engine();
    let app_clone = app.clone();
    tauri::async_runtime::spawn_blocking(move || ai_lyrics_plugin_manager::uninstall(&app_clone))
        .await
        .map_err(|e| format!("Task error: {}", e))?
}

#[tauri::command]
#[allow(non_snake_case)]
fn generate_ai_lyrics(
    app: AppHandle,
    filePath: String,
    modelName: Option<String>,
    language: Option<String>,
    isolateVocals: Option<bool>,
) -> Result<(), String> {
    sidecar_lyrics::generate_ai_lyrics(&app, filePath, modelName, language, isolateVocals)
}

#[tauri::command]
#[allow(non_snake_case)]
fn extract_vocal_ai(
    app: AppHandle,
    filePath: String,
    outputPath: Option<String>,
) -> Result<(), String> {
    sidecar_lyrics::extract_vocal_ai(&app, filePath, outputPath)
}

#[tauri::command]
fn cancel_ai_lyrics(app: AppHandle) -> Result<(), String> {
    sidecar_lyrics::cancel_ai_lyrics(&app)
}

#[tauri::command]
fn get_ai_lyrics_current_state() -> sidecar_lyrics::AiLyricsState {
    sidecar_lyrics::get_current_state()
}

#[tauri::command]
fn get_downloaded_ai_models(app: AppHandle) -> Vec<String> {
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

#[tauri::command]
#[allow(non_snake_case)]
fn download_ai_model(app: AppHandle, modelName: String) -> Result<(), String> {
    sidecar_lyrics::download_ai_model(&app, modelName)
}

#[tauri::command]
#[allow(non_snake_case)]
fn delete_ai_model(app: AppHandle, modelName: String) -> Result<(), String> {
    sidecar_lyrics::delete_ai_model(&app, modelName)
}

#[tauri::command]
fn open_ai_models_folder(app: AppHandle) -> Result<(), String> {
    sidecar_lyrics::open_ai_models_folder(&app)
}

#[tauri::command]
#[allow(non_snake_case)]
fn import_ai_model_file(app: AppHandle, srcPath: String, modelCode: String) -> Result<(), String> {
    sidecar_lyrics::import_ai_model_file(&app, srcPath, modelCode)
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("cmd").args(["/C", "start", "", &url]).spawn();
    }
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open").arg(&url).spawn();
    }
    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("xdg-open").arg(&url).spawn();
    }
    Ok(())
}




#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
#[allow(non_snake_case)]
struct SystemSpecsInfo {
    cpuCores: usize,
    cpuThreads: usize,
    ramGb: usize,
    cpuName: String,
    gpuName: String,
}


#[tauri::command]
fn get_system_specs() -> SystemSpecsInfo {
    let mut cpu_threads = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4);
    let mut cpu_cores = cpu_threads / 2;
    if cpu_cores == 0 { cpu_cores = 1; }
    let mut ram_gb = 8;
    let mut cpu_name = String::from("Processor CPU");
    let mut gpu_name = String::from("Graphics GPU");

    #[cfg(target_os = "windows")]
    {
        if let Ok(output) = std::process::Command::new("wmic")
            .args(["OS", "get", "TotalVisibleMemorySize", "/Value"])
            .output()
        {
            let text = String::from_utf8_lossy(&output.stdout);
            for line in text.lines() {
                if let Some(val) = line.strip_prefix("TotalVisibleMemorySize=") {
                    if let Ok(kb) = val.trim().parse::<u64>() {
                        let gb = ((kb + 524_288) / (1024 * 1024)) as usize;
                        if gb > 0 {
                            ram_gb = gb;
                        }
                    }
                }
            }
        }

        if let Ok(output) = std::process::Command::new("wmic")
            .args(["cpu", "get", "Name,NumberOfCores,NumberOfLogicalProcessors", "/Value"])
            .output()
        {
            let text = String::from_utf8_lossy(&output.stdout);
            for line in text.lines() {
                let trimmed = line.trim();
                if let Some(val) = trimmed.strip_prefix("Name=") {
                    if !val.is_empty() {
                        cpu_name = val.to_string();
                    }
                } else if let Some(val) = trimmed.strip_prefix("NumberOfCores=") {
                    if let Ok(c) = val.parse::<usize>() {
                        if c > 0 { cpu_cores = c; }
                    }
                } else if let Some(val) = trimmed.strip_prefix("NumberOfLogicalProcessors=") {
                    if let Ok(t) = val.parse::<usize>() {
                        if t > 0 { cpu_threads = t; }
                    }
                }
            }
        }

        if let Ok(output) = std::process::Command::new("wmic")
            .args(["path", "Win32_VideoController", "get", "Name", "/Value"])
            .output()
        {
            let text = String::from_utf8_lossy(&output.stdout);
            for line in text.lines() {
                if let Some(val) = line.strip_prefix("Name=") {
                    let trimmed = val.trim();
                    if !trimmed.is_empty() {
                        gpu_name = trimmed.to_string();
                        break;
                    }
                }
            }
        }
    }

    SystemSpecsInfo {
        cpuCores: cpu_cores,
        cpuThreads: cpu_threads,
        ramGb: ram_gb,
        cpuName: cpu_name,
        gpuName: gpu_name,
    }
}


/// Sends a raw JSON command line to the C# audio engine, starting the
/// process if necessary. Example payload:
/// {"command":"play","path":"D:\\music\\song.flac","exclusive":true}
#[tauri::command]
fn send_audio_command(app: AppHandle, json: String) -> Result<(), String> {
    sidecar::send_command(&app, &json)
}

#[tauri::command]
fn stop_audio_engine() -> Result<(), String> {
    sidecar::stop_engine()
}

#[tauri::command]
fn is_audio_engine_running() -> bool {
    sidecar::is_running()
}

#[tauri::command]
async fn open_webview_stream(
    app: tauri::AppHandle,
    url: String,
    label: String,
    title: String,
) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&label) {
        let parsed = Url::parse(&url).map_err(|e| e.to_string())?;
        let _ = window.navigate(parsed);
        let _ = window.show();
        let _ = window.set_focus();
        return Ok(());
    }

    let _window = WebviewWindowBuilder::new(
        &app,
        &label,
        WebviewUrl::External(Url::parse(&url).map_err(|e| e.to_string())?),
    )
    .title(&title)
    .inner_size(1200.0, 800.0)
    .min_inner_size(800.0, 600.0)
    .build()
    .map_err(|e| e.to_string())?;

    // Poll URL periodically to catch SPA navigations (pushState/replaceState)
    // that on_navigation doesn't intercept
    let app_clone = app.clone();
    let label_clone = label.clone();
    std::thread::spawn(move || {
        let mut last_url: Option<String> = None;
        loop {
            std::thread::sleep(Duration::from_secs(1));
            if let Some(w) = app_clone.get_webview_window(&label_clone) {
                match w.url() {
                    Ok(current_url) => {
                        let url_str = current_url.as_str().to_string();
                        let is_new = match &last_url {
                            Some(prev) => &url_str != prev,
                            None => true,
                        };
                        if is_new && is_media_url(&url_str) {
                            let _ = app_clone.emit("stream-url-changed", &url_str);
                        }
                        last_url = Some(url_str);
                    }
                    Err(_) => {
                        // webview not ready yet, skip
                    }
                }
            } else {
                break; // window closed
            }
        }
    });

    Ok(())
}

fn is_media_url(url: &str) -> bool {
    if url.contains("youtube.com/watch?v=")
        || url.contains("youtu.be/")
        || url.contains("/shorts/")
    {
        return true;
    }
    if url.contains("music.youtube.com/watch?v=")
        || url.contains("music.youtube.com/playlist?list=")
    {
        return true;
    }
    if url.contains("open.spotify.com/track/")
        || url.contains("open.spotify.com/album/")
        || url.contains("open.spotify.com/playlist/")
        || url.contains("open.spotify.com/episode/")
        || url.contains("open.spotify.com/show/")
    {
        return true;
    }
    if url.contains("soundcloud.com/") {
        let path = url.split("soundcloud.com/").nth(1).unwrap_or("");
        let segments: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();
        if segments.len() >= 2 {
            return true;
        }
    }
    if url.contains("bandcamp.com/track/")
        || url.contains(".bandcamp.com/track/")
        || url.contains("bandcamp.com/album/")
        || url.contains(".bandcamp.com/album/")
    {
        return true;
    }
    if url.contains("deezer.com/track/")
        || url.contains("deezer.com/album/")
        || url.contains("deezer.com/playlist/")
    {
        return true;
    }
    if url.contains("tidal.com/track/")
        || url.contains("tidal.com/album/")
        || url.contains("tidal.com/playlist/")
    {
        return true;
    }
    if url.contains("music.apple.com/") {
        let path_segments: Vec<&str> = url.split('/').filter(|s| !s.is_empty()).collect();
        if path_segments.iter().any(|s| *s == "album" || *s == "song" || *s == "playlist") {
            return true;
        }
    }
    false
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
            // Kill the sidecar engine so it never outlives the host app.
            let _ = sidecar::stop_engine();
            plugin_manager::cancel_download();
            if RESET_ON_CLOSE.load(Ordering::SeqCst) {
                let has_default = DEFAULT_WALLPAPER_PATH.lock()
                    .map(|p| p.is_some())
                    .unwrap_or(false);
                if has_default {
                    let _ = clear_wallpaper_internal();
                }
            }
        }
    });
}
