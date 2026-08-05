# Bisync ESC/POS LAN test for Windows

Same ESC/POS protocol used by DantSu on Android — raw thermal commands over **TCP port 9100**.

DantSu’s library is Android-only. On Windows (same LAN as the printer), use this package to prove the printer link before binding the Android POS.

## Find printers on this LAN (recommended)

Browsers often **cannot see** raw ESC/POS printers. Use the Windows finder instead:

1. Unzip this package on the Windows PC (`192.168.70.x` etc.).
2. Double-click **`Find-BisyncPrinters.cmd`** (or pass your station IP).
3. Copy the JSON output (also saved as `bisync-lan-find-result.json`).
4. In Bisync → Device set up → **Import Windows scan**, paste the JSON, then **Assign / Link**.

```powershell
cd path\to\escpos-lan-windows
Set-ExecutionPolicy -Scope Process Bypass
.\Find-BisyncPrinters.ps1 -StationIp 192.168.70.131
```

## Quick test print

```powershell
.\Test-BisyncPrinter.ps1 -HostAddress 192.168.70.50 -Port 9100 -PrinterName "Kitchen Printer"
```

Or double-click **`Test-BisyncPrinter.cmd`** and enter the printer IP.

## Bisync POS binding

In Device set up → **Add printer by IP**:

- SDK: **`escpos-lan-windows`** (Windows) or **`dantsu-escpos-android`** (Android tablet)
- Host: printer IP
- Port: **9100** (typical)

Cloud “Test print” from the hosted API cannot reach private LAN IPs. Use this Windows script (or an Android POS on the same LAN) for a real LAN test.

## Files

| File | Purpose |
|------|---------|
| `Find-BisyncPrinters.ps1` / `.cmd` | TCP scan of /24 for 9100 / 8008 / 80… → JSON for Bisync import |
| `Test-BisyncPrinter.ps1` / `.cmd` | Sends ESC/POS test slip over TCP |
| `INSTALL.md` | This guide |
| `bisync-driver.json` | Bisync package manifest |
