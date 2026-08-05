@echo off
setlocal
title Bisync ESC/POS LAN printer test
echo.
echo  Bisync POS — Windows LAN printer test (ESC/POS TCP 9100)
echo  Same protocol as DantSu Android SDK over the network.
echo.
set /p HOST=Printer IP (e.g. 192.168.1.50): 
if "%HOST%"=="" (
  echo No IP entered.
  pause
  exit /b 1
)
set /p PORT=Port [9100]: 
if "%PORT%"=="" set PORT=9100
set /p NAME=Printer name [LAN Printer]: 
if "%NAME%"=="" set NAME=LAN Printer
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Test-BisyncPrinter.ps1" -HostAddress "%HOST%" -Port %PORT% -PrinterName "%NAME%"
echo.
pause
