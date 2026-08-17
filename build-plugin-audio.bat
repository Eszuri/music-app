@echo off
echo Building Symvonia Bit-Perfect Audio Engine Plugin...
dotnet publish plugin/src-audio-engine/AudioEngine.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o plugin/src-audio-engine/publish
if %ERRORLEVEL% EQU 0 (
    echo Build success: plugin/src-audio-engine/publish/symvonia-audio-engine.exe
) else (
    echo Build failed with error code %ERRORLEVEL%
    exit /b %ERRORLEVEL%
)