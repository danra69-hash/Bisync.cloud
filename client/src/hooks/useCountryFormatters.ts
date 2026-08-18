import { useMemo } from 'react';
import { formatCogsPercent } from '../data/productForm';
import {
  formatAlternateUomPrice,
  formatCompactCurrency,
  formatComponentUomPrice,
  formatCountryCurrency,
  formatCountryNumber,
  formatCountryPercent,
  formatPrincipalUomPrice,
  formatVendorDeliveryPrice,
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
    /** Principal Component / stock UOM unit price — default 4 decimal places. */
    uomPrice: (value: number, symbol?: string) => formatPrincipalUomPrice(value, countryCode, symbol),
    /** Alternate / non-principal Component UOM unit price — default 2 decimal places. */
    altUomPrice: (value: number, symbol?: string) => formatAlternateUomPrice(value, countryCode, symbol),
    /** Vendor Delivery unit price — default 2 decimal places. */
    deliveryPrice: (value: number, symbol?: string) => formatVendorDeliveryPrice(value, countryCode, symbol),
    /** Principal vs alternate Component UOM price formatting. */
    componentUomPrice: (value: number, isPrincipal: boolean, symbol?: string) =>
      formatComponentUomPrice(value, isPrincipal, countryCode, symbol),
    cogsPercent: (cogs: number, rrp: number) => formatCogsPercent(cogs, rrp, countryCode),
  }), [countryCode]);
}
