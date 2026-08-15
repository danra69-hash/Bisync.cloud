# One-time bootstrap for a STANDALONE Pulse GCP project (NOT Bisync).
#
# Prerequisites:
#   1. Google Cloud Console → create project (e.g. pulse-fitness-cloud) + link billing
#   2. gcloud installed and:  gcloud auth login
#   3. Optional: gh auth login  (to set GitHub Actions variables)
#
# From your Bisync.cloud repo root in PowerShell:
#   cd C:\path\to\Bisync.cloud
#   git checkout pulse
#   git pull
#   powershell -ExecutionPolicy Bypass -File .\pulse\scripts\setup-gcp.ps1 -ProjectId pulse-fitness-cloud
#
# Optional create project from CLI:
#   powershell -ExecutionPolicy Bypass -File .\pulse\scripts\setup-gcp.ps1 `
#     -ProjectId pulse-fitness-cloud -CreateProject -BillingAccount XXXXXX-XXXXXX-XXXXXX

param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectId,

    [string]$BillingAccount = "",
    [switch]$CreateProject,
    [string]$Region = "asia-southeast1",
    [string]$Repo = "danra69-hash/Bisync.cloud",
    [string]$SaName = "pulse-github-deploy",
    [string]$PoolId = "pulse-github-pool",
    [string]$ProviderId = "pulse-github-provider",
    [string]$ArRepo = "pulse",
    [string]$SqlInstance = "pulse-pg",
    [string]$DbName = "pulse",
    [string]$DbUser = "pulse",
    [string]$SecretId = "pulse-db-password"
)

$ErrorActionPreference = "Continue"
$RepoOwner = $Repo.Split("/")[0]

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
Write-Host "=== Pulse standalone GCP setup (NOT Bisync) ===" -ForegroundColor Cyan
Write-Host "Project: $ProjectId"
Write-Host "Region:  $Region"
Write-Host "Repo:    $Repo"
Write-Host ""

if ($CreateProject) {
    if (Invoke-GcloudQuiet projects describe $ProjectId) {
        Write-Host "Project already exists." -ForegroundColor Green
    } else {
        Write-Host "==> Creating project $ProjectId ..." -ForegroundColor Cyan
        & $Gcloud projects create $ProjectId --name="Pulse Fitness Cloud"
        if ($LASTEXITCODE -ne 0) { throw "Failed to create project." }
    }
    if ($BillingAccount) {
        Write-Host "==> Linking billing $BillingAccount ..." -ForegroundColor Cyan
        & $Gcloud billing projects link $ProjectId --billing-account=$BillingAccount
    } else {
        Write-Host "NOTE: Link billing in Console if not already linked." -ForegroundColor Yellow
    }
}

& $Gcloud config set project $ProjectId
if ($LASTEXITCODE -ne 0) { throw "Failed to set project $ProjectId. Create it in Console first, or pass -CreateProject." }

