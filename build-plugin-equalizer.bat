@echo off
echo Building Symvonia Equalizer DSP Plugin...
dotnet publish plugin/src-equalizer/EqualizerPlugin.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:EnableCompressionInSingleFile=true -p:PublishTrimmed=true -o plugin/src-equalizer/publish
if %ERRORLEVEL% EQU 0 (
    echo Build success: plugin/src-equalizer/publish/symvonia-equalizer.exe
) else (
    echo Build failed with error code %ERRORLEVEL%
    exit /b %ERRORLEVEL%
)
