# Publish the local SQLite database to GitHub and/or Cloud Run GCS.
# Usage:
#   .\scripts\publish-local-db.ps1
#   .\scripts\publish-local-db.ps1 -SkipGitHub
#   .\scripts\publish-local-db.ps1 -SkipCloud

param(
    [string]$ProjectId = "project-8d670aa9-f439-44d9-8e1",
    [string]$Region = "asia-southeast1",
    [string]$ServiceName = "bisync-cloud",
    [string]$CommitMessage = "chore: sync local database",
    [switch]$SkipGitHub,
    [switch]$SkipCloud
)

$ErrorActionPreference = "Stop"

$Root = Split-Path $PSScriptRoot -Parent
$DbDir = Join-Path $Root "src\Bisync.Api"
$DbPath = Join-Path $DbDir "bisync.db"
$LatestDbPath = Join-Path $DbDir "bisync-latest.db"
$LatestSqlPath = Join-Path $DbDir "bisync-latest.sql"

function Write-Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Checkpoint-SqliteDatabase([string]$Path) {
    $walPath = "$Path-wal"
    if (-not (Test-Path $walPath)) {
        return
    }

    $sqlite3 = Get-Command sqlite3 -ErrorAction SilentlyContinue
    if ($null -eq $sqlite3) {
        Write-Host "Warning: $walPath exists and sqlite3 is not on PATH. Stop the API before publishing for a consistent copy." -ForegroundColor Yellow
        return
    }

    Write-Host "Checkpointing WAL into $Path..." -ForegroundColor Gray
    & $sqlite3.Source $Path "PRAGMA wal_checkpoint(FULL);"
    if ($LASTEXITCODE -ne 0) {
        throw "SQLite WAL checkpoint failed."
    }
}

function Update-DatabaseArtifacts {
    if (-not (Test-Path $DbPath)) {
        throw "Database not found at $DbPath"
    }

    Write-Step "Refreshing local database artifacts"
    Checkpoint-SqliteDatabase $DbPath

    Copy-Item $DbPath $LatestDbPath -Force
    Write-Host "Copied bisync.db -> bisync-latest.db" -ForegroundColor Green

    $sqlite3 = Get-Command sqlite3 -ErrorAction SilentlyContinue
    if ($null -ne $sqlite3) {
        & $sqlite3.Source $DbPath ".dump" | Set-Content -Path $LatestSqlPath -Encoding UTF8
        Write-Host "Exported bisync-latest.sql" -ForegroundColor Green
    } else {
        Write-Host "Skipped bisync-latest.sql export (sqlite3 not on PATH)." -ForegroundColor Yellow
    }
}

function Publish-DatabaseToGitHub {
    Write-Step "Publishing database to GitHub"
    Push-Location $Root
    try {
        $files = @(
            "src/Bisync.Api/bisync.db",
            "src/Bisync.Api/bisync-latest.db"
        )
        if (Test-Path $LatestSqlPath) {
            $files += "src/Bisync.Api/bisync-latest.sql"
        }

        git add @files
        git diff --staged --quiet
        if ($LASTEXITCODE -eq 0) {
            Write-Host "No database changes to commit." -ForegroundColor Gray
            $status = git status -sb
            if ($status -match "ahead") {
                Write-Host "Pushing existing commits..." -ForegroundColor Gray
                git push origin HEAD
                if ($LASTEXITCODE -ne 0) { throw "git push failed." }
            }
            return
        }

        git commit -m $CommitMessage
        if ($LASTEXITCODE -ne 0) { throw "git commit failed." }

        git push origin HEAD
        if ($LASTEXITCODE -ne 0) { throw "git push failed." }

        $hash = git rev-parse --short HEAD
        Write-Host "Database pushed to GitHub ($hash)." -ForegroundColor Green
    } finally {
        Pop-Location
    }
}

function Publish-DatabaseToCloud {
    Write-Step "Publishing database to Cloud Run"
    & (Join-Path $PSScriptRoot "sync-cloud-db.ps1") `
        -ProjectId $ProjectId `
        -Region $Region `
        -ServiceName $ServiceName `
        -DbPath $DbPath
    if ($LASTEXITCODE -ne 0) { throw "Cloud database sync failed." }
}

Update-DatabaseArtifacts

if (-not $SkipGitHub) {
    Publish-DatabaseToGitHub
}

if (-not $SkipCloud) {
    Publish-DatabaseToCloud
}

Write-Host ""
Write-Host "Local database publish complete." -ForegroundColor Green
