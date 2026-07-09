# Restore PostgreSQL dumps exported by publish-postgres-db.ps1 into local Docker Postgres.
# Usage:
#   docker compose up -d
#   .\scripts\restore-postgres-db.ps1

param(
    [string]$DbHost = "localhost",
    [int]$DbPort = 5432,
    [string]$DbUser = "bisync",
    [string]$DbPassword = "bisync",
    [string]$Database = "bisync",
    [string]$ArchiveDatabase = "bisync_archive",
    [string]$DockerContainer = "bisync-postgres",
    [switch]$SkipArchive
)

$ErrorActionPreference = "Stop"

$Root = Split-Path $PSScriptRoot -Parent
$DbDir = Join-Path $Root "src\Bisync.Api"
$MainSqlPath = Join-Path $DbDir "bisync-postgres-latest.sql"
$ArchiveSqlPath = Join-Path $DbDir "bisync-archive-postgres-latest.sql"

function Resolve-Psql {
    $cmd = Get-Command psql -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $candidates = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\psql.exe" -ErrorAction SilentlyContinue |
        Sort-Object { $_.Directory.Parent.Name } -Descending
    if ($candidates) { return $candidates[0].FullName }

    throw "psql not found."
}

function Resolve-Docker {
    $cmd = Get-Command docker -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $paths = @(
        "C:\Program Files\Docker\Docker\resources\bin\docker.exe",
        "C:\Program Files\Docker\Docker\docker.exe"
    )
    foreach ($path in $paths) {
        if (Test-Path $path) { return $path }
    }

    return $null
}

function Restore-Database([string]$Psql, [string]$TargetDatabase, [string]$SqlPath) {
    if (-not (Test-Path $SqlPath)) {
        throw "Dump not found: $SqlPath"
    }

    Write-Host "Restoring $TargetDatabase from $SqlPath ..." -ForegroundColor Cyan

    $docker = Resolve-Docker
    if ($docker) {
        $running = & $docker ps --filter "name=$DockerContainer" --format "{{.Names}}" 2>$null
        if ($running -match [regex]::Escape($DockerContainer)) {
            Get-Content $SqlPath -Raw | & $docker exec -i -e PGPASSWORD=$DbPassword $DockerContainer `
                psql -U $DbUser -d $TargetDatabase -v ON_ERROR_STOP=1
            if ($LASTEXITCODE -ne 0) { throw "Restore failed for $TargetDatabase (docker)." }
            return
        }
    }

    $env:PGPASSWORD = $DbPassword
    & $Psql -h $DbHost -p $DbPort -U $DbUser -d $TargetDatabase -v ON_ERROR_STOP=1 -f $SqlPath
    if ($LASTEXITCODE -ne 0) { throw "Restore failed for $TargetDatabase." }
}

if (-not (Test-Path $MainSqlPath)) {
    throw "Missing $MainSqlPath. Run .\scripts\publish-postgres-db.ps1 on the source machine first."
}

$psql = Resolve-Psql
Restore-Database -Psql $psql -TargetDatabase $Database -SqlPath $MainSqlPath

if (-not $SkipArchive -and (Test-Path $ArchiveSqlPath)) {
    Restore-Database -Psql $psql -TargetDatabase $ArchiveDatabase -SqlPath $ArchiveSqlPath
}

Write-Host "PostgreSQL restore complete." -ForegroundColor Green
