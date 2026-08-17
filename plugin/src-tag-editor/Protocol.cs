using System.Text.Json;
using System.Text.Json.Serialization;

namespace Symvonia.TagEditor;

public static class Protocol
{
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
        [JsonPropertyName("filePath")] public string? FilePath { get; set; }
        [JsonPropertyName("tags")] public TagsDto? Tags { get; set; }
        [JsonPropertyName("artwork")] public ArtworkDto? Artwork { get; set; }
    }

    public sealed class VerifyResponse
    {
        [JsonPropertyName("event")] public string Event { get; set; } = "verify_response";
        [JsonPropertyName("token")] public string Token { get; set; } = "";
        [JsonPropertyName("engine")] public string Engine { get; set; } = "Symvonia Tag Editor Engine";
        [JsonPropertyName("version")] public string Version { get; set; } = "1.0.0";
    }

    public sealed class ReadyEvent
    {
        [JsonPropertyName("event")] public string Event { get; set; } = "ready";
        [JsonPropertyName("engine")] public string Engine { get; set; } = "Symvonia Tag Editor Engine";
        [JsonPropertyName("version")] public string Version { get; set; } = "1.0.0";
    }

    public sealed class WriteResultEvent
    {
        [JsonPropertyName("event")] public string Event { get; set; } = "write_result";
        [JsonPropertyName("success")] public bool Success { get; set; }
        [JsonPropertyName("filePath")] public string FilePath { get; set; } = "";
        [JsonPropertyName("error")] public string? Error { get; set; }
    }

    public sealed class SimpleEvent
    {
        [JsonPropertyName("event")] public string Event { get; set; } = "";
    }

    public static Command? ParseCommand(string line)
    {
        try
        {
            return JsonSerializer.Deserialize(line, TagJsonContext.Default.Command);
        }
        catch
        {
            return null;
        }
    }

    private static readonly object LogLock = new();

    public static void EmitVerify(string token)
    {
        var res = new VerifyResponse { Token = token };
        string line = JsonSerializer.Serialize(res, TagJsonContext.Default.VerifyResponse);
        EmitRaw(line);
    }

    public static void EmitReady()
    {
        var res = new ReadyEvent();
        string line = JsonSerializer.Serialize(res, TagJsonContext.Default.ReadyEvent);
        EmitRaw(line);
    }

    public static void EmitWriteResult(string filePath, bool success, string? error = null)
    {
        var res = new WriteResultEvent
        {
            FilePath = filePath,
            Success = success,
            Error = error
        };
        string line = JsonSerializer.Serialize(res, TagJsonContext.Default.WriteResultEvent);
        EmitRaw(line);
    }

    public static void EmitSimple(string eventName)
    {
        var res = new SimpleEvent { Event = eventName };
        string line = JsonSerializer.Serialize(res, TagJsonContext.Default.SimpleEvent);
        EmitRaw(line);
    }

    private static void EmitRaw(string line)
    {
        lock (LogLock)
        {
            Console.Out.WriteLine(line);
            Console.Out.Flush();
        }
    }
}

[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase, WriteIndented = false)]
[JsonSerializable(typeof(Protocol.Command))]
[JsonSerializable(typeof(Protocol.VerifyResponse))]
[JsonSerializable(typeof(Protocol.ReadyEvent))]
[JsonSerializable(typeof(Protocol.WriteResultEvent))]
[JsonSerializable(typeof(Protocol.SimpleEvent))]
internal partial class TagJsonContext : JsonSerializerContext
{
}
