@echo off
setlocal EnableExtensions
REM Bisync.cloud Desktop — installs Desktop + Start Menu shortcuts with the Bisync logo,
REM then opens a dedicated Chrome/Edge app window (private profile → clean login).

set "APP_URL=https://bisync-cloud-389272498937.asia-southeast1.run.app/"
set "INSTALL_DIR=%LOCALAPPDATA%\Bisync.cloud-Desktop"
set "PROFILE_DIR=%INSTALL_DIR%\profile"
set "HERE=%~dp0"
set "ICON_SRC=%HERE%Bisync.cloud.ico"
set "VBS_SRC=%HERE%Install-Desktop-Shortcut.vbs"
set "SHORTCUT_NAME=Bisync.cloud.lnk"

if not exist "%ICON_SRC%" (
  echo ERROR: Bisync.cloud.ico is missing next to this launcher.
  echo Keep Bisync.cloud.ico in the same folder as Bisync.cloud.bat.
  pause
  exit /b 1
)

if not exist "%VBS_SRC%" (
  echo ERROR: Install-Desktop-Shortcut.vbs is missing next to this launcher.
  echo Double-click Install-Desktop-Shortcut.vbs if present, or re-download the Windows zip.
  pause
  exit /b 1
)

if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%" >nul 2>&1

REM Create / refresh Desktop + Start Menu shortcuts with the Bisync logo.
cscript //nologo "%VBS_SRC%" /silent
if errorlevel 1 (
  echo WARNING: Silent shortcut install failed — retrying with a confirmation dialog...
  cscript //nologo "%VBS_SRC%"
)

set "DESKTOP_LNK="
for %%D in (
  "%USERPROFILE%\Desktop\%SHORTCUT_NAME%"
  "%OneDrive%\Desktop\%SHORTCUT_NAME%"
  "%PUBLIC%\Desktop\%SHORTCUT_NAME%"
) do if exist "%%~D" set "DESKTOP_LNK=%%~D"

if defined DESKTOP_LNK (
  echo Desktop shortcut ready: %DESKTOP_LNK%
) else (
  echo WARNING: Desktop\Bisync.cloud.lnk was not found.
  echo Double-click Install-Desktop-Shortcut.vbs in this folder to create it.
)

REM Locate Chrome or Edge for the app window.
set "BROWSER="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "BROWSER=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "BROWSER=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER if exist "%LocalAPPDATA%\Google\Chrome\Application\chrome.exe" set "BROWSER=%LocalAPPDATA%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "BROWSER=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "BROWSER=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"

if defined BROWSER (
  start "" "%BROWSER%" --app="%APP_URL%" --user-data-dir="%PROFILE_DIR%" --no-first-run --new-window --disable-session-crashed-bubble --no-default-browser-check
  exit /b 0
)

start "" "%APP_URL%"
echo Opened in the default browser. Install Google Chrome or Microsoft Edge for the desktop app window.
pause
exit /b 0
