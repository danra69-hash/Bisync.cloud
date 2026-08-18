@echo off
setlocal
REM Find ESC/POS printers on this PC's LAN (real TCP scan — browsers cannot do this).
cd /d "%~dp0"

set "STATION="
if not "%~1"=="" set "STATION=%~1"

if "%STATION%"=="" (
  echo.
  echo Bisync Find Printers ^(Windows LAN^)
  echo Leave blank to auto-detect this PC IPv4, or type e.g. 192.168.70.131
  set /p STATION=Station IP: 
)

if "%STATION%"=="" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Find-BisyncPrinters.ps1"
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Find-BisyncPrinters.ps1" -StationIp "%STATION%"
)

echo.
echo JSON also saved as bisync-lan-find-result.json in this folder.
echo Paste that JSON into Bisync Device set up → Import Windows scan.
pause
endlocal
