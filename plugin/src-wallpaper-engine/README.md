# Symvonia Wallpaper Engine

Standalone Windows wallpaper renderer using Win32 desktop windows, Direct3D 11, and HLSL Shader Model 5.

The engine has no Tauri dependency. It can be launched directly from a terminal or supervised by any host through line-delimited JSON on `stdin`/`stdout`.

## Build

Requirements:

- Windows 10/11 x64
- Visual Studio 2022 with the Desktop C++ workload
- Windows 10/11 SDK
- CMake 3.24+

```powershell
cmake -S plugin/src-wallpaper-engine -B plugin/src-wallpaper-engine/build -G "Visual Studio 17 2022" -A x64
cmake --build plugin/src-wallpaper-engine/build --config Release
```

Copy the executable and `shaders/` directory together when running it.

## Standalone run

```powershell
plugin/src-wallpaper-engine/build/bin/symvonia-wallpaper-engine.exe --standalone --texture C:/Wallpapers/cover.jpg
```

`--standalone` keeps rendering after `stdin` closes. Without it, the process exits when the IPC input stream ends.

## IPC example

```json
{"command":"set_texture","path":"C:\\Wallpapers\\cover.jpg"}
{"command":"set_param","name":"intensity","value":0.8}
{"command":"pause"}
{"command":"get_state"}
{"command":"quit"}
```

The desktop host creates one non-activating window per monitor behind the desktop icons when the Windows `WorkerW` host is available. If Explorer has not exposed a `WorkerW`, the engine falls back to the `Progman` host.

