import { useMemo } from 'react';
import { formatCogsPercent } from '../data/productForm';
import {
  formatCompactCurrency,
  formatCountryCurrency,
  formatCountryNumber,
  formatCountryPercent,
  getCurrencyCode,
  getCurrencySymbol,
} from '../utils/numberFormat';
import { useOrgCountryCode } from '../context/OrgCountryContext';

export function useCountryFormatters() {
  const countryCode = useOrgCountryCode();

  return useMemo(() => ({
    countryCode,
    /** Display symbol for the selected company's setup country. */
    symbol: getCurrencySymbol(countryCode),
    /** ISO 4217 code for the selected company's setup country. */
    currencyCode: getCurrencyCode(countryCode),
    number: (value: number) => formatCountryNumber(value, countryCode),
    currency: (value: number, symbol?: string) => formatCountryCurrency(value, countryCode, symbol),
    compact: (value: number) => formatCompactCurrency(value, countryCode),
    percent: (value: number) => formatCountryPercent(value, countryCode),
    /** Alias kept for call sites that historically used Malaysian RM formatting. */
    rm: (value: number) => formatCountryCurrency(value, countryCode),
    cogsPercent: (cogs: number, rrp: number) => formatCogsPercent(cogs, rrp, countryCode),
  }), [countryCode]);
}
