@echo off
chcp 65001 >nul
title 猎聘简历初筛 - 启动器
cd /d "%~dp0"

REM 把启动过程写入日志，方便排查（即使窗口关闭也能看）
set "LOG=%~dp0logs\launch_bat.log"
echo [%date% %time%] 启动器开始 >> "%LOG%"

REM ============ 0. 定位 Python 与 Chrome ============
set "PY_EXE=D:\Python312\python.exe"
if not exist "%PY_EXE%" set "PY_EXE=python"

set "CHROME="
if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"        set "CHROME=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
if not defined CHROME if exist "C:\Users\yh\AppData\Local\Google\Chrome\Application\chrome.exe" set "CHROME=C:\Users\yh\AppData\Local\Google\Chrome\Application\chrome.exe"
if not defined CHROME if exist "C:\Program Files\Google\Chrome\Application\chrome.exe"          set "CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe"
if not defined CHROME if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"    set "CHROME=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"

echo ============================================================
echo   猎聘简历初筛工具 - 一键启动
echo ============================================================
echo.

if not defined CHROME (
    echo [错误] 找不到 chrome.exe，请确认 Chrome 已安装。
    echo [%date% %time%] 错误: 找不到 chrome.exe >> "%LOG%"
    echo.
    echo 按任意键退出...
    pause >nul
    goto :eof
)
echo [信息] 使用 Chrome: %CHROME%
echo [%date% %time%] Chrome=%CHROME% >> "%LOG%"

REM ============ 1. 检查 9222 是否已在调试模式 ============
echo [1/3] 检查 Chrome 调试端口 9222 ...
curl -s -o NUL "http://127.0.0.1:9222/json/version" >nul 2>&1
if %errorlevel%==0 (
    echo    - 9222 已在监听，跳过重启 Chrome。
    goto :backend
)

REM 未监听 -> 先彻底关闭所有 Chrome，再带调试参数重启
echo    - 9222 未监听，准备重启 Chrome（调试模式）...
echo [%date% %time%] 关闭现有 Chrome >> "%LOG%"
taskkill /F /IM chrome.exe /T >nul 2>&1
timeout /t 3 /nobreak >nul

echo    - 启动 Chrome 调试模式并打开工具窗口标签页...
start "" "%CHROME%" --remote-debugging-port=9222 --remote-allow-origins=* --restore-last-session --new-tab "http://127.0.0.1:7788/"
echo [%date% %time%] 已 start Chrome 调试模式 >> "%LOG%"

REM 轮询 9222（最多 25 秒）
set CNT=0
:wait9222
curl -s -o NUL "http://127.0.0.1:9222/json/version" >nul 2>&1
if %errorlevel%==0 goto :chromeok
set /a CNT+=1
if %CNT% GEQ 25 (
    echo    [警告] 9222 端口 25 秒内未就绪。可能 Chrome 没以调试模式启动。
    echo    [警告] 请手动在「运行」(Win+R) 里粘贴执行：
    echo            "%CHROME%" --remote-debugging-port=9222 --remote-allow-origins=*
    echo [%date% %time%] 警告: 9222 未在超时内就绪 >> "%LOG%"
    goto :backend
)
timeout /t 1 /nobreak >nul
goto :wait9222
:chromeok
echo    - Chrome 调试模式已就绪 [9222] OK

REM ============ 2. 后端 ============
:backend
echo [2/3] 检查工具后端 7788 ...
curl -s -o NUL "http://127.0.0.1:7788/" >nul 2>&1
if %errorlevel%==0 (
    echo    - 后端已在运行，直接复用。
    goto :openui
)
echo    - 正在启动后端（独立窗口「猎聘简历初筛-后端」，请勿关闭）...
echo [%date% %time%] 启动后端 >> "%LOG%"
start "猎聘简历初筛-后端" "%PY_EXE%" -m app.main
timeout /t 5 /nobreak >nul

REM ============ 3. 打开工具窗口 ============
:openui
echo [3/3] 打开工具窗口...
start "" "http://127.0.0.1:7788/"
echo.
echo ============================================================
echo   就绪！请按以下步骤操作：
echo   1) 在刚打开的 Chrome 里，进入猎聘企业端
echo      （lpt.liepin.com  -  人才管理  -  求职者投递  -  未处理）
echo   2) 回到工具窗口 http://127.0.0.1:7788/ ，点「扫描新简历」
echo   3) 工具会自动判定，并按规则点「通过筛选」/「不合适」
echo ============================================================
echo.
echo [提示] 本窗口可随时关闭；后端窗口请保持打开。
echo [日志] 完整启动记录见: %LOG%
echo.
echo 按任意键可关闭本窗口（不影响已启动的工具）...
echo [%date% %time%] 启动完成 >> "%LOG%"
pause >nul
