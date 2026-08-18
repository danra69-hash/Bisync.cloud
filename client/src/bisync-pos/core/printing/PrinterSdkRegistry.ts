/**
 * Client-side printer SDK repository mirror.
 * Server catalog (PosPrinterSdks) is authoritative — Bisync ships DantSu only.
 */

import { DANTSU_PRINTER_SDK_CODE } from '../../../data/dantsuPrinterSdk';

export type PrinterPaperWidthMm = 58 | 80 | 112;
export type PrinterAlignment = 'left' | 'center';

export type PrinterSdkAdapter = {
  sdkCode: string;
  brand: string;
  displayName: string;
  protocol: 'escpos' | 'star' | 'raw' | string;
  defaultPort: number;
  supportedPaperWidthsMm: PrinterPaperWidthMm[];
  /** Build a tiny alignment test payload (base64 ESC/POS-ish text marker). */
  buildAlignmentTest: (opts: {
    paperWidthMm: PrinterPaperWidthMm;
    alignment: PrinterAlignment;
    marginLeft: number;
    marginRight: number;
  }) => string;
};

function escposAlign(alignment: PrinterAlignment): string {
  // ESC a n — 0 left, 1 center
  return alignment === 'center' ? '\\x1Ba\\x01' : '\\x1Ba\\x00';
}

function makeEscPosAdapter(
  sdkCode: string,
  brand: string,
  displayName: string,
  protocol: string,
  defaultPort: number,
  widths: PrinterPaperWidthMm[],
): PrinterSdkAdapter {
  return {
    sdkCode,
    brand,
    displayName,
    protocol,
    defaultPort,
    supportedPaperWidthsMm: widths,
    buildAlignmentTest: ({ paperWidthMm, alignment, marginLeft, marginRight }) => {
      const lines = [
        escposAlign(alignment),
        `Bisync POS · ${displayName}`,
        `Paper ${paperWidthMm}mm · align ${alignment}`,
        `Margins L${marginLeft} R${marginRight}`,
        '------------------------',
        'Alignment check complete',
        '\\x1Bd\\x03\\x1DVA\\x00',
      ];
      return lines.join('\\n');
    },
  };
}

const DANTSU = makeEscPosAdapter(
  DANTSU_PRINTER_SDK_CODE,
  'DantSu',
  'ESCPOS ThermalPrinter Android',
  'escpos',
  9100,
  [58, 80, 112],
);

const ADAPTERS: PrinterSdkAdapter[] = [DANTSU];

const byCode = new Map(ADAPTERS.map(a => [a.sdkCode, a]));

export function listPrinterSdkAdapters(): PrinterSdkAdapter[] {
  return [...ADAPTERS];
}

export function getPrinterSdkAdapter(sdkCode: string): PrinterSdkAdapter | null {
  if (!sdkCode) return DANTSU;
  return byCode.get(sdkCode) ?? DANTSU;
}

/** Auto-pick an adapter when a printer is connected — always DantSu. */
export function resolvePrinterSdkAdapter(_brand?: string, _model?: string, _platformHint?: string): PrinterSdkAdapter {
  return DANTSU;
}
