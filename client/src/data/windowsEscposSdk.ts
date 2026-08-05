/**
 * Bisync ESC/POS LAN test for Windows — deposited in Dev Console Ref & Library.
 * Same ESC/POS dialect as DantSu Android, over TCP 9100 from a Windows PC on the venue LAN.
 */

export const WINDOWS_ESCPOS_SDK_CODE = 'escpos-lan-windows';

export const WINDOWS_ESCPOS_SDK_TITLE = 'ESC/POS LAN Test (Windows)';

export const WINDOWS_ESCPOS_SDK_REVISED_DATE = '5 Aug 2026';

export const WINDOWS_ESCPOS_SDK_VERSION = '1.1.0';

export const WINDOWS_ESCPOS_SDK_SUMMARY =
  'Windows package to find ESC/POS printers on the LAN (real TCP scan) and send a test slip over port 9100. '
  + 'Browsers often cannot see raw printers — run Find-BisyncPrinters on the venue PC, paste JSON into Device set up, '
  + 'then bind DantSu on the Android POS for production.';

export const WINDOWS_ESCPOS_SDK_DOWNLOAD_PATH =
  `/api/pos-devices/printer-sdks/${WINDOWS_ESCPOS_SDK_CODE}/package`;

export const WINDOWS_ESCPOS_SDK_STEPS = [
  {
    id: 'download',
    number: '1',
    title: 'Download the Windows package',
    body: 'From POS Setup → Drivers / Device set up. Saves bisync-escpos-lan-windows-windows.zip.',
  },
  {
    id: 'find',
    number: '2',
    title: 'Find printers on the LAN',
    body: 'Unzip on the venue Windows PC. Run Find-BisyncPrinters.cmd (enter Station IP e.g. 192.168.70.131). Copy the JSON.',
  },
  {
    id: 'import',
    number: '3',
    title: 'Import into Device set up',
    body: 'Paste the JSON under Import Windows scan, then Link / Assign each printer. Or use Add printer by IP if you already know the address.',
  },
  {
    id: 'test',
    number: '4',
    title: 'Optional test slip',
    body: 'Run Test-BisyncPrinter.cmd with the printer IP to confirm ESC/POS over TCP 9100.',
  },
] as const;
