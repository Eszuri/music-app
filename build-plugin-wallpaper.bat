@echo off
setlocal

echo Building Symvonia Standalone Wallpaper Engine...

cmake -S plugin/src-wallpaper-engine -B plugin/src-wallpaper-engine/build -G "Visual Studio 17 2022" -A x64
if %ERRORLEVEL% NEQ 0 exit /b %ERRORLEVEL%

cmake --build plugin/src-wallpaper-engine/build --config Release
if %ERRORLEVEL% NEQ 0 exit /b %ERRORLEVEL%

if not exist "plugin\src-wallpaper-engine\publish\" mkdir "plugin\src-wallpaper-engine\publish"
if not exist "plugin\src-wallpaper-engine\publish\shaders\" mkdir "plugin\src-wallpaper-engine\publish\shaders"

copy /Y "plugin\src-wallpaper-engine\build\bin\symvonia-wallpaper-engine.exe" "plugin\src-wallpaper-engine\publish\symvonia-wallpaper-engine.exe" >NUL
copy /Y "plugin\src-wallpaper-engine\shaders\*.hlsl" "plugin\src-wallpaper-engine\publish\shaders\" >NUL
copy /Y "plugin\src-wallpaper-engine\manifest.json" "plugin\src-wallpaper-engine\publish\manifest.json" >NUL

echo Build success: plugin/src-wallpaper-engine/publish/symvonia-wallpaper-engine.exe
endlocal
