# Deploy Bisync.cloud to Google Cloud Run (API + React in one container), backed by Cloud SQL PostgreSQL.
# Usage: .\scripts\deploy-gcp.ps1 -ProjectId YOUR_GCP_PROJECT_ID

param(
    [Parameter(Mandatory = $true, HelpMessage = "GCP Project ID from console.cloud.google.com")]
    [string]$ProjectId,

    [string]$Region = "asia-southeast1",
    [string]$ServiceName = "bisync-cloud",
    [string]$RepoName = "bisync",
    [string]$SqlInstance = "bisync-pg",
    [string]$DbUser = "postgres",

    # Hidden Dev Team console path baked into the SPA (e.g. /dev/ops-a7f3c9). Empty disables it.
    [string]$DevConsolePath = "/dev/console"
)

# gcloud writes progress/info to stderr; with "Stop" that aborts the script mid-deploy.
# Every critical step below checks $LASTEXITCODE and throws explicitly, so use "Continue".
$ErrorActionPreference = "Continue"

function Resolve-Gcloud {
    $candidates = @()
    if ($env:LOCALAPPDATA) {
        $candidates += "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
    }
    $cmd = Get-Command gcloud -ErrorAction SilentlyContinue
    if ($cmd) { $candidates += $cmd.Source }
    $candidates += @(
        "$env:HOME/google-cloud-sdk/bin/gcloud",
        "/usr/bin/gcloud",
        "/usr/local/bin/gcloud"
    )
    foreach ($path in $candidates) {
        if ($path -and (Test-Path $path)) { return $path }
    }
    throw "Google Cloud CLI not found. Install with: winget install Google.CloudSDK (Windows) or https://cloud.google.com/sdk/docs/install"
}

$Gcloud = Resolve-Gcloud
Write-Host "Using gcloud: $Gcloud" -ForegroundColor Gray

function Step([string]$Number, [string]$Message) {
    Write-Host ""
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host " Step $Number - $Message" -ForegroundColor Cyan
    Write-Host "==================================================" -ForegroundColor Cyan
}

$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

Step "1" "Checking Google Cloud login"
$Auth = & $Gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>$null
if (-not $Auth) {
    Write-Host "No active login. Opening browser for gcloud auth login..." -ForegroundColor Yellow
    & $Gcloud auth login
    if ($LASTEXITCODE -ne 0) { throw "gcloud auth login failed." }
}
Write-Host "Logged in as: $(& $Gcloud auth list --filter=status:ACTIVE --format='value(account)')" -ForegroundColor Green

Step "2" "Setting GCP project to '$ProjectId'"
& $Gcloud config set project $ProjectId
if ($LASTEXITCODE -ne 0) { throw "Failed to set project. Check your Project ID." }

Step "3" "Enabling required APIs"
& $Gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com sqladmin.googleapis.com secretmanager.googleapis.com
if ($LASTEXITCODE -ne 0) { throw "Failed to enable APIs." }
Write-Host "APIs enabled." -ForegroundColor Green

Step "4" "Verifying Cloud SQL instance '$SqlInstance' exists"
$InstanceConnectionName = & $Gcloud sql instances describe $SqlInstance --format="value(connectionName)" 2>$null
if (-not $InstanceConnectionName) {
    throw "Cloud SQL instance '$SqlInstance' not found. Create it first (see scripts/provision-cloudsql.ps1 or README)."
}
Write-Host "Cloud SQL connection name: $InstanceConnectionName" -ForegroundColor Green

Step "5" "Creating Artifact Registry repository '$RepoName' in $Region (if missing)"
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

