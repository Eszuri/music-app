@echo off
echo ========================================================
echo Building All Symvonia Plugins (Single-File Releases)...
echo ========================================================

echo.
echo [1/4] Building Audio Engine Plugin...
call build-plugin-audio.bat
if %ERRORLEVEL% NEQ 0 exit /b %ERRORLEVEL%

echo.
echo [2/4] Building AI Lyrics Plugin...
call build-plugin-lyrics.bat
if %ERRORLEVEL% NEQ 0 exit /b %ERRORLEVEL%

echo.
echo [3/4] Building Equalizer DSP Plugin...
call build-plugin-equalizer.bat
if %ERRORLEVEL% NEQ 0 exit /b %ERRORLEVEL%

echo.
echo [4/4] Building Tag Editor Plugin...
call build-plugin-tag-editor.bat
if %ERRORLEVEL% NEQ 0 exit /b %ERRORLEVEL%

echo.
echo ========================================================
echo All 4 Symvonia plugins built successfully!
echo ========================================================
