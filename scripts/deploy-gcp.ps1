# Deploy Bisync.cloud to Google Cloud Run (API + React in one container)
# Usage: .\scripts\deploy-gcp.ps1 -ProjectId YOUR_GCP_PROJECT_ID

param(
    [Parameter(Mandatory = $true, HelpMessage = "GCP Project ID from console.cloud.google.com")]
    [string]$ProjectId,

    [string]$Region = "asia-southeast1",
    [string]$ServiceName = "bisync-cloud",
    [string]$RepoName = "bisync"
)

$ErrorActionPreference = "Stop"

$Gcloud = "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
if (-not (Test-Path $Gcloud)) {
    throw "Google Cloud CLI not found. Install with: winget install Google.CloudSDK"
}

function Step([string]$Number, [string]$Message) {
    Write-Host ""
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host " Step $Number - $Message" -ForegroundColor Cyan
    Write-Host "==================================================" -ForegroundColor Cyan
}

$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

Step "0" "Checking Google Cloud login"
$Auth = & $Gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>$null
if (-not $Auth) {
    Write-Host "No active login. Opening browser for gcloud auth login..." -ForegroundColor Yellow
    & $Gcloud auth login
    if ($LASTEXITCODE -ne 0) { throw "gcloud auth login failed." }
}
Write-Host "Logged in as: $(& $Gcloud auth list --filter=status:ACTIVE --format='value(account)')" -ForegroundColor Green

Step "1" "Setting GCP project to '$ProjectId'"
& $Gcloud config set project $ProjectId
if ($LASTEXITCODE -ne 0) { throw "Failed to set project. Check your Project ID." }

Step "2" "Enabling required APIs (Cloud Run, Artifact Registry, Cloud Build)"
& $Gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com
if ($LASTEXITCODE -ne 0) { throw "Failed to enable APIs." }
Write-Host "APIs enabled." -ForegroundColor Green

Step "3" "Creating Artifact Registry repository '$RepoName' in $Region (if missing)"
$PrevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
& $Gcloud artifacts repositories describe $RepoName --location=$Region --format="value(name)" *> $null
$RepoExists = $LASTEXITCODE -eq 0
$ErrorActionPreference = $PrevEap
if (-not $RepoExists) {
    & $Gcloud artifacts repositories create $RepoName `
        --repository-format=docker `
        --location=$Region `
        --description="Bisync.cloud container images"
    if ($LASTEXITCODE -ne 0) { throw "Failed to create Artifact Registry repository." }
    Write-Host "Repository created." -ForegroundColor Green
} else {
    Write-Host "Repository already exists." -ForegroundColor Green
}

$Image = "${Region}-docker.pkg.dev/${ProjectId}/${RepoName}/${ServiceName}:latest"

Step "4" "Building container image with Cloud Build (5-10 min first time)"
Write-Host "Image: $Image" -ForegroundColor Gray
& $Gcloud builds submit --tag $Image .
if ($LASTEXITCODE -ne 0) { throw "Cloud Build failed." }
Write-Host "Image built and pushed." -ForegroundColor Green

Step "5" "Deploying to Cloud Run service '$ServiceName'"
$BucketName = "$($ProjectId.Replace('_','-').ToLower())-bisync-data"
$PrevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
& $Gcloud storage buckets describe "gs://$BucketName" *> $null
$BucketExists = $LASTEXITCODE -eq 0
$ErrorActionPreference = $PrevEap
if (-not $BucketExists) {
    Write-Host "Creating persistent data bucket: gs://$BucketName" -ForegroundColor Gray
    & $Gcloud storage buckets create "gs://$BucketName" --location=$Region --uniform-bucket-level-access
    if ($LASTEXITCODE -ne 0) { throw "Failed to create storage bucket." }
}

& $Gcloud services enable storage.googleapis.com *> $null
$ProjectNumber = & $Gcloud projects describe $ProjectId --format="value(projectNumber)"
$RunServiceAccount = "$ProjectNumber-compute@developer.gserviceaccount.com"
& $Gcloud storage buckets add-iam-policy-binding "gs://$BucketName" `
    --member="serviceAccount:$RunServiceAccount" `
    --role="roles/storage.objectAdmin" *> $null

& $Gcloud run deploy $ServiceName `
    --image $Image `
    --region $Region `
    --platform managed `
    --allow-unauthenticated `
    --port 8080 `
    --memory 1Gi `
    --cpu 1 `
    --min-instances 1 `
    --max-instances 1 `
    --timeout 300 `
    --cpu-boost `
    --add-volume "name=bisync-data,type=cloud-storage,bucket=$BucketName" `
    --add-volume-mount "volume=bisync-data,mount-path=/app/data" `
    --set-env-vars "ASPNETCORE_ENVIRONMENT=Production"
if ($LASTEXITCODE -ne 0) { throw "Cloud Run deploy failed." }

Step "6" "Deployment complete"
$Url = & $Gcloud run services describe $ServiceName --region $Region --format="value(status.url)"
Write-Host ""
Write-Host "  Live URL:  $Url" -ForegroundColor Green
Write-Host "  Health:    $Url/api/health" -ForegroundColor Green
Write-Host ""
Write-Host "Notes:" -ForegroundColor Yellow
Write-Host "  - Local dev is unchanged. Keep using dotnet run + npm run dev on your PC."
Write-Host "  - Cloud DB persists in gs://$BucketName (mounted at /app/data)." -ForegroundColor Green
Write-Host "  - Single Cloud Run instance keeps SQLite writes consistent." -ForegroundColor Green
Write-Host "  - Redeploy: .\scripts\deploy-gcp.ps1 -ProjectId $ProjectId"
Write-Host ""
