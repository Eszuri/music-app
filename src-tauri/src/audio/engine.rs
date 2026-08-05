use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::Emitter;

use super::decoder::{AudioDecoder, AudioStreamInfo};
use super::output::AudioOutput;

#[derive(Debug, Clone, serde::Serialize)]
pub struct EnginePositionEvent {
    pub current_time: f64,
    pub duration: f64,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct EngineStateEvent {
    pub is_playing: bool,
    pub is_paused: bool,
    pub is_stopped: bool,
}

pub enum EngineCommand {
    Play(PathBuf),
    Pause,
    Resume,
    Stop,
    Seek(f64),
    SetVolume(f32),
    SetDevice(Option<String>),
}

pub struct AudioEngineState {
    pub is_playing: bool,
    pub is_paused: bool,
    pub volume: f32,
    pub device_name: Option<String>,
    pub stream_info: Option<AudioStreamInfo>,
}

impl Default for AudioEngineState {
    fn default() -> Self {
        Self {
            is_playing: false,
            is_paused: false,
            volume: 1.0,
            device_name: None,
            stream_info: None,
        }
    }
}

pub struct AudioEngineHandle {
    sender: crossbeam_channel::Sender<EngineCommand>,
    pub _state: Arc<Mutex<AudioEngineState>>,
}

impl AudioEngineHandle {
    pub fn new(app_handle: tauri::AppHandle) -> Self {
        let (tx, rx) = crossbeam_channel::unbounded::<EngineCommand>();
        let state = Arc::new(Mutex::new(AudioEngineState::default()));
        let state_clone = Arc::clone(&state);

        thread::spawn(move || {
            let mut current_decoder: Option<AudioDecoder> = None;
            let mut current_output: Option<AudioOutput> = None;
            let mut pending_samples: Vec<f32> = Vec::new();
            let mut pending_offset = 0;
            let mut playback_position_sec = 0.0;
            let mut target_volume = 1.0;
            let mut last_position_emit = std::time::Instant::now();

            loop {
                // Handle pending commands from frontend
                while let Ok(cmd) = rx.try_recv() {
                    match cmd {
                        EngineCommand::Play(path) => {
                            current_output = None;
                            current_decoder = None;
                            match AudioDecoder::open(&path) {
                                Ok(decoder) => {
                                    let info = decoder.get_stream_info();
                                    log::info!("Opened audio stream: {:?}", info);

                                    let dev_name = {
                                        let s = state_clone.lock().unwrap();
                                        s.device_name.clone()
                                    };

                                    match AudioOutput::new(
                                        dev_name.as_deref(),
                                        info.sample_rate,
                                        info.channels,
                                    ) {
                                        Ok(out) => {
                                            current_output = Some(out);
                                            current_decoder = Some(decoder);
                                            pending_samples.clear();
                                            pending_offset = 0;
                                            playback_position_sec = 0.0;

                                            let mut s = state_clone.lock().unwrap();
                                            s.is_playing = true;
                                            s.is_paused = false;
                                            s.stream_info = Some(info.clone());

                                            let _ = app_handle.emit("engine-stream-info", info);
                                            let _ = app_handle.emit("engine-state", EngineStateEvent {
                                                is_playing: true,
                                                is_paused: false,
                                                is_stopped: false,
                                            });
                                        }
                                        Err(e) => {
                                            log::error!("Failed to create audio output stream: {}", e);
                                            let _ = app_handle.emit("engine-error", e);
                                        }
                                    }
                                }
                                Err(e) => {
                                    log::error!("Failed to decode file: {}", e);
                                    let _ = app_handle.emit("engine-error", e);
                                }
                            }
                        }
                        EngineCommand::Pause => {
                            let mut s = state_clone.lock().unwrap();
                            s.is_playing = false;
                            s.is_paused = true;
                            let _ = app_handle.emit("engine-state", EngineStateEvent {
                                is_playing: false,
                                is_paused: true,
                                is_stopped: false,
                            });
                        }
                        EngineCommand::Resume => {
                            let mut s = state_clone.lock().unwrap();
                            if s.is_paused {
                                s.is_playing = true;
                                s.is_paused = false;
                                let _ = app_handle.emit("engine-state", EngineStateEvent {
                                    is_playing: true,
                                    is_paused: false,
                                    is_stopped: false,
                                });
                            }
                        }
                        EngineCommand::Stop => {
                            current_decoder = None;
                            current_output = None;
                            pending_samples.clear();
                            pending_offset = 0;
                            playback_position_sec = 0.0;

                            let mut s = state_clone.lock().unwrap();
                            s.is_playing = false;
                            s.is_paused = false;
                            s.stream_info = None;
                            let _ = app_handle.emit("engine-state", EngineStateEvent {
                                is_playing: false,
                                is_paused: false,
                                is_stopped: true,
                            });
                        }
                        EngineCommand::Seek(secs) => {
                            if let Some(ref mut decoder) = current_decoder {
                                if decoder.seek_to_secs(secs).is_ok() {
                                    pending_samples.clear();
                                    pending_offset = 0;
                                    playback_position_sec = secs;
                                    let duration = decoder.duration_secs;
                                    let _ = app_handle.emit("engine-position", EnginePositionEvent {
                                        current_time: secs,
                                        duration,
                                    });
                                }
                            }
                        }
                        EngineCommand::SetVolume(vol) => {
                            target_volume = vol.clamp(0.0, 1.0);
                            let mut s = state_clone.lock().unwrap();
                            s.volume = target_volume;
                        }
                        EngineCommand::SetDevice(dev) => {
                            let mut s = state_clone.lock().unwrap();
                            s.device_name = dev;
                            current_output = None;
                        }
                    }
                }

                // Audio Playback Processing Step
                let is_active = {
                    let s = state_clone.lock().unwrap();
                    s.is_playing && !s.is_paused
                };

                if is_active {
                    if current_output.is_none() && current_decoder.is_some() {
                        if let Some(ref decoder) = current_decoder {
                            let info = decoder.get_stream_info();
                            let dev_name = {
                                let s = state_clone.lock().unwrap();
                                s.device_name.clone()
                            };
                            match AudioOutput::new(dev_name.as_deref(), info.sample_rate, info.channels) {
                                Ok(out) => current_output = Some(out),
                                Err(e) => log::error!("Failed to recreate output stream: {}", e),
                            }
                        }
                    }

                    if let (Some(decoder), Some(output)) = (current_decoder.as_mut(), current_output.as_mut()) {
                        // Keep ring buffer continuously filled
                        while output.free_space() >= 1024 {
                            if pending_offset >= pending_samples.len() {
                                match decoder.decode_next() {
                                    Ok(Some(mut samples)) => {
                                        if (target_volume - 1.0).abs() > 0.001 {
                                            for s in samples.iter_mut() {
                                                *s *= target_volume;
                                            }
                                        }
                                        pending_samples = samples;
                                        pending_offset = 0;
                                    }
                                    Ok(None) => {
                                        let mut s = state_clone.lock().unwrap();
                                        s.is_playing = false;
                                        s.is_paused = false;
                                        let _ = app_handle.emit("engine-state", EngineStateEvent {
                                            is_playing: false,
                                            is_paused: false,
                                            is_stopped: true,
                                        });
                                        break;
                                    }
                                    Err(e) => {
                                        log::error!("Error decoding frame: {}", e);
                                        break;
                                    }
                                }
                            }

                            if pending_offset < pending_samples.len() {
                                let unwritten = &pending_samples[pending_offset..];
                                let written = output.push_samples(unwritten);
                                if written == 0 {
                                    break;
                                }
                                pending_offset += written;

                                let samples_per_sec = output.sample_rate as f64 * output.channels as f64;
                                if samples_per_sec > 0.0 {
                                    playback_position_sec += written as f64 / samples_per_sec;
                                }
                            }
                        }

                        // Throttle position IPC emits to 4Hz (every 250ms) to eliminate UI thread lag
                        if last_position_emit.elapsed() >= Duration::from_millis(250) {
                            last_position_emit = std::time::Instant::now();
                            let _ = app_handle.emit("engine-position", EnginePositionEvent {
                                current_time: playback_position_sec,
                                duration: decoder.duration_secs,
                            });
                        }
                    }
                }

                thread::sleep(Duration::from_millis(10));
            }
        });

        Self { sender: tx, _state: state }
    }

    pub fn play(&self, path: PathBuf) {
        let _ = self.sender.send(EngineCommand::Play(path));
    }

    pub fn pause(&self) {
        let _ = self.sender.send(EngineCommand::Pause);
    }

    pub fn resume(&self) {
        let _ = self.sender.send(EngineCommand::Resume);
    }

    pub fn stop(&self) {
        let _ = self.sender.send(EngineCommand::Stop);
    }

    pub fn seek(&self, secs: f64) {
        let _ = self.sender.send(EngineCommand::Seek(secs));
    }

    pub fn set_volume(&self, volume: f32) {
        let _ = self.sender.send(EngineCommand::SetVolume(volume));
    }

    pub fn set_device(&self, device_name: Option<String>) {
        let _ = self.sender.send(EngineCommand::SetDevice(device_name));
    }
}
