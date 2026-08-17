using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.Unicode;

namespace Symvonia.Engine;

/// <summary>
/// JSON protocol definitions and serialization helpers for the Unified Audio Engine.
/// Uses full Unicode encoding without escape sequences.
/// </summary>
public static class Protocol
{
    public static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        WriteIndented = false,
        Encoder = JavaScriptEncoder.Create(UnicodeRanges.All),
    };

    public sealed class TagsDto
    {
        [JsonPropertyName("title")] public string? Title { get; set; }
        [JsonPropertyName("artist")] public string? Artist { get; set; }
        [JsonPropertyName("album")] public string? Album { get; set; }
        [JsonPropertyName("genre")] public string? Genre { get; set; }
        [JsonPropertyName("year")] public uint? Year { get; set; }
        [JsonPropertyName("trackNumber")] public uint? TrackNumber { get; set; }
        [JsonPropertyName("totalTracks")] public uint? TotalTracks { get; set; }
        [JsonPropertyName("discNumber")] public uint? DiscNumber { get; set; }
        [JsonPropertyName("totalDiscs")] public uint? TotalDiscs { get; set; }
        [JsonPropertyName("comment")] public string? Comment { get; set; }
    }

    public sealed class ArtworkDto
    {
        [JsonPropertyName("action")] public string? Action { get; set; } // "set" | "remove" | "keep"
        [JsonPropertyName("mime")] public string? Mime { get; set; }
        [JsonPropertyName("dataBase64")] public string? DataBase64 { get; set; }
    }

    public sealed class Command
    {
        [JsonPropertyName("command")] public string? Name { get; set; }

        // Audio Player parameters
        [JsonPropertyName("path")] public string? Path { get; set; }
        [JsonPropertyName("mode")] public string? Mode { get; set; }
        [JsonPropertyName("exclusive")] public bool? Exclusive { get; set; }
        [JsonPropertyName("deviceId")] public string? DeviceId { get; set; }
        [JsonPropertyName("requestId")] public string? RequestId { get; set; }
        [JsonPropertyName("position")] public double? Position { get; set; }
        [JsonPropertyName("volume")] public float? Volume { get; set; }

        // DSP / Equalizer parameters
        [JsonPropertyName("bandMode")] public int? BandMode { get; set; }
        [JsonPropertyName("bands")] public double[]? Bands { get; set; }
        [JsonPropertyName("preamp")] public double? Preamp { get; set; }
        [JsonPropertyName("sampleRate")] public double? SampleRate { get; set; }

        // Tag Editor parameters
        [JsonPropertyName("filePath")] public string? FilePath { get; set; }
        [JsonPropertyName("tags")] public TagsDto? Tags { get; set; }
        [JsonPropertyName("artwork")] public ArtworkDto? Artwork { get; set; }
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

    private static readonly object LogLock = new();

    public static void Emit(object payload)
    {
        string line = JsonSerializer.Serialize(payload, JsonOptions);
        lock (LogLock)
        {
            Console.Out.WriteLine(line);
            Console.Out.Flush();
        }
    }

    public static void EmitState(
        string state,
        string? path,
        string? mode,
        int? sampleRate,
        int? bitDepth,
        string? deviceName,
        string? requestId = null)
    {
        Emit(new
        {
            @event = "state",
            state,
            path,
            mode,
            exclusive = mode == "exclusive",
            sampleRate,
            bitDepth,
            deviceName,
            requestId
        });
    }

    public static void EmitError(
        string code,
        string message,
        string? context = null,
        string? mode = null,
        string? path = null,
        string? requestId = null,
        bool recoverable = false)
    {
        Emit(new { @event = "error", code, message, context, mode, path, requestId, recoverable });
    }

    public static void EmitError(string message, string? context = null)
    {
        EmitError("ENGINE_ERROR", message, context);
    }

    public static void EmitProgress(double position, double duration)
    {
        Emit(new
        {
            @event = "progress",
            position = Math.Round(position, 2),
            duration = Math.Round(duration, 2)
        });
    }

    public static void EmitCurveResult(int bandMode, double[] curve, double suggestedAutoPreamp)
    {
        Emit(new
        {
            @event = "curve_result",
            bandMode,
            curve,
            suggestedAutoPreamp = Math.Round(suggestedAutoPreamp, 2)
        });
    }

    public static void EmitWriteResult(string filePath, bool success, string? error = null)
    {
        Emit(new
        {
            @event = "write_result",
            filePath,
            success,
            error
        });
    }
}
