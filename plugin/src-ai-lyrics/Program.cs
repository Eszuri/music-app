using System.Runtime.InteropServices;
using Symvonia.AiLyrics;

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
        engine = "Symvonia AI Lyrics Engine",
        version = "1.0.0"
    });
    return;
}

// Pre-load all Whisper & ONNX native DLLs before Whisper.net and OnnxRuntime use them.
{
    string baseDir = AppContext.BaseDirectory;
    string exeDir = Path.GetDirectoryName(Environment.ProcessPath ?? "") ?? baseDir;

    // Prefer extraction base directory if native dlls exist there, otherwise exe directory
    string libraryPath = Directory.GetFiles(baseDir, "*whisper*.dll").Length > 0 ? baseDir : exeDir;
    Whisper.net.LibraryLoader.RuntimeOptions.LibraryPath = libraryPath;

    // Pre-load native DLLs in dependency order (ggml deps first, then whisper, then onnxruntime)
    string[] nativeDlls = ["ggml-base-whisper.dll", "ggml-whisper.dll", "ggml-cpu-whisper.dll", "whisper.dll", "onnxruntime.dll"];
    foreach (var dll in nativeDlls)
    {
        string pathBase = Path.Combine(baseDir, dll);
        string pathExe = Path.Combine(exeDir, dll);
        string? path = File.Exists(pathBase) ? pathBase : (File.Exists(pathExe) ? pathExe : null);
        if (path != null)
        {
            NativeLibrary.TryLoad(path, out _);
        }
    }
}

// Symvonia Local AI Lyrics Generator Engine — headless console process.
// Speaks JSON lines on stdin/stdout (see Protocol.cs).

if (args.Length >= 1 && args[0] == "--test-native")
{
    try
    {
        string baseDir = AppDomain.CurrentDomain.BaseDirectory;
        string exeDir = Path.GetDirectoryName(Environment.ProcessPath ?? "") ?? "";
        Console.WriteLine($"BaseDirectory: {baseDir}");
        Console.WriteLine($"ProcessPath:   {Environment.ProcessPath}");
        Console.WriteLine($"ExeDir:        {exeDir}");
        Console.WriteLine($"Same? {baseDir.TrimEnd(Path.DirectorySeparatorChar) == exeDir.TrimEnd(Path.DirectorySeparatorChar)}");

        Console.WriteLine($"\n--- DLLs in ExeDir ---");
        foreach (var f in Directory.GetFiles(exeDir, "*.dll"))
            Console.WriteLine($"  {Path.GetFileName(f)} ({new FileInfo(f).Length} bytes)");

        Console.WriteLine($"\n--- DLLs in BaseDir ---");
        foreach (var f in Directory.GetFiles(baseDir, "*.dll"))
            Console.WriteLine($"  {Path.GetFileName(f)} ({new FileInfo(f).Length} bytes)");

        // Try explicit load
        Console.WriteLine($"\n--- Explicit Load Test ---");
        string[] toLoad = ["whisper.dll", "ggml-whisper.dll", "ggml-base-whisper.dll", "ggml-cpu-whisper.dll", "onnxruntime.dll"];
        foreach (var dll in toLoad)
        {
            string pathBase = Path.Combine(baseDir, dll);
            string pathExe = Path.Combine(exeDir, dll);
            string? path = File.Exists(pathBase) ? pathBase : (File.Exists(pathExe) ? pathExe : null);
            bool exists = path != null;
            bool loaded = false;
            IntPtr handle = IntPtr.Zero;
            if (exists)
                loaded = NativeLibrary.TryLoad(path!, out handle);
            Console.WriteLine($"  {dll}: exists={exists}, loaded={loaded}, handle=0x{handle:X}");
        }

        // Try WhisperFactory
        Console.WriteLine($"\n--- WhisperFactory Test ---");
        string libraryPath = Directory.GetFiles(baseDir, "*whisper*.dll").Length > 0 ? baseDir : exeDir;
        Whisper.net.LibraryLoader.RuntimeOptions.LibraryPath = libraryPath;
        Console.WriteLine($"RuntimeOptions.LibraryPath set to: {libraryPath}");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Error: {ex}");
    }
    return;
}
if (args.Length >= 2 && args[0] == "--extract-vocal")
{
    string inputAudio = Path.GetFullPath(args[1]);
    string modelsDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "models");
    string outputWav = args.Length >= 3 ? Path.GetFullPath(args[2]) : GetExtractedVocalPath(inputAudio, modelsDir);




    try
    {
        Console.WriteLine($"[Vocal Extractor CLI] Input Audio: {inputAudio}");
        Console.WriteLine($"[Vocal Extractor CLI] Output Path:  {outputWav}");

        string modelPath = await VocalExtractor.EnsureModelDownloadedAsync(modelsDir);
        Console.WriteLine($"[Vocal Extractor CLI] ONNX Model:  {modelPath}");

        Console.WriteLine("[Vocal Extractor CLI] Extracting vocal track...");
        var sw = System.Diagnostics.Stopwatch.StartNew();
        await VocalExtractor.ExtractVocalAsync(inputAudio, outputWav, modelPath);
        sw.Stop();

        Console.WriteLine($"[Vocal Extractor CLI] SUCCESS! Extracted vocal saved to: {outputWav}");
        Console.WriteLine($"[Vocal Extractor CLI] Time Elapsed: {sw.Elapsed.TotalSeconds:F2} seconds");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[Vocal Extractor CLI] ERROR: {ex}");
    }
    return;
}

