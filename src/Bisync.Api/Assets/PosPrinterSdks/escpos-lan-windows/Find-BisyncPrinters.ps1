<#
.SYNOPSIS
  Find ESC/POS / POS devices on the local Windows LAN via real TCP connects.

.DESCRIPTION
  Browsers cannot reliably see raw printers on TCP 9100. This script scans a /24
  with System.Net.Sockets.TcpClient (works on Windows PowerShell 5.1+) and prints
  JSON that Bisync Device set up can import.

.EXAMPLE
  .\Find-BisyncPrinters.ps1
  .\Find-BisyncPrinters.ps1 -StationIp 192.168.70.131
#>
[CmdletBinding()]
param(
  [string]$StationIp = "",

  [int[]]$Ports = @(9100, 9101, 8008, 80, 631),

  [int]$TimeoutMs = 300,

  [int]$Concurrency = 40,

  [switch]$Quiet
)

$ErrorActionPreference = "Stop"

function Get-LocalIpv4 {
  $candidates = New-Object System.Collections.Generic.List[string]
  try {
    Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
      Where-Object {
        $_.IPAddress -notlike "127.*" -and (
          $_.IPAddress -like "10.*" -or
          $_.IPAddress -like "192.168.*" -or
          ($_.IPAddress -match '^172\.(1[6-9]|2[0-9]|3[0-1])\.')
        )
      } |
      ForEach-Object { [void]$candidates.Add($_.IPAddress) }
  } catch { }

  if ($candidates.Count -eq 0) {
    foreach ($line in (ipconfig)) {
      if ($line -match 'IPv4 Address[.\s]*:\s*((?:10|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d+\.\d+)') {
        [void]$candidates.Add($Matches[1])
      }
    }
  }
  return @($candidates | Select-Object -Unique)
}

function Get-SubnetHosts([string]$Ip) {
  $parts = $Ip.Trim().Split('.')
  if ($parts.Count -ne 4) { throw "Invalid station IP: $Ip" }
  $prefix = "{0}.{1}.{2}" -f $parts[0], $parts[1], $parts[2]
  $hosts = New-Object System.Collections.Generic.List[string]
  for ($i = 1; $i -le 254; $i++) {
    [void]$hosts.Add(("{0}.{1}" -f $prefix, $i))
  }
  return @{
    Prefix = $prefix
    Cidr = "$prefix.0/24"
    Hosts = $hosts.ToArray()
  }
}

function Test-TcpOpen([string]$HostAddress, [int]$Port, [int]$WaitMs) {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $async = $client.BeginConnect($HostAddress, $Port, $null, $null)
    $ok = $async.AsyncWaitHandle.WaitOne($WaitMs, $false)
    if (-not $ok) { return $false }
    $client.EndConnect($async) | Out-Null
    return $true
  } catch {
    return $false
  } finally {
    try { $client.Close() } catch {}
  }
}

if (-not $StationIp) {
  $locals = @(Get-LocalIpv4)
  if ($locals.Count -eq 0) {
    throw "Could not detect a private IPv4 on this PC. Pass -StationIp 192.168.x.x"
  }
  $StationIp = $locals[0]
  if (-not $Quiet) {
    Write-Host ("Using station IP {0}" -f $StationIp) -ForegroundColor Cyan
    if ($locals.Count -gt 1) {
      Write-Host ("Other NICs: {0}" -f ($locals -join ", ")) -ForegroundColor DarkGray
    }
  }
}

$subnet = Get-SubnetHosts -Ip $StationIp
$found = New-Object System.Collections.Generic.List[object]
$started = Get-Date
$total = $subnet.Hosts.Count
$done = 0

if (-not $Quiet) {
  Write-Host ("Scanning {0} for ports {1} …" -f $subnet.Cidr, ($Ports -join ",")) -ForegroundColor Cyan
}

# Runspace pool works on Windows PowerShell 5.1 (no PS7 ForEach-Object -Parallel required).
$pool = [runspacefactory]::CreateRunspacePool(1, [Math]::Max(1, $Concurrency))
$pool.Open()
$jobs = @()

$script = {
  param($HostAddress, $Ports, $TimeoutMs, $StationIp)
  function Test-TcpOpen([string]$HostAddress, [int]$Port, [int]$WaitMs) {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
      $async = $client.BeginConnect($HostAddress, $Port, $null, $null)
      $ok = $async.AsyncWaitHandle.WaitOne($WaitMs, $false)
      if (-not $ok) { return $false }
      $client.EndConnect($async) | Out-Null
      return $true
    } catch {
      return $false
    } finally {
      try { $client.Close() } catch {}
    }
  }
  $open = New-Object System.Collections.Generic.List[int]
  foreach ($port in $Ports) {
    if (Test-TcpOpen -HostAddress $HostAddress -Port $port -WaitMs $TimeoutMs) {
      [void]$open.Add($port)
    }
  }
  if ($open.Count -eq 0) { return $null }
  $suggested = if ($open.Contains(9100) -or $open.Contains(9101) -or $open.Contains(8008) -or $open.Contains(631)) {
    "printer"
  } elseif ($open.Contains(80)) {
    "kitchenDisplay"
  } else {
    "posOrderStation"
  }
  return [pscustomobject]@{
    host = $HostAddress
    openPorts = @($open.ToArray())
    suggestedDeviceType = $suggested
    isStation = ($HostAddress -eq $StationIp)
  }
}

foreach ($hostAddress in $subnet.Hosts) {
  $ps = [powershell]::Create().AddScript($script).AddArgument($hostAddress).AddArgument($Ports).AddArgument($TimeoutMs).AddArgument($StationIp)
  $ps.RunspacePool = $pool
  $jobs += [pscustomobject]@{ Pipe = $ps; Handle = $ps.BeginInvoke() }
}

foreach ($job in $jobs) {
  $row = $job.Pipe.EndInvoke($job.Handle)
  $job.Pipe.Dispose()
  $done++
  if (-not $Quiet -and ($done % 25 -eq 0 -or $done -eq $total)) {
    Write-Host ("  … {0}/{1}" -f $done, $total) -ForegroundColor DarkGray
  }
  if ($null -ne $row) {
    foreach ($item in @($row)) {
      if ($null -ne $item) { [void]$found.Add($item) }
    }
  }
}

$pool.Close()
$pool.Dispose()

$hosts = @($found | Sort-Object {
  if ($_.isStation) { "0" } elseif ($_.suggestedDeviceType -eq "printer") { "1" } else { "2" }
}, host)

$durationMs = [int]((Get-Date) - $started).TotalMilliseconds
$result = [pscustomobject]@{
  source = "bisync-find-printers"
  stationIp = $StationIp
  subnetCidr = $subnet.Cidr
  scannedHosts = $total
  durationMs = $durationMs
  hosts = $hosts
}

$json = $result | ConvertTo-Json -Depth 6
Write-Output $json

$outPath = Join-Path $PSScriptRoot "bisync-lan-find-result.json"
$utf8 = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($outPath, $json, $utf8)

if (-not $Quiet) {
  Write-Host ""
  Write-Host ("Found {0} host(s) in {1} ms" -f $hosts.Count, $durationMs) -ForegroundColor Green
  Write-Host ("Saved: {0}" -f $outPath) -ForegroundColor DarkGray
  Write-Host "Copy the JSON above (or open the .json file) and paste into Bisync Device set up → Import Windows scan." -ForegroundColor Yellow
}
