/**
 * Platform number rules (all countries / modules):
 *
 * - Database / storage: always 4 decimal places (0.0000). The 5th decimal is
 *   rounded half-away-from-zero (MidpointRounding.AwayFromZero).
 * - Display: default 2 decimals; include the 3rd digit only when it is non-zero;
 *   include the 4th digit only when it is non-zero.
 * - Number inputs: sized for at least 4 integer digits + 4 decimal digits (9999.9999).
 */

export const PLATFORM_DECIMAL_SCALE = 4;
export const PLATFORM_DISPLAY_MIN_DECIMALS = 2;
export const PLATFORM_NUMBER_INPUT_STEP = 0.0001;

/** Shared props for `<input type="number">` quantity / price fields. */
export const PLATFORM_NUMBER_INPUT_PROPS = {
  step: PLATFORM_NUMBER_INPUT_STEP,
  inputMode: 'decimal' as const,
};

export type CountryNumberFormat = {
  decimals: number;
  zeroDecimals: number;
};

/** @deprecated Prefer PLATFORM_* constants — kept for callers that still read country format metadata. */
const DEFAULT_FORMAT: CountryNumberFormat = {
  decimals: PLATFORM_DISPLAY_MIN_DECIMALS,
  zeroDecimals: PLATFORM_DISPLAY_MIN_DECIMALS,
};

export function getCountryNumberFormat(_countryCode = 'MY'): CountryNumberFormat {
  return DEFAULT_FORMAT;
}

/**
 * Round to 4 decimal places for DB / API payloads (5th digit AwayFromZero).
 * Matches `Bisync.Api.Services.DecimalRounding.ToDb`.
 */
export function roundToDbDecimal(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** PLATFORM_DECIMAL_SCALE;
  const shifted = value * factor;
  const rounded = shifted >= 0
    ? Math.floor(shifted + 0.5)
    : Math.ceil(shifted - 0.5);
  return rounded / factor;
}

/**
 * Platform display: 2 decimals by default; show 3rd/4th only when those digits are non-zero.
 * Always rounds to 4dp first so display matches stored precision.
 *
 * Examples: 1.2 → "1.20"; 1.234 → "1.234"; 1.2345 → "1.2345"; 1.2300 → "1.23"; 0 → "0.00"
 */
export function formatPlatformNumber(value: number): string {
  if (!Number.isFinite(value)) return (0).toFixed(PLATFORM_DISPLAY_MIN_DECIMALS);

  const rounded = roundToDbDecimal(value);
  const sign = rounded < 0 ? '-' : '';
  const abs = Math.abs(rounded);
  const fixed4 = abs.toFixed(PLATFORM_DECIMAL_SCALE);
  const dec = fixed4.split('.')[1] ?? '0000';

  let decimals = PLATFORM_DISPLAY_MIN_DECIMALS;
  if (dec[3] !== '0') decimals = 4;
  else if (dec[2] !== '0') decimals = 3;

  return `${sign}${abs.toFixed(decimals)}`;
}

/** True when value rounds to zero at DB precision (4dp). */
export function isCountryZero(value: number, _countryCode = 'MY'): boolean {
  if (!Number.isFinite(value)) return true;
  return roundToDbDecimal(value) === 0;
}

/**
 * Format a number for on-platform display (smart 2–4 decimals).
 * `countryCode` is retained for call-site compatibility; display rules are platform-wide.
 */
export function formatCountryNumber(value: number, _countryCode = 'MY'): string {
  return formatPlatformNumber(value);
}

export function getCurrencySymbol(countryCode = 'MY'): string {
  switch (countryCode.toUpperCase()) {
    case 'SG':
      return 'S$';
    case 'AU':
      return 'A$';
    case 'US':
      return '$';
    case 'MY':
    default:
      return 'RM';
  }
}

export function formatCountryCurrency(
  value: number,
  countryCode = 'MY',
  symbol?: string,
): string {
  const prefix = symbol ?? getCurrencySymbol(countryCode);
  return `${prefix} ${formatPlatformNumber(value)}`;
}

export function formatCountryPercent(value: number, _countryCode = 'MY'): string {
  return `${formatPlatformNumber(value)}%`;
}

/** Parse a raw input string and round to DB precision. Returns null when empty/invalid. */
export function parsePlatformNumber(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? roundToDbDecimal(raw) : null;
  }
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return roundToDbDecimal(parsed);
}

/** Normalize an editable number field on blur: round to 4dp, keep full precision string for editing. */
export function normalizeNumberInputValue(raw: string): string {
  const parsed = parsePlatformNumber(raw);
  if (parsed == null) return '';
  return parsed.toFixed(PLATFORM_DECIMAL_SCALE);
}
