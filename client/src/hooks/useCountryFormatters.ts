import { useMemo } from 'react';
import { formatCogsPercent } from '../data/productForm';
import {
  formatCountryCurrency,
  formatCountryNumber,
  formatCountryPercent,
} from '../utils/numberFormat';
import { useOrgCountryCode } from '../context/OrgCountryContext';

export function useCountryFormatters() {
  const countryCode = useOrgCountryCode();

  return useMemo(() => ({
    countryCode,
    number: (value: number) => formatCountryNumber(value, countryCode),
    currency: (value: number, symbol?: string) => formatCountryCurrency(value, countryCode, symbol),
    percent: (value: number) => formatCountryPercent(value, countryCode),
    rm: (value: number) => formatCountryCurrency(value, countryCode),
    cogsPercent: (cogs: number, rrp: number) => formatCogsPercent(cogs, rrp, countryCode),
  }), [countryCode]);
}
