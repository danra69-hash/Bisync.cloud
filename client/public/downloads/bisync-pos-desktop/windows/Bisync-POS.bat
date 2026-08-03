@echo off
setlocal
set "POS_URL=https://bisync-cloud-389272498937.asia-southeast1.run.app/POS?fs=1"
set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"

if exist "%EDGE%" (
  start "" "%EDGE%" --app="%POS_URL%" --start-fullscreen --force-dark-mode
  exit /b 0
)
if exist "%CHROME%" (
  start "" "%CHROME%" --app="%POS_URL%" --start-fullscreen
  exit /b 0
)

start "" "%POS_URL%"
echo Opened in the default browser. Install Edge or Chrome for app fullscreen mode.
pause
