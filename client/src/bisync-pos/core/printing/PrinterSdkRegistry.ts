/**
 * Client-side printer SDK repository mirror.
 * Server catalog (PosPrinterSdks) is authoritative; this module maps SDK codes
 * to runtime adapters used when a printer device is connected on a station.
 */

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

const ADAPTERS: PrinterSdkAdapter[] = [
  makeEscPosAdapter('generic-escpos', 'Generic', 'Generic ESC/POS', 'escpos', 9100, [58, 80, 112]),
  makeEscPosAdapter('epson-escpos', 'Epson', 'Epson ePOS / ESC/POS', 'escpos', 9100, [58, 80]),
  makeEscPosAdapter('star-linemode', 'Star Micronics', 'Star Line Mode / ESC/POS', 'star', 9100, [58, 80]),
  makeEscPosAdapter('citizen-escpos', 'Citizen', 'Citizen ESC/POS', 'escpos', 9100, [58, 80]),
  makeEscPosAdapter('bixolon-escpos', 'Bixolon', 'Bixolon ESC/POS', 'escpos', 9100, [58, 80]),
  makeEscPosAdapter('network-raw', 'Network', 'Raw TCP (port 9100)', 'raw', 9100, [58, 80, 112]),
];

const byCode = new Map(ADAPTERS.map(a => [a.sdkCode, a]));

export function listPrinterSdkAdapters(): PrinterSdkAdapter[] {
  return [...ADAPTERS];
}

export function getPrinterSdkAdapter(sdkCode: string): PrinterSdkAdapter | null {
  return byCode.get(sdkCode) ?? null;
}

/** Auto-pick an adapter when a printer is connected (brand/model hints). */
export function resolvePrinterSdkAdapter(brand?: string, model?: string): PrinterSdkAdapter {
  const hay = `${brand ?? ''} ${model ?? ''}`.trim().toLowerCase();
  if (!hay) return byCode.get('generic-escpos')!;
  for (const adapter of ADAPTERS) {
    if (hay.includes(adapter.brand.toLowerCase())) return adapter;
  }
  if (hay.includes('star')) return byCode.get('star-linemode')!;
  if (hay.includes('epson')) return byCode.get('epson-escpos')!;
  return byCode.get('generic-escpos')!;
}
