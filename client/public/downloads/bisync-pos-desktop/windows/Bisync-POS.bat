@echo off
setlocal
REM Bisync POS — Google Chrome first (Windows). Opens as app window, fullscreen, on top of the desktop.
set "POS_URL=https://bisync-cloud-389272498937.asia-southeast1.run.app/POS?fs=1"
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"
set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"

if exist "%CHROME%" (
  start "" "%CHROME%" --app="%POS_URL%" --start-fullscreen --window-position=0,0 --disable-session-crashed-bubble --no-first-run --force-dark-mode
  exit /b 0
)
if exist "%EDGE%" (
  start "" "%EDGE%" --app="%POS_URL%" --start-fullscreen --window-position=0,0 --force-dark-mode
  exit /b 0
)

start "" "%POS_URL%"
echo Opened in the default browser. Install Google Chrome for app fullscreen mode.
pause
