using System.Text.Json;
using System.Text.Json.Serialization;

namespace Symvonia.AudioEngine;

/// <summary>
/// JSON line protocol used over stdin/stdout between Tauri (Rust) and this engine.
///
/// Incoming commands (one JSON object per line on stdin):
///   {"command":"play","path":"D:\\music\\song.flac","exclusive":true}
///   {"command":"pause"} / {"command":"resume"} / {"command":"stop"}
///   {"command":"seek","position":12.5}
///   {"command":"set_volume","volume":0.8}
///   {"command":"set_device","deviceId":"..."}   (null/omitted = default device)
///   {"command":"get_devices"}
///   {"command":"get_state"}
///   {"command":"shutdown"}
///
/// Outgoing events (one JSON object per line on stdout):
///   {"event":"ready","version":"1.0.0"}
///   {"event":"state","state":"playing|paused|stopped","path":"...","exclusive":true,"sampleRate":96000,"bitDepth":24}
///   {"event":"progress","position":12.5,"duration":240.0}
///   {"event":"devices","devices":[{...}]}
///   {"event":"error","message":"...","context":"play"}
///   {"event":"bye"}
/// </summary>
public static class Protocol
{
    public static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        WriteIndented = false,
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    public sealed class Command
    {
        [JsonPropertyName("command")] public string? Name { get; set; }
        [JsonPropertyName("path")] public string? Path { get; set; }
        [JsonPropertyName("exclusive")] public bool Exclusive { get; set; }
        [JsonPropertyName("position")] public double? Position { get; set; }
        [JsonPropertyName("volume")] public float? Volume { get; set; }
        [JsonPropertyName("deviceId")] public string? DeviceId { get; set; }
    }

    public sealed class DeviceInfo
    {
        [JsonPropertyName("id")] public string Id { get; set; } = "";
        [JsonPropertyName("name")] public string Name { get; set; } = "";
        [JsonPropertyName("isDefault")] public bool IsDefault { get; set; }
    }

    public static Command? ParseCommand(string line)
    {
        try
        {
            return JsonSerializer.Deserialize<Command>(line, JsonOptions);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    /// <summary>Writes one event as a single JSON line to stdout (thread-safe).</summary>
    public static void Emit(object payload)
    {
        string line = JsonSerializer.Serialize(payload, JsonOptions);
        lock (Console.Out)
        {
            Console.Out.WriteLine(line);
            Console.Out.Flush();
        }
    }

    public static void EmitState(string state, string? path, bool exclusive, int? sampleRate, int? bitDepth, string? deviceName)
    {
        Emit(new
        {
            @event = "state",
            state,
            path,
            exclusive,
            sampleRate,
            bitDepth,
            deviceName,
        });
    }

    public static void EmitProgress(double position, double duration)
    {
        Emit(new { @event = "progress", position, duration });
    }

    public static void EmitError(string message, string? context = null)
    {
        Emit(new { @event = "error", message, context });
    }
}
