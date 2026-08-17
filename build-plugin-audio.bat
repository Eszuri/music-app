@echo off
echo Building Symvonia Unified Audio Engine Plugin (Audio, Equalizer, Metadata)...
dotnet publish plugin/src-engine/SymvoniaEngine.csproj -c Release -r win-x64 --self-contained true -o plugin/src-engine/publish
if %ERRORLEVEL% EQU 0 (
    echo Build success: plugin/src-engine/publish/symvonia-audio-engine.exe
) else (
    echo Build failed with error code %ERRORLEVEL%
    exit /b %ERRORLEVEL%
)