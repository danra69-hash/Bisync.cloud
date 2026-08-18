export type CountryNumberFormat = {
  decimals: number;
  zeroDecimals: number;
};

const DEFAULT_FORMAT: CountryNumberFormat = {
  decimals: 2,
  zeroDecimals: 2,
};

const COUNTRY_NUMBER_FORMAT: Record<string, CountryNumberFormat> = {
  MY: { decimals: 2, zeroDecimals: 4 },
};

/** ISO 4217 currency codes keyed by company setup country. */
const COUNTRY_CURRENCY_CODE: Record<string, string> = {
  MY: 'MYR',
  SG: 'SGD',
  AU: 'AUD',
  GB: 'GBP',
  UK: 'GBP',
  US: 'USD',
  ID: 'IDR',
  TH: 'THB',
  VN: 'VND',
  PH: 'PHP',
  JP: 'JPY',
  KR: 'KRW',
  CN: 'CNY',
  HK: 'HKD',
  TW: 'TWD',
  NZ: 'NZD',
  FR: 'EUR',
  DE: 'EUR',
  IT: 'EUR',
  ES: 'EUR',
  CA: 'CAD',
  AE: 'AED',
  IN: 'INR',
};

const COUNTRY_CURRENCY_SYMBOL: Record<string, string> = {
  MY: 'RM',
  SG: 'S$',
  AU: 'A$',
  GB: '£',
  UK: '£',
  US: '$',
  ID: 'Rp',
  TH: '฿',
  VN: '₫',
  PH: '₱',
  JP: '¥',
  KR: '₩',
  CN: '¥',
  HK: 'HK$',
  TW: 'NT$',
  NZ: 'NZ$',
  FR: '€',
  DE: '€',
  IT: '€',
  ES: '€',
  CA: 'C$',
  AE: 'AED',
  IN: '₹',
};

function normalizeCountryCode(countryCode = 'MY'): string {
  const code = (countryCode || 'MY').trim().toUpperCase();
  return code || 'MY';
}

export function getCountryNumberFormat(countryCode = 'MY'): CountryNumberFormat {
  return COUNTRY_NUMBER_FORMAT[normalizeCountryCode(countryCode)] ?? DEFAULT_FORMAT;
}

/** True when value rounds to 0 at the country's standard decimal places. */
export function isCountryZero(value: number, countryCode = 'MY'): boolean {
  if (!Number.isFinite(value)) return true;
  const { decimals } = getCountryNumberFormat(countryCode);
  return Number(value.toFixed(decimals)) === 0;
}

/**
 * Malaysia: non-zero values use 2 decimals (0.00); zero values use 4 decimals (0.0000).
 * Other countries: 2 decimals for all values.
 */
export function formatCountryNumber(value: number, countryCode = 'MY'): string {
  if (!Number.isFinite(value)) {
    const { zeroDecimals } = getCountryNumberFormat(countryCode);
    return (0).toFixed(zeroDecimals);
  }

  const { decimals, zeroDecimals } = getCountryNumberFormat(countryCode);

  if (isCountryZero(value, countryCode)) {
    return value.toFixed(zeroDecimals);
  }

  return value.toFixed(decimals);
}

/** Display symbol for the company setup country (e.g. MY→RM, SG→S$, GB→£). */
export function getCurrencySymbol(countryCode = 'MY'): string {
  const code = normalizeCountryCode(countryCode);
  return COUNTRY_CURRENCY_SYMBOL[code] ?? 'RM';
}

/** ISO 4217 code for the company setup country (e.g. MY→MYR, SG→SGD). */
export function getCurrencyCode(countryCode = 'MY'): string {
  const code = normalizeCountryCode(countryCode);
  return COUNTRY_CURRENCY_CODE[code] ?? 'MYR';
}

export function formatCountryCurrency(
  value: number,
  countryCode = 'MY',
  symbol?: string,
): string {
  const prefix = symbol ?? getCurrencySymbol(countryCode);
  return `${prefix} ${formatCountryNumber(value, countryCode)}`;
}

/** Default principal Component UOM unit-price decimals (platform setting may override). */
export const PRINCIPAL_UOM_PRICE_DECIMALS = 4;
/** Default alternate Component UOM unit-price decimals. */
export const ALTERNATE_UOM_PRICE_DECIMALS = 2;
/** Default vendor delivery unit-price decimals. */
export const VENDOR_DELIVERY_PRICE_DECIMALS = 2;

export type PriceDisplayDecimals = {
  principalUomPriceDecimals: number;
  alternateUomPriceDecimals: number;
  vendorDeliveryPriceDecimals: number;
};

