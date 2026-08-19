# One-time: GitHub Actions OIDC provider + deploy role for Bisync → AWS (Windows).
# Prefer owning this via Terraform (infra/aws/github_oidc.tf) after the first apply.
#
# Prerequisites:
#   - AWS CLI v2 installed (winget install Amazon.AWSCLI)
#   - Terraform installed (winget install Hashicorp.Terraform)
#   - Open PowerShell IN THE REPO ROOT (not System32)
#
# Usage:
#   cd C:\path\to\Bisync.cloud
#   powershell -ExecutionPolicy Bypass -File .\scripts\setup-github-aws-deploy.ps1

param(
    [string]$AwsRegion = "ap-southeast-1",
    [string]$NamePrefix = "bisync-cloud",
    [string]$GithubOrg = "danra69-hash",
    [string]$GithubRepo = "Bisync.cloud"
)

$ErrorActionPreference = "Stop"

function Require-Command([string]$Name, [string]$InstallHint) {
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if ($null -eq $cmd) {
        throw @"
'$Name' was not found on PATH.

Install it, then close and reopen PowerShell:
  $InstallHint

If it is already installed, restart the terminal so PATH updates.
"@
    }
}

Require-Command "aws" "winget install Amazon.AWSCLI"
Require-Command "terraform" "winget install Hashicorp.Terraform"

$RoleName = "$NamePrefix-github-deploy"
$OidcUrl = "https://token.actions.githubusercontent.com"

Write-Host ""
Write-Host "=== Bisync GitHub Actions AWS deploy setup ===" -ForegroundColor Cyan
Write-Host "Region: $AwsRegion"
Write-Host "Repo:   $GithubOrg/$GithubRepo"
Write-Host ""

Write-Host "==> Checking AWS login..." -ForegroundColor Cyan
$identityJson = aws sts get-caller-identity --output json 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Not logged in. Run: aws configure" -ForegroundColor Yellow
    Write-Host "  Access Key ID / Secret from IAM → Users → Security credentials" -ForegroundColor Yellow
    Write-Host "  Default region: $AwsRegion" -ForegroundColor Yellow
    Write-Host "  Default output: json" -ForegroundColor Yellow
    throw "AWS CLI is not authenticated. Run 'aws configure' then retry this script."
}
$identity = $identityJson | ConvertFrom-Json
$AccountId = $identity.Account
Write-Host "Logged in as Account $AccountId ($($identity.Arn))" -ForegroundColor Green

$OidcArn = aws iam list-open-id-connect-providers `
    --query "OpenIDConnectProviderList[?contains(Arn, 'token.actions.githubusercontent.com')].Arn | [0]" `
    --output text
if (-not $OidcArn -or $OidcArn -eq "None") {
    Write-Host "==> Creating GitHub OIDC provider..." -ForegroundColor Cyan
    $OidcArn = aws iam create-open-id-connect-provider `
        --url $OidcUrl `
        --client-id-list "sts.amazonaws.com" `
        --thumbprint-list "6938fd4d98bab03faadb97b34396831e3780aea1" `
        --query OpenIDConnectProviderArn `
        --output text
    if ($LASTEXITCODE -ne 0) { throw "Failed to create OIDC provider." }
} else {
    Write-Host "OIDC provider exists: $OidcArn" -ForegroundColor Green
}

$Trust = @"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Federated": "$OidcArn" },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:${GithubOrg}/${GithubRepo}:*"
        }
      }
    }
  ]
}
"@

$TrustFile = Join-Path $env:TEMP "bisync-aws-trust.json"
Set-Content -Path $TrustFile -Value $Trust -Encoding utf8

aws iam get-role --role-name $RoleName 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "==> Updating trust on $RoleName ..." -ForegroundColor Cyan
    aws iam update-assume-role-policy --role-name $RoleName --policy-document "file://$TrustFile"
} else {
    Write-Host "==> Creating role $RoleName ..." -ForegroundColor Cyan
    aws iam create-role --role-name $RoleName --assume-role-policy-document "file://$TrustFile" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Failed to create role." }
}

$Policy = @"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "EcrAuth",
      "Effect": "Allow",
      "Action": ["ecr:GetAuthorizationToken"],
      "Resource": "*"
    },
    {
      "Sid": "EcrPush",
      "Effect": "Allow",
      "Action": [
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:DescribeRepositories",
        "ecr:ListImages",
        "ecr:DescribeImages"
      ],
      "Resource": "arn:aws:ecr:${AwsRegion}:${AccountId}:repository/${NamePrefix}"
    },
    {
      "Sid": "EcsDeploy",
      "Effect": "Allow",
      "Action": [
        "ecs:DescribeServices",
        "ecs:DescribeTaskDefinition",
        "ecs:DescribeTasks",
        "ecs:ListTasks",
        "ecs:RegisterTaskDefinition",
        "ecs:UpdateService"
      ],
      "Resource": "*"
    },
    {
      "Sid": "PassRoles",
      "Effect": "Allow",
      "Action": ["iam:PassRole"],
      "Resource": [
        "arn:aws:iam::${AccountId}:role/${NamePrefix}-ecs-execution",
        "arn:aws:iam::${AccountId}:role/${NamePrefix}-ecs-task"
      ]
    }
  ]
}
"@

$PolicyFile = Join-Path $env:TEMP "bisync-aws-policy.json"
Set-Content -Path $PolicyFile -Value $Policy -Encoding utf8
aws iam put-role-policy `
    --role-name $RoleName `
    --policy-name "$NamePrefix-github-deploy" `
    --policy-document "file://$PolicyFile"
if ($LASTEXITCODE -ne 0) { throw "Failed to attach inline policy." }

$RoleArn = "arn:aws:iam::${AccountId}:role/${RoleName}"

Write-Host ""
Write-Host "Done. Set these GitHub repository VARIABLES:" -ForegroundColor Green
Write-Host "  Settings → Secrets and variables → Actions → Variables" -ForegroundColor Gray
Write-Host ""
Write-Host "  AWS_ROLE_ARN=$RoleArn"
Write-Host "  AWS_REGION=$AwsRegion"
Write-Host "  AWS_ECR_REPOSITORY=$NamePrefix"
Write-Host "  AWS_ECS_CLUSTER=$NamePrefix"
Write-Host "  AWS_ECS_SERVICE=$NamePrefix"
Write-Host "  AWS_PUBLIC_BASE_URL=https://bisync.ai"
Write-Host ""
Write-Host "Next (still in the repo root):" -ForegroundColor Cyan
Write-Host "  cd infra\aws"
Write-Host "  Copy-Item terraform.tfvars.example terraform.tfvars"
Write-Host "  terraform init"
Write-Host "  terraform apply"
Write-Host ""
Write-Host "Full runbook: docs\AWS_DEPLOY.md" -ForegroundColor Gray
