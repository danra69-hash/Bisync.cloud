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
$publicIp = (Invoke-RestMethod -Uri "https://api.ipify.org").Trim()
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
