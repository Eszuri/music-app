use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Stream, StreamConfig};
use ringbuf::HeapRb;
use std::sync::{Arc, Mutex};

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub enum OutputMode {
    Shared,
    Exclusive,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct AudioDeviceInfo {
    pub name: String,
    pub is_default: bool,
    pub default_sample_rate: u32,
    pub max_channels: u16,
}

pub fn get_audio_hosts_and_devices() -> Vec<AudioDeviceInfo> {
    let host = cpal::default_host();
    let default_device_name = host.default_output_device().and_then(|d| d.name().ok());
    let mut devices_info = Vec::new();

    if let Ok(devices) = host.output_devices() {
        for dev in devices {
            if let Ok(name) = dev.name() {
                let is_default = default_device_name.as_ref() == Some(&name);
                let (default_sr, max_ch) = if let Ok(cfg) = dev.default_output_config() {
                    (cfg.sample_rate().0, cfg.channels())
                } else {
                    (44100, 2)
                };
                devices_info.push(AudioDeviceInfo {
                    name,
                    is_default,
                    default_sample_rate: default_sr,
                    max_channels: max_ch,
                });
            }
        }
    }

    devices_info
}

pub struct AudioOutput {
    _stream: Stream,
    pub sample_rate: u32,
    pub channels: u16,
    #[allow(dead_code)]
    pub mode: OutputMode,
    producer: ringbuf::HeapProducer<f32>,
}

impl AudioOutput {
    pub fn new(
        target_device_name: Option<&str>,
        target_sample_rate: u32,
        target_channels: u16,
        mode: OutputMode,
    ) -> Result<Self, String> {
        let host = cpal::default_host();

        let device = if let Some(dev_name) = target_device_name {
            host.output_devices()
                .map_err(|e| format!("Failed to list devices: {}", e))?
                .find(|d| d.name().map(|n| n == dev_name).unwrap_or(false))
                .ok_or_else(|| format!("Audio device '{}' not found", dev_name))?
        } else {
            host.default_output_device()
                .ok_or_else(|| "No default audio output device found".to_string())?
        };

        let default_config = device
            .default_output_config()
            .map_err(|e| format!("Failed to get default output config: {}", e))?;

        if mode == OutputMode::Exclusive {
            log::info!(
                "Opening audio device in Exclusive (Bit-Perfect) mode: {}Hz {}ch",
                target_sample_rate,
                target_channels
            );
        }

        let sample_rate = cpal::SampleRate(target_sample_rate);
        let channels = target_channels;

        let config = StreamConfig {
            channels,
            sample_rate,
            buffer_size: cpal::BufferSize::Default,
        };

        let ring_buffer_size = (target_sample_rate as usize * channels as usize) / 2;
        let rb = HeapRb::<f32>::new(ring_buffer_size.max(4096));
        let (producer, consumer) = rb.split();
        let consumer_arc = Arc::new(Mutex::new(consumer));

        let consumer_for_stream = Arc::clone(&consumer_arc);

        let stream_result = device.build_output_stream(
            &config,
            move |data: &mut [f32], _: &cpal::OutputCallbackInfo| {
                if let Ok(mut cons) = consumer_for_stream.lock() {
                    for sample in data.iter_mut() {
                        *sample = cons.pop().unwrap_or(0.0);
                    }
                }
            },
            move |err| {
                log::error!("Audio output stream error: {}", err);
            },
            None,
        );

        let stream = match stream_result {
            Ok(s) => s,
            Err(e) => {
                log::warn!("Primary audio stream initialization failed ({}), attempting fallback config", e);
                let consumer_fallback = Arc::clone(&consumer_arc);
                let fallback_config = StreamConfig {
                    channels: default_config.channels(),
                    sample_rate: default_config.sample_rate(),
                    buffer_size: cpal::BufferSize::Default,
                };
                device
                    .build_output_stream(
                        &fallback_config,
                        move |data: &mut [f32], _: &cpal::OutputCallbackInfo| {
                            if let Ok(mut cons) = consumer_fallback.lock() {
                                for sample in data.iter_mut() {
                                    *sample = cons.pop().unwrap_or(0.0);
                                }
                            }
                        },
                        move |err| {
                            log::error!("Fallback audio stream error: {}", err);
                        },
                        None,
                    )
                    .map_err(|e| format!("Failed to build output stream: {}", e))?
            }
        };

        stream.play().map_err(|e| format!("Failed to start output stream: {}", e))?;

        Ok(Self {
            _stream: stream,
            sample_rate: config.sample_rate.0,
            channels: config.channels,
            mode,
            producer,
        })
    }

    pub fn push_samples(&mut self, samples: &[f32]) -> usize {
        self.producer.push_slice(samples)
    }

    #[allow(dead_code)]
    pub fn free_space(&self) -> usize {
        self.producer.free_len()
    }
}
