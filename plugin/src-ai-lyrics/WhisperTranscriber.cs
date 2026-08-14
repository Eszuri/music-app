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
        if (modelName.Equals("vocal", StringComparison.OrdinalIgnoreCase)
            || modelName.Equals("htdemucs", StringComparison.OrdinalIgnoreCase)
            || modelName.Equals("htdemucs_ft_vocals", StringComparison.OrdinalIgnoreCase)
            || modelName.Equals("htdemucs_ft_vocals.onnx", StringComparison.OrdinalIgnoreCase))
        {
            return await VocalExtractor.EnsureModelDownloadedAsync(targetDir, cancellationToken);
        }

        Directory.CreateDirectory(targetDir);
        string fileName = $"ggml-{modelName.ToLowerInvariant()}.bin";
        string targetPath = Path.Combine(targetDir, fileName);

        // Check if fully downloaded model file already exists and is valid
        if (File.Exists(targetPath))
        {
            if (ValidateModelFile(targetPath, modelName))
            {
                return targetPath;
            }
            else
            {
                // Corrupt existing model file, delete to redownload
                try { File.Delete(targetPath); } catch { }
            }
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

        string tempPath = targetPath + ".tmp";
        long existingTempLength = 0;

        if (File.Exists(tempPath))
        {
            try
            {
                existingTempLength = new FileInfo(tempPath).Length;
            }
            catch
            {
                existingTempLength = 0;
            }
        }

        HttpResponseMessage response;
        bool isResuming = false;
        long totalBytes = 0;

        if (existingTempLength > 0)
        {
            using var rangeRequest = new HttpRequestMessage(HttpMethod.Get, url);
            rangeRequest.Headers.Range = new System.Net.Http.Headers.RangeHeaderValue(existingTempLength, null);
            response = await HttpClient.SendAsync(rangeRequest, HttpCompletionOption.ResponseHeadersRead, cancellationToken);

            if (response.StatusCode == System.Net.HttpStatusCode.PartialContent)
            {
                isResuming = true;
                long contentLen = response.Content.Headers.ContentLength ?? 0;
                totalBytes = existingTempLength + contentLen;
            }
            else if (response.StatusCode == System.Net.HttpStatusCode.RequestedRangeNotSatisfiable)
            {
                response.Dispose();
                try { File.Delete(tempPath); } catch { }
                existingTempLength = 0;
                response = await HttpClient.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
                response.EnsureSuccessStatusCode();
                totalBytes = response.Content.Headers.ContentLength ?? 0;
            }
            else
            {
                try { File.Delete(tempPath); } catch { }
                existingTempLength = 0;
                response.EnsureSuccessStatusCode();
                totalBytes = response.Content.Headers.ContentLength ?? 0;
            }
        }
        else
        {
            response = await HttpClient.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            response.EnsureSuccessStatusCode();
            totalBytes = response.Content.Headers.ContentLength ?? 0;
        }

        using (response)
        using (var stream = await response.Content.ReadAsStreamAsync(cancellationToken))
        {
            FileMode mode = isResuming ? FileMode.Append : FileMode.Create;
            using (var fileStream = new FileStream(tempPath, mode, FileAccess.Write, FileShare.None, 65536, true))
            {
                byte[] buffer = new byte[65536];
                long totalRead = existingTempLength;
                int bytesRead;
                long lastEmit = 0;

                // Immediate emit upon starting / resuming
                int initialPercent = totalBytes > 0 ? (int)((totalRead * 100) / totalBytes) : 0;
                Protocol.Emit(new
                {
                    @event = "model_download_progress",
                    modelName,
                    downloaded = totalRead,
                    total = totalBytes,
                    percent = initialPercent
                });

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
        }

        // Integrity Check & Validation
        if (!ValidateTempModelFile(tempPath, totalBytes))
        {
            try { File.Delete(tempPath); } catch { }
            throw new InvalidOperationException($"Model file verification failed for '{modelName}'. The temporary download file was corrupted and has been removed.");
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

    private static bool ValidateTempModelFile(string tempPath, long expectedTotalBytes)
    {
        if (!File.Exists(tempPath)) return false;
        var info = new FileInfo(tempPath);
        if (expectedTotalBytes > 0 && info.Length != expectedTotalBytes) return false;
        if (info.Length < 1024 * 1024) return false;

        try
        {
            using var fs = new FileStream(tempPath, FileMode.Open, FileAccess.Read, FileShare.Read);
            if (fs.Length < 4) return false;
            byte[] magic = new byte[4];
            fs.Read(magic, 0, 4);
            uint magicValue = BitConverter.ToUInt32(magic, 0);
            return magicValue == 0x67676d6c || magicValue == 0x666d6767 || magicValue == 0x746a6767 || magicValue == 0x66756767;
        }
        catch
        {
            return false;
        }
    }

    private static bool ValidateModelFile(string targetPath, string modelName)
    {
        if (!File.Exists(targetPath)) return false;
        var info = new FileInfo(targetPath);

        long minExpectedSize = modelName.ToLowerInvariant() switch
        {
            "tiny" => 60L * 1024 * 1024,
            "base" => 120L * 1024 * 1024,
            "small" => 400L * 1024 * 1024,
            "medium" => 1300L * 1024 * 1024,
            "large-v3-turbo" => 1400L * 1024 * 1024,
            "large-v3" => 2700L * 1024 * 1024,
            _ => 10L * 1024 * 1024
        };

        if (info.Length < minExpectedSize) return false;

        try
        {
            using var fs = new FileStream(targetPath, FileMode.Open, FileAccess.Read, FileShare.Read);
            if (fs.Length < 4) return false;
            byte[] magic = new byte[4];
            fs.Read(magic, 0, 4);
            uint magicValue = BitConverter.ToUInt32(magic, 0);
            return magicValue == 0x67676d6c || magicValue == 0x666d6767 || magicValue == 0x746a6767 || magicValue == 0x66756767;
        }
        catch
        {
            return false;
        }
    }

    /// <summary>
    /// Reads any audio file using NAudio, converts to 16kHz 16-bit mono WAV stream in memory.
    /// Uses FileShare.ReadWrite and BelowNormal thread priority for zero playback stutter when music is playing.
    /// </summary>
    private static MemoryStream ConvertAudioTo16kHzWavStream(string audioPath, out TimeSpan duration)
    {
        try
        {
            Thread.CurrentThread.Priority = ThreadPriority.BelowNormal;
        }
        catch { }

        WaveStream reader;
        try
        {
            var stream = new FileStream(audioPath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
            reader = new StreamMediaFoundationReader(stream);
        }
        catch
        {
            reader = new AudioFileReader(audioPath);
        }

        using (reader)
        {
            duration = reader.TotalTime;

            var outFormat = new WaveFormat(16000, 16, 1);
            using var resampler = new MediaFoundationResampler(reader, outFormat);

            var wavMemoryStream = new MemoryStream();
            WaveFileWriter.WriteWavFileToStream(wavMemoryStream, resampler);
            wavMemoryStream.Position = 0;
            return wavMemoryStream;
        }
    }


    private static readonly HashSet<string> HallucinationBlacklist = new(StringComparer.OrdinalIgnoreCase)
    {
        "thank you",
        "thank you.",
        "thank you!",
        "thank you very much",
        "thank you very much.",
        "thank you for watching",
        "thank you for watching.",
        "thank you for watching!",
        "thank you for listening",
        "thank you for listening.",
        "thank you for listening!",
        "thanks for watching",
        "thanks for watching.",
        "thanks for watching!",
        "thanks for listening",
        "thanks for listening.",
        "thanks for listening!",
        "thanks",
        "thanks.",
        "thanks!",
        "subtitles by amara.org",
        "subtitles by the amara.org community",
        "subtitles by",
        "subtitles by amara.org visual",
        "subscribe",
        "subscribe to my channel",
        "like and subscribe",
        "please subscribe",
        "don't forget to subscribe",
        "click the bell icon",
        "see you next time",
        "see you next time.",
        "see you in the next video",
        "see you next week",
        "bye",
        "bye.",
        "bye!",
        "bye bye",
        "bye-bye",
        "pbc",
        "you",
        "the end",
        "the end.",
        "[music]",
        "(music)",
        "music",
        "[music playing]",
        "(music playing)",
        "music playing",
        "[applause]",
        "(applause)",
        "applause",
        "[silence]",
        "(silence)",
        "silence",
        "[cheering]",
        "(cheering)",
        "cheering",
        "[screaming]",
        "(screaming)",
        "screaming",
        "[laughter]",
        "(laughter)",
        "laughter",
        "[gasp]",
        "(gasp)",
        "gasp",
        "[sigh]",
        "(sigh)",
        "sigh",
        "[singing]",
        "(singing)",
        "singing"
    };

    public static string? CleanSegmentText(string rawText)
    {
        if (string.IsNullOrWhiteSpace(rawText))
            return null;

        // Strip multi-byte emoji notes
        string text = rawText.Replace("🎵", "").Replace("🎶", "");

        // Trim leading/trailing whitespace, music notes, quotes, and bracket noise
        text = text.Trim(' ', '\t', '\r', '\n', '♪', '"', '\'', '`', '—', '-', '[', ']', '(', ')');
        if (string.IsNullOrWhiteSpace(text))
            return null;

        // Check against exact hallucination blacklist
        if (HallucinationBlacklist.Contains(text))
            return null;

        // Check if starts with common subtitle artifact prefixes
        string lower = text.ToLowerInvariant();
        if (lower.StartsWith("subtitles by") ||
            lower.StartsWith("thank you for") ||
            lower.StartsWith("thanks for") ||
            lower.StartsWith("copyright") ||
            lower.StartsWith("translated by") ||
            lower.StartsWith("captioned by"))
        {
            return null;
        }

        // Deduplicate excessive single word repetitions (e.g. "yeah yeah yeah yeah yeah yeah")
        var words = text.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (words.Length >= 4)
        {
            bool allSameWord = true;
            for (int i = 1; i < words.Length; i++)
            {
                if (!string.Equals(words[i], words[0], StringComparison.OrdinalIgnoreCase))
                {
                    allSameWord = false;
                    break;
                }
            }
            if (allSameWord)
            {
                text = $"{words[0]} {words[0]}";
            }
        }

        return text;
    }



    /// <summary>
    /// Extracts 16kHz float PCM samples from WAV memory stream byte array using NAudio WaveFileReader.
    /// </summary>
    public static float[] ExtractPcmSamples(byte[] wavBytes)
    {
        try
        {
            using var ms = new MemoryStream(wavBytes);
            using var reader = new WaveFileReader(ms);
            var sampleProvider = reader.ToSampleProvider();
            var floatSamples = new List<float>();
            float[] buffer = new float[4096];
            int read;
            while ((read = sampleProvider.Read(buffer, 0, buffer.Length)) > 0)
            {
                for (int i = 0; i < read; i++)
                {
                    floatSamples.Add(buffer[i]);
                }
            }
            return floatSamples.ToArray();
        }
        catch
        {
            return Array.Empty<float>();
        }
    }

    /// <summary>
    /// Metode C: Calculates RMS (Root Mean Square) energy of the audio segment.
    /// Returns 0.0 for dead silence.
    /// </summary>
    public static float CalculateRmsEnergy(float[] samples, int sampleRate, double startSec, double endSec)
    {
        if (samples.Length == 0 || endSec <= startSec) return 1.0f; // Default keep if samples unreadable

        int startSample = Math.Max(0, (int)(startSec * sampleRate));
        int endSample = Math.Min(samples.Length, (int)(endSec * sampleRate));
        int count = endSample - startSample;
        if (count <= 0) return 1.0f;

        double sumSquares = 0;
        for (int i = startSample; i < endSample; i++)
        {
            float s = samples[i];
            sumSquares += s * s;
        }
        return (float)Math.Sqrt(sumSquares / count);
    }

    /// <summary>
    /// Metode A: Evaluates segment confidence log-probability / probability scores.
    /// Drops segments with low confidence or min-probability anomalies.
    /// </summary>
    public static bool IsLowConfidenceSegment(float probability, float minProbability, string rawText)
    {
        // Only drop segments with extremely low confidence (< 10%)
        if (probability > 0f && probability < 0.10f)
            return true;

        if (minProbability > 0f && minProbability < 0.01f && rawText.Trim().Length < 6)
            return true;

        return false;
    }

    private static string? GetStringProperty(object obj, string name)
    {
        var prop = obj.GetType().GetProperty(name);
        return prop?.GetValue(obj)?.ToString();
    }

    private static TimeSpan GetTimeSpanProperty(object obj, string name)
    {
        var prop = obj.GetType().GetProperty(name);
        var val = prop?.GetValue(obj);
        return val is TimeSpan ts ? ts : TimeSpan.Zero;
    }

    private static float GetFloatProperty(object obj, string name)
    {
        var prop = obj.GetType().GetProperty(name);
        var val = prop?.GetValue(obj);
        return val is float f ? f : (val is double d ? (float)d : 1.0f);
    }

    /// <summary>
    /// Metode B: Evaluates token-level timestamp anomalies and token probability clusters.
    /// </summary>
    public static bool HasTokenTimestampAnomalies(System.Collections.IEnumerable? tokens, double segmentDuration)
    {
        if (tokens == null)
            return false;

        int lowProbTokenCount = 0;
        int validTokenCount = 0;

        foreach (var t in tokens)
        {
            if (t == null) continue;

            string text = GetStringProperty(t, "Text") ?? "";
            if (string.IsNullOrWhiteSpace(text))
                continue;

            validTokenCount++;

            TimeSpan start = GetTimeSpanProperty(t, "Start");
            TimeSpan end = GetTimeSpanProperty(t, "End");
            float probability = GetFloatProperty(t, "Probability");

            double tokenDuration = (end - start).TotalSeconds;
            if (tokenDuration > 4.0 && segmentDuration > 4.0)
            {
                return true; // Single token hallucination loop
            }

            if (probability > 0f && probability < 0.05f)
            {
                lowProbTokenCount++;
            }
        }

        if (validTokenCount > 0 && ((float)lowProbTokenCount / validTokenCount) > 0.80f)
        {
            return true;
        }

        return false;
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
        byte[] wavBytes = wavStream.ToArray();
        float[] pcmSamples = ExtractPcmSamples(wavBytes);
        wavStream.Position = 0;

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

        builder.WithTokenTimestamps();
        using var processor = builder.Build();

        var lrcBuilder = new StringBuilder();
        var plainBuilder = new StringBuilder();
        int segmentCount = 0;

        string? lastText = null;
        int consecutiveDupCount = 0;
        var recentTexts = new Queue<string>();

        await foreach (var segment in processor.ProcessAsync(wavStream, cancellationToken))
        {
            // Metode C: Audio Energy / Silence RMS Gate
            float rms = CalculateRmsEnergy(pcmSamples, 16000, segment.Start.TotalSeconds, segment.End.TotalSeconds);
            if (rms < 0.005f)
            {
                continue;
            }

            // Metode A: Log-Prob Confidence Filter
            if (IsLowConfidenceSegment(segment.Probability, segment.MinProbability, segment.Text))
            {
                continue;
            }

            // Metode B: Token-Level Timestamp & Anomaly Filter
            if (HasTokenTimestampAnomalies(segment.Tokens, (segment.End - segment.Start).TotalSeconds))
            {
                continue;
            }

            string? text = CleanSegmentText(segment.Text);
            if (string.IsNullOrEmpty(text))
                continue;

            string lower = text.ToLowerInvariant();

            // Additional Tail-End Artifact Removal (last 15% of track duration)
            bool isTailEnd = segment.Start.TotalSeconds > (totalSeconds * 0.85);
            if (isTailEnd)
            {
                if (lower.Contains("thank you") || lower.Contains("thanks") || lower.Contains("watching") || lower.Contains("subscribe") || lower.Contains("amara.org"))
                {
                    continue;
                }
            }

            // Anti-Repetition Loop Filter: Allow normal song chorus repeats (up to 2 times), but block infinite hallucination loops
            if (string.Equals(text, lastText, StringComparison.OrdinalIgnoreCase))
            {
                consecutiveDupCount++;
                if (consecutiveDupCount > 2)
                {
                    continue;
                }
            }
            else if (recentTexts.Contains(text, StringComparer.OrdinalIgnoreCase))
            {
                consecutiveDupCount++;
                if (consecutiveDupCount > 3)
                {
                    continue;
                }
            }
            else
            {
                lastText = text;
                consecutiveDupCount = 1;
            }

            recentTexts.Enqueue(text);
            if (recentTexts.Count > 8)
                recentTexts.Dequeue();

            segmentCount++;
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

