# Bisync ESC/POS LAN test for Windows

Same ESC/POS protocol used by DantSu on Android — raw thermal commands over **TCP port 9100**.

DantSu’s library is Android-only. On Windows (same LAN as the printer), use this package to prove the printer link before binding the Android POS.

## Quick test (this PC must be on the venue Wi‑Fi / LAN)

1. Unzip this package on the Windows machine.
2. Open **PowerShell**.
3. Run (replace IP/port with your printer):

```powershell
cd path\to\escpos-lan-windows
Set-ExecutionPolicy -Scope Process Bypass
.\Test-BisyncPrinter.ps1 -HostAddress 192.168.1.50 -Port 9100
```

Optional name:

```powershell
.\Test-BisyncPrinter.ps1 -HostAddress 192.168.1.50 -Port 9100 -PrinterName "Kitchen Printer"
```

4. The printer should spit a short **Bisync POS** test slip.
5. If it times out: wrong IP, printer offline, or Windows firewall / VLAN isolation.

## Bisync POS binding

In Device set up, register the printer with:

- SDK: **`escpos-lan-windows`**
- Host: printer IP
- Port: **9100** (typical)

Cloud “Test print” from the hosted API cannot reach private LAN IPs. Use this Windows script (or an Android POS on the same LAN) for a real LAN test.

## Files

| File | Purpose |
|------|---------|
| `Test-BisyncPrinter.ps1` | Sends ESC/POS test slip over TCP |
| `Test-BisyncPrinter.cmd` | Double-click helper (prompts for IP) |
| `INSTALL.md` | This guide |
| `bisync-driver.json` | Bisync package manifest |
