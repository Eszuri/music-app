#pragma once

#include "ipc.h"
#include "renderer.h"
#include "window_host.h"

#include <filesystem>
#include <string>

namespace symvonia::wallpaper {

class WallpaperEngine {
public:
    bool initialize(const std::filesystem::path& shaderDirectory, std::string& error);
    bool handleCommand(const Command& command, std::string& error);
    void tick(bool& quitRequested);

    State state() const;
    bool shouldQuit() const { return quitRequested_; }

private:
    bool rebuildWindows(std::string& error);
    bool applyTexture(const std::filesystem::path& path, std::string& error);

    WindowHost windowHost_;
    Renderer renderer_;
    State state_;
    std::filesystem::path shaderDirectory_;
    float intensity_ = 0.8f;
    float elapsedSeconds_ = 0.0f;
    bool quitRequested_ = false;
    bool initialized_ = false;
};

} // namespace symvonia::wallpaper