Write-Host "==> Enabling APIs..." -ForegroundColor Cyan
& $Gcloud services enable `
    run.googleapis.com `
    artifactregistry.googleapis.com `
    cloudbuild.googleapis.com `
    sqladmin.googleapis.com `
    secretmanager.googleapis.com `
    iam.googleapis.com `
    iamcredentials.googleapis.com `
    cloudresourcemanager.googleapis.com `
    sts.googleapis.com
if ($LASTEXITCODE -ne 0) { throw "Failed to enable APIs." }

$SaEmail = "$SaName@$ProjectId.iam.gserviceaccount.com"
Write-Host "==> Ensuring service account $SaEmail ..." -ForegroundColor Cyan
if (-not (Invoke-GcloudQuiet iam service-accounts describe $SaEmail --project $ProjectId)) {
    & $Gcloud iam service-accounts create $SaName `
        --project $ProjectId `
        --display-name "Pulse GitHub Actions deploy"
    if ($LASTEXITCODE -ne 0) { throw "Failed to create service account." }
}

$Roles = @(
    "roles/run.admin",
    "roles/cloudbuild.builds.editor",
    "roles/artifactregistry.admin",
    "roles/artifactregistry.writer",
    "roles/storage.admin",
    "roles/iam.serviceAccountUser",
    "roles/cloudsql.admin",
    "roles/secretmanager.admin",
    "roles/logging.viewer",
    "roles/browser"
)
foreach ($role in $Roles) {
    Write-Host "  grant $role"
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

& $Gcloud projects add-iam-policy-binding $ProjectId `
    --member="serviceAccount:$CloudBuildSa" `
    --role="roles/artifactregistry.writer" `
    --condition=None `
    *> $null

& $Gcloud iam service-accounts add-iam-policy-binding $ComputeSa `
    --project $ProjectId `
    --member="serviceAccount:$SaEmail" `
    --role="roles/iam.serviceAccountUser" `
    *> $null

Write-Host "==> Artifact Registry $ArRepo ..." -ForegroundColor Cyan
if (-not (Invoke-GcloudQuiet artifacts repositories describe $ArRepo --location=$Region --project $ProjectId)) {
    & $Gcloud artifacts repositories create $ArRepo `
        --repository-format=docker `
        --location=$Region `
        --project $ProjectId `
        --description="Pulse container images"
    if ($LASTEXITCODE -ne 0) { throw "Failed to create Artifact Registry." }
}

Write-Host "==> Secret $SecretId ..." -ForegroundColor Cyan
$DbPass = $null
if (-not (Invoke-GcloudQuiet secrets describe $SecretId --project $ProjectId)) {
    $bytes = New-Object byte[] 18
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $DbPass = [Convert]::ToBase64String($bytes) -replace '[/+=]', 'x'
    $tmp = [System.IO.Path]::GetTempFileName()
    [System.IO.File]::WriteAllText($tmp, $DbPass)
    & $Gcloud secrets create $SecretId `
        --project $ProjectId `
        --replication-policy=automatic `
        --data-file=$tmp
    Remove-Item $tmp -Force
    if ($LASTEXITCODE -ne 0) { throw "Failed to create secret." }
    Write-Host "Generated DB password stored in Secret Manager." -ForegroundColor Green
} else {
    $DbPass = & $Gcloud secrets versions access latest --secret=$SecretId --project $ProjectId
}

& $Gcloud secrets add-iam-policy-binding $SecretId `
    --project $ProjectId `
    --member="serviceAccount:$ComputeSa" `
    --role="roles/secretmanager.secretAccessor" `
    *> $null

& $Gcloud projects add-iam-policy-binding $ProjectId `
    --member="serviceAccount:$ComputeSa" `
    --role="roles/cloudsql.client" `
    --condition=None `
    *> $null

Write-Host "==> Cloud SQL $SqlInstance (may take several minutes)..." -ForegroundColor Cyan
if (-not (Invoke-GcloudQuiet sql instances describe $SqlInstance --project $ProjectId)) {
    & $Gcloud sql instances create $SqlInstance `
        --project $ProjectId `
        --database-version=POSTGRES_16 `
        --tier=db-f1-micro `
        --region=$Region `
        --storage-auto-increase `
        --root-password=$DbPass
    if ($LASTEXITCODE -ne 0) { throw "Failed to create Cloud SQL instance." }
}

if (-not (Invoke-GcloudQuiet sql databases describe $DbName --instance=$SqlInstance --project $ProjectId)) {
    & $Gcloud sql databases create $DbName --instance=$SqlInstance --project $ProjectId
}

$existingUsers = & $Gcloud sql users list --instance=$SqlInstance --project $ProjectId --format="value(name)"
if ($existingUsers -notcontains $DbUser) {
    & $Gcloud sql users create $DbUser `
        --instance=$SqlInstance `
        --project $ProjectId `
        --password=$DbPass
}

Write-Host "==> Workload Identity Federation..." -ForegroundColor Cyan
if (-not (Invoke-GcloudQuiet iam workload-identity-pools describe $PoolId --project $ProjectId --location=global)) {
    & $Gcloud iam workload-identity-pools create $PoolId `
        --project $ProjectId `
        --location=global `
        --display-name="Pulse GitHub pool"
    if ($LASTEXITCODE -ne 0) { throw "Failed to create WIF pool." }
}

