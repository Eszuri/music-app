#include "engine.h"

#include <algorithm>
#include <chrono>

namespace symvonia::wallpaper {

bool WallpaperEngine::initialize(const std::filesystem::path& shaderDirectory, std::string& error) {
    shaderDirectory_ = shaderDirectory;
    if (!windowHost_.initialize()) {
        error = "Unable to create desktop wallpaper windows.";
        return false;
    }
    if (!renderer_.initialize(shaderDirectory_, error)) return false;
    if (!rebuildWindows(error)) return false;

    state_.state = "playing";
    state_.scene = "cover-reactive";
    state_.fitMode = renderer_.fitMode();
    state_.effect = renderer_.effect();
    state_.fps = 30.0;
    state_.monitorCount = static_cast<int>(windowHost_.windows().size());
    initialized_ = true;
    return true;
}

bool WallpaperEngine::rebuildWindows(std::string& error) {
    for (const auto& window : windowHost_.windows()) {
        if (!renderer_.detach(window.handle)) return false;
    }
    if (!windowHost_.rebuild()) {
        error = "Unable to enumerate or create desktop monitors.";
        return false;
    }
    for (const auto& window : windowHost_.windows()) {
        if (!renderer_.attach(window.handle, error)) return false;
    }
    state_.monitorCount = static_cast<int>(windowHost_.windows().size());
    return true;
}

bool WallpaperEngine::applyTexture(const std::filesystem::path& path, std::string& error) {
    if (!renderer_.setTexture(path, error)) return false;
    state_.texturePath = path.string();
    return true;
}

bool WallpaperEngine::handleCommand(const Command& command, std::string& error) {
    if (!initialized_) {
        error = "Wallpaper engine is not initialized.";
        return false;
    }

    if (command.name == "start") {
        if (!command.scene.empty()) state_.scene = command.scene;
        if (!command.texturePath.empty() && !applyTexture(std::filesystem::u8path(command.texturePath), error)) return false;
        state_.state = "playing";
        return true;
    }
    if (command.name == "pause") {
        state_.state = "paused";
        return true;
    }
    if (command.name == "resume") {
        state_.state = "playing";
        return true;
    }
    if (command.name == "stop") {
        state_.state = "stopped";
        return true;
    }
    if (command.name == "quit" || command.name == "shutdown") {
        state_.state = "stopped";
        quitRequested_ = true;
        return true;
    }
    if (command.name == "set_texture") {
        if (command.texturePath.empty()) {
            error = "set_texture requires a path.";
            return false;
        }
        return applyTexture(std::filesystem::u8path(command.texturePath), error);
    }
    if (command.name == "set_param") {
        if (command.parameter == "intensity") {
            intensity_ = std::clamp(static_cast<float>(command.value), 0.0f, 2.0f);
            return true;
        }
        if (command.parameter == "fitMode") {
            const std::string mode = !command.fitMode.empty() ? command.fitMode : "fill";
            renderer_.setFitMode(mode);
            state_.fitMode = renderer_.fitMode();
            return true;
        }
        if (command.parameter == "effect") {
            const std::string eff = !command.effect.empty() ? command.effect : "none";
            renderer_.setEffect(eff);
            state_.effect = renderer_.effect();
            return true;
        }
        error = "Unsupported shader parameter: " + command.parameter;
        return false;
    }
    if (command.name == "set_fit_mode") {
        const std::string mode = !command.fitMode.empty() ? command.fitMode : "fill";
        renderer_.setFitMode(mode);
        state_.fitMode = renderer_.fitMode();
        return true;
    }
    if (command.name == "set_effect") {
        const std::string eff = !command.effect.empty() ? command.effect : "none";
        renderer_.setEffect(eff);
        state_.effect = renderer_.effect();
        return true;
    }
    if (command.name == "set_fps") {
        state_.fps = std::clamp(command.fps, 1.0, 120.0);
        return true;
    }
    if (command.name == "get_state") return true;

    error = "Unknown command: " + command.name;
    return false;
}

void WallpaperEngine::tick(bool& quitRequested) {
    if (!initialized_) return;
    windowHost_.pumpMessages(quitRequested);
    if (quitRequested) {
        quitRequested_ = true;
        return;
    }

    if (windowHost_.consumeDisplayChange()) {
        std::string ignored;
        rebuildWindows(ignored);
    }

    if (state_.state != "playing") return;
    elapsedSeconds_ += static_cast<float>(1.0 / std::max(state_.fps, 1.0));
    for (const auto& window : windowHost_.windows()) {
        std::string error;
        if (!renderer_.render(window.handle, elapsedSeconds_, intensity_, error)) {
            state_.state = "error";
            state_.error = error;
            return;
        }
    }
}

State WallpaperEngine::state() const {
    State snapshot = state_;
    snapshot.monitorCount = static_cast<int>(windowHost_.windows().size());
    return snapshot;
}

} // namespace symvonia::wallpaper

