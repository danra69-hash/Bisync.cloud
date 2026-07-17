# Ensure local PostgreSQL has bisync/bisync databases (Docker or native PG on port 5432).
# Usage:
#   $env:POSTGRES_SUPERUSER_PASSWORD = 'your-postgres-password'
#   .\scripts\setup-local-postgres.ps1

param(
    [string]$DbHost = "127.0.0.1",
    [int]$DbPort = 5432,
    [string]$SuperUser = "postgres",
    [string]$SuperPassword = $env:POSTGRES_SUPERUSER_PASSWORD,
    [string]$AppUser = "bisync",
    [string]$AppPassword = "bisync",
    [string]$Database = "bisync",
    [string]$ArchiveDatabase = "bisync_archive",
    [string]$AuditDatabase = "bisync_audit"
)

$ErrorActionPreference = "Stop"

function Resolve-Psql {
    $cmd = Get-Command psql -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $candidates = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\psql.exe" -ErrorAction SilentlyContinue |
        Sort-Object { $_.Directory.Parent.Name } -Descending
    if ($candidates) { return $candidates[0].FullName }

    throw "psql not found."
}

function Invoke-Psql([string]$Psql, [string]$DatabaseName, [string]$Sql) {
    $args = @("-h", $DbHost, "-p", "$DbPort", "-U", $SuperUser, "-d", $DatabaseName, "-v", "ON_ERROR_STOP=1", "-c", $Sql)
    if ($SuperPassword) { $env:PGPASSWORD = $SuperPassword }
    & $Psql @args
    if ($LASTEXITCODE -ne 0) { throw "psql command failed." }
}

$psql = Resolve-Psql

Write-Host "Ensuring role and databases for Bisync on ${DbHost}:${DbPort} ..." -ForegroundColor Cyan

Invoke-Psql -Psql $psql -DatabaseName "postgres" -Sql @"
DO `$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$AppUser') THEN
    CREATE ROLE $AppUser LOGIN PASSWORD '$AppPassword' CREATEDB;
  ELSE
    ALTER ROLE $AppUser WITH LOGIN PASSWORD '$AppPassword' CREATEDB;
  END IF;
END
`$\$;
"@

Invoke-Psql -Psql $psql -DatabaseName "postgres" -Sql "SELECT 1 FROM pg_database WHERE datname = '$Database'" | Out-Null
$dbExists = & $psql -h $DbHost -p $DbPort -U $SuperUser -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$Database'"
if ($SuperPassword) { $env:PGPASSWORD = $SuperPassword }
if (-not ($dbExists -match "1")) {
    Invoke-Psql -Psql $psql -DatabaseName "postgres" -Sql "CREATE DATABASE $Database OWNER $AppUser"
} else {
    Write-Host "Database $Database already exists." -ForegroundColor Gray
}

$archiveExists = & $psql -h $DbHost -p $DbPort -U $SuperUser -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$ArchiveDatabase'"
if (-not ($archiveExists -match "1")) {
    Invoke-Psql -Psql $psql -DatabaseName "postgres" -Sql "CREATE DATABASE $ArchiveDatabase OWNER $AppUser"
} else {
    Write-Host "Database $ArchiveDatabase already exists." -ForegroundColor Gray
}

$auditExists = & $psql -h $DbHost -p $DbPort -U $SuperUser -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$AuditDatabase'"
if (-not ($auditExists -match "1")) {
    Invoke-Psql -Psql $psql -DatabaseName "postgres" -Sql "CREATE DATABASE $AuditDatabase OWNER $AppUser"
} else {
    Write-Host "Database $AuditDatabase already exists." -ForegroundColor Gray
}

Write-Host "Local PostgreSQL ready for Bisync ($AppUser / $Database)." -ForegroundColor Green
