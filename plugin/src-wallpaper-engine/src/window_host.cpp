#include "window_host.h"

#include <algorithm>

namespace symvonia::wallpaper {
namespace {

constexpr UINT kWorkerMessage = 0x052C;

struct WorkerSearch {
    HWND worker = nullptr;
};

} // namespace

WindowHost::~WindowHost() {
    destroy();
}

bool WindowHost::registerClass() {
    WNDCLASSEXW wc{};
    wc.cbSize = sizeof(wc);
    wc.hInstance = instance_;
    wc.lpfnWndProc = &WindowHost::windowProc;
    wc.lpszClassName = className_.c_str();
    wc.hCursor = LoadCursorW(nullptr, IDC_ARROW);
    wc.hbrBackground = nullptr;
    wc.style = CS_HREDRAW | CS_VREDRAW;

    if (RegisterClassExW(&wc) != 0) return true;
    return GetLastError() == ERROR_CLASS_ALREADY_EXISTS;
}

HWND WindowHost::findDesktopHost() const {
    HWND progman = FindWindowW(L"Progman", nullptr);
    if (progman) {
        DWORD_PTR result = 0;
        SendMessageTimeoutW(progman, kWorkerMessage, 0, 0, SMTO_NORMAL, 1000, &result);
    }

    WorkerSearch search;
    EnumWindows(&WindowHost::workerEnumProc, reinterpret_cast<LPARAM>(&search));
    return search.worker ? search.worker : progman;
}

BOOL CALLBACK WindowHost::workerEnumProc(HWND hwnd, LPARAM data) {
    auto* search = reinterpret_cast<WorkerSearch*>(data);
    if (!search || search->worker) return FALSE;
    if (!FindWindowExW(hwnd, nullptr, L"SHELLDLL_DefView", nullptr)) return TRUE;
    search->worker = FindWindowExW(nullptr, hwnd, L"WorkerW", nullptr);
    return FALSE;
}

BOOL CALLBACK WindowHost::monitorEnumProc(HMONITOR monitor, HDC, LPRECT, LPARAM data) {
    auto* result = reinterpret_cast<std::vector<DesktopWindow>*>(data);
    if (!result) return FALSE;

    MONITORINFOEXW info{};
    info.cbSize = sizeof(info);
    if (!GetMonitorInfoW(monitor, &info)) return TRUE;

    DesktopWindow window;
    window.monitorRect = info.rcMonitor;
    window.monitorName = info.szDevice;
    result->push_back(std::move(window));
    return TRUE;
}

std::vector<DesktopWindow> WindowHost::enumerateMonitors() const {
    std::vector<DesktopWindow> monitors;
    EnumDisplayMonitors(nullptr, nullptr, &WindowHost::monitorEnumProc, reinterpret_cast<LPARAM>(&monitors));
    std::sort(monitors.begin(), monitors.end(), [](const auto& left, const auto& right) {
        if (left.monitorRect.top != right.monitorRect.top) return left.monitorRect.top < right.monitorRect.top;
        return left.monitorRect.left < right.monitorRect.left;
    });
    return monitors;
}

bool WindowHost::initialize() {
    instance_ = GetModuleHandleW(nullptr);
    if (!registerClass()) return false;
    parentWindow_ = findDesktopHost();
    return rebuild();
}

bool WindowHost::rebuild() {
    for (const auto& window : windows_) {
        if (window.handle) DestroyWindow(window.handle);
    }
    windows_.clear();

    const auto monitors = enumerateMonitors();
    if (monitors.empty()) return false;
    if (!parentWindow_) parentWindow_ = findDesktopHost();

    RECT parentRect{};
    if (parentWindow_) GetWindowRect(parentWindow_, &parentRect);

    for (auto monitor : monitors) {
        const int x = monitor.monitorRect.left - parentRect.left;
        const int y = monitor.monitorRect.top - parentRect.top;
        const int width = monitor.monitorRect.right - monitor.monitorRect.left;
        const int height = monitor.monitorRect.bottom - monitor.monitorRect.top;

        const DWORD style = parentWindow_ ? WS_CHILD | WS_VISIBLE : WS_POPUP | WS_VISIBLE;
        const HWND hwnd = CreateWindowExW(
            WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE,
            className_.c_str(),
            L"Symvonia Wallpaper Engine",
            style,
            x,
            y,
            width,
            height,
            parentWindow_,
            nullptr,
            instance_,
            this);
        if (!hwnd) return false;
        monitor.handle = hwnd;
        windows_.push_back(std::move(monitor));
    }
    return true;
}

void WindowHost::destroy() {
    for (const auto& window : windows_) {
        if (window.handle) DestroyWindow(window.handle);
    }
    windows_.clear();
}

void WindowHost::pumpMessages(bool& quitRequested) {
    MSG message{};
    while (PeekMessageW(&message, nullptr, 0, 0, PM_REMOVE)) {
        if (message.message == WM_QUIT) {
            quitRequested = true;
            continue;
        }
        TranslateMessage(&message);
        DispatchMessageW(&message);
    }
}

bool WindowHost::consumeDisplayChange() {
    const bool changed = displayChanged_;
    displayChanged_ = false;
    return changed;
}

LRESULT CALLBACK WindowHost::windowProc(HWND hwnd, UINT message, WPARAM wParam, LPARAM lParam) {
    auto* host = reinterpret_cast<WindowHost*>(GetWindowLongPtrW(hwnd, GWLP_USERDATA));
    if (message == WM_NCCREATE) {
        auto* create = reinterpret_cast<CREATESTRUCTW*>(lParam);
        host = reinterpret_cast<WindowHost*>(create->lpCreateParams);
        SetWindowLongPtrW(hwnd, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(host));
    }

    switch (message) {
    case WM_MOUSEACTIVATE:
        return MA_NOACTIVATE;
    case WM_ERASEBKGND:
        return 1;
    case WM_DISPLAYCHANGE:
    case WM_DEVICECHANGE:
        if (host) host->displayChanged_ = true;
        return 0;
    case WM_NCHITTEST:
        return HTTRANSPARENT;
    default:
        break;
    }
    return DefWindowProcW(hwnd, message, wParam, lParam);
}

} // namespace symvonia::wallpaper
