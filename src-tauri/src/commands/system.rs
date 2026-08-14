use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

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
static VOLUME_CALLBACK_REGISTERED: AtomicBool = AtomicBool::new(false);

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
pub fn get_system_volume() -> Result<u32, String> {
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
pub fn set_system_volume(value: u32) -> Result<(), String> {
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
pub fn get_system_mute() -> Result<bool, String> {
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
pub fn set_system_mute(mute: bool) -> Result<(), String> {
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
pub fn register_volume_callback(app: AppHandle) -> Result<(), String> {
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
                
                let _ = Box::leak(Box::new(VolumeCallbackWrapper {
                    callback,
                    endpoint,
                }));

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
pub fn register_volume_callback(_app: AppHandle) -> Result<(), String> {
    Err("Volume callback only available on Windows".to_string())
}

#[cfg(windows)]
#[tauri::command]
pub fn unregister_volume_callback() -> Result<(), String> {
    VOLUME_CALLBACK_REGISTERED.store(false, Ordering::SeqCst);
    Ok(())
}

#[cfg(not(windows))]
#[tauri::command]
pub fn unregister_volume_callback() -> Result<(), String> {
    Err("Volume callback only available on Windows".to_string())
}

#[tauri::command]
pub async fn pick_folder() -> Result<Option<String>, String> {
    let folder = rfd::AsyncFileDialog::new()
        .set_title("Pilih folder musik")
        .pick_folder()
        .await;

    Ok(folder.map(|f| f.path().to_string_lossy().to_string()))
}

#[tauri::command]
pub async fn pick_audio_file() -> Result<Option<String>, String> {
    let file = rfd::AsyncFileDialog::new()
        .set_title("Pilih file audio")
        .add_filter("Audio", &["mp3", "flac", "wav", "m4a", "aac", "ogg", "opus", "wma"])
        .pick_file()
        .await;
    Ok(file.map(|f| f.path().to_string_lossy().to_string()))
}

#[tauri::command]
pub async fn pick_single_file(
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
pub async fn open_devtools(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.open_devtools();
        Ok(())
    } else {
        Err("Main webview window not found".to_string())
    }
}

#[tauri::command]
pub fn open_external_url(url: String) -> Result<(), String> {
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
pub struct SystemSpecsInfo {
    pub cpuCores: usize,
    pub cpuThreads: usize,
    pub ramGb: usize,
    pub cpuName: String,
    pub gpuName: String,
}

#[tauri::command]
pub fn get_system_specs() -> SystemSpecsInfo {
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
                if let Some(val) = line.strip_prefix("Name=") {
                    if !val.is_empty() {
                        cpu_name = val.to_string();
                    }
                } else if let Some(val) = line.strip_prefix("NumberOfCores=") {
                    if let Ok(c) = val.parse::<usize>() {
                        if c > 0 { cpu_cores = c; }
                    }
                } else if let Some(val) = line.strip_prefix("NumberOfLogicalProcessors=") {
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
