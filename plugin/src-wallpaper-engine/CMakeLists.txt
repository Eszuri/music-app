cmake_minimum_required(VERSION 3.24)

project(SymvoniaWallpaperEngine LANGUAGES CXX)

if (NOT WIN32)
    message(FATAL_ERROR "Symvonia Wallpaper Engine currently targets Windows only.")
endif()

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_executable(symvonia-wallpaper-engine
    src/main.cpp
    src/engine.cpp
    src/engine.h
    src/ipc.cpp
    src/ipc.h
    src/renderer.cpp
    src/renderer.h
    src/window_host.cpp
    src/window_host.h
)

target_compile_definitions(symvonia-wallpaper-engine PRIVATE
    UNICODE
    _UNICODE
    WIN32_LEAN_AND_MEAN
    NOMINMAX
    _CRT_SECURE_NO_WARNINGS
    _SILENCE_CXX20_U8PATH_DEPRECATION_WARNING
)

target_compile_options(symvonia-wallpaper-engine PRIVATE
    /W4
    /permissive-
    /EHsc
)

target_link_libraries(symvonia-wallpaper-engine PRIVATE
    d3d11
    dxgi
    d3dcompiler
    dwmapi
    gdi32
    ole32
    shlwapi
    user32
    windowscodecs
)

set_target_properties(symvonia-wallpaper-engine PROPERTIES
    OUTPUT_NAME "symvonia-wallpaper-engine"
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin"
    RUNTIME_OUTPUT_DIRECTORY_RELEASE "${CMAKE_BINARY_DIR}/bin"
    RUNTIME_OUTPUT_DIRECTORY_DEBUG "${CMAKE_BINARY_DIR}/bin"
)
