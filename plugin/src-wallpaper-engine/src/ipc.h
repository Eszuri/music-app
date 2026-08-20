#pragma once

#include <optional>
#include <string>

namespace symvonia::wallpaper {

struct Command {
    std::string name;
    std::string scene;
    std::string texturePath;
    std::string parameter;
    std::string fitMode;
    std::string effect;
    std::string transition;
    double value = 0.0;
    double fps = 30.0;
};

struct State {
    std::string state = "starting";
    std::string scene = "cover-reactive";
    std::string texturePath;
    std::string fitMode = "fill";
    std::string effect = "none";
    std::string transition = "fade";
    double fps = 30.0;
    int monitorCount = 0;
    std::string error;
};

std::optional<Command> parseCommand(const std::string& line);
std::string makeReadyEvent();
std::string makeStateEvent(const State& state);
std::string makeErrorEvent(const std::string& code, const std::string& message);

} // namespace symvonia::wallpaper
