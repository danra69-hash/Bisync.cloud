<#
.SYNOPSIS
  Send a Bisync ESC/POS test slip to a LAN thermal printer (TCP 9100).

.DESCRIPTION
  Same raw ESC/POS dialect used by the DantSu Android SDK. Run this on a Windows
  PC that is on the same network as the printer. Cloud-hosted Test print cannot
  reach private LAN addresses.

.EXAMPLE
  .\Test-BisyncPrinter.ps1 -HostAddress 192.168.1.50
  .\Test-BisyncPrinter.ps1 -HostAddress 192.168.1.50 -Port 9100 -PrinterName "Kitchen"
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$HostAddress,

  [int]$Port = 9100,

  [string]$PrinterName = "LAN Printer",

  [ValidateSet("left", "center")]
  [string]$Align = "left",

  [int]$TimeoutMs = 4000
)

$ErrorActionPreference = "Stop"

function Write-Utf8NoBom([string]$Path, [string]$Content) {
  $utf8 = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($Path, $Content, $utf8)
}

function New-EscPosTestSlip {
  param(
    [string]$Name,
    [string]$Alignment
  )

  $ms = New-Object System.IO.MemoryStream
  $ascii = [System.Text.Encoding]::ASCII

  function Add-Bytes([byte[]]$Bytes) {
    $ms.Write($Bytes, 0, $Bytes.Length)
  }
  function Add-Line([string]$Text) {
    $line = $ascii.GetBytes(($Text + "`n"))
    $ms.Write($line, 0, $line.Length)
  }

  $alignByte = if ($Alignment -eq "center") { [byte]1 } else { [byte]0 }

  Add-Bytes @(0x1B, 0x40)              # ESC @ init
  Add-Bytes @(0x1B, 0x61, $alignByte)  # alignment
  Add-Bytes @(0x1B, 0x45, 0x01)        # bold on
  Add-Line "Bisync POS"
  Add-Bytes @(0x1B, 0x45, 0x00)        # bold off
  Add-Line "Test print · ESC/POS Windows LAN"
  Add-Line ("Printer: " + $Name)
  Add-Line ("Host: " + $HostAddress + ":" + $Port)
  Add-Line ((Get-Date).ToString("yyyy-MM-dd HH:mm:ss"))
  Add-Line "------------------------"
  Add-Line "Printer link OK"
  Add-Bytes @(0x1B, 0x64, 0x04)        # feed
  Add-Bytes @(0x1D, 0x56, 0x00)        # full cut
  return $ms.ToArray()
}

Write-Host "Bisync ESC/POS LAN test" -ForegroundColor Cyan
Write-Host ("Connecting to {0}:{1} …" -f $HostAddress, $Port)

$payload = New-EscPosTestSlip -Name $PrinterName -Alignment $Align
$client = New-Object System.Net.Sockets.TcpClient
$started = Get-Date

try {
  $async = $client.BeginConnect($HostAddress, $Port, $null, $null)
  $ok = $async.AsyncWaitHandle.WaitOne($TimeoutMs, $false)
  if (-not $ok -or -not $client.Connected) {
    throw ("Timed out reaching {0}:{1}. Confirm the printer IP, that it is powered on, and that this Windows PC is on the same LAN/VLAN." -f $HostAddress, $Port)
  }
  $client.EndConnect($async) | Out-Null
  $stream = $client.GetStream()
  $stream.WriteTimeout = $TimeoutMs
  $stream.Write($payload, 0, $payload.Length)
  $stream.Flush()
  $ms = [int]((Get-Date) - $started).TotalMilliseconds
  Write-Host ("OK — sent {0} bytes in {1} ms. Check the printer for the Bisync slip." -f $payload.Length, $ms) -ForegroundColor Green
  exit 0
}
catch {
  Write-Host ("FAILED: " + $_.Exception.Message) -ForegroundColor Red
  Write-Host "Tips: ping the IP, try port 9100, disable guest Wi-Fi isolation, or test from another device on the same subnet." -ForegroundColor Yellow
  exit 1
}
finally {
  if ($client) { $client.Close() }
}
