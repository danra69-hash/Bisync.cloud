# Run the local API against Cloud SQL PostgreSQL (same data as production).
# Usage: .\scripts\run-api-cloudsql.ps1

param(
    [string]$ProjectId = "project-8d670aa9-f439-44d9-8e1",
    [string]$SqlInstance = "bisync-pg",
    [string]$DbUser = "postgres"
)

$ErrorActionPreference = "Continue"

$Gcloud = "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
if (-not (Test-Path $Gcloud)) {
    throw "Google Cloud CLI not found."
}

$Root = Split-Path $PSScriptRoot -Parent

Write-Host "Authorizing current public IP for Cloud SQL access..." -ForegroundColor Cyan
$publicIp = $null
foreach ($url in @(
    "https://checkip.amazonaws.com",
    "https://api.ipify.org",
    "https://ifconfig.me/ip",
    "https://icanhazip.com"
)) {
    try {
        $candidate = (Invoke-RestMethod -Uri $url -TimeoutSec 10).ToString().Trim()
        # Prefer IPv4 — Cloud SQL authorized-networks expects IPv4 CIDR
        if ($candidate -match '^\d{1,3}(\.\d{1,3}){3}$') {
            $publicIp = $candidate
            break
        }
    } catch {
        # try next provider
    }
}
if (-not $publicIp) {
    throw "Could not detect public IPv4. Check internet access, then re-run this script."
}
Write-Host "Public IP: $publicIp" -ForegroundColor Gray
& $Gcloud sql instances patch $SqlInstance --authorized-networks="$publicIp/32" --quiet
if ($LASTEXITCODE -ne 0) { throw "Failed to authorize network on Cloud SQL." }

$ip = & $Gcloud sql instances describe $SqlInstance --format="value(ipAddresses[0].ipAddress)"
if (-not $ip) { throw "Cloud SQL public IP not found." }

Write-Host "Reading DB password from Secret Manager..." -ForegroundColor Cyan
$password = (& $Gcloud secrets versions access latest --secret=bisync-db-password).Trim()
if (-not $password) { throw "Could not read bisync-db-password secret." }

$defaultConn = "Host=$ip;Port=5432;Database=bisync;Username=$DbUser;Password=$password;SSL Mode=Require;Trust Server Certificate=true"
$archiveConn = "Host=$ip;Port=5432;Database=bisync_archive;Username=$DbUser;Password=$password;SSL Mode=Require;Trust Server Certificate=true"

$env:ASPNETCORE_ENVIRONMENT = "Development"
$env:ConnectionStrings__DefaultConnection = $defaultConn
$env:ConnectionStrings__ArchiveConnection = $archiveConn

Write-Host "Starting API on http://localhost:5299 (Cloud SQL backend)..." -ForegroundColor Green
Push-Location (Join-Path $Root "src\Bisync.Api")
dotnet run
Pop-Location
