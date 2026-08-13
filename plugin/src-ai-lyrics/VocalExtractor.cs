using System.Globalization;
using System.Runtime.InteropServices;
using Microsoft.ML.OnnxRuntime;
using Microsoft.ML.OnnxRuntime.Tensors;
using NAudio.Wave;

namespace Symvonia.AiLyrics;

public class VocalExtractor
{
    private static readonly HttpClient HttpClient = new();

    public const string DefaultModelUrl = "https://huggingface.co/StemSplitio/htdemucs-ft-vocals-onnx/resolve/main/htdemucs_ft_vocals.onnx";
    public const string DefaultModelFileName = "htdemucs_ft_vocals.onnx";

    /// <summary>
    /// Ensures the HT-Demucs ONNX vocal extraction model is downloaded to targetDir.
    /// </summary>
    public static async Task<string> EnsureModelDownloadedAsync(string targetDir, CancellationToken cancellationToken = default)
    {
        Directory.CreateDirectory(targetDir);
        string targetPath = Path.Combine(targetDir, DefaultModelFileName);

        if (File.Exists(targetPath) && new FileInfo(targetPath).Length > 10 * 1024 * 1024)
        {
            return targetPath;
        }

        Protocol.Emit(new
        {
            @event = "vocal_model_download_start",
            modelName = DefaultModelFileName,
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
            using var rangeRequest = new HttpRequestMessage(HttpMethod.Get, DefaultModelUrl);
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
                response = await HttpClient.GetAsync(DefaultModelUrl, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
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
            response = await HttpClient.GetAsync(DefaultModelUrl, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
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

                int initialPercent = totalBytes > 0 ? (int)((totalRead * 100) / totalBytes) : 0;
                Protocol.Emit(new
                {
                    @event = "vocal_model_download_progress",
                    modelName = DefaultModelFileName,
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
                            @event = "vocal_model_download_progress",
                            modelName = DefaultModelFileName,
                            downloaded = totalRead,
                            total = totalBytes,
                            percent
                        });
                    }
                }
            }
        }

        if (File.Exists(targetPath))
            File.Delete(targetPath);

        File.Move(tempPath, targetPath);

        Protocol.Emit(new
        {
            @event = "vocal_model_download_complete",
            modelName = DefaultModelFileName,
            path = targetPath
        });

        return targetPath;
    }

    /// <summary>
    /// Reads audio file, resamples to 44.1kHz Stereo 32-bit Float PCM samples.
    /// Uses FileShare.ReadWrite and BelowNormal thread priority for smooth playback when music is playing.
    /// </summary>
    public static float[] ReadAudioTo441kHzStereo(string audioPath, out int sampleRate, out int channels, out TimeSpan duration)
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

            var outFormat = WaveFormat.CreateIeeeFloatWaveFormat(44100, 2);
            using var resampler = new MediaFoundationResampler(reader, outFormat);

            sampleRate = 44100;
            channels = 2;

            var sampleList = new List<float>();
            byte[] buffer = new byte[65536];
            int bytesRead;

            while ((bytesRead = resampler.Read(buffer, 0, buffer.Length)) > 0)
            {
                int floatCount = bytesRead / 4;
                float[] floatBuffer = new float[floatCount];
                Buffer.BlockCopy(buffer, 0, floatBuffer, 0, bytesRead);
                sampleList.AddRange(floatBuffer);
            }

