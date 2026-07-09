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

export function getCountryNumberFormat(countryCode = 'MY'): CountryNumberFormat {
  return COUNTRY_NUMBER_FORMAT[countryCode.toUpperCase()] ?? DEFAULT_FORMAT;
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
  return `${prefix} ${formatCountryNumber(value, countryCode)}`;
}

export function formatCountryPercent(value: number, countryCode = 'MY'): string {
  return `${formatCountryNumber(value, countryCode)}%`;
}
