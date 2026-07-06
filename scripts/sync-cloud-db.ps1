# Upload local bisync.db to the Cloud Run persistent GCS volume.
# Usage: .\scripts\sync-cloud-db.ps1 -ProjectId YOUR_GCP_PROJECT_ID

param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectId,

    [string]$Region = "asia-southeast1",
    [string]$ServiceName = "bisync-cloud",
    [string]$DbPath = ""
)

$ErrorActionPreference = "Stop"

$Gcloud = "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
if (-not (Test-Path $Gcloud)) {
    throw "Google Cloud CLI not found. Install with: winget install Google.CloudSDK"
}

$Root = Split-Path $PSScriptRoot -Parent
if ([string]::IsNullOrWhiteSpace($DbPath)) {
    $DbPath = Join-Path $Root "src\Bisync.Api\bisync.db"
}

if (-not (Test-Path $DbPath)) {
    throw "Database not found at $DbPath"
}

$BucketName = "$($ProjectId.Replace('_', '-').ToLower())-bisync-data"
$RemotePath = "gs://$BucketName/bisync.db"

Write-Host "Scaling Cloud Run to zero instances (brief downtime)..." -ForegroundColor Yellow
& $Gcloud run services update $ServiceName `
    --project $ProjectId `
    --region $Region `
    --min-instances 0 `
    --max-instances 1 `
    --quiet
if ($LASTEXITCODE -ne 0) { throw "Failed to scale Cloud Run service." }

Write-Host "Waiting 20s for active instance to drain..." -ForegroundColor Gray
Start-Sleep -Seconds 20

Write-Host "Uploading $DbPath -> $RemotePath" -ForegroundColor Cyan
& $Gcloud storage cp $DbPath $RemotePath
if ($LASTEXITCODE -ne 0) { throw "Failed to upload database to cloud storage." }

Write-Host "Restoring min-instances=1..." -ForegroundColor Yellow
& $Gcloud run services update $ServiceName `
    --project $ProjectId `
    --region $Region `
    --min-instances 1 `
    --max-instances 1 `
    --quiet
if ($LASTEXITCODE -ne 0) { throw "Failed to restore Cloud Run scaling." }

Write-Host "Cloud database updated at $RemotePath" -ForegroundColor Green
