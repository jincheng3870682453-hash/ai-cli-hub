@echo off
rem AI CLI Install Platform launcher - auto-finds Node, downloads portable (arch-aware) if missing
chcp 65001 >nul
setlocal
set "APP=%~dp0"
set "NODE="
set "NODE_VER=v22.23.2"

rem detect architecture: ARM64 Windows vs x64
set "NODE_ARCH=x64"
if "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "NODE_ARCH=arm64"
set "NODE_PKG=node-%NODE_VER%-win-%NODE_ARCH%"
set "NODE_DIR=%LOCALAPPDATA%\ai-cli-hub-node"

rem 1) node on PATH
if not defined NODE (node --version >nul 2>&1 && set "NODE=node")
rem 2) portable Node downloaded by DeepSeek-CLI installer (same arch)
if not defined NODE if exist "%LOCALAPPDATA%\DeepSeek-CLI\%NODE_PKG%\node.exe" set "NODE=%LOCALAPPDATA%\DeepSeek-CLI\%NODE_PKG%\node.exe"
rem 3) previously downloaded by this launcher (same arch)
if not defined NODE if exist "%NODE_DIR%\%NODE_PKG%\node.exe" set "NODE=%NODE_DIR%\%NODE_PKG%\node.exe"

if not defined NODE (
  echo [bootstrap] Node.js not found - downloading portable %NODE_PKG% ...
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$ErrorActionPreference='Stop'; $p='%NODE_PKG%'; $d='%NODE_DIR%';" ^
    "$urls=@('https://nodejs.org/dist/%NODE_VER%/'+$p+'.zip','https://npmmirror.com/mirrors/node/%NODE_VER%/'+$p+'.zip');" ^
    "$zip=Join-Path $env:TEMP ($p+'.zip'); foreach($u in $urls){ try{ Invoke-WebRequest -Uri $u -OutFile $zip -UseBasicParsing -TimeoutSec 120; break }catch{} };" ^
    "if(!(Test-Path $zip)){ Write-Host '[bootstrap] download failed - install Node from https://nodejs.org'; exit 1 };" ^
    "New-Item -ItemType Directory -Path $d -Force | Out-Null; Expand-Archive -Path $zip -DestinationPath $d -Force;"
  if exist "%NODE_DIR%\%NODE_PKG%\node.exe" set "NODE=%NODE_DIR%\%NODE_PKG%\node.exe"
)

if not defined NODE (
  echo [ERROR] Node.js not found. Install from https://nodejs.org or set PATH.
  pause
  exit /b 1
)

"%NODE%" "%APP%index.js" %*
endlocal
