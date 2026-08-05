/**
 * Bisync ESC/POS LAN test for Windows — deposited in Dev Console Ref & Library.
 * Same ESC/POS dialect as DantSu Android, over TCP 9100 from a Windows PC on the venue LAN.
 */

export const WINDOWS_ESCPOS_SDK_CODE = 'escpos-lan-windows';

export const WINDOWS_ESCPOS_SDK_TITLE = 'ESC/POS LAN Test (Windows)';

export const WINDOWS_ESCPOS_SDK_REVISED_DATE = '5 Aug 2026';

export const WINDOWS_ESCPOS_SDK_VERSION = '1.0.0';

export const WINDOWS_ESCPOS_SDK_SUMMARY =
  'Windows package for testing ESC/POS thermal printers on the local network (TCP 9100). '
  + 'DantSu is Android-only; use this on a Windows PC on the same LAN to prove the printer works, '
  + 'then bind DantSu on the Android POS for production.';

export const WINDOWS_ESCPOS_SDK_DOWNLOAD_PATH =
  `/api/pos-devices/printer-sdks/${WINDOWS_ESCPOS_SDK_CODE}/package`;

export const WINDOWS_ESCPOS_SDK_STEPS = [
  {
    id: 'download',
    number: '1',
    title: 'Download the Windows package',
    body: 'From POS Setup → Drivers, or Download below. Saves bisync-escpos-lan-windows-windows.zip.',
  },
  {
    id: 'unzip',
    number: '2',
    title: 'Unzip on the Windows PC',
    body: 'Use a PC on the same Wi‑Fi/LAN as the printer (not guest Wi‑Fi isolation).',
  },
  {
    id: 'run',
    number: '3',
    title: 'Run the LAN test',
    body: 'Double-click Test-BisyncPrinter.cmd and enter the printer IP, or run Test-BisyncPrinter.ps1 in PowerShell.',
  },
  {
    id: 'bind',
    number: '4',
    title: 'Bind in Bisync',
    body: 'If the slip prints, register the printer in Device set up (SDK escpos-lan-windows or dantsu-escpos-android on the tablet).',
  },
] as const;
