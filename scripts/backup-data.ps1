# Backs up the local Bisync SQLite database (all app data).
# Output: data-backups/bisync-YYYYMMDD-HHMMSS/

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not (Test-Path "$root\src\Bisync.Api")) {
    $root = Split-Path -Parent $PSScriptRoot
}

$dbDir = Join-Path $root "src\Bisync.Api"
$backupRoot = Join-Path $root "data-backups"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$dest = Join-Path $backupRoot "bisync-$stamp"

New-Item -ItemType Directory -Force -Path $dest | Out-Null

$files = @("bisync.db", "bisync.db-wal", "bisync.db-shm")
$copied = @()
foreach ($name in $files) {
    $src = Join-Path $dbDir $name
    if (Test-Path $src) {
        Copy-Item $src (Join-Path $dest $name) -Force
        $copied += $name
    }
}

if ($copied.Count -eq 0) {
    Remove-Item $dest -Recurse -Force
    Write-Error "No database found at $dbDir\bisync.db"
}

$commit = ""
Push-Location $root
try { $commit = (git rev-parse --short HEAD 2>$null) } catch { }
Pop-Location

$manifest = @{
    createdAt = (Get-Date).ToString("o")
    sourceDir = $dbDir
    files = $copied
    gitCommit = $commit
    note = "Restore by copying bisync.db into src/Bisync.Api/ (stop API first)."
}
$manifest | ConvertTo-Json | Set-Content (Join-Path $dest "backup-info.json") -Encoding UTF8

Write-Host "Backup saved to: $dest"
Write-Host "Files: $($copied -join ', ')"
