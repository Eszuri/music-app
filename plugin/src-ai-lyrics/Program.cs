using System.Runtime.InteropServices;
using Symvonia.AiLyrics;

// Pre-load all Whisper native DLLs before Whisper.net tries to load them.
// Whisper.net uses NativeLibrary.Load internally (not [DllImport]),
// so SetDllImportResolver won't help. We must load them ourselves.
{
    string exeDir = Path.GetDirectoryName(Environment.ProcessPath ?? "") ?? AppDomain.CurrentDomain.BaseDirectory;

    // Set Whisper.net's library search path
    Whisper.net.LibraryLoader.RuntimeOptions.LibraryPath = exeDir;

    // Pre-load native DLLs in dependency order (ggml deps first, then whisper)
    string[] nativeDlls = ["ggml-base-whisper.dll", "ggml-whisper.dll", "ggml-cpu-whisper.dll", "whisper.dll"];
    foreach (var dll in nativeDlls)
    {
        string path = Path.Combine(exeDir, dll);
        if (File.Exists(path))
        {
            NativeLibrary.Load(path);
        }
    }
}

// Symvonia Local AI Lyrics Generator Engine — headless console process.
// Speaks JSON lines on stdin/stdout (see Protocol.cs).

Console.InputEncoding = System.Text.Encoding.UTF8;
Console.OutputEncoding = new System.Text.UTF8Encoding(encoderShouldEmitUTF8Identifier: false);

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
        string[] toLoad = ["whisper.dll", "ggml-whisper.dll", "ggml-base-whisper.dll", "ggml-cpu-whisper.dll"];
        foreach (var dll in toLoad)
        {
            string path = Path.Combine(exeDir, dll);
            bool exists = File.Exists(path);
            bool loaded = false;
            IntPtr handle = IntPtr.Zero;
            if (exists)
                loaded = NativeLibrary.TryLoad(path, out handle);
            Console.WriteLine($"  {dll}: exists={exists}, loaded={loaded}, handle=0x{handle:X}");
        }

        // Try WhisperFactory
        Console.WriteLine($"\n--- WhisperFactory Test ---");
        Whisper.net.LibraryLoader.RuntimeOptions.LibraryPath = exeDir;
        Console.WriteLine($"RuntimeOptions.LibraryPath set to: {exeDir}");
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
    string outputWav = args.Length >= 3 ? Path.GetFullPath(args[2]) : Path.ChangeExtension(inputAudio, ".vocal.wav");
    string modelsDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "models");

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

if (args.Length >= 2 && args[0] == "--verify")
{
    var token = args[1];
    Protocol.Emit(new
    {
        @event = "verify_response",
        token = token,
        engine = "Symvonia AI Lyrics Engine",
        version = "1.0.0"
    });
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
                    try
                    {
                        string actualAudioPath = audioPath;
                        if (isolateVocals)
                        {
                            string vocalModelPath = await VocalExtractor.EnsureModelDownloadedAsync(modelsDir, token);
                            string vocalOutputPath = Path.ChangeExtension(audioPath, ".vocal.wav");
                            actualAudioPath = await VocalExtractor.ExtractVocalAsync(audioPath, vocalOutputPath, vocalModelPath, token);
                        }

                        if (string.IsNullOrEmpty(modelPath) || !File.Exists(modelPath))
                        {
                            modelPath = await WhisperTranscriber.EnsureModelDownloadedAsync(modelName, modelsDir, token);
                        }

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
                }, token);
                break;
            }

            case "download_model":
            {
                string modelName = cmd.ModelName ?? "base";
                string modelsDir = cmd.ModelsDir ?? Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "models");

                activeCts?.Cancel();
                activeCts = new CancellationTokenSource();
                var token = activeCts.Token;

                activeTask = Task.Run(async () =>
                {
                    try
                    {
                        string path = await WhisperTranscriber.EnsureModelDownloadedAsync(modelName, modelsDir, token);
                        Protocol.Emit(new { @event = "model_ready", modelName, path });
                    }
                    catch (OperationCanceledException)
                    {
                        Protocol.Emit(new { @event = "model_download_cancelled" });
                    }
                    catch (Exception ex)
                    {
                        Protocol.EmitError(ex.Message, "download_model");
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
                string outputPath = !string.IsNullOrEmpty(cmd.ModelPath) ? cmd.ModelPath : Path.ChangeExtension(audioPath, ".vocal.wav");

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
                activeCts?.Cancel();
                Protocol.Emit(new { @event = "cancelled" });
                break;

            case "shutdown":
                activeCts?.Cancel();
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

