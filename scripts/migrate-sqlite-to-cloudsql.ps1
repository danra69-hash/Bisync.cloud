# Migrate local SQLite databases into Cloud SQL PostgreSQL.
# Usage: .\scripts\migrate-sqlite-to-cloudsql.ps1 -ProjectId project-8d670aa9-f439-44d9-8e1

param(
    [string]$ProjectId = "project-8d670aa9-f439-44d9-8e1",
    [string]$Region = "asia-southeast1",
    [string]$SqlInstance = "bisync-pg",
    [string]$Database = "bisync",
    [string]$ArchiveDatabase = "bisync_archive",
    [string]$DbUser = "postgres",
    [string]$SqlitePath = "",
    [string]$ArchiveSqlitePath = "",
    [switch]$SkipMain,
    [switch]$SkipArchive
)

$ErrorActionPreference = "Continue"

$Gcloud = "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
if (-not (Test-Path $Gcloud)) {
    throw "Google Cloud CLI not found."
}

$Root = Split-Path $PSScriptRoot -Parent
if ([string]::IsNullOrWhiteSpace($SqlitePath)) {
    $SqlitePath = Join-Path $Root "src\Bisync.Api\bisync.db"
}
if ([string]::IsNullOrWhiteSpace($ArchiveSqlitePath)) {
    $ArchiveSqlitePath = Join-Path $Root "data-archives\stock-card\archive.db"
}

function Get-ConnectionString([string]$TargetDatabase) {
    return "Host=$ip;Port=5432;Database=$TargetDatabase;Username=$DbUser;Password=$password;SSL Mode=Require;Trust Server Certificate=true;Include Error Detail=true"
}

function Invoke-SqliteMigration([string]$SourcePath, [string]$TargetDatabase) {
    if (-not (Test-Path $SourcePath)) {
        throw "SQLite database not found at $SourcePath"
    }

    Write-Host "Migrating $SourcePath -> Cloud SQL $SqlInstance/$TargetDatabase ..." -ForegroundColor Cyan
    $targetConnection = Get-ConnectionString $TargetDatabase
    dotnet run -c Release --no-build -- "$SourcePath" $targetConnection
    if ($LASTEXITCODE -ne 0) {
        throw "Migration failed for $TargetDatabase with exit code $LASTEXITCODE."
    }
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

Write-Host "Building migration tool..." -ForegroundColor Cyan
Push-Location (Join-Path $Root "tools\Bisync.SqliteToPostgres")
dotnet build -c Release --nologo -v q
if ($LASTEXITCODE -ne 0) { throw "Migration tool build failed." }

if (-not $SkipMain) {
    Invoke-SqliteMigration -SourcePath $SqlitePath -TargetDatabase $Database
}

if (-not $SkipArchive) {
    if (-not (Test-Path $ArchiveSqlitePath)) {
        Write-Host "Archive SQLite not found at $ArchiveSqlitePath - skipping archive migration." -ForegroundColor Yellow
    } else {
        Invoke-SqliteMigration -SourcePath $ArchiveSqlitePath -TargetDatabase $ArchiveDatabase
    }
}

Pop-Location

Write-Host ""
Write-Host "Migration complete." -ForegroundColor Green
Write-Host "Verify main:    curl https://bisync-cloud-389272498937.asia-southeast1.run.app/api/companies" -ForegroundColor Green
Write-Host "Verify archive: curl https://bisync-cloud-389272498937.asia-southeast1.run.app/api/stock-card-archive/status" -ForegroundColor Green