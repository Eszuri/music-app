using System.Runtime.InteropServices;
using Symvonia.Engine;

// Symvonia Unified Audio Engine — WASAPI Exclusive Playback, Equalizer DSP, & TagLib# Metadata.
// Speaks JSON lines on stdin/stdout (see Protocol.cs).

[DllImport("kernel32.dll", SetLastError = true)]
static extern IntPtr GetStdHandle(int nStdHandle);

try
{
    IntPtr hOut = GetStdHandle(-11);
    if (hOut != IntPtr.Zero && hOut != new IntPtr(-1))
    {
        var outStream = new FileStream(new Microsoft.Win32.SafeHandles.SafeFileHandle(hOut, false), FileAccess.Write, 4096);
        Console.SetOut(new StreamWriter(outStream, new System.Text.UTF8Encoding(false)) { AutoFlush = true });
    }
}
catch { }

try
{
    IntPtr hIn = GetStdHandle(-10);
    if (hIn != IntPtr.Zero && hIn != new IntPtr(-1))
    {
        var inStream = new FileStream(new Microsoft.Win32.SafeHandles.SafeFileHandle(hIn, false), FileAccess.Read, 4096);
        Console.SetIn(new StreamReader(inStream, System.Text.Encoding.UTF8));
    }
}
catch { }

if (args.Length >= 2 && args[0] == "--verify")
{
    var token = args[1];
    Protocol.Emit(new
    {
        @event = "verify_response",
        token,
        engine = "Symvonia Audio Engine",
        version = "2.0.0",
        capabilities = new[] { "audio", "equalizer", "tags" }
    });
    return;
}

using var player = new AudioPlayer();

player.PlaybackEnded += () =>
{
    Protocol.EmitState("ended", player.CurrentPath, player.IsExclusive, null, null, player.DeviceName);
};

Protocol.Emit(new { @event = "ready", version = "2.0.0" });

string? line;
while ((line = Console.In.ReadLine()) != null)
{
    if (string.IsNullOrWhiteSpace(line))
        continue;

    var cmd = Protocol.ParseCommand(line);
    if (cmd?.Name == null)
    {
        Protocol.EmitError("Invalid command JSON", "parse");
        continue;
    }

    try
    {
        switch (cmd.Name)
        {
            // === Audio Player Commands ===
            case "play":
            {
                if (string.IsNullOrEmpty(cmd.Path))
                {
                    Protocol.EmitError("Missing 'path' for play command", "play");
                    break;
                }
                player.Play(cmd.Path, cmd.Exclusive, cmd.DeviceId);
                var (rate, bits) = player.CurrentFormat;
                Protocol.EmitState("playing", player.CurrentPath, player.IsExclusive, rate, bits, player.DeviceName);
                break;
            }

            case "pause":
            {
                player.Pause();
                var (rate, bits) = player.CurrentFormat;
                Protocol.EmitState("paused", player.CurrentPath, player.IsExclusive, rate, bits, player.DeviceName);
                break;
            }

            case "resume":
            {
                player.Resume();
                var (rate, bits) = player.CurrentFormat;
                Protocol.EmitState("playing", player.CurrentPath, player.IsExclusive, rate, bits, player.DeviceName);
                break;
            }

            case "stop":
                player.Stop();
                Protocol.EmitState("stopped", null, player.IsExclusive, null, null, player.DeviceName);
                break;

            case "seek":
                if (cmd.Position.HasValue)
                {
                    player.Seek(cmd.Position.Value);
                    var (pos, dur) = player.GetProgress();
                    Protocol.EmitProgress(pos, dur);
                }
                else
                {
                    Protocol.EmitError("Missing 'position' for seek command", "seek");
                }
                break;

            case "set_volume":
                if (cmd.Volume.HasValue)
                    player.SetVolume(cmd.Volume.Value);
                else
                    Protocol.EmitError("Missing 'volume' for set_volume command", "set_volume");
                break;

            case "get_devices":
                Protocol.Emit(new { @event = "devices", devices = AudioPlayer.GetDevices() });
                break;

            case "get_state":
            {
                var (rate, bits) = player.CurrentFormat;
                string state = player.IsPlaying ? "playing" : player.IsPaused ? "paused" : "stopped";
                Protocol.EmitState(state, player.CurrentPath, player.IsExclusive, rate, bits, player.DeviceName);
                break;
            }

            // === DSP / Equalizer Commands ===
            case "ping":
                Protocol.Emit(new { @event = "pong" });
                break;

            case "get_curve":
            {
                int bandMode = cmd.BandMode ?? 10;
                double[] bands = cmd.Bands ?? [];
                double preamp = cmd.Preamp ?? 0.0;
                double[] curve = DspEngine.CalculateResponseCurve(bandMode, bands, preamp);
                double autoPreamp = DspEngine.CalculateAutoPreamp(bands);
                Protocol.EmitCurveResult(bandMode, curve, autoPreamp);
                break;
            }

            case "calculate_coefficients":
            {
                int bandMode = cmd.BandMode ?? 10;
                double[] bands = cmd.Bands ?? [];
                double sampleRate = cmd.SampleRate ?? 44100.0;
                var freqs = DspEngine.GetFrequenciesForBandMode(bandMode);
                double q = (bandMode == 31) ? 4.3 : (bandMode == 15 ? 2.0 : 1.4);

                var filters = new List<object>();
                for (int i = 0; i < freqs.Length && i < bands.Length; i++)
                {
                    var coef = DspEngine.ComputePeakingEq(freqs[i], bands[i], q, sampleRate);
                    filters.Add(new
                    {
                        freq = freqs[i],
                        gain = bands[i],
                        b0 = coef.B0,
                        b1 = coef.B1,
                        b2 = coef.B2,
                        a1 = coef.A1,
                        a2 = coef.A2
                    });
                }

                Protocol.Emit(new
                {
                    @event = "coefficients_result",
                    bandMode,
                    sampleRate,
                    filters
                });
                break;
            }

            // === Metadata Tag Editor Commands ===
            case "write_tags":
            {
                if (string.IsNullOrEmpty(cmd.FilePath))
                {
                    Protocol.EmitWriteResult("", false, "Missing 'filePath' parameter");
                    break;
                }
                var (success, error) = TagEngine.WriteTags(cmd.FilePath, cmd.Tags, cmd.Artwork);
                Protocol.EmitWriteResult(cmd.FilePath, success, error);
                break;
            }

            // === System Commands ===
            case "shutdown":
                Protocol.Emit(new { @event = "bye" });
                player.Stop();
                return;

            default:
                Protocol.EmitError($"Unknown command: {cmd.Name}", "unknown");
                break;
        }
    }
    catch (Exception ex)
    {
        Protocol.EmitError(ex.Message, cmd.Name);
    }
}

player.Stop();
