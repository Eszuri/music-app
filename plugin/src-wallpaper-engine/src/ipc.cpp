#include "ipc.h"

#include <algorithm>
#include <cctype>
#include <iomanip>
#include <sstream>

namespace symvonia::wallpaper {
namespace {

std::string trim(std::string value) {
    const auto first = value.find_first_not_of(" \t\r\n");
    if (first == std::string::npos) return {};
    const auto last = value.find_last_not_of(" \t\r\n");
    return value.substr(first, last - first + 1);
}

std::string jsonUnescape(const std::string& value) {
    std::string result;
    result.reserve(value.size());
    bool escaped = false;
    for (char ch : value) {
        if (!escaped) {
            if (ch == '\\') escaped = true;
            else result.push_back(ch);
            continue;
        }
        switch (ch) {
        case '"': result.push_back('"'); break;
        case '\\': result.push_back('\\'); break;
        case '/': result.push_back('/'); break;
        case 'b': result.push_back('\b'); break;
        case 'f': result.push_back('\f'); break;
        case 'n': result.push_back('\n'); break;
        case 'r': result.push_back('\r'); break;
        case 't': result.push_back('\t'); break;
        default: result.push_back(ch); break;
        }
        escaped = false;
    }
    if (escaped) result.push_back('\\');
    return result;
}

std::optional<std::string> getString(const std::string& json, const std::string& key) {
    const std::string needle = "\"" + key + "\"";
    const auto keyPos = json.find(needle);
    if (keyPos == std::string::npos) return std::nullopt;
    const auto colon = json.find(':', keyPos + needle.size());
    if (colon == std::string::npos) return std::nullopt;
    const auto firstQuote = json.find('"', colon + 1);
    if (firstQuote == std::string::npos) return std::nullopt;

    std::string value;
    bool escaped = false;
    for (size_t index = firstQuote + 1; index < json.size(); ++index) {
        const char ch = json[index];
        if (!escaped && ch == '"') return jsonUnescape(value);
        if (!escaped && ch == '\\') {
            escaped = true;
            value.push_back(ch);
        } else {
            value.push_back(ch);
            escaped = false;
        }
    }
    return std::nullopt;
}

std::optional<double> getNumber(const std::string& json, const std::string& key) {
    const std::string needle = "\"" + key + "\"";
    const auto keyPos = json.find(needle);
    if (keyPos == std::string::npos) return std::nullopt;
    const auto colon = json.find(':', keyPos + needle.size());
    if (colon == std::string::npos) return std::nullopt;
    size_t begin = colon + 1;
    while (begin < json.size() && std::isspace(static_cast<unsigned char>(json[begin]))) ++begin;
    size_t end = begin;
    while (end < json.size() && (std::isdigit(static_cast<unsigned char>(json[end])) || json[end] == '.' || json[end] == '-' || json[end] == '+')) ++end;
    if (begin == end) return std::nullopt;
    try {
        return std::stod(json.substr(begin, end - begin));
    } catch (...) {
        return std::nullopt;
    }
}

std::string escape(const std::string& value) {
    std::ostringstream out;
    for (const char ch : value) {
        switch (ch) {
        case '"': out << "\\\""; break;
        case '\\': out << "\\\\"; break;
        case '\n': out << "\\n"; break;
        case '\r': out << "\\r"; break;
        case '\t': out << "\\t"; break;
        default: out << ch; break;
        }
    }
    return out.str();
}

} // namespace

std::optional<Command> parseCommand(const std::string& line) {
    if (trim(line).empty()) return std::nullopt;
    const auto name = getString(line, "command");
    if (!name || name->empty()) return std::nullopt;

    Command command;
    command.name = *name;
    command.scene = getString(line, "scene").value_or(command.scene);
    command.texturePath = getString(line, "path").value_or(command.texturePath);
    command.texturePath = getString(line, "texturePath").value_or(command.texturePath);
    command.parameter = getString(line, "name").value_or(command.parameter);
    command.fitMode = getString(line, "fitMode").value_or(command.fitMode);
    command.fitMode = getString(line, "mode").value_or(command.fitMode);
    command.value = getNumber(line, "value").value_or(command.value);
    command.fps = getNumber(line, "fps").value_or(command.fps);
    return command;
}

std::string makeReadyEvent() {
    return R"({"event":"ready","version":"0.1.0","renderer":"d3d11","shaderModel":"5_0"})";
}

std::string makeStateEvent(const State& state) {
    std::ostringstream out;
    out << "{\"event\":\"state\",\"state\":\"" << escape(state.state)
        << "\",\"scene\":\"" << escape(state.scene)
        << "\",\"texturePath\":\"" << escape(state.texturePath)
        << "\",\"fitMode\":\"" << escape(state.fitMode)
        << "\",\"fps\":" << std::fixed << std::setprecision(2) << state.fps
        << ",\"monitorCount\":" << state.monitorCount;
    if (!state.error.empty()) out << ",\"error\":\"" << escape(state.error) << "\"";
    out << '}';
    return out.str();
}

std::string makeErrorEvent(const std::string& code, const std::string& message) {
    return "{\"event\":\"error\",\"code\":\"" + escape(code)
        + "\",\"message\":\"" + escape(message) + "\"}";
}

} // namespace symvonia::wallpaper

