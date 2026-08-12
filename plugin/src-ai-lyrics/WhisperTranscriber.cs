using System.Globalization;
using System.Text;
using NAudio.Wave;
using Whisper.net;

namespace Symvonia.AiLyrics;

public class WhisperTranscriber
{
    private static readonly HttpClient HttpClient = new();

    public static readonly Dictionary<string, string> ModelUrls = new(StringComparer.OrdinalIgnoreCase)
    {
        { "tiny", "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin" },
        { "base", "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin" },
        { "small", "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin" },
        { "medium", "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin" },
        { "large-v3-turbo", "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin" },
        { "large-v3", "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin" }
    };

    public static async Task<string> EnsureModelDownloadedAsync(string modelName, string targetDir, CancellationToken cancellationToken = default)
    {
        Directory.CreateDirectory(targetDir);
        string fileName = $"ggml-{modelName.ToLowerInvariant()}.bin";
        string targetPath = Path.Combine(targetDir, fileName);

        if (File.Exists(targetPath) && new FileInfo(targetPath).Length > 1024 * 1024)
        {
            return targetPath;
        }

        if (!ModelUrls.TryGetValue(modelName, out var url))
        {
            throw new ArgumentException($"Unknown model name: {modelName}. Supported: tiny, base, small, medium, large-v3-turbo, large-v3");
        }

        Protocol.Emit(new
        {
            @event = "model_download_start",
            modelName,
            targetPath
        });

        using var response = await HttpClient.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        response.EnsureSuccessStatusCode();

        long totalBytes = response.Content.Headers.ContentLength ?? 0;
        using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        string tempPath = targetPath + ".tmp";
        using (var fileStream = new FileStream(tempPath, FileMode.Create, FileAccess.Write, FileShare.None, 8192, true))
        {
            byte[] buffer = new byte[65536];
            long totalRead = 0;
            int bytesRead;
            long lastEmit = 0;

            while ((bytesRead = await stream.ReadAsync(buffer, 0, buffer.Length, cancellationToken)) > 0)
            {
                await fileStream.WriteAsync(buffer.AsMemory(0, bytesRead), cancellationToken);
                totalRead += bytesRead;

                if (Environment.TickCount64 - lastEmit >= 200)
                {
                    lastEmit = Environment.TickCount64;
                    int percent = totalBytes > 0 ? (int)((totalRead * 100) / totalBytes) : 0;
                    Protocol.Emit(new
                    {
                        @event = "model_download_progress",
                        modelName,
                        downloaded = totalRead,
                        total = totalBytes,
                        percent
                    });
                }
            }
        }

        if (File.Exists(targetPath))
            File.Delete(targetPath);

        File.Move(tempPath, targetPath);

        Protocol.Emit(new
        {
            @event = "model_download_complete",
            modelName,
            path = targetPath
        });

        return targetPath;
    }

    /// <summary>
    /// Reads any audio file using NAudio, converts to 16kHz 16-bit mono WAV stream in memory.
    /// </summary>
    private static MemoryStream ConvertAudioTo16kHzWavStream(string audioPath, out TimeSpan duration)
    {
        using var reader = new AudioFileReader(audioPath);
        duration = reader.TotalTime;

        var outFormat = new WaveFormat(16000, 16, 1);
        using var resampler = new MediaFoundationResampler(reader, outFormat);

        var wavMemoryStream = new MemoryStream();
        WaveFileWriter.WriteWavFileToStream(wavMemoryStream, resampler);
        wavMemoryStream.Position = 0;
        return wavMemoryStream;
    }

    public static async Task TranscribeAsync(
        string audioPath,
        string modelPath,
        string? language = null,
        CancellationToken cancellationToken = default)
    {
        if (!File.Exists(audioPath))
            throw new FileNotFoundException($"Audio file not found: {audioPath}");
        if (!File.Exists(modelPath))
            throw new FileNotFoundException($"Whisper model not found: {modelPath}");

        Protocol.Emit(new { @event = "transcribe_starting", audioPath, modelPath });

        try
        {
            string exeDir = Path.GetDirectoryName(Environment.ProcessPath ?? "") ?? AppDomain.CurrentDomain.BaseDirectory;
            Whisper.net.LibraryLoader.RuntimeOptions.LibraryPath = exeDir;
        }
        catch
        {
            // Ignore if setting fails
        }

        using var wavStream = ConvertAudioTo16kHzWavStream(audioPath, out var totalDuration);
        double totalSeconds = totalDuration.TotalSeconds > 0 ? totalDuration.TotalSeconds : 1.0;

        using var factory = WhisperFactory.FromPath(modelPath);
        var builder = factory.CreateBuilder();

        if (!string.IsNullOrWhiteSpace(language) && !language.Equals("auto", StringComparison.OrdinalIgnoreCase))
        {
            builder.WithLanguage(language);
        }
        else
        {
            builder.WithLanguage("auto");
        }

        using var processor = builder.Build();

        var lrcBuilder = new StringBuilder();
        var plainBuilder = new StringBuilder();
        int segmentCount = 0;

        await foreach (var segment in processor.ProcessAsync(wavStream, cancellationToken))
        {
            segmentCount++;
            string text = segment.Text.Trim();
            if (string.IsNullOrEmpty(text))
                continue;

            TimeSpan start = segment.Start;
            string lrcTimestamp = $"[{(int)start.TotalMinutes:D2}:{start.Seconds:D2}.{start.Milliseconds / 10:D2}]";

            string lrcLine = $"{lrcTimestamp} {text}";
            lrcBuilder.AppendLine(lrcLine);
            plainBuilder.AppendLine(text);

            int percent = Math.Min(99, (int)((segment.End.TotalSeconds / totalSeconds) * 100));
            Protocol.EmitProgress(percent, text, lrcTimestamp);
        }

        Protocol.EmitProgress(100, "Done", "");
        Protocol.EmitResult(lrcBuilder.ToString().TrimEnd(), plainBuilder.ToString().TrimEnd(), segmentCount);
    }
}
