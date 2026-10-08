@echo off
chcp 65001 >nul
title Facetry 开发服务器
cd /d %~dp0

rem ── 服务器已在运行：直接开浏览器，避免 strictPort 冲突 ──
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 'http://127.0.0.1:8443/'; exit 0 } catch { exit 1 }"
if not errorlevel 1 (
  echo [Facetry] 服务器已在运行，正在打开浏览器……
  start "" "http://127.0.0.1:8443/"
  exit /b 0
)

rem ── 环境检查 ──
where pnpm >nul 2>nul
if errorlevel 1 (
  echo [Facetry] 未检测到 pnpm，请先安装 Node.js 并执行：npm i -g pnpm
  pause
  exit /b 1
)

rem ── 首次运行：安装依赖 ──
if not exist node_modules (
  echo [Facetry] 首次运行，正在安装依赖……
  call pnpm install
  if errorlevel 1 (
    echo [Facetry] 依赖安装失败，请检查网络后重试。
    pause
    exit /b 1
  )
)

rem ── 启动开发服务器（延迟 3 秒自动开浏览器，等 vite 就绪）──
echo [Facetry] 正在启动开发服务器：http://127.0.0.1:8443/
start "" /min powershell -NoProfile -Command "Start-Sleep -Seconds 3; Start-Process 'http://127.0.0.1:8443/'"
pnpm dev
pause
