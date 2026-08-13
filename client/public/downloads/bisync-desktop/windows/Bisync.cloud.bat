@echo off
setlocal
REM Bisync.cloud Desktop — opens a dedicated Chrome/Edge app window.
set "APP_URL=https://bisync-cloud-389272498937.asia-southeast1.run.app"
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"
set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"

if exist "%CHROME%" (
  start "" "%CHROME%" --app="%APP_URL%" --new-window --disable-session-crashed-bubble --no-first-run
  exit /b 0
)
if exist "%EDGE%" (
  start "" "%EDGE%" --app="%APP_URL%" --new-window --no-first-run
  exit /b 0
)

start "" "%APP_URL%"
echo Opened in the default browser. Install Google Chrome for the desktop app window.
pause
