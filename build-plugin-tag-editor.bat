@echo off
echo Building Symvonia Tag Editor Plugin...
dotnet publish plugin/src-tag-editor/TagEditorPlugin.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:EnableCompressionInSingleFile=true -p:PublishTrimmed=true -o plugin/src-tag-editor/publish
if %ERRORLEVEL% EQU 0 (
    echo Build success: plugin/src-tag-editor/publish/symvonia-tag-editor.exe
) else (
    echo Build failed with error code %ERRORLEVEL%
    exit /b %ERRORLEVEL%
)
