#include "engine.h"
#include "ipc.h"

#include <windows.h>

#include <atomic>
#include <algorithm>
#include <chrono>
#include <condition_variable>
#include <filesystem>
#include <iostream>
#include <memory>
#include <mutex>
#include <queue>
#include <string>
#include <thread>

namespace symvonia::wallpaper {
namespace {

struct InputState {
    std::mutex mutex;
    std::queue<std::string> lines;
    std::atomic<bool> closed = false;
};

void emitLine(const std::string& line) {
    std::cout << line << '\n' << std::flush;
}

std::filesystem::path defaultShaderDirectory(const wchar_t* executablePath) {
    std::filesystem::path executable(executablePath ? executablePath : L"");
    return executable.parent_path() / L"shaders";
}

} // namespace
} // namespace symvonia::wallpaper

int wmain(int argc, wchar_t* argv[]) {
    using namespace symvonia::wallpaper;

    bool standalone = false;
    std::filesystem::path shaderDirectory;
    std::filesystem::path initialTexture;
    std::string initialFit = "fill";
    std::string initialEffect = "none";
    double initialFps = 30.0;

    wchar_t executablePath[MAX_PATH]{};
    const DWORD pathLength = GetModuleFileNameW(nullptr, executablePath, MAX_PATH);
    shaderDirectory = defaultShaderDirectory(pathLength > 0 ? executablePath : nullptr);

    for (int index = 1; index < argc; ++index) {
        const std::wstring argument = argv[index];
        if (argument == L"--standalone") {
            standalone = true;
        } else if (argument == L"--stdio") {
            standalone = false;
        } else if (argument == L"--shader-dir" && index + 1 < argc) {
            shaderDirectory = argv[++index];
        } else if (argument == L"--texture" && index + 1 < argc) {
            initialTexture = argv[++index];
        } else if (argument == L"--fps" && index + 1 < argc) {
            try {
                initialFps = std::stod(argv[++index]);
            } catch (...) {
                emitLine(makeErrorEvent("INVALID_ARGUMENT", "Invalid --fps value."));
                return 2;
            }
        } else if (argument == L"--fit" && index + 1 < argc) {
            std::wstring fitArg = argv[++index];
            if (fitArg == L"fit") initialFit = "fit";
            else if (fitArg == L"stretch") initialFit = "stretch";
            else if (fitArg == L"center") initialFit = "center";
            else if (fitArg == L"tile") initialFit = "tile";
            else initialFit = "fill";
        } else if (argument == L"--effect" && index + 1 < argc) {
            std::wstring effArg = argv[++index];
            if (effArg == L"reactive_glow" || effArg == L"glow") initialEffect = "reactive_glow";
            else if (effArg == L"subtle_pulse" || effArg == L"pulse" || effArg == L"breathing") initialEffect = "subtle_pulse";
            else if (effArg == L"cinematic_vignette" || effArg == L"vignette") initialEffect = "cinematic_vignette";
            else if (effArg == L"grayscale" || effArg == L"black_white") initialEffect = "grayscale";
            else if (effArg == L"dimmed" || effArg == L"dim") initialEffect = "dimmed";
            else initialEffect = "none";
        } else if (argument == L"--help") {
            std::wcout << L"Symvonia Wallpaper Engine 0.1.0\n"
                       << L"  --standalone             Keep rendering after stdin closes\n"
                       << L"  --stdio                  Exit when stdin closes (default)\n"
                       << L"  --shader-dir <directory> HLSL shader directory\n"
                       << L"  --texture <file>         Initial PNG/JPEG/BMP texture\n"
                       << L"  --fit <mode>             Fit mode (fill, fit, stretch, center, tile)\n"
                       << L"  --effect <mode>          Visual effect (none, reactive_glow, subtle_pulse, cinematic_vignette, grayscale, dimmed)\n"
                       << L"  --fps <number>           Target frame rate\n";
            return 0;
        }
    }

    if (FAILED(CoInitializeEx(nullptr, COINIT_MULTITHREADED))) {
        emitLine(makeErrorEvent("COM_INIT_FAILED", "Unable to initialize COM."));
        return 1;
    }

    WallpaperEngine engine;
    std::string error;
    if (!engine.initialize(shaderDirectory, error)) {
        emitLine(makeErrorEvent("ENGINE_INIT_FAILED", error));
        CoUninitialize();
        return 1;
    }

    if (initialFit != "fill") {
        Command fitCmd;
        fitCmd.name = "set_fit_mode";
        fitCmd.fitMode = initialFit;
        engine.handleCommand(fitCmd, error);
    }

    if (initialEffect != "none") {
        Command effCmd;
        effCmd.name = "set_effect";
        effCmd.effect = initialEffect;
        engine.handleCommand(effCmd, error);
    }

    if (!initialTexture.empty()) {
        Command textureCommand;
        textureCommand.name = "set_texture";
        textureCommand.texturePath = initialTexture.string();
        if (!engine.handleCommand(textureCommand, error)) {
            emitLine(makeErrorEvent("TEXTURE_LOAD_FAILED", error));
        }
    }
    Command fpsCommand;
    fpsCommand.name = "set_fps";
    fpsCommand.fps = initialFps;
    engine.handleCommand(fpsCommand, error);

    emitLine(makeReadyEvent());
    emitLine(makeStateEvent(engine.state()));

    const auto input = std::make_shared<InputState>();
    std::thread reader([input]() {
        std::string line;
        while (std::getline(std::cin, line)) {
            std::lock_guard lock(input->mutex);
            input->lines.push(std::move(line));
        }
        input->closed.store(true);
    });

    bool quitRequested = false;
    auto lastFrameTime = std::chrono::steady_clock::now();

    while (!quitRequested && !engine.shouldQuit()) {
        engine.tick(quitRequested);
        if (quitRequested) break;

        std::queue<std::string> pending;
        {
            std::lock_guard lock(input->mutex);
            std::swap(pending, input->lines);
        }

        while (!pending.empty()) {
            const auto line = std::move(pending.front());
            pending.pop();
            const auto command = parseCommand(line);
            if (!command) {
                emitLine(makeErrorEvent("INVALID_COMMAND", "Expected a JSON object with a command field."));
                continue;
            }

            error.clear();
            if (!engine.handleCommand(*command, error)) {
                emitLine(makeErrorEvent("COMMAND_FAILED", error));
            } else if (command->name == "get_state" || command->name == "start" || command->name == "pause" ||
                       command->name == "resume" || command->name == "stop" || command->name == "set_texture" ||
                       command->name == "set_param" || command->name == "set_fps") {
                emitLine(makeStateEvent(engine.state()));
            }
        }

        if (input->closed.load() && !standalone) {
            quitRequested = true;
            break;
        }

        const double frameRate = std::clamp(engine.state().fps, 1.0, 120.0);
        const auto targetFrameDuration = std::chrono::duration<double>(1.0 / frameRate);
        const auto now = std::chrono::steady_clock::now();
        const auto elapsed = now - lastFrameTime;

        if (elapsed < targetFrameDuration) {
            const auto remaining = std::chrono::duration_cast<std::chrono::milliseconds>(targetFrameDuration - elapsed);
            const DWORD waitMs = std::clamp(static_cast<DWORD>(remaining.count()), 1UL, 16UL);
            MsgWaitForMultipleObjectsEx(0, nullptr, waitMs, QS_ALLINPUT, MWMO_ALERTABLE);
        } else {
            lastFrameTime = now;
        }
    }

    if (reader.joinable()) {
        if (input->closed.load()) reader.join();
        else reader.detach();
    }
    CoUninitialize();
    return 0;
}
