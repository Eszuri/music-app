using NAudio.CoreAudioApi;
using NAudio.Wave;
using NAudio.Wave.SampleProviders;

namespace Symvonia.AudioEngine;

/// <summary>
/// NAudio playback pipeline: AudioFileReader → WasapiOut.
/// Supports WASAPI Exclusive (bit-perfect) and Shared modes.
/// All public members are thread-safe; NAudio callbacks arrive on worker threads.
/// </summary>
public sealed class AudioPlayer : IDisposable
{
    private readonly object _gate = new();

    private AudioFileReader? _reader;
    private PausableSampleProvider? _pausable;
    private WasapiOut? _output;
    private MMDevice? _device;
    private Timer? _progressTimer;

    private string? _currentPath;
    private bool _exclusive;
    private float _volume = 1.0f;
    private bool _disposed;

    /// <summary>Natural end-of-track reached (not a user-initiated stop).</summary>
    public event Action? PlaybackEnded;

    public string? CurrentPath
    {
        get { lock (_gate) return _currentPath; }
    }

    public bool IsExclusive
    {
        get { lock (_gate) return _exclusive; }
    }

    public bool IsPlaying
    {
        get
        {
            lock (_gate)
                return _output?.PlaybackState == PlaybackState.Playing && _pausable != null && !_pausable.IsPaused;
        }
    }

    public bool IsPaused
    {
        get
        {
            lock (_gate)
                return _output?.PlaybackState == PlaybackState.Playing && _pausable != null && _pausable.IsPaused;
        }
    }

    public (int? rate, int? bits) CurrentFormat
    {
        get
        {
            lock (_gate)
            {
                if (_output?.OutputWaveFormat is { } wf)
                    return (wf.SampleRate, wf.BitsPerSample);
                return (null, null);
            }
        }
    }

    public string? DeviceName
    {
        get { lock (_gate) return _device?.FriendlyName; }
    }

    /// <summary>
    /// Loads a file and starts playback. When exclusive=true, tries WASAPI
    /// Exclusive with the source's native sample rate at float32 → PCM24 → PCM16.
    /// Throws on failure; caller converts exceptions into error events.
    /// </summary>
    public void Play(string path, bool exclusive, string? deviceId)
    {
        if (!File.Exists(path))
            throw new FileNotFoundException("Audio file not found", path);

        lock (_gate)
        {
            StopLocked();

            _reader = new AudioFileReader(path) { Volume = _volume };
            _device = ResolveDevice(deviceId);
            _pausable = new PausableSampleProvider(_reader);

            if (exclusive)
            {
                // CreateExclusiveOutput returns an already-initialized WasapiOut.
                // Do NOT call Init again — a second Init would try to re-acquire
                // the device we just grabbed exclusively (AUDCLNT_E_DEVICE_IN_USE)
                // and would discard the PCM-conversion wrapper.
                _output = CreateExclusiveOutput(_device, _pausable);
            }
            else
            {
                _output = new WasapiOut(_device, AudioClientShareMode.Shared, true, 200);
                _output.Init(_pausable.ToWaveProvider());
            }

            _output.PlaybackStopped += OnPlaybackStopped;
            _currentPath = path;
            _exclusive = exclusive;
            _output.Play();
            StartProgressTimerLocked();
        }
    }

    private static WasapiOut CreateExclusiveOutput(MMDevice device, ISampleProvider reader)
    {
        int sourceRate = reader.WaveFormat.SampleRate;
        int channels = reader.WaveFormat.Channels;

        // Candidate formats, most bit-transparent first. float32 is the native
        // output of AudioFileReader (no conversion at all); PCM24/16 require an
        // in-memory bit-depth conversion but keep the source sample rate.
        var attempts = new List<(Func<ISampleProvider, IWaveProvider> wrap, string label)>
        {
            ((Func<ISampleProvider, IWaveProvider>)(r => r.ToWaveProvider()), $"float32 {sourceRate}Hz"),
            ((Func<ISampleProvider, IWaveProvider>)(r => new SampleToWaveProvider24(r)), $"pcm24 {sourceRate}Hz"),
            ((Func<ISampleProvider, IWaveProvider>)(r => new SampleToWaveProvider16(r)), $"pcm16 {sourceRate}Hz"),
        };

        Exception? lastError = null;
        foreach (var (wrap, label) in attempts)
        {
            IWaveProvider? provider = null;
            WasapiOut? candidate = null;
            try
            {
                provider = wrap(reader);
                candidate = new WasapiOut(device, AudioClientShareMode.Exclusive, true, 50);
                candidate.Init(provider);
                return candidate;
            }
            catch (Exception ex)
            {
                lastError = ex;
                try { candidate?.Dispose(); } catch { /* ignore */ }
            }
        }

        throw new InvalidOperationException(
            $"DAC does not support {channels}ch @ {sourceRate}Hz in WASAPI Exclusive mode (tried float32/24-bit/16-bit). {lastError?.Message}");
    }

    public void Pause()
    {
        lock (_gate)
        {
            if (_output?.PlaybackState == PlaybackState.Playing && _pausable != null)
            {
                _pausable.IsPaused = true;
            }
        }
    }