            return sampleList.ToArray();
        }
    }


    /// <summary>
    /// Extracts vocal stem from input audio using HT-Demucs ONNX model and saves output to WAV file.
    /// </summary>
    public static async Task<string> ExtractVocalAsync(
        string audioPath,
        string outputPath,
        string modelPath,
        CancellationToken cancellationToken = default)
    {
        if (!File.Exists(audioPath))
            throw new FileNotFoundException($"Input audio file not found: {audioPath}");
        if (!File.Exists(modelPath))
            throw new FileNotFoundException($"ONNX Vocal model not found: {modelPath}");

        outputPath = Path.GetFullPath(outputPath);

        Protocol.Emit(new { @event = "vocal_extraction_starting", audioPath, outputPath, modelPath });

        return await Task.Run(() =>
        {
            // 1. Read & Resample audio to 44.1kHz stereo
            float[] interleavedSamples = ReadAudioTo441kHzStereo(audioPath, out int sampleRate, out int channels, out TimeSpan totalDuration);
            int totalFrames = interleavedSamples.Length / 2;

            float[] leftChannel = new float[totalFrames];
            float[] rightChannel = new float[totalFrames];

            for (int i = 0; i < totalFrames; i++)
            {
                leftChannel[i] = interleavedSamples[i * 2];
                rightChannel[i] = interleavedSamples[i * 2 + 1];
            }

            // 2. Prepare ONNX Inference Session
            using var sessionOptions = new SessionOptions();
            sessionOptions.GraphOptimizationLevel = GraphOptimizationLevel.ORT_ENABLE_ALL;

            using var session = new InferenceSession(modelPath, sessionOptions);

            // HT-Demucs model input shape: [1, 2, chunkSize]
            // We use a chunk size of 343,980 samples (~7.8 seconds per chunk at 44.1kHz)
            int chunkSize = 343980;
            int overlap = 22050; // 0.5s overlap
            int step = chunkSize - overlap;

            float[] vocalLeft = new float[totalFrames];
            float[] vocalRight = new float[totalFrames];
            float[] weights = new float[totalFrames];

            int totalChunks = (int)Math.Ceiling((double)totalFrames / step);
            int completedChunks = 0;

            for (int offset = 0; offset < totalFrames; offset += step)
            {
                cancellationToken.ThrowIfCancellationRequested();

                int currentChunkSize = Math.Min(chunkSize, totalFrames - offset);
                if (currentChunkSize <= 0) break;

                // Create tensor [1, 2, chunkSize]
                var inputTensor = new DenseTensor<float>(new[] { 1, 2, chunkSize });

                for (int c = 0; c < 2; c++)
                {
                    float[] srcChannel = (c == 0) ? leftChannel : rightChannel;
                    for (int s = 0; s < chunkSize; s++)
                    {
                        int srcIdx = offset + s;
                        inputTensor[0, c, s] = (srcIdx < totalFrames) ? srcChannel[srcIdx] : 0f;
                    }
                }

                var inputs = new List<NamedOnnxValue>
                {
                    NamedOnnxValue.CreateFromTensor("mix", inputTensor)
                };

                using var results = session.Run(inputs);
                var outputTensor = results.First(v => v.Name == "stems" || v.Name == "vocal" || v.Name == "output").AsTensor<float>();

                // Shape of stems: [1, 4, 2, chunkSize] (index 3 is Vocal) or [1, 2, chunkSize]
                bool isStems = outputTensor.Dimensions.Length == 4;

                // Triangle window for smooth overlap blending
                for (int s = 0; s < currentChunkSize; s++)
                {
                    int targetIdx = offset + s;
                    if (targetIdx >= totalFrames) break;

                    float windowWeight = 1.0f;
                    if (s < overlap) windowWeight = (float)s / overlap;
                    else if (s > chunkSize - overlap) windowWeight = (float)(chunkSize - s) / overlap;

                    float vL = isStems ? outputTensor[0, 3, 0, s] : outputTensor[0, 0, s];
                    float vR = isStems ? outputTensor[0, 3, 1, s] : outputTensor[0, 1, s];

                    vocalLeft[targetIdx] += vL * windowWeight;
                    vocalRight[targetIdx] += vR * windowWeight;
                    weights[targetIdx] += windowWeight;
                }

                completedChunks++;
                int percent = Math.Min(99, (int)((completedChunks * 100.0) / totalChunks));
                Protocol.Emit(new
                {
                    @event = "vocal_extraction_progress",
                    percent,
                    completedChunks,
                    totalChunks
                });
            }

            // Normalize by weights
            float[] finalInterleaved = new float[totalFrames * 2];
            for (int i = 0; i < totalFrames; i++)
            {
                float w = weights[i] > 0 ? weights[i] : 1.0f;
                finalInterleaved[i * 2] = Math.Clamp(vocalLeft[i] / w, -1.0f, 1.0f);
                finalInterleaved[i * 2 + 1] = Math.Clamp(vocalRight[i] / w, -1.0f, 1.0f);
            }

            // Write output WAV (16-bit PCM Stereo 44.1kHz - Universally Compatible)
            string? outDir = Path.GetDirectoryName(outputPath);
            if (!string.IsNullOrEmpty(outDir)) Directory.CreateDirectory(outDir);

            var wavFormat = new WaveFormat(44100, 16, 2);
            using (var writer = new WaveFileWriter(outputPath, wavFormat))
            {
                short[] pcm16 = new short[finalInterleaved.Length];
                for (int i = 0; i < finalInterleaved.Length; i++)
                {
                    pcm16[i] = (short)Math.Clamp((int)(finalInterleaved[i] * 32767f), -32768, 32767);
                }
                writer.WriteSamples(pcm16, 0, pcm16.Length);
                writer.Flush();
            }

            Protocol.Emit(new
            {
                @event = "vocal_extraction_complete",
                outputPath,
                totalFrames,
                durationSeconds = totalDuration.TotalSeconds
            });

            return outputPath;
        }, cancellationToken);
    }
}