$AttributeMapping = "google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner"
$AttributeCondition = "assertion.repository_owner == '$RepoOwner'"
if (-not (Invoke-GcloudQuiet iam workload-identity-pools providers describe $ProviderId --project $ProjectId --location=global --workload-identity-pool=$PoolId)) {
    & $Gcloud iam workload-identity-pools providers create-oidc $ProviderId `
        --project $ProjectId `
        --location=global `
        --workload-identity-pool=$PoolId `
        --display-name="Pulse GitHub provider" `
        --issuer-uri="https://token.actions.githubusercontent.com" `
        --attribute-mapping=$AttributeMapping `
        --attribute-condition=$AttributeCondition
    if ($LASTEXITCODE -ne 0) { throw "Failed to create WIF provider." }
} else {
    & $Gcloud iam workload-identity-pools providers update-oidc $ProviderId `
        --project $ProjectId `
        --location=global `
        --workload-identity-pool=$PoolId `
        --attribute-mapping=$AttributeMapping `
        --attribute-condition=$AttributeCondition `
        *> $null
}

$PoolFull = "projects/$ProjectNumber/locations/global/workloadIdentityPools/$PoolId"
$Member = "principalSet://iam.googleapis.com/$PoolFull/attribute.repository/$Repo"
& $Gcloud iam service-accounts add-iam-policy-binding $SaEmail `
    --project $ProjectId `
    --role="roles/iam.workloadIdentityUser" `
    --member=$Member `
    *> $null

$ProviderName = & $Gcloud iam workload-identity-pools providers describe $ProviderId `
    --project $ProjectId `
    --location=global `
    --workload-identity-pool=$PoolId `
    --format="value(name)"
if (-not $ProviderName) { throw "Could not resolve provider resource name." }

Write-Host ""
Write-Host "=== Add these GitHub repository VARIABLES ===" -ForegroundColor Green
Write-Host "(Settings -> Secrets and variables -> Actions -> Variables)" -ForegroundColor Gray
Write-Host ""
Write-Host "  PULSE_GCP_PROJECT_ID = $ProjectId" -ForegroundColor Yellow
Write-Host "  PULSE_GCP_WORKLOAD_IDENTITY_PROVIDER = $ProviderName" -ForegroundColor Yellow
Write-Host "  PULSE_GCP_SERVICE_ACCOUNT = $SaEmail" -ForegroundColor Yellow
Write-Host "  PULSE_GCP_REGION = $Region" -ForegroundColor Yellow
Write-Host ""

$Gh = Get-Command gh -ErrorAction SilentlyContinue
if ($null -ne $Gh) {
    $answer = Read-Host "Set PULSE_GCP_* GitHub variables on $Repo now with gh? (y/N)"
    if ($answer -eq "y" -or $answer -eq "Y") {
        & $Gh.Source variable set PULSE_GCP_PROJECT_ID --repo $Repo --body $ProjectId
        & $Gh.Source variable set PULSE_GCP_WORKLOAD_IDENTITY_PROVIDER --repo $Repo --body $ProviderName
        & $Gh.Source variable set PULSE_GCP_SERVICE_ACCOUNT --repo $Repo --body $SaEmail
        & $Gh.Source variable set PULSE_GCP_REGION --repo $Repo --body $Region
        Write-Host "GitHub variables set (check exit codes above)." -ForegroundColor Green
    }
} else {
    Write-Host "gh CLI not found — set the four variables manually in GitHub." -ForegroundColor Yellow
}

$SqlConn = & $Gcloud sql instances describe $SqlInstance --project $ProjectId --format="value(connectionName)"
Write-Host ""
Write-Host "=== Pulse GCP ready ===" -ForegroundColor Green
Write-Host "SQL connection: $SqlConn"
Write-Host ""
Write-Host "Next deploy:" -ForegroundColor Cyan
Write-Host "  git push origin pulse"
Write-Host "  # or GitHub Actions -> Deploy Pulse -> Run workflow (branch: pulse)"
Write-Host ""
