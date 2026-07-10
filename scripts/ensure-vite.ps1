# Ensure the Vite client is listening on localhost:5173.
# Usage: .\scripts\ensure-vite.ps1

param(
    [int]$Port = 5173,
    [string]$ClientDir = ""
)

$ErrorActionPreference = "Continue"
$Root = Split-Path $PSScriptRoot -Parent
if (-not $ClientDir) { $ClientDir = Join-Path $Root "client" }

$listening = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.OwningProcess -gt 0 }
if ($listening) {
    try {
        $probe = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/" -UseBasicParsing -TimeoutSec 3
        if ($probe.StatusCode -ge 200) {
            Write-Host "Vite already listening on port $Port (PID $($listening[0].OwningProcess))."
            exit 0
        }
    } catch {
        Write-Host "Stale listener on $Port - restarting..."
        $listening | ForEach-Object {
            Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
        }
        Start-Sleep -Seconds 1
    }
}

Write-Host "Port $Port is free - starting Vite in a detached window..."
$npm = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
if (-not $npm) { $npm = "npm.cmd" }

Start-Process -FilePath $npm `
    -ArgumentList @("run", "dev", "--", "--host", "127.0.0.1", "--port", "$Port") `
    -WorkingDirectory $ClientDir `
    -WindowStyle Minimized

for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 500
    $up = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($up) {
        Write-Host "Vite is up on http://127.0.0.1:$Port/"
        exit 0
    }
}

Write-Host "Vite was launched but port $Port is not listening yet. Check the minimized npm window."
exit 1
