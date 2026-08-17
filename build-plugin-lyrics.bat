@echo off
echo Building Symvonia AI Lyrics Plugin...
dotnet publish plugin/src-ai-lyrics/AiLyricsPlugin.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o plugin/src-ai-lyrics/publish
if %ERRORLEVEL% EQU 0 (
    echo Build success: plugin/src-ai-lyrics/publish/symvonia-ai-lyrics.exe
) else (
    echo Build failed with error code %ERRORLEVEL%
    exit /b %ERRORLEVEL%
)
