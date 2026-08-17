using Symvonia.AudioEngine;

// Symvonia Bit-Perfect Audio Engine — headless console process.
// Speaks JSON lines on stdin/stdout (see Protocol.cs). Nothing else may ever
// be written to stdout, or the host's JSON parser will break.

using System.Runtime.InteropServices;

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
        token = token,
        engine = "Symvonia Audio Engine",
        version = "1.0.0"
    });
    return;
}

using var player = new AudioPlayer();

player.PlaybackEnded += () =>
{
    Protocol.EmitState("ended", player.CurrentPath, player.IsExclusive, null, null, player.DeviceName);
};

Protocol.Emit(new { @event = "ready", version = "1.0.0" });

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

// stdin closed by host → exit cleanly.
player.Stop();