if (args.Length >= 2 && args[0] == "--transcribe")
{
    string audioPath = Path.GetFullPath(args[1]);
    string modelName = args.Length >= 3 ? args[2] : "large-v3";
    string modelsDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "models");
    if (!Directory.Exists(modelsDir))
    {
        string appDataModels = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "com.symvonia.player", "plugins", "ai-lyrics", "models");
        if (Directory.Exists(appDataModels))
            modelsDir = appDataModels;
    }

    try
    {
        Console.WriteLine($"[Transcriber CLI] Audio: {audioPath}");
        Console.WriteLine($"[Transcriber CLI] Model: {modelName}");
        string modelPath = await WhisperTranscriber.EnsureModelDownloadedAsync(modelName, modelsDir);
        await WhisperTranscriber.TranscribeAsync(audioPath, modelPath);
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[Transcriber CLI] ERROR: {ex}");
    }
    return;
}

Protocol.Emit(new { @event = "ready", version = "1.0.0" });

CancellationTokenSource? activeCts = null;
Task? activeTask = null;
var downloadCtsDict = new System.Collections.Concurrent.ConcurrentDictionary<string, CancellationTokenSource>(StringComparer.OrdinalIgnoreCase);

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
            case "transcribe":
            {
                if (string.IsNullOrEmpty(cmd.Path))
                {
                    Protocol.EmitError("Missing 'path' for transcribe command", "transcribe");
                    break;
                }

                activeCts?.Cancel();
                activeCts = new CancellationTokenSource();
                var token = activeCts.Token;

                string audioPath = cmd.Path;
                string? modelPath = cmd.ModelPath;
                string modelName = cmd.ModelName ?? "base";
                string modelsDir = cmd.ModelsDir ?? Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "models");
                bool isolateVocals = cmd.IsolateVocals ?? false;

                activeTask = Task.Run(async () =>
                {
                    string actualAudioPath = audioPath;
                    try
                    {
                        // Step 1: Ensure all selected models are downloaded first before starting any processing
                        string vocalModelPath = string.Empty;
                        if (isolateVocals)
                        {
                            vocalModelPath = await VocalExtractor.EnsureModelDownloadedAsync(modelsDir, token);
                        }

                        if (string.IsNullOrEmpty(modelPath) || !File.Exists(modelPath))
                        {
                            modelPath = await WhisperTranscriber.EnsureModelDownloadedAsync(modelName, modelsDir, token);
                        }

                        // Step 2: Model initialization
                        Protocol.Emit(new
                        {
                            @event = "progress",
                            percent = 0,
                            segmentText = "Inisialisasi Model AI...",
                            timestamp = ""
                        });

                        // Step 3: Vocal extraction (if selected)
                        if (isolateVocals && !string.IsNullOrEmpty(vocalModelPath) && File.Exists(vocalModelPath))
                        {
                            string vocalOutputPath = GetExtractedVocalPath(audioPath, modelsDir);
                            actualAudioPath = await VocalExtractor.ExtractVocalAsync(audioPath, vocalOutputPath, vocalModelPath, token);
                        }

                        // Step 4: Transcribe lyrics
                        await WhisperTranscriber.TranscribeAsync(actualAudioPath, modelPath, cmd.Language, token);
                    }
                    catch (OperationCanceledException)
                    {
                        Protocol.Emit(new { @event = "transcribe_cancelled" });
                    }
                    catch (Exception ex)
                    {
                        Protocol.EmitError(ex.Message, "transcribe");
                    }
                    finally
                    {
                        // Immediately delete temporary extracted vocal file after generating lyrics
                        if (isolateVocals && !string.Equals(actualAudioPath, audioPath, StringComparison.OrdinalIgnoreCase))
                        {
                            try
                            {
                                if (File.Exists(actualAudioPath))
                                {
                                    File.Delete(actualAudioPath);
                                }
                            }
                            catch
                            {
                                // Ignore cleanup error if file handles are releasing
                            }
                        }
                    }

                }, token);
                break;
            }

            case "download_model":
            {
                string modelName = cmd.ModelName ?? "base";
                string modelsDir = cmd.ModelsDir ?? Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "models");

                if (downloadCtsDict.ContainsKey(modelName))
                {
                    // Already downloading this model
                    break;
                }

                var modelCts = new CancellationTokenSource();
                downloadCtsDict[modelName] = modelCts;
                var token = modelCts.Token;

                _ = Task.Run(async () =>
                {
                    try
                    {
                        if (modelName.Equals("vocal", StringComparison.OrdinalIgnoreCase) || modelName.Equals("htdemucs", StringComparison.OrdinalIgnoreCase) || modelName.Equals("htdemucs_ft_vocals", StringComparison.OrdinalIgnoreCase))
                        {
                            string path = await VocalExtractor.EnsureModelDownloadedAsync(modelsDir, token);
                            Protocol.Emit(new { @event = "model_ready", modelName = "vocal", path });
                        }
                        else
                        {
                            string path = await WhisperTranscriber.EnsureModelDownloadedAsync(modelName, modelsDir, token);
                            Protocol.Emit(new { @event = "model_ready", modelName, path });
                        }
                    }
                    catch (OperationCanceledException)
                    {
                        Protocol.Emit(new { @event = "model_download_cancelled", modelName });
                    }
                    catch (Exception ex)
                    {
                        Protocol.EmitError(ex.Message, "download_model");
                    }
                    finally
                    {
                        downloadCtsDict.TryRemove(modelName, out _);
                    }
                }, token);
                break;
            }

            case "extract_vocal":
            {
                if (string.IsNullOrEmpty(cmd.Path))
                {
                    Protocol.EmitError("Missing 'path' for extract_vocal command", "extract_vocal");
                    break;
                }

                activeCts?.Cancel();
                activeCts = new CancellationTokenSource();
                var token = activeCts.Token;

                string audioPath = cmd.Path;
                string modelsDir = cmd.ModelsDir ?? Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "models");
                string outputPath = !string.IsNullOrEmpty(cmd.ModelPath) ? cmd.ModelPath : GetExtractedVocalPath(audioPath, modelsDir);


                activeTask = Task.Run(async () =>
                {
                    try
                    {
                        string modelPath = await VocalExtractor.EnsureModelDownloadedAsync(modelsDir, token);
                        await VocalExtractor.ExtractVocalAsync(audioPath, outputPath, modelPath, token);
                    }
                    catch (OperationCanceledException)
                    {
                        Protocol.Emit(new { @event = "vocal_extraction_cancelled" });
                    }
                    catch (Exception ex)
                    {
                        Protocol.EmitError(ex.Message, "extract_vocal");
                    }
                }, token);
                break;
            }

            case "cancel":
            {
                if (!string.IsNullOrEmpty(cmd.ModelName))
                {
                    string targetKey = cmd.ModelName;
                    if (downloadCtsDict.TryRemove(targetKey, out var targetCts))
                    {
                        try { targetCts.Cancel(); } catch { }
                    }
                    if (targetKey.Equals("vocal", StringComparison.OrdinalIgnoreCase) || targetKey.Equals("htdemucs", StringComparison.OrdinalIgnoreCase))
                    {
                        try { activeCts?.Cancel(); } catch { }
                    }
                    Protocol.Emit(new { @event = "model_download_cancelled", modelName = targetKey });
                }
                else
                {
                    try { activeCts?.Cancel(); } catch { }
                    foreach (var kvp in downloadCtsDict)
                    {
                        try { kvp.Value.Cancel(); } catch { }
                    }
                    downloadCtsDict.Clear();
                    Protocol.Emit(new { @event = "cancelled" });
                }
                break;
            }

            case "shutdown":
                activeCts?.Cancel();
                foreach (var kvp in downloadCtsDict)
                {
                    kvp.Value.Cancel();
                }
                downloadCtsDict.Clear();
                Protocol.Emit(new { @event = "bye" });
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

if (activeTask != null)
{
    try
    {
        await activeTask;
    }
    catch
    {
        // Suppress background exception on exit
    }
}

static string GetExtractedVocalPath(string audioPath, string modelsDir)
{
    string parentDir = Path.GetDirectoryName(modelsDir) ?? AppDomain.CurrentDomain.BaseDirectory;
    string vocalOutputDir = Path.Combine(parentDir, "extracted-vocals");
    Directory.CreateDirectory(vocalOutputDir);

    string safeName = Path.GetFileNameWithoutExtension(audioPath);
    foreach (char c in Path.GetInvalidFileNameChars())
    {
        safeName = safeName.Replace(c, '_');
    }

    byte[] hashBytes = System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(audioPath));
    string hashStr = Convert.ToHexString(hashBytes)[..12];

    return Path.Combine(vocalOutputDir, $"{safeName}_{hashStr}.vocal.wav");
}


