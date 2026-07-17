# One-time setup: Workload Identity Federation so GitHub Actions can deploy
# to Cloud Run WITHOUT creating a service-account JSON key
# (org policy constraints/iam.disableServiceAccountKeyCreation).
#
# Prerequisites:
#   - gcloud installed and logged in (gcloud auth login)
#   - Permission to create WI pools and bind IAM on the project
#   - gh CLI logged in (optional; can set GitHub variables manually)
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\scripts\setup-github-deploy.ps1

param(
    [string]$ProjectId = "project-8d670aa9-f439-44d9-8e1",
    [string]$SaName = "github-deploy",
    [string]$PoolId = "github-pool",
    [string]$ProviderId = "github-provider",
    [string]$Repo = "danra69-hash/Bisync.cloud",
    [string]$RepoOwner = "danra69-hash"
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

function Invoke-GcloudQuiet {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
    & $Gcloud @Args 2>$null | Out-Null
    return ($LASTEXITCODE -eq 0)
}

Write-Host ""
Write-Host "=== Bisync GitHub Actions deploy setup (Workload Identity) ===" -ForegroundColor Cyan
Write-Host "Project: $ProjectId"
Write-Host "SA:      $SaName@$ProjectId.iam.gserviceaccount.com"
Write-Host "Repo:    $Repo"
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
    iam.googleapis.com `
    iamcredentials.googleapis.com `
    cloudresourcemanager.googleapis.com
if ($LASTEXITCODE -ne 0) { throw "Failed to enable APIs." }

$SaEmail = "$SaName@$ProjectId.iam.gserviceaccount.com"

Write-Host "==> Ensuring service account $SaEmail ..." -ForegroundColor Cyan
if (-not (Invoke-GcloudQuiet iam service-accounts describe $SaEmail --project $ProjectId)) {
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
    "roles/logging.viewer",
    "roles/browser",
    "roles/secretmanager.secretAccessor"
)

Write-Host "==> Granting IAM roles on project..." -ForegroundColor Cyan
foreach ($role in $Roles) {
    Write-Host "  $role"
    & $Gcloud projects add-iam-policy-binding $ProjectId `
        --member="serviceAccount:$SaEmail" `
        --role=$role `
        --condition=None `
        *> $null
}

$ProjectNumber = & $Gcloud projects describe $ProjectId --format="value(projectNumber)"
if (-not $ProjectNumber) { throw "Could not resolve project number." }
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

Write-Host "==> Ensuring Workload Identity Pool '$PoolId'..." -ForegroundColor Cyan
$PoolFull = "projects/$ProjectNumber/locations/global/workloadIdentityPools/$PoolId"
if (-not (Invoke-GcloudQuiet iam workload-identity-pools describe $PoolId --project $ProjectId --location=global)) {
    & $Gcloud iam workload-identity-pools create $PoolId `
        --project $ProjectId `
        --location=global `
        --display-name="GitHub Actions"
    if ($LASTEXITCODE -ne 0) { throw "Failed to create workload identity pool." }
} else {
    Write-Host "Pool already exists." -ForegroundColor Green
}

Write-Host "==> Ensuring OIDC provider '$ProviderId' for GitHub..." -ForegroundColor Cyan
$ProviderFull = "$PoolFull/providers/$ProviderId"
$AttributeMapping = "google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner"
$AttributeCondition = "assertion.repository_owner == '$RepoOwner'"

if (-not (Invoke-GcloudQuiet iam workload-identity-pools providers describe $ProviderId --project $ProjectId --location=global --workload-identity-pool=$PoolId)) {
    & $Gcloud iam workload-identity-pools providers create-oidc $ProviderId `
        --project $ProjectId `
        --location=global `
        --workload-identity-pool=$PoolId `
        --display-name="GitHub OIDC" `
        --issuer-uri="https://token.actions.githubusercontent.com" `
        --attribute-mapping=$AttributeMapping `
        --attribute-condition=$AttributeCondition
    if ($LASTEXITCODE -ne 0) { throw "Failed to create workload identity provider." }
} else {
    Write-Host "Provider already exists - updating attribute condition/mapping..." -ForegroundColor Green
    & $Gcloud iam workload-identity-pools providers update-oidc $ProviderId `
        --project $ProjectId `
        --location=global `
        --workload-identity-pool=$PoolId `
        --attribute-mapping=$AttributeMapping `
        --attribute-condition=$AttributeCondition `
        *> $null
}

Write-Host "==> Binding repo $Repo to impersonate $SaEmail ..." -ForegroundColor Cyan
$Member = "principalSet://iam.googleapis.com/$PoolFull/attribute.repository/$Repo"
& $Gcloud iam service-accounts add-iam-policy-binding $SaEmail `
    --project $ProjectId `
    --role="roles/iam.workloadIdentityUser" `
    --member=$Member `
    *> $null
if ($LASTEXITCODE -ne 0) { throw "Failed to bind workloadIdentityUser on service account." }

# Resolve canonical provider resource name (needed by google-github-actions/auth)
$ProviderName = & $Gcloud iam workload-identity-pools providers describe $ProviderId `
    --project $ProjectId `
    --location=global `
    --workload-identity-pool=$PoolId `
    --format="value(name)"
if (-not $ProviderName) { throw "Could not resolve provider resource name." }

Write-Host ""
Write-Host "=== Add these GitHub repository VARIABLES ===" -ForegroundColor Green
Write-Host "(Settings -> Secrets and variables -> Actions -> Variables tab)" -ForegroundColor Gray
Write-Host ""
Write-Host "  GCP_WORKLOAD_IDENTITY_PROVIDER ="
Write-Host "    $ProviderName" -ForegroundColor Yellow
Write-Host ""
Write-Host "  GCP_SERVICE_ACCOUNT ="
Write-Host "    $SaEmail" -ForegroundColor Yellow
Write-Host ""
Write-Host "Option A - GitHub CLI:" -ForegroundColor Cyan
Write-Host ('  gh variable set GCP_WORKLOAD_IDENTITY_PROVIDER --repo {0} --body "{1}"' -f $Repo, $ProviderName)
Write-Host ('  gh variable set GCP_SERVICE_ACCOUNT --repo {0} --body "{1}"' -f $Repo, $SaEmail)
Write-Host ""
Write-Host "Then merge the auto-deploy PR (or Actions -> Deploy Cloud Run -> Run workflow)." -ForegroundColor Cyan
Write-Host "No JSON key is created (org policy safe)." -ForegroundColor Green
Write-Host ""
Write-Host "Note: the 'Python was not found' line from gcloud on Windows is harmless - ignore it." -ForegroundColor Gray
Write-Host ""

$Gh = Get-Command gh -ErrorAction SilentlyContinue
if ($null -ne $Gh) {
    $answer = Read-Host "Set the two GitHub variables on $Repo now with gh? (y/N)"
    if ($answer -eq "y" -or $answer -eq "Y") {
        & $Gh.Source variable set GCP_WORKLOAD_IDENTITY_PROVIDER --repo $Repo --body $ProviderName
        $ok1 = ($LASTEXITCODE -eq 0)
        & $Gh.Source variable set GCP_SERVICE_ACCOUNT --repo $Repo --body $SaEmail
        $ok2 = ($LASTEXITCODE -eq 0)
        if ($ok1 -and $ok2) {
            Write-Host "GitHub variables set on $Repo." -ForegroundColor Green
        } else {
            Write-Host "gh variable set failed - set them manually from the values above." -ForegroundColor Red
        }
    }
}
