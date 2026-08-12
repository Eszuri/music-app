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
        [JsonPropertyName("isolateVocals")] public bool? IsolateVocals { get; set; }
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
    private static string? _logFilePath;

    public static void Emit(object payload)
    {
        string line = JsonSerializer.Serialize(payload, JsonOptions);
        lock (Console.Out)
        {
            Console.Out.WriteLine(line);
            Console.Out.Flush();
        }
        WriteToAppDataLog(line);
    }

    private static void WriteToAppDataLog(string rawJson)
    {
        try
        {
            string? logPath = _logFilePath;

            if (string.IsNullOrEmpty(logPath))
            {
                string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
                string logDir = Path.Combine(appData, "com.symvonia.player", "plugins", "ai-lyrics", "logs");
                Directory.CreateDirectory(logDir);
                logPath = Path.Combine(logDir, "ai-lyrics-generator.log");
                _logFilePath = logPath;
            }

            lock (LogLock)
            {
                File.AppendAllText(logPath, $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] {rawJson}{Environment.NewLine}");
            }
        }
        catch
        {
            // Ignore logging errors if file is temporarily busy
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
