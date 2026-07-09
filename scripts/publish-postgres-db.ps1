# Export local PostgreSQL (Docker or localhost) and publish to GitHub / Cloud SQL.
# Usage:
#   .\scripts\publish-postgres-db.ps1
#   .\scripts\publish-postgres-db.ps1 -SkipGitHub
#   .\scripts\publish-postgres-db.ps1 -SkipCloud
#   .\scripts\publish-postgres-db.ps1 -CommitMessage "chore: sync postgres database"

param(
    [string]$ProjectId = "project-8d670aa9-f439-44d9-8e1",
    [string]$Region = "asia-southeast1",
    [string]$SqlInstance = "bisync-pg",
    [string]$DbHost = "localhost",
    [int]$DbPort = 5432,
    [string]$DbUser = "bisync",
    [string]$DbPassword = "bisync",
    [string]$Database = "bisync",
    [string]$ArchiveDatabase = "bisync_archive",
    [string]$DockerContainer = "bisync-postgres",
    [string]$CommitMessage = "chore: sync local PostgreSQL database",
    [switch]$SkipGitHub,
    [switch]$SkipCloud
)

$ErrorActionPreference = "Stop"

$Root = Split-Path $PSScriptRoot -Parent
$DbDir = Join-Path $Root "src\Bisync.Api"
$MainSqlPath = Join-Path $DbDir "bisync-postgres-latest.sql"
$ArchiveSqlPath = Join-Path $DbDir "bisync-archive-postgres-latest.sql"

function Write-Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Resolve-PgDump {
    $cmd = Get-Command pg_dump -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $candidates = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\pg_dump.exe" -ErrorAction SilentlyContinue |
        Sort-Object { $_.Directory.Parent.Name } -Descending
    if ($candidates) { return $candidates[0].FullName }

    throw "pg_dump not found. Install PostgreSQL client tools or add pg_dump to PATH."
}

function Resolve-Psql {
    $cmd = Get-Command psql -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $candidates = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\psql.exe" -ErrorAction SilentlyContinue |
        Sort-Object { $_.Directory.Parent.Name } -Descending
    if ($candidates) { return $candidates[0].FullName }

    throw "psql not found. Install PostgreSQL client tools or add psql to PATH."
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

function Export-PostgresDatabase(
    [string]$PgDump,
    [string]$TargetDatabase,
    [string]$OutputPath
) {
    $docker = Resolve-Docker
    if ($docker) {
        $running = & $docker ps --filter "name=$DockerContainer" --format "{{.Names}}" 2>$null
        if ($running -match [regex]::Escape($DockerContainer)) {
            Write-Host "Dumping $TargetDatabase via Docker container $DockerContainer..." -ForegroundColor Gray
            & $docker exec -e PGPASSWORD=$DbPassword $DockerContainer `
                pg_dump -U $DbUser -d $TargetDatabase --no-owner --no-acl `
                | Set-Content -Path $OutputPath -Encoding UTF8
            if ($LASTEXITCODE -ne 0) { throw "pg_dump failed for $TargetDatabase (docker)." }
            return
        }
    }

    Write-Host "Dumping $TargetDatabase from ${DbHost}:${DbPort}..." -ForegroundColor Gray
    $env:PGPASSWORD = $DbPassword
    & $PgDump -h $DbHost -p $DbPort -U $DbUser -d $TargetDatabase --no-owner --no-acl -f $OutputPath
    if ($LASTEXITCODE -ne 0) { throw "pg_dump failed for $TargetDatabase." }
}

function Update-PostgresArtifacts {
    Write-Step "Exporting local PostgreSQL databases"
    $dumpTool = Join-Path $Root "tools\Bisync.PostgresDump\Bisync.PostgresDump.csproj"
    if (Test-Path $dumpTool) {
        Write-Host "Using Bisync.PostgresDump (reads API connection settings)..." -ForegroundColor Gray
        Push-Location (Join-Path $Root "tools\Bisync.PostgresDump")
        try {
            dotnet run -c Release --nologo
            if ($LASTEXITCODE -ne 0) { throw "Bisync.PostgresDump failed." }
        } finally {
            Pop-Location
        }
        return
    }

    $pgDump = Resolve-PgDump
    Export-PostgresDatabase -PgDump $pgDump -TargetDatabase $Database -OutputPath $MainSqlPath
    Write-Host "Exported $MainSqlPath" -ForegroundColor Green

    try {
        Export-PostgresDatabase -PgDump $pgDump -TargetDatabase $ArchiveDatabase -OutputPath $ArchiveSqlPath
        Write-Host "Exported $ArchiveSqlPath" -ForegroundColor Green
    } catch {
        Write-Host "Skipped archive export: $($_.Exception.Message)" -ForegroundColor Yellow
        if (Test-Path $ArchiveSqlPath) { Remove-Item $ArchiveSqlPath -Force }
    }
}

function Publish-PostgresToGitHub {
    Write-Step "Publishing PostgreSQL dumps to GitHub"
    Push-Location $Root
    try {
        $files = @("src/Bisync.Api/bisync-postgres-latest.sql")
        if (Test-Path $ArchiveSqlPath) {
            $files += "src/Bisync.Api/bisync-archive-postgres-latest.sql"
        }

        git add @files
        git diff --staged --quiet
        if ($LASTEXITCODE -eq 0) {
            Write-Host "No PostgreSQL dump changes to commit." -ForegroundColor Gray
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
        Write-Host "PostgreSQL dumps pushed to GitHub ($hash)." -ForegroundColor Green
    } finally {
        Pop-Location
    }
}

function Publish-PostgresToCloud {
    Write-Step "Publishing PostgreSQL dumps to Cloud SQL"
    & (Join-Path $PSScriptRoot "sync-cloud-postgres.ps1") `
        -ProjectId $ProjectId `
        -Region $Region `
        -SqlInstance $SqlInstance `
        -MainSqlPath $MainSqlPath `
        -ArchiveSqlPath $ArchiveSqlPath
    if ($LASTEXITCODE -ne 0) { throw "Cloud SQL sync failed." }
}

Update-PostgresArtifacts

if (-not $SkipGitHub) {
    Publish-PostgresToGitHub
}

if (-not $SkipCloud) {
    Publish-PostgresToCloud
}

Write-Host ""
Write-Host "PostgreSQL publish complete." -ForegroundColor Green
Write-Host "Restore on another device: .\scripts\restore-postgres-db.ps1" -ForegroundColor Gray
