@echo off
setlocal EnableExtensions
REM Bisync.cloud Desktop — installs a Desktop shortcut (with Bisync logo) and opens a dedicated app window.
REM Uses a private browser profile so sign-in is clean (not shared with Chrome/Edge).

set "APP_URL=https://bisync-cloud-389272498937.asia-southeast1.run.app/"
set "INSTALL_DIR=%LOCALAPPDATA%\Bisync.cloud-Desktop"
set "PROFILE_DIR=%INSTALL_DIR%\profile"
set "LAUNCHER=%INSTALL_DIR%\Bisync.cloud.bat"
set "ICON=%INSTALL_DIR%\Bisync.cloud.ico"

if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%" >nul 2>&1
copy /Y "%~f0" "%LAUNCHER%" >nul 2>&1
if exist "%~dp0Bisync.cloud.ico" copy /Y "%~dp0Bisync.cloud.ico" "%ICON%" >nul 2>&1

REM Pin / place a Desktop shortcut with the Bisync logo.
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$desktop = [Environment]::GetFolderPath('Desktop');" ^
  "$lnkPath = Join-Path $desktop 'Bisync.cloud.lnk';" ^
  "$target = '%LAUNCHER%';" ^
  "$icon = '%ICON%';" ^
  "$w = New-Object -ComObject WScript.Shell;" ^
  "$s = $w.CreateShortcut($lnkPath);" ^
  "$s.TargetPath = $target;" ^
  "$s.WorkingDirectory = (Split-Path -Parent $target);" ^
  "if (Test-Path $icon) { $s.IconLocation = $icon + ',0' }" ^
  "$s.WindowStyle = 7;" ^
  "$s.Description = 'Bisync.cloud Desktop';" ^
  "$s.Save()"

set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LocalAPPDATA%\Google\Chrome\Application\chrome.exe"
set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"

REM Fresh private profile → platform login required (no inherited browser session).
if exist "%CHROME%" (
  start "" "%CHROME%" --app="%APP_URL%" --user-data-dir="%PROFILE_DIR%" --no-first-run --new-window --disable-session-crashed-bubble --no-default-browser-check
  exit /b 0
)
if exist "%EDGE%" (
  start "" "%EDGE%" --app="%APP_URL%" --user-data-dir="%PROFILE_DIR%" --no-first-run --new-window --disable-session-crashed-bubble --no-default-browser-check
  exit /b 0
)

start "" "%APP_URL%"
echo Opened in the default browser. Install Google Chrome or Microsoft Edge for the desktop app window.
pause
