@echo off
rem AI CLI Install Platform launcher - finds a usable Node.js (generic)
chcp 65001 >nul
setlocal
set "APP=%~dp0"
set "NODE="

rem 1) node on PATH
if not defined NODE (node --version >nul 2>&1 && set "NODE=node")
rem 2) portable Node downloaded by DeepSeek-CLI installer
if not defined NODE if exist "%LOCALAPPDATA%\DeepSeek-CLI\node-v22.23.2-win-x64\node.exe" set "NODE=%LOCALAPPDATA%\DeepSeek-CLI\node-v22.23.2-win-x64\node.exe"

if not defined NODE (
  echo [ERROR] Node.js not found. Install from https://nodejs.org or set PATH.
  pause
  exit /b 1
)

"%NODE%" "%APP%index.js" %*
endlocal
