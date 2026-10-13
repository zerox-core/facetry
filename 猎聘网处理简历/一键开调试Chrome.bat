@echo off
taskkill /F /IM chrome.exe /T
timeout /t 3
start "" "C:\Users\yh\AppData\Local\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --remote-allow-origins=* --user-data-dir="%TEMP%\liepin_debug"
timeout /t 5
curl -s http://127.0.0.1:9222/json/version
pause
