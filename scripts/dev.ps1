param(
    [switch]$ApiOnly,
    [switch]$ClientOnly
)

$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
$apiUrl = "http://127.0.0.1:5299"
$clientUrl = "http://127.0.0.1:5173"

function Test-ApiHealth {
    try {
        $r = Invoke-WebRequest -Uri "$apiUrl/api/health" -UseBasicParsing -TimeoutSec 2
        return $r.StatusCode -eq 200
    } catch {
        return $false
    }
}

if (-not $ClientOnly) {
    if (Test-ApiHealth) {
        Write-Host "API already healthy at $apiUrl" -ForegroundColor Green
    } else {
        Write-Host "Starting Bisync API on $apiUrl ..." -ForegroundColor Cyan
        # Bind 127.0.0.1 explicitly so Vite proxy (also 127.0.0.1) never hits IPv6 localhost mismatch -> 502.
        $apiCmd = @"
`$env:ASPNETCORE_ENVIRONMENT = 'Development'
`$env:DEV_CONSOLE_ENABLED = 'true'
cd '$root\src\Bisync.Api'
dotnet run --urls $apiUrl
"@
        Start-Process powershell -ArgumentList "-NoExit", "-Command", $apiCmd

        Write-Host "Waiting for API health..." -ForegroundColor Gray
        $ready = $false
        for ($i = 1; $i -le 45; $i++) {
            Start-Sleep -Seconds 2
            if (Test-ApiHealth) {
                $ready = $true
                break
            }
            Write-Host "  attempt $i/45..." -ForegroundColor DarkGray
        }
        if (-not $ready) {
            Write-Host ""
            Write-Host "API did not become healthy at $apiUrl/api/health" -ForegroundColor Red
            Write-Host "Common fixes:" -ForegroundColor Yellow
            Write-Host "  1. Start Postgres:  docker compose up -d"
            Write-Host "  2. Check the API PowerShell window for errors"
            Write-Host "Login will return 502 until the API is up."
        } else {
            Write-Host "API healthy." -ForegroundColor Green
        }
    }
}

if (-not $ApiOnly) {
    Write-Host "Starting Bisync client on $clientUrl ..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\client'; npm run dev -- --host 0.0.0.0 --port 5173"
}

Write-Host ""
Write-Host "Bisync.cloud dev servers:" -ForegroundColor Green
Write-Host "  API:    $apiUrl/api/health"
Write-Host "  Client: http://localhost:5173"
Write-Host "  Login:  dra@cubevalue.com / Pass@123"
Write-Host ""
if (-not (Test-ApiHealth)) {
    Write-Host "WARNING: API not healthy - browser login will show API error 502." -ForegroundColor Red
}
