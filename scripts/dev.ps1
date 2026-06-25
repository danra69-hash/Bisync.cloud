param(
    [switch]$ApiOnly,
    [switch]$ClientOnly
)

$root = Split-Path -Parent $PSScriptRoot

if (-not $ClientOnly) {
    Write-Host "Starting Bisync API on http://localhost:5299 ..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\src\Bisync.Api'; dotnet run"
    Start-Sleep -Seconds 3
}

if (-not $ApiOnly) {
    Write-Host "Starting Bisync client on http://localhost:5173 ..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\client'; npm run dev"
}

Write-Host ""
Write-Host "Bisync.cloud dev servers starting:" -ForegroundColor Green
Write-Host "  API:    http://localhost:5299/api/health"
Write-Host "  Client: http://localhost:5173"
