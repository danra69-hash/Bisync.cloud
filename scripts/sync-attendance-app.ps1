# Sync BisyncRMSMobile/web → attendance-app (Clock SPA for /Attendance/app).
# Usage: .\scripts\sync-attendance-app.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$Src = Join-Path (Split-Path $Root -Parent) "BisyncRMSMobile\web"
$Dst = Join-Path $Root "attendance-app"

if (-not (Test-Path $Src)) {
    throw "Source not found: $Src"
}

if (Test-Path $Dst) {
    Remove-Item $Dst -Recurse -Force
}
New-Item -ItemType Directory -Path $Dst | Out-Null

robocopy $Src $Dst /E /XD node_modules dist .wrangler .git `
    /XF .env .env.local .env.production .env.uat `
    /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null

$envAttendance = Join-Path $Src ".env.attendance"
if (Test-Path $envAttendance) {
    Copy-Item $envAttendance (Join-Path $Dst ".env.attendance") -Force
}

Write-Host "Synced clock web → $Dst" -ForegroundColor Green
