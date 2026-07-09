# Restore local PostgreSQL dumps into Cloud SQL.
# Usage: .\scripts\sync-cloud-postgres.ps1 -ProjectId YOUR_GCP_PROJECT_ID

param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectId,

    [string]$Region = "asia-southeast1",
    [string]$SqlInstance = "bisync-pg",
    [string]$DbUser = "postgres",
    [string]$Database = "bisync",
    [string]$ArchiveDatabase = "bisync_archive",
    [string]$MainSqlPath = "",
    [string]$ArchiveSqlPath = ""
)

$ErrorActionPreference = "Stop"

$Gcloud = "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
if (-not (Test-Path $Gcloud)) {
    throw "Google Cloud CLI not found. Install with: winget install Google.CloudSDK"
}

$Root = Split-Path $PSScriptRoot -Parent
$DbDir = Join-Path $Root "src\Bisync.Api"
if ([string]::IsNullOrWhiteSpace($MainSqlPath)) {
    $MainSqlPath = Join-Path $DbDir "bisync-postgres-latest.sql"
}
if ([string]::IsNullOrWhiteSpace($ArchiveSqlPath)) {
    $ArchiveSqlPath = Join-Path $DbDir "bisync-archive-postgres-latest.sql"
}

if (-not (Test-Path $MainSqlPath)) {
    throw "Main PostgreSQL dump not found at $MainSqlPath"
}

function Resolve-Psql {
    $cmd = Get-Command psql -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $candidates = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\psql.exe" -ErrorAction SilentlyContinue |
        Sort-Object { $_.Directory.Parent.Name } -Descending
    if ($candidates) { return $candidates[0].FullName }

    throw "psql not found."
}

function Restore-CloudDatabase([string]$Psql, [string]$TargetDatabase, [string]$SqlPath, [string]$Password, [string]$HostIp) {
    if (-not (Test-Path $SqlPath)) {
        Write-Host "Skipping $TargetDatabase (dump not found)." -ForegroundColor Yellow
        return
    }

    Write-Host "Restoring Cloud SQL $TargetDatabase from $SqlPath ..." -ForegroundColor Cyan
    $env:PGPASSWORD = $Password
    & $Psql -h $HostIp -p 5432 -U $DbUser -d $TargetDatabase -v ON_ERROR_STOP=1 -f $SqlPath
    if ($LASTEXITCODE -ne 0) { throw "Cloud SQL restore failed for $TargetDatabase." }
}

Write-Host "Authorizing current public IP for Cloud SQL access..." -ForegroundColor Cyan
$publicIp = (Invoke-RestMethod -Uri "https://api.ipify.org").Trim()
& $Gcloud sql instances patch $SqlInstance --authorized-networks="$publicIp/32" --quiet
if ($LASTEXITCODE -ne 0) { throw "Failed to authorize network on Cloud SQL." }

$ip = & $Gcloud sql instances describe $SqlInstance --format="value(ipAddresses[0].ipAddress)"
if (-not $ip) { throw "Cloud SQL public IP not found." }

Write-Host "Reading DB password from Secret Manager..." -ForegroundColor Cyan
$password = (& $Gcloud secrets versions access latest --secret=bisync-db-password).Trim()
if (-not $password) { throw "Could not read bisync-db-password secret." }

$psql = Resolve-Psql
Restore-CloudDatabase -Psql $psql -TargetDatabase $Database -SqlPath $MainSqlPath -Password $password -HostIp $ip

if (Test-Path $ArchiveSqlPath) {
    Restore-CloudDatabase -Psql $psql -TargetDatabase $ArchiveDatabase -SqlPath $ArchiveSqlPath -Password $password -HostIp $ip
}

Write-Host "Cloud SQL database updated from local PostgreSQL dumps." -ForegroundColor Green
