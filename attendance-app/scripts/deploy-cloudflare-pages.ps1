# Deploy web/dist to Cloudflare Pages (bisync-rms-mobile)
# Usage:
#   $env:CLOUDFLARE_API_TOKEN = "your-token"
#   $env:CLOUDFLARE_ACCOUNT_ID = "optional-if-token-has-account-read"
#   .\scripts\deploy-cloudflare-pages.ps1

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

if (-not $env:CLOUDFLARE_API_TOKEN) {
  Write-Error "Set CLOUDFLARE_API_TOKEN first. Create at: https://dash.cloudflare.com/profile/api-tokens"
}

if (-not $env:CLOUDFLARE_ACCOUNT_ID) {
  Write-Host "Fetching account ID from Cloudflare API..."
  $resp = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/accounts" `
    -Headers @{ Authorization = "Bearer $env:CLOUDFLARE_API_TOKEN" }
  if (-not $resp.success -or $resp.result.Count -lt 1) {
    Write-Error "Could not list accounts. Token needs Account:Read + Cloudflare Pages:Edit."
  }
  $env:CLOUDFLARE_ACCOUNT_ID = $resp.result[0].id
  Write-Host "Using account: $($resp.result[0].name) ($($env:CLOUDFLARE_ACCOUNT_ID))"
}

if (-not (Test-Path "dist\index.html")) {
  Write-Host "Building..."
  npm run build
}

Write-Host "Deploying dist/ to Cloudflare Pages (bisync-rms-mobile)..."
npx wrangler@4 pages deploy dist --project-name=bisync-rms-mobile --branch=production

Write-Host ""
Write-Host "Next: Cloudflare dashboard -> Workers & Pages -> bisync-rms-mobile -> Custom domains"
Write-Host "      Add mobile.bisync.cloud (remove any CNAME to *.trycloudflare.com first)"