    public void Resume()
    {
        lock (_gate)
        {
            if (_output?.PlaybackState == PlaybackState.Playing && _pausable != null)
            {
                _pausable.IsPaused = false;
            }
        }
    }

    public void Stop()
    {
        lock (_gate)
        {
            StopLocked();
        }
    }

    private void StopLocked()
    {
        StopProgressTimerLocked();
        if (_output != null)
        {
            try { _output.PlaybackStopped -= OnPlaybackStopped; } catch { /* ignore */ }
            try { _output.Stop(); } catch { /* ignore */ }
            try { _output.Dispose(); } catch { /* ignore */ }
            _output = null;
        }
        if (_reader != null)
        {
            try { _reader.Dispose(); } catch { /* ignore */ }
            _reader = null;
        }
        _currentPath = null;
    }

    public void Seek(double seconds)
    {
        lock (_gate)
        {
            if (_reader == null) return;
            double clamped = Math.Clamp(seconds, 0, _reader.TotalTime.TotalSeconds);
            _reader.CurrentTime = TimeSpan.FromSeconds(clamped);
        }
    }

    public void SetVolume(float volume)
    {
        lock (_gate)
        {
            _volume = Math.Clamp(volume, 0f, 1f);
            if (_reader != null)
                _reader.Volume = _volume;
        }
    }

    public (double position, double duration) GetProgress()
    {
        lock (_gate)
        {
            if (_reader == null) return (0, 0);
            return (_reader.CurrentTime.TotalSeconds, _reader.TotalTime.TotalSeconds);
        }
    }

    public static List<Protocol.DeviceInfo> GetDevices()
    {
        var result = new List<Protocol.DeviceInfo>();
        using var enumerator = new MMDeviceEnumerator();
        MMDevice? defaultDevice = null;
        try { defaultDevice = enumerator.GetDefaultAudioEndpoint(DataFlow.Render, Role.Multimedia); }
        catch { /* no default device */ }

        foreach (var dev in enumerator.EnumerateAudioEndPoints(DataFlow.Render, DeviceState.Active))
        {
            using (dev)
            {
                result.Add(new Protocol.DeviceInfo
                {
                    Id = dev.ID,
                    Name = dev.FriendlyName,
                    IsDefault = defaultDevice != null && dev.ID == defaultDevice.ID,
                });
            }
        }
        return result;
    }

    private static MMDevice ResolveDevice(string? deviceId)
    {
        var enumerator = new MMDeviceEnumerator();
        try
        {
            if (!string.IsNullOrEmpty(deviceId))
            {
                try
                {
                    return enumerator.GetDevice(deviceId);
                }
                catch
                {
                    throw new InvalidOperationException($"Audio device not found: {deviceId}");
                }
            }
            return enumerator.GetDefaultAudioEndpoint(DataFlow.Render, Role.Multimedia);
        }
        catch
        {
            enumerator.Dispose();
            throw;
        }
    }

    private void StartProgressTimerLocked()
    {
        _progressTimer ??= new Timer(_ =>
        {
            try
            {
                bool playing;
                (double pos, double dur) progress;
                lock (_gate)
                {
                    playing = _output?.PlaybackState == PlaybackState.Playing && _reader != null;
                    progress = GetProgressNoLock();
                }
                if (playing)
                    Protocol.EmitProgress(progress.pos, progress.dur);
            }
            catch { /* never let the timer thread die on transient errors */ }
        }, null, TimeSpan.FromMilliseconds(250), TimeSpan.FromMilliseconds(250));
    }

    private (double pos, double dur) GetProgressNoLock()
    {
        if (_reader == null) return (0, 0);
        return (_reader.CurrentTime.TotalSeconds, _reader.TotalTime.TotalSeconds);
    }

    private void StopProgressTimerLocked()
    {
        _progressTimer?.Dispose();
        _progressTimer = null;
    }

    private void OnPlaybackStopped(object? sender, StoppedEventArgs e)
    {
        bool endedNaturally;
        lock (_gate)
        {
            // Natural end: output stopped on its own while reader reached the end.
            endedNaturally = _reader != null
                && _reader.CurrentTime >= _reader.TotalTime - TimeSpan.FromMilliseconds(150);
        }

        if (e.Exception != null)
        {
            Protocol.EmitError(e.Exception.Message, "playback");
            return;
        }

        if (endedNaturally)
        {
            try { PlaybackEnded?.Invoke(); } catch { /* ignore */ }
        }
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        lock (_gate)
        {
            StopLocked();
        }
    }
}

internal class PausableSampleProvider : ISampleProvider
{
    private readonly ISampleProvider _source;
    private volatile bool _isPaused;

    public bool IsPaused
    {
        get => _isPaused;
        set => _isPaused = value;
    }

    public PausableSampleProvider(ISampleProvider source)
    {
        _source = source;
        WaveFormat = source.WaveFormat;
    }

    public WaveFormat WaveFormat { get; }

    public int Read(float[] buffer, int offset, int count)
    {
        if (_isPaused)
        {
            Array.Clear(buffer, offset, count);
            return count;
        }
        return _source.Read(buffer, offset, count);
    }
}