const DEFAULT_PRICE_DISPLAY: PriceDisplayDecimals = {
  principalUomPriceDecimals: PRINCIPAL_UOM_PRICE_DECIMALS,
  alternateUomPriceDecimals: ALTERNATE_UOM_PRICE_DECIMALS,
  vendorDeliveryPriceDecimals: VENDOR_DELIVERY_PRICE_DECIMALS,
};

let priceDisplayDecimals: PriceDisplayDecimals = { ...DEFAULT_PRICE_DISPLAY };

function clampDecimals(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(6, Math.max(0, Math.round(value)));
}

/** Apply platform price-display settings (loaded from API). */
export function setPriceDisplayDecimals(next: Partial<PriceDisplayDecimals> | null | undefined) {
  priceDisplayDecimals = {
    principalUomPriceDecimals: clampDecimals(
      next?.principalUomPriceDecimals ?? DEFAULT_PRICE_DISPLAY.principalUomPriceDecimals,
      PRINCIPAL_UOM_PRICE_DECIMALS,
    ),
    alternateUomPriceDecimals: clampDecimals(
      next?.alternateUomPriceDecimals ?? DEFAULT_PRICE_DISPLAY.alternateUomPriceDecimals,
      ALTERNATE_UOM_PRICE_DECIMALS,
    ),
    vendorDeliveryPriceDecimals: clampDecimals(
      next?.vendorDeliveryPriceDecimals ?? DEFAULT_PRICE_DISPLAY.vendorDeliveryPriceDecimals,
      VENDOR_DELIVERY_PRICE_DECIMALS,
    ),
  };
}

export function getPriceDisplayDecimals(): PriceDisplayDecimals {
  return priceDisplayDecimals;
}

export function formatFixedDecimals(value: number, decimals: number): string {
  const places = clampDecimals(decimals, 2);
  if (!Number.isFinite(value)) return (0).toFixed(places);
  return value.toFixed(places);
}

export function formatPrincipalUomPriceNumber(value: number): string {
  return formatFixedDecimals(value, priceDisplayDecimals.principalUomPriceDecimals);
}

export function formatAlternateUomPriceNumber(value: number): string {
  return formatFixedDecimals(value, priceDisplayDecimals.alternateUomPriceDecimals);
}

export function formatVendorDeliveryPriceNumber(value: number): string {
  return formatFixedDecimals(value, priceDisplayDecimals.vendorDeliveryPriceDecimals);
}

/**
 * Currency display for Principal Component Unit price (and stock UOM price).
 * Default 4 decimal places so values like 0.0330 are not collapsed to 0.03.
 */
export function formatPrincipalUomPrice(
  value: number,
  countryCode = 'MY',
  symbol?: string,
): string {
  const prefix = symbol ?? getCurrencySymbol(countryCode);
  return `${prefix} ${formatPrincipalUomPriceNumber(value)}`;
}

/** Currency display for alternate / non-principal Component UOM prices (default 2 dp). */
export function formatAlternateUomPrice(
  value: number,
  countryCode = 'MY',
  symbol?: string,
): string {
  const prefix = symbol ?? getCurrencySymbol(countryCode);
  return `${prefix} ${formatAlternateUomPriceNumber(value)}`;
}

/** Currency display for Vendor Delivery unit price (default 2 dp). */
export function formatVendorDeliveryPrice(
  value: number,
  countryCode = 'MY',
  symbol?: string,
): string {
  const prefix = symbol ?? getCurrencySymbol(countryCode);
  return `${prefix} ${formatVendorDeliveryPriceNumber(value)}`;
}

/** Pick principal vs alternate Component UOM price formatting. */
export function formatComponentUomPrice(
  value: number,
  isPrincipal: boolean,
  countryCode = 'MY',
  symbol?: string,
): string {
  return isPrincipal
    ? formatPrincipalUomPrice(value, countryCode, symbol)
    : formatAlternateUomPrice(value, countryCode, symbol);
}

/** Compact money for dashboard KPIs (e.g. RM 1.2k, S$ 2.50M). */
export function formatCompactCurrency(value: number, countryCode = 'MY'): string {
  const symbol = getCurrencySymbol(countryCode);
  if (!Number.isFinite(value)) return `${symbol} 0`;
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${symbol} ${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${symbol} ${(value / 1_000).toFixed(1)}k`;
  return `${symbol} ${value.toFixed(0)}`;
}

export function formatCountryPercent(value: number, countryCode = 'MY'): string {
  return `${formatCountryNumber(value, countryCode)}%`;
}
