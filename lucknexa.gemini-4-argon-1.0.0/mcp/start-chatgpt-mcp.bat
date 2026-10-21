@echo off
title Gemini 4 Argon MCP Server (ChatGPT & Remote)
echo ========================================================
echo    Gemini 4 Argon MCP Server for ChatGPT Desktop
echo    Author: Lucky Kuntal (ffzlucky7-coder)
echo ========================================================
echo.

cd /d "%~dp0"
start "Gemini 4 Argon MCP Server" node "http-server.js"
timeout /t 2 /nobreak >nul

echo Starting Public HTTPS Tunnel...
where cloudflared >nul 2>&1
if %errorlevel% equ 0 (
    cloudflared tunnel --url http://localhost:3333
) else (
    if exist "C:\Program Files (x86)\cloudflared\cloudflared.exe" (
        "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:3333
    ) else (
        where ngrok >nul 2>&1
        if %errorlevel% equ 0 (
            ngrok http 3333
        ) else (
            echo [Notice] Please install cloudflared or ngrok to expose your local MCP server to ChatGPT Desktop.
            echo Local server is currently running at http://localhost:3333
            pause
        )
    )
)
pause