Step "6" "Building container image with Cloud Build (5-10 min first time)"
Write-Host "Image: $Image" -ForegroundColor Gray
if ($DevConsolePath) {
    Write-Host "Dev console path: $DevConsolePath" -ForegroundColor Gray
} else {
    Write-Host "Dev console path: (disabled)" -ForegroundColor Gray
}
# Prefer repo cloudbuild.yaml (same config as GitHub Actions CD).
$CloudbuildConfig = Join-Path $Root "cloudbuild.yaml"
if (Test-Path $CloudbuildConfig) {
    $ImageSha = $Image -replace ':latest$', ":manual-$(Get-Date -Format 'yyyyMMddHHmmss')"
    & $Gcloud builds submit `
        --config $CloudbuildConfig `
        --substitutions "_IMAGE=$Image,_IMAGE_SHA=$ImageSha,_VITE_DEV_CONSOLE_PATH=$DevConsolePath" `
        .
} else {
    $CloudbuildYaml = @"
steps:
- name: 'gcr.io/cloud-builders/docker'
  args:
    - 'build'
    - '--build-arg'
    - 'VITE_DEV_CONSOLE_PATH=$DevConsolePath'
    - '-t'
    - '$Image'
    - '.'
images:
- '$Image'
"@
    $Tmp = Join-Path $env:TEMP "bisync-cloudbuild-devconsole.yaml"
    Set-Content -Path $Tmp -Value $CloudbuildYaml -Encoding UTF8
    & $Gcloud builds submit --config $Tmp .
}
if ($LASTEXITCODE -ne 0) { throw "Cloud Build failed." }
Write-Host "Image built and pushed." -ForegroundColor Green

Step "7" "Granting the Cloud Run service account access to the DB password secret + Cloud SQL"
$ProjectNumber = & $Gcloud projects describe $ProjectId --format="value(projectNumber)"
$RunServiceAccount = "$ProjectNumber-compute@developer.gserviceaccount.com"
& $Gcloud secrets add-iam-policy-binding bisync-db-password `
    --member="serviceAccount:$RunServiceAccount" `
    --role="roles/secretmanager.secretAccessor" *> $null
& $Gcloud projects add-iam-policy-binding $ProjectId `
    --member="serviceAccount:$RunServiceAccount" `
    --role="roles/cloudsql.client" *> $null

Step "8" "Deploying to Cloud Run service '$ServiceName'"
# Cloud Run reaches Cloud SQL over a Unix socket at /cloudsql/<connectionName>.
# The password is injected from Secret Manager as DB_PASSWORD; connection strings are assembled from it.
$DefaultConn = "Host=/cloudsql/${InstanceConnectionName};Database=bisync;Username=${DbUser}"
$ArchiveConn = "Host=/cloudsql/${InstanceConnectionName};Database=bisync_archive;Username=${DbUser}"
$AuditConn = "Host=/cloudsql/${InstanceConnectionName};Database=bisync_audit;Username=${DbUser}"

$DevConsoleEnabled = if ($DevConsolePath) { "true" } else { "false" }

& $Gcloud run deploy $ServiceName `
    --image $Image `
    --region $Region `
    --platform managed `
    --allow-unauthenticated `
    --port 8080 `
    --memory 1Gi `
    --cpu 1 `
    --min-instances 1 `
    --max-instances 2 `
    --timeout 600 `
    --cpu-boost `
    --add-cloudsql-instances $InstanceConnectionName `
    --set-secrets "DB_PASSWORD=bisync-db-password:latest" `
    --set-env-vars "ASPNETCORE_ENVIRONMENT=Production" `
    --set-env-vars "ConnectionStrings__DefaultConnection=$DefaultConn" `
    --set-env-vars "ConnectionStrings__ArchiveConnection=$ArchiveConn" `
    --set-env-vars "ConnectionStrings__AuditConnection=$AuditConn" `
    --set-env-vars "DEV_CONSOLE_ENABLED=$DevConsoleEnabled"
if ($LASTEXITCODE -ne 0) { throw "Cloud Run deploy failed." }

Step "9" "Deployment complete"
$Url = & $Gcloud run services describe $ServiceName --region $Region --format="value(status.url)"
Write-Host ""
Write-Host "  Live URL:  $Url" -ForegroundColor Green
Write-Host "  Health:    $Url/api/health" -ForegroundColor Green
if ($DevConsolePath) {
    Write-Host "  Dev console: $Url$DevConsolePath" -ForegroundColor Green
    Write-Host "  (Dev Team / Super Admin login required; not linked in the app nav)" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "Notes:" -ForegroundColor Yellow
Write-Host "  - Backed by Cloud SQL PostgreSQL instance '$SqlInstance' ($InstanceConnectionName)."
Write-Host "  - DB password is stored in Secret Manager secret 'bisync-db-password'."
Write-Host "  - Redeploy: .\scripts\deploy-gcp.ps1 -ProjectId $ProjectId [-DevConsolePath '/dev/ops-secret']"
Write-Host ""
