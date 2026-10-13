@echo off
chcp 65001 >nul
title 打开 Chrome 调试模式（猎聘简历初筛）
setlocal
set "CHROME=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=C:\Users\yh\AppData\Local\Google\Chrome\Application\chrome.exe"
set "LOG=%~dp0logs\open_chrome.log"
if not exist "%~dp0logs" mkdir "%~dp0logs"
echo [%date% %time%] 开始执行 > "%LOG%"

echo ============================================================
echo   打开 Chrome 调试模式
echo ============================================================
echo.
if not exist "%CHROME%" (
    echo [错误] 找不到 chrome.exe：%CHROME%
    echo [%date% %time%] 错误: 找不到 chrome >> "%LOG%"
    echo 按任意键退出...
    pause >nul
    goto :eof
)
echo [信息] Chrome 路径: %CHROME%
echo.

echo [1] 关闭所有已打开的 Chrome（避免单实例吞掉调试参数）...
taskkill /F /IM chrome.exe /T >nul 2>&1
echo     （等待 3 秒让进程彻底退出）
timeout /t 3 /nobreak >nul
echo [%date% %time%] 已关闭旧 Chrome >> "%LOG%"

echo [2] 启动 Chrome 调试模式（端口 9222）...
start "" "%CHROME%" --remote-debugging-port=9222 --remote-allow-origins=* --restore-last-session
echo [%date% %time%] 已 start chrome 调试模式 >> "%LOG%"

echo [3] 等待调试端口就绪（最多 25 秒）...
set CNT=0
:wait
curl -s -o NUL "http://127.0.0.1:9222/json/version" >nul 2>&1
if %errorlevel%==0 goto :ok
set /a CNT+=1
if %CNT% GEQ 25 goto :fail
timeout /t 1 /nobreak >nul
goto :wait

:ok
echo.
echo ============================================================
echo  [OK] 成功！Chrome 调试模式已就绪（端口 9222）
echo ============================================================
echo.
echo  接下来请做两件事：
echo   1) 在本机浏览器地址栏打开： http://127.0.0.1:9222/json/version
echo      看到一串 JSON（含 webSocketDebuggerUrl）即表示成功
echo   2) 再打开： http://127.0.0.1:7788/  → 猎聘简历初筛工具界面
echo.
echo  然后在该 Chrome 里登录 lpt.liepin.com，回到工具界面点「扫描新简历」。
echo.
echo  （日志已保存： %LOG% ）
echo.
echo 按任意键关闭本窗口（Chrome 会继续在后台运行）...
echo [%date% %time%] 成功 >> "%LOG%"
pause >nul
goto :eof

:fail
echo.
echo ============================================================
echo  [失败] 25 秒内 9222 端口未就绪
echo ============================================================
echo.
echo  可能原因：
echo   - 端口 9222 被其他程序占用
echo   - Chrome 没以调试模式启动（被安全软件拦截）
echo.
echo  请改用聊天里给的「Win+R 直接命令」方式，或查看日志：
echo   %LOG%
echo.
pause >nul
