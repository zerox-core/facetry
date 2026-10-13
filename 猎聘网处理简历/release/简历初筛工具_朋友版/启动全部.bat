@echo off
setlocal
cd /d "%~dp0"

echo ===== Resume Screener Launcher =====

REM 1) locate python (WorkBuddy managed python or system python)
set PY=
where python >nul 2>&1 && set PY=python
if not defined PY ( where py >nul 2>&1 && set PY=py )
if not defined PY (
  echo [ERROR] Python not found. Install Python 3.10+ and check "Add to PATH" at python.org
  pause & exit /b 1
)
echo Using Python: %PY%

REM 2) install dependencies (first run)
echo [1/3] Checking dependencies...
%PY% -m pip install -r requirements.txt --quiet 2>nul

REM 3) start backend on port 7788
echo [2/3] Starting backend on 7788 ...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :7788 ^| findstr LISTENING') do taskkill /PID %%a /F >nul 2>&1
timeout /t 1 /nobreak >nul
start "screener-backend" %PY% -m app.main
timeout /t 6 /nobreak >nul

REM 4) start Chrome debug on port 9222
echo [3/3] Checking Chrome debug on 9222 ...
curl -s -o NUL "http://127.0.0.1:9222/json/version" >nul 2>&1
if %errorlevel%==0 (
  echo   Chrome debug already running, skip
) else (
  set CHROME=
  if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set CHROME="%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
  if not defined CHROME ( if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" set CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe" )
  if not defined CHROME ( if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" set CHROME="C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" )
  if not defined CHROME (
    echo [ERROR] Chrome not found. Install from google.com/chrome
    pause & exit /b 1
  )
  echo   Starting Chrome debug mode...
  start "" %CHROME% --remote-debugging-port=9222 --remote-allow-origins=* --user-data-dir="%TEMP%\liepin_debug"
  timeout /t 6 /nobreak >nul
)

REM 5) open the tool page
start "" "http://127.0.0.1:7788/"

echo.
echo Done! In the debug Chrome, log in to liepin / 51job, then click "Scan new resumes".
echo Note: 9222 is a LOCAL debug port - never expose it to the public internet.
pause
