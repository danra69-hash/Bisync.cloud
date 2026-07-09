# Restore local PostgreSQL dumps into Cloud SQL via GCS import.
# Usage: .\scripts\sync-cloud-postgres.ps1 -ProjectId YOUR_GCP_PROJECT_ID

param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectId,

    [string]$Region = "asia-southeast1",
    [string]$SqlInstance = "bisync-pg",
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

$BucketName = "$($ProjectId.Replace('_', '-').ToLower())-bisync-data"
$InstanceUri = "projects/$ProjectId/instances/$SqlInstance"

function Import-CloudSqlDump([string]$SqlPath, [string]$TargetDatabase, [string]$ObjectName) {
    if (-not (Test-Path $SqlPath)) {
        Write-Host "Skipping $TargetDatabase (dump not found)." -ForegroundColor Yellow
        return
    }

    $remotePath = "gs://$BucketName/db-sync/$ObjectName"
    Write-Host "Uploading $SqlPath -> $remotePath" -ForegroundColor Cyan
    & $Gcloud storage cp $SqlPath $remotePath
    if ($LASTEXITCODE -ne 0) { throw "Failed to upload $ObjectName to GCS." }

    Write-Host "Importing into Cloud SQL database '$TargetDatabase'..." -ForegroundColor Cyan
    & $Gcloud sql import sql $SqlInstance $remotePath `
        --database=$TargetDatabase `
        --user=postgres `
        --project=$ProjectId `
        --quiet
    if ($LASTEXITCODE -ne 0) {
        throw "Cloud SQL import failed for $TargetDatabase. The dump may contain objects that already exist; check Cloud SQL logs."
    }

    Write-Host "Imported $TargetDatabase from $ObjectName." -ForegroundColor Green
}

Write-Host "Using Cloud SQL instance: $SqlInstance" -ForegroundColor Gray
Import-CloudSqlDump -SqlPath $MainSqlPath -TargetDatabase $Database -ObjectName "bisync-postgres-latest.sql"
Import-CloudSqlDump -SqlPath $ArchiveSqlPath -TargetDatabase $ArchiveDatabase -ObjectName "bisync-archive-postgres-latest.sql"

Write-Host "Cloud SQL database updated from local PostgreSQL dumps." -ForegroundColor Green
