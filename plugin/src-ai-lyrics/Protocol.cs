using System.Text.Json;
using System.Text.Json.Serialization;

namespace Symvonia.AiLyrics;

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
        [JsonPropertyName("modelPath")] public string? ModelPath { get; set; }
        [JsonPropertyName("modelName")] public string? ModelName { get; set; }
        [JsonPropertyName("language")] public string? Language { get; set; }
        [JsonPropertyName("modelsDir")] public string? ModelsDir { get; set; }
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

    public static void Emit(object payload)
    {
        string line = JsonSerializer.Serialize(payload, JsonOptions);
        lock (Console.Out)
        {
            Console.Out.WriteLine(line);
            Console.Out.Flush();
        }
    }

    public static void EmitProgress(int percent, string segmentText, string timestamp)
    {
        Emit(new
        {
            @event = "progress",
            percent,
            segmentText,
            timestamp
        });
    }

    public static void EmitResult(string lrcContent, string plainText, int segmentCount)
    {
        Emit(new
        {
            @event = "transcription_result",
            lrcContent,
            plainText,
            segmentCount
        });
    }

    public static void EmitError(string message, string? context = null)
    {
        Emit(new { @event = "error", message, context });
    }
}
