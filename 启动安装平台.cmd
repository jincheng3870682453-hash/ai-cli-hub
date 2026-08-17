@echo off
rem AI CLI Install Platform launcher - auto-finds Node, downloads portable if missing
chcp 65001 >nul
setlocal
set "APP=%~dp0"
set "NODE="
set "NODE_VER=v22.23.2"
set "NODE_DIR=%LOCALAPPDATA%\ai-cli-hub-node"

rem 1) node on PATH
if not defined NODE (node --version >nul 2>&1 && set "NODE=node")
rem 2) portable Node downloaded by DeepSeek-CLI installer
if not defined NODE if exist "%LOCALAPPDATA%\DeepSeek-CLI\node-%NODE_VER%-win-x64\node.exe" set "NODE=%LOCALAPPDATA%\DeepSeek-CLI\node-%NODE_VER%-win-x64\node.exe"
rem 3) previously downloaded by this launcher
if not defined NODE if exist "%NODE_DIR%\node-%NODE_VER%-win-x64\node.exe" set "NODE=%NODE_DIR%\node-%NODE_VER%-win-x64\node.exe"

if not defined NODE (
  echo [bootstrap] Node.js not found - downloading portable Node %NODE_VER% ...
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$ErrorActionPreference='Stop'; $v='%NODE_VER%'; $p='node-'+$v+'-win-x64'; $d='%NODE_DIR%';" ^
    "$urls=@('https://nodejs.org/dist/'+$v+'/'+$p+'.zip','https://npmmirror.com/mirrors/node/'+$v+'/'+$p+'.zip');" ^
    "$zip=Join-Path $env:TEMP ($p+'.zip'); foreach($u in $urls){ try{ Invoke-WebRequest -Uri $u -OutFile $zip -UseBasicParsing -TimeoutSec 120; break }catch{} };" ^
    "if(!(Test-Path $zip)){ Write-Host '[bootstrap] download failed - install Node from https://nodejs.org'; exit 1 };" ^
    "New-Item -ItemType Directory -Path $d -Force | Out-Null; Expand-Archive -Path $zip -DestinationPath $d -Force;"
  if exist "%NODE_DIR%\node-%NODE_VER%-win-x64\node.exe" set "NODE=%NODE_DIR%\node-%NODE_VER%-win-x64\node.exe"
)

if not defined NODE (
  echo [ERROR] Node.js not found. Install from https://nodejs.org or set PATH.
  pause
  exit /b 1
)

"%NODE%" "%APP%index.js" %*
endlocal
