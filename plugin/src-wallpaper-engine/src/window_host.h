#pragma once

#include <windows.h>

#include <functional>
#include <string>
#include <vector>

namespace symvonia::wallpaper {

struct DesktopWindow {
    HWND handle = nullptr;
    RECT monitorRect{};
    std::wstring monitorName;
};

class WindowHost {
public:
    WindowHost() = default;
    ~WindowHost();

    WindowHost(const WindowHost&) = delete;
    WindowHost& operator=(const WindowHost&) = delete;

    bool initialize();
    void destroy();
    bool rebuild();
    void pumpMessages(bool& quitRequested);
    bool consumeDisplayChange();

    const std::vector<DesktopWindow>& windows() const { return windows_; }
    HWND parentWindow() const { return parentWindow_; }

private:
    static LRESULT CALLBACK windowProc(HWND hwnd, UINT message, WPARAM wParam, LPARAM lParam);
    static BOOL CALLBACK monitorEnumProc(HMONITOR monitor, HDC, LPRECT, LPARAM data);
    static BOOL CALLBACK workerEnumProc(HWND hwnd, LPARAM data);

    bool registerClass();
    HWND findDesktopHost() const;
    std::vector<DesktopWindow> enumerateMonitors() const;
    std::wstring className_ = L"SymvoniaWallpaperEngineWindow";
    HINSTANCE instance_ = nullptr;
    HWND parentWindow_ = nullptr;
    std::vector<DesktopWindow> windows_;
    bool displayChanged_ = false;
};

} // namespace symvonia::wallpaper
