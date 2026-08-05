/**
 * DantSu ESCPOS-ThermalPrinter-Android — deposited in Dev Console Ref & Library.
 * Authoritative package is served from /api/pos-devices/printer-sdks/dantsu-escpos-android/package
 */

export const DANTSU_PRINTER_SDK_CODE = 'dantsu-escpos-android';

export const DANTSU_PRINTER_SDK_TITLE = 'ESCPOS ThermalPrinter Android (DantSu)';

export const DANTSU_PRINTER_SDK_REVISED_DATE = '5 Aug 2026';

export const DANTSU_PRINTER_SDK_VERSION = '3.4.0';

export const DANTSU_PRINTER_SDK_SUMMARY =
  'Official Android library for ESC/POS thermal printers over Bluetooth, TCP/IP, and USB. '
  + 'This is the sole printer SDK packaged for Bisync POS. Download the install zip onto the Android device, '
  + 'then bind the driver in POS Setup.';

export const DANTSU_PRINTER_SDK_UPSTREAM =
  'https://github.com/DantSu/ESCPOS-ThermalPrinter-Android';

export const DANTSU_PRINTER_SDK_JITPACK =
  'com.github.DantSu:ESCPOS-ThermalPrinter-Android:3.4.0';

export const DANTSU_PRINTER_SDK_DOWNLOAD_PATH =
  `/api/pos-devices/printer-sdks/${DANTSU_PRINTER_SDK_CODE}/package`;

export const DANTSU_PRINTER_SDK_STEPS = [
  {
    id: 'download',
    number: '1',
    title: 'Download the Bisync package',
    body: 'From POS Setup → Drivers, or use Download below. Saves bisync-dantsu-escpos-android-android.zip (AAR, source, INSTALL.md).',
  },
  {
    id: 'unzip',
    number: '2',
    title: 'Unzip on the Android POS device',
    body: 'Open Files / Downloads on the tablet, unzip the package, and keep the AAR with INSTALL.md.',
  },
  {
    id: 'install',
    number: '3',
    title: 'Install via Gradle or offline AAR',
    body: 'Add JitPack dependency 3.4.0, or copy ESCPOS-ThermalPrinter-Android-3.4.0.aar into app/libs/.',
  },
  {
    id: 'bind',
    number: '4',
    title: 'Bind in Bisync POS',
    body: 'Register the printer with SDK code dantsu-escpos-android, Install driver, then run Test print.',
  },
] as const;
