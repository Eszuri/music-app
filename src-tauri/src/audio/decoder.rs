use std::fs::File;
use std::path::Path;
use symphonia::core::audio::{AudioBuffer, AudioBufferRef, Signal};
use symphonia::core::codecs::{Decoder, DecoderOptions, CODEC_TYPE_NULL};
use symphonia::core::errors::Error;
use symphonia::core::formats::{FormatOptions, FormatReader, SeekMode, SeekTo};
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;
use symphonia::core::units::Time;

#[derive(Debug, Clone, serde::Serialize)]
pub struct AudioStreamInfo {
    pub sample_rate: u32,
    pub bit_depth: Option<u32>,
    pub channels: u16,
    pub duration_secs: f64,
    pub format_name: String,
}

pub struct AudioDecoder {
    format: Box<dyn FormatReader>,
    decoder: Box<dyn Decoder>,
    track_id: u32,
    pub sample_rate: u32,
    pub bit_depth: Option<u32>,
    pub channels: u16,
    pub _total_samples: Option<u64>,
    pub duration_secs: f64,
    pub format_name: String,
}

impl AudioDecoder {
    pub fn open<P: AsRef<Path>>(path: P) -> Result<Self, String> {
        let file = File::open(&path).map_err(|e| format!("Failed to open file: {}", e))?;
        let mss = MediaSourceStream::new(Box::new(file), Default::default());

        let mut hint = Hint::new();
        if let Some(ext) = path.as_ref().extension().and_then(|e| e.to_str()) {
            hint.with_extension(ext);
        }

        let format_opts: FormatOptions = Default::default();
        let metadata_opts: MetadataOptions = Default::default();
        let decoder_opts: DecoderOptions = Default::default();

        let probed = symphonia::default::get_probe()
            .format(&hint, mss, &format_opts, &metadata_opts)
            .map_err(|e| format!("Failed to probe audio format: {}", e))?;

        let format = probed.format;
        let format_name = path
            .as_ref()
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("audio")
            .to_uppercase();

        let track = format
            .tracks()
            .iter()
            .find(|t| t.codec_params.codec != CODEC_TYPE_NULL)
            .ok_or_else(|| "No supported audio track found".to_string())?;

        let track_id = track.id;
        let codec_params = &track.codec_params;

        let sample_rate = codec_params.sample_rate.unwrap_or(44100);
        let bit_depth = codec_params.bits_per_sample;
        let channels = codec_params.channels.map(|c| c.count() as u16).unwrap_or(2);
        let total_samples = codec_params.n_frames;

        let time_base = codec_params.time_base;
        let duration_secs = match (total_samples, time_base) {
            (Some(n_frames), Some(tb)) => {
                let time = tb.calc_time(n_frames);
                time.seconds as f64 + time.frac
            }
            _ => 0.0,
        };

        let decoder = symphonia::default::get_codecs()
            .make(codec_params, &decoder_opts)
            .map_err(|e| format!("Failed to create audio decoder: {}", e))?;

        Ok(Self {
            format,
            decoder,
            track_id,
            sample_rate,
            bit_depth,
            channels,
            _total_samples: total_samples,
            duration_secs,
            format_name,
        })
    }

    pub fn get_stream_info(&self) -> AudioStreamInfo {
        AudioStreamInfo {
            sample_rate: self.sample_rate,
            bit_depth: self.bit_depth,
            channels: self.channels,
            duration_secs: self.duration_secs,
            format_name: self.format_name.clone(),
        }
    }

    /// Decode the next packet and return interleaved f32 PCM samples
    pub fn decode_next(&mut self) -> Result<Option<Vec<f32>>, String> {
        loop {
            let packet = match self.format.next_packet() {
                Ok(packet) => packet,
                Err(Error::IoError(ref e)) if e.kind() == std::io::ErrorKind::UnexpectedEof => {
                    return Ok(None);
                }
                Err(Error::ResetRequired) => {
                    return Ok(None);
                }
                Err(e) => return Err(format!("Decode packet error: {}", e)),
            };

            if packet.track_id() != self.track_id {
                continue;
            }

            match self.decoder.decode(&packet) {
                Ok(audio_buf) => {
                    let samples = convert_audio_buf_to_interleaved_f32(&audio_buf);
                    return Ok(Some(samples));
                }
                Err(Error::DecodeError(e)) => {
                    log::warn!("Decode frame error, skipping: {}", e);
                    continue;
                }
                Err(e) => return Err(format!("Fatal decode error: {}", e)),
            }
        }
    }

    pub fn seek_to_secs(&mut self, time_secs: f64) -> Result<(), String> {
        let seek_to = SeekTo::Time {
            time: Time::from(time_secs),
            track_id: Some(self.track_id),
        };
        self.format
            .seek(SeekMode::Accurate, seek_to)
            .map_err(|e| format!("Seek failed: {}", e))?;
        self.decoder.reset();
        Ok(())
    }
}

fn convert_audio_buf_to_interleaved_f32(buf_ref: &AudioBufferRef) -> Vec<f32> {
    match buf_ref {
        AudioBufferRef::U8(buf) => convert_buf(buf, |s| (s as f32 - 128.0) / 128.0),
        AudioBufferRef::U16(buf) => convert_buf(buf, |s| (s as f32 - 32768.0) / 32768.0),
        AudioBufferRef::U24(buf) => convert_buf(buf, |s| (s.inner() as f32 - 8388608.0) / 8388608.0),
        AudioBufferRef::U32(buf) => convert_buf(buf, |s| (s as f32 - 2147483648.0) / 2147483648.0),
        AudioBufferRef::S8(buf) => convert_buf(buf, |s| s as f32 / 128.0),
        AudioBufferRef::S16(buf) => convert_buf(buf, |s| s as f32 / 32768.0),
        AudioBufferRef::S24(buf) => convert_buf(buf, |s| s.inner() as f32 / 8388608.0),
        AudioBufferRef::S32(buf) => convert_buf(buf, |s| s as f32 / 2147483648.0),
        AudioBufferRef::F32(buf) => convert_buf(buf, |s| s),
        AudioBufferRef::F64(buf) => convert_buf(buf, |s| s as f32),
    }
}

fn convert_buf<T: symphonia::core::sample::Sample, F: Fn(T) -> f32>(
    buf: &AudioBuffer<T>,
    to_f32: F,
) -> Vec<f32> {
    let num_channels = buf.spec().channels.count();
    let num_frames = buf.frames();
    let mut out = Vec::with_capacity(num_channels * num_frames);

    for frame in 0..num_frames {
        for channel in 0..num_channels {
            let sample = buf.chan(channel)[frame];
            out.push(to_f32(sample));
        }
    }
    out
}
