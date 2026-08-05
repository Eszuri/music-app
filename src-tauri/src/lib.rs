use rayon::prelude::*;
use std::ffi::OsStr;
use std::fs;
use std::io::{Read, Seek};
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, SystemTime};

mod audio;

use audio::engine::AudioEngineHandle;
use audio::output::{get_audio_hosts_and_devices, AudioDeviceInfo};

static AUDIO_ENGINE: std::sync::OnceLock<AudioEngineHandle> = std::sync::OnceLock::new();

#[tauri::command]
fn engine_play(path: String) -> Result<(), String> {
    if let Some(engine) = AUDIO_ENGINE.get() {
        engine.play(std::path::PathBuf::from(path));
        Ok(())
    } else {
        Err("Audio engine not initialized".to_string())
    }
}

#[tauri::command]
fn engine_pause() -> Result<(), String> {
    if let Some(engine) = AUDIO_ENGINE.get() {
        engine.pause();
        Ok(())
    } else {
        Err("Audio engine not initialized".to_string())
    }
}

#[tauri::command]
fn engine_resume() -> Result<(), String> {
    if let Some(engine) = AUDIO_ENGINE.get() {
        engine.resume();
        Ok(())
    } else {
        Err("Audio engine not initialized".to_string())
    }
}

#[tauri::command]
fn engine_stop() -> Result<(), String> {
    if let Some(engine) = AUDIO_ENGINE.get() {
        engine.stop();
        Ok(())
    } else {
        Err("Audio engine not initialized".to_string())
    }
}

#[tauri::command]
fn engine_seek(position_secs: f64) -> Result<(), String> {
    if let Some(engine) = AUDIO_ENGINE.get() {
        engine.seek(position_secs);
        Ok(())
    } else {
        Err("Audio engine not initialized".to_string())
    }
}

#[tauri::command]
fn engine_set_volume(volume: f32) -> Result<(), String> {
    if let Some(engine) = AUDIO_ENGINE.get() {
        engine.set_volume(volume);
        Ok(())
    } else {
        Err("Audio engine not initialized".to_string())
    }
}



#[tauri::command]
fn engine_get_output_devices() -> Result<Vec<AudioDeviceInfo>, String> {
    Ok(get_audio_hosts_and_devices())
}

#[tauri::command]
fn engine_set_output_device(name: Option<String>) -> Result<(), String> {
    if let Some(engine) = AUDIO_ENGINE.get() {
        engine.set_device(name);
        Ok(())
    } else {
        Err("Audio engine not initialized".to_string())
    }
}

#[cfg(windows)]
use std::os::windows::ffi::OsStrExt;

use base64::Engine;
use lofty::file::AudioFile;
use lofty::file::TaggedFileExt;
use lofty::read_from_path;
use lofty::tag::Accessor;
use serde::Serialize;
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
            });
        }
    };

    let props = tagged_file.properties();
    let duration = props.duration().as_secs_f64();
    let bitrate = props.audio_bitrate();
    let sample_rate = props.sample_rate();
    let channels = props.channels();

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
    })
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

    let mut tagged_file = read_from_path(path).map_err(|e| format!("Failed to read metadata: {}", e))?;

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
        let bmp_path = temp_dir.join("mw-def.bmp");
        img.save_with_format(&bmp_path, image::ImageFormat::Bmp)
            .map_err(|e| format!("Failed to save BMP: {}", e))?;
        apply_wallpaper(&bmp_path)
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
        let bmp_path = temp_dir.join("mw-cover.bmp");

        img.save_with_format(&bmp_path, image::ImageFormat::Bmp)
            .map_err(|e| format!("Gagal save BMP: {}", e))?;

        apply_wallpaper(&bmp_path)
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
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
            open_devtools,
            save_cover_image,
            set_default_wallpaper_path,
            get_default_wallpaper_path,
            set_reset_on_close,
            open_webview_stream,
            engine_play,
            engine_pause,
            engine_resume,
            engine_stop,
            engine_seek,
            engine_set_volume,
            engine_get_output_devices,
            engine_set_output_device
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
            let handle = app.handle().clone();
            let _ = AUDIO_ENGINE.set(AudioEngineHandle::new(handle));

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
