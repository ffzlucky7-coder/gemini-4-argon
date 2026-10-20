@echo off
title Gemini 4 Argon Extension Installer
echo =======================================================
echo    Gemini 4 Argon Autonomous Agent Installer v1.1.0
echo    Created by Lucky Kuntal (ffzlucky7-coder)
echo =======================================================
echo.

set "TARGET_DIR=%USERPROFILE%\.antigravity-ide\extensions\lucknexa.gemini-4-argon-1.0.0"
set "SOURCE_DIR=%~dp0lucknexa.gemini-4-argon-1.0.0"

echo [1/3] Copying extension to Antigravity IDE directory...
echo Source: %SOURCE_DIR%
echo Destination: %TARGET_DIR%

if not exist "%USERPROFILE%\.antigravity-ide\extensions" (
    mkdir "%USERPROFILE%\.antigravity-ide\extensions"
)

robocopy "%SOURCE_DIR%" "%TARGET_DIR%" /E /IS /IT /NP /NJH /NJS

echo.
echo [2/3] Registering extension with Antigravity IDE CLI...
where antigravity-ide.cmd >nul 2>nul
if %ERRORLEVEL% equ 0 (
    if exist "%~dp0gemini-4-argon-1.1.0.vsix" (
        echo Running: antigravity-ide.cmd --install-extension gemini-4-argon-1.1.0.vsix
        call antigravity-ide.cmd --install-extension "%~dp0gemini-4-argon-1.1.0.vsix" --force
    ) else if exist "%~dp0gemini-4-argon-1.0.0.vsix" (
        echo Running: antigravity-ide.cmd --install-extension gemini-4-argon-1.0.0.vsix
        call antigravity-ide.cmd --install-extension "%~dp0gemini-4-argon-1.0.0.vsix" --force
    )
) else (
    where code >nul 2>nul
    if %ERRORLEVEL% equ 0 (
        if exist "%~dp0gemini-4-argon-1.1.0.vsix" (
            echo Running: code --install-extension gemini-4-argon-1.1.0.vsix
            call code --install-extension "%~dp0gemini-4-argon-1.1.0.vsix" --force
        ) else if exist "%~dp0gemini-4-argon-1.0.0.vsix" (
            echo Running: code --install-extension gemini-4-argon-1.0.0.vsix
            call code --install-extension "%~dp0gemini-4-argon-1.0.0.vsix" --force
        )
    )
)

echo.
echo =======================================================
echo  SUCCESS: Gemini 4 Argon Extension has been installed!
echo.
echo  To activate in Antigravity IDE / VS Code:
echo   1. Restart Antigravity IDE OR press Ctrl+Shift+P and run:
echo      "Developer: Reload Window"
echo   2. You will see the glowing Gemini 4 Argon icon in the
echo      left Activity Bar!
echo   3. Click the icon, select Reasoning Mode, and enjoy!
echo =======================================================
echo.
pause
