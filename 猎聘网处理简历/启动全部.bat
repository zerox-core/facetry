@echo off
setlocal
cd /d "%~dp0"

echo [1/3] Restart backend 7788 (kill old then start fresh) ...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :7788 ^| findstr LISTENING') do taskkill /PID %%a /F >nul 2>&1
timeout /t 1 /nobreak >nul
echo   starting backend ...
start "backend" "D:\Python312\python.exe" -m app.main
timeout /t 6 /nobreak >nul

echo [2/3] Check Chrome debug 9222 ...
curl -s -o NUL "http://127.0.0.1:9222/json/version" >nul 2>&1
if %errorlevel%==0 (
    echo   Chrome debug already running, skip
) else (
    echo   starting Chrome debug ...
    start "" "C:\Users\yh\AppData\Local\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --remote-allow-origins=* --user-data-dir="%TEMP%\liepin_debug"
    timeout /t 6 /nobreak >nul
)

echo [3/3] Open tool page ...
start "" "http://127.0.0.1:7788/"

echo All done. Go to the debug Chrome, login liepin if needed, then click Scan.
echo If 9222 still not ready, close all Chrome manually and re-run this bat.
pause
