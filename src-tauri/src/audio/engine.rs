use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::Emitter;

use super::decoder::{AudioDecoder, AudioStreamInfo};
use super::output::{AudioOutput, OutputMode};

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
    SetOutputMode(OutputMode),
    SetDevice(Option<String>),
}

pub struct AudioEngineState {
    pub is_playing: bool,
    pub is_paused: bool,
    pub volume: f32,
    pub output_mode: OutputMode,
    pub device_name: Option<String>,
    pub stream_info: Option<AudioStreamInfo>,
}

impl Default for AudioEngineState {
    fn default() -> Self {
        Self {
            is_playing: false,
            is_paused: false,
            volume: 1.0,
            output_mode: OutputMode::Shared,
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

            loop {
                // Handle pending commands from frontend
                while let Ok(cmd) = rx.try_recv() {
                    match cmd {
                        EngineCommand::Play(path) => {
                            match AudioDecoder::open(&path) {
                                Ok(decoder) => {
                                    let info = decoder.get_stream_info();
                                    log::info!("Opened audio stream: {:?}", info);

                                    let mode = {
                                        let s = state_clone.lock().unwrap();
                                        s.output_mode.clone()
                                    };
                                    let dev_name = {
                                        let s = state_clone.lock().unwrap();
                                        s.device_name.clone()
                                    };

                                    match AudioOutput::new(
                                        dev_name.as_deref(),
                                        info.sample_rate,
                                        info.channels,
                                        mode,
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
                        EngineCommand::SetOutputMode(mode) => {
                            let mut s = state_clone.lock().unwrap();
                            s.output_mode = mode;
                        }
                        EngineCommand::SetDevice(dev) => {
                            let mut s = state_clone.lock().unwrap();
                            s.device_name = dev;
                        }
                    }
                }

                // Audio Playback Processing Step
                let is_active = {
                    let s = state_clone.lock().unwrap();
                    s.is_playing && !s.is_paused
                };

                if is_active {
                    if let (Some(decoder), Some(output)) = (current_decoder.as_mut(), current_output.as_mut()) {
                        // Refill buffer if needed
                        if pending_offset >= pending_samples.len() {
                            match decoder.decode_next() {
                                Ok(Some(samples)) => {
                                    pending_samples = samples;
                                    // Apply software volume scaling unless in Exclusive (Bit-Perfect) mode
                                    let is_exclusive = {
                                        let s = state_clone.lock().unwrap();
                                        s.output_mode == OutputMode::Exclusive
                                    };
                                    if !is_exclusive && (target_volume - 1.0).abs() > 0.001 {
                                        for s in pending_samples.iter_mut() {
                                            *s *= target_volume;
                                        }
                                    }
                                    pending_offset = 0;
                                }
                                Ok(None) => {
                                    // End of stream
                                    let mut s = state_clone.lock().unwrap();
                                    s.is_playing = false;
                                    s.is_paused = false;
                                    let _ = app_handle.emit("engine-state", EngineStateEvent {
                                        is_playing: false,
                                        is_paused: false,
                                        is_stopped: true,
                                    });
                                }
                                Err(e) => {
                                    log::error!("Error decoding frame: {}", e);
                                }
                            }
                        }

                        // Push samples to output
                        if pending_offset < pending_samples.len() {
                            let unwritten = &pending_samples[pending_offset..];
                            let written = output.push_samples(unwritten);
                            pending_offset += written;

                            let samples_per_sec = output.sample_rate as f64 * output.channels as f64;
                            if samples_per_sec > 0.0 {
                                playback_position_sec += written as f64 / samples_per_sec;
                            }

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

    pub fn set_output_mode(&self, mode: OutputMode) {
        let _ = self.sender.send(EngineCommand::SetOutputMode(mode));
    }

    pub fn set_device(&self, device_name: Option<String>) {
        let _ = self.sender.send(EngineCommand::SetDevice(device_name));
    }
}
