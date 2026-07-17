# One-time setup: create a GCP service account for GitHub Actions CD and print
# the steps to add it as the GCP_SA_KEY repo secret.
#
# Prerequisites:
#   - gcloud installed and logged in (gcloud auth login)
#   - Permission to create service accounts and grant IAM on the project
#   - gh CLI logged in (optional; script can print the secret command)
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\scripts\setup-github-deploy.ps1
#   powershell -ExecutionPolicy Bypass -File .\scripts\setup-github-deploy.ps1 -ProjectId project-8d670aa9-f439-44d9-8e1

param(
    [string]$ProjectId = "project-8d670aa9-f439-44d9-8e1",
    [string]$Region = "asia-southeast1",
    [string]$SaName = "github-deploy",
    [string]$Repo = "danra69-hash/Bisync.cloud"
)

$ErrorActionPreference = "Continue"

$Gcloud = "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
if (-not (Test-Path $Gcloud)) {
    $GcloudCmd = Get-Command gcloud -ErrorAction SilentlyContinue
    if ($null -eq $GcloudCmd) {
        throw "Google Cloud CLI not found. Install with: winget install Google.CloudSDK"
    }
    $Gcloud = $GcloudCmd.Source
}

Write-Host ""
Write-Host "=== Bisync GitHub Actions deploy setup ===" -ForegroundColor Cyan
Write-Host "Project: $ProjectId"
Write-Host "SA:      $SaName@$ProjectId.iam.gserviceaccount.com"
Write-Host ""

& $Gcloud config set project $ProjectId
if ($LASTEXITCODE -ne 0) { throw "Failed to set project $ProjectId" }

Write-Host "==> Enabling APIs..." -ForegroundColor Cyan
& $Gcloud services enable `
    run.googleapis.com `
    artifactregistry.googleapis.com `
    cloudbuild.googleapis.com `
    sqladmin.googleapis.com `
    secretmanager.googleapis.com `
    iam.googleapis.com
if ($LASTEXITCODE -ne 0) { throw "Failed to enable APIs." }

$SaEmail = "$SaName@$ProjectId.iam.gserviceaccount.com"

Write-Host "==> Ensuring service account $SaEmail ..." -ForegroundColor Cyan
& $Gcloud iam service-accounts describe $SaEmail --project $ProjectId *> $null
if ($LASTEXITCODE -ne 0) {
    & $Gcloud iam service-accounts create $SaName `
        --project $ProjectId `
        --display-name "GitHub Actions Cloud Run deploy"
    if ($LASTEXITCODE -ne 0) { throw "Failed to create service account." }
} else {
    Write-Host "Service account already exists." -ForegroundColor Green
}

$Roles = @(
    "roles/run.admin",
    "roles/cloudbuild.builds.editor",
    "roles/artifactregistry.writer",
    "roles/artifactregistry.admin",
    "roles/storage.admin",
    "roles/iam.serviceAccountUser",
    "roles/cloudsql.viewer",
    "roles/secretmanager.secretAccessor"
)

Write-Host "==> Granting IAM roles..." -ForegroundColor Cyan
foreach ($role in $Roles) {
    Write-Host "  $role"
    & $Gcloud projects add-iam-policy-binding $ProjectId `
        --member="serviceAccount:$SaEmail" `
        --role=$role `
        --condition=None `
        *> $null
}

# Cloud Build runs as the project's Cloud Build SA; grant it Artifact Registry writer.
$ProjectNumber = & $Gcloud projects describe $ProjectId --format="value(projectNumber)"
$CloudBuildSa = "$ProjectNumber@cloudbuild.gserviceaccount.com"
$ComputeSa = "$ProjectNumber-compute@developer.gserviceaccount.com"

Write-Host "==> Granting Cloud Build SA Artifact Registry writer..." -ForegroundColor Cyan
& $Gcloud projects add-iam-policy-binding $ProjectId `
    --member="serviceAccount:$CloudBuildSa" `
    --role="roles/artifactregistry.writer" `
    --condition=None `
    *> $null

Write-Host "==> Allowing deploy SA to act as Cloud Run runtime SA..." -ForegroundColor Cyan
& $Gcloud iam service-accounts add-iam-policy-binding $ComputeSa `
    --project $ProjectId `
    --member="serviceAccount:$SaEmail" `
    --role="roles/iam.serviceAccountUser" `
    *> $null

Write-Host "==> Ensuring Cloud Run runtime SA can read DB secret + Cloud SQL..." -ForegroundColor Cyan
& $Gcloud secrets add-iam-policy-binding bisync-db-password `
    --project $ProjectId `
    --member="serviceAccount:$ComputeSa" `
    --role="roles/secretmanager.secretAccessor" `
    *> $null
& $Gcloud projects add-iam-policy-binding $ProjectId `
    --member="serviceAccount:$ComputeSa" `
    --role="roles/cloudsql.client" `
    --condition=None `
    *> $null

$KeyDir = Join-Path $env:TEMP "bisync-github-deploy"
New-Item -ItemType Directory -Force -Path $KeyDir | Out-Null
$KeyPath = Join-Path $KeyDir "gcp-sa-key.json"

Write-Host "==> Creating JSON key at $KeyPath ..." -ForegroundColor Cyan
if (Test-Path $KeyPath) { Remove-Item $KeyPath -Force }
& $Gcloud iam service-accounts keys create $KeyPath `
    --iam-account $SaEmail `
    --project $ProjectId
if ($LASTEXITCODE -ne 0) { throw "Failed to create service account key." }

Write-Host ""
Write-Host "=== Add the GitHub secret ===" -ForegroundColor Green
Write-Host ""
Write-Host "Option A - GitHub CLI (recommended):" -ForegroundColor Yellow
Write-Host ('  Get-Content -Raw "{0}" | gh secret set GCP_SA_KEY --repo {1}' -f $KeyPath, $Repo)
Write-Host ""
Write-Host "Option B - GitHub website:" -ForegroundColor Yellow
Write-Host "  1. Open https://github.com/$Repo/settings/secrets/actions"
Write-Host "  2. New repository secret"
Write-Host "  3. Name:  GCP_SA_KEY"
Write-Host "  4. Value: paste the full contents of:"
Write-Host "           $KeyPath"
Write-Host ""
Write-Host "Then merge to master (or run Actions -> Deploy Cloud Run -> Run workflow)." -ForegroundColor Cyan
Write-Host "Delete the local key file after the secret is saved:" -ForegroundColor Yellow
Write-Host ('  Remove-Item "{0}"' -f $KeyPath)
Write-Host ""

$Gh = Get-Command gh -ErrorAction SilentlyContinue
if ($null -ne $Gh) {
    $answer = Read-Host "Set GCP_SA_KEY on $Repo now with gh? (y/N)"
    if ($answer -eq "y" -or $answer -eq "Y") {
        Get-Content -Raw $KeyPath | & $Gh.Source secret set GCP_SA_KEY --repo $Repo
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Secret GCP_SA_KEY set on $Repo." -ForegroundColor Green
            Remove-Item $KeyPath -Force
            Write-Host "Local key file deleted." -ForegroundColor Green
        } else {
            Write-Host "gh secret set failed - set it manually from $KeyPath" -ForegroundColor Red
        }
    }
}
