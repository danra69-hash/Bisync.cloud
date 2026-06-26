export type CountryConfig = {
  code: string;
  name: string;
  dialCode: string;
  states: string[];
  postcodeLabel: string;
  postcodePlaceholder: string;
  phonePlaceholder: string;
  faxPlaceholder: string;
  cityLabel: string;
  stateLabel: string;
  phoneRegex: RegExp;
  postcodeRegex: RegExp;
};

export const COUNTRIES: CountryConfig[] = [
  {
    code: 'MY',
    name: 'Malaysia',
    dialCode: '+60',
    states: ['Wilayah Persekutuan', 'Selangor', 'Penang', 'Johor', 'Sabah', 'Sarawak', 'Perak', 'Melaka'],
    postcodeLabel: 'Postcode',
    postcodePlaceholder: 'e.g. 50250',
    phonePlaceholder: '+60 3-2145 6789',
    faxPlaceholder: '+60 3-2145 6790',
    cityLabel: 'City',
    stateLabel: 'State',
    phoneRegex: /^\+60[\s-]?(?:\d[\s-]?){8,11}$/,
    postcodeRegex: /^\d{5}$/,
  },
  {
    code: 'SG',
    name: 'Singapore',
    dialCode: '+65',
    states: ['Singapore'],
    postcodeLabel: 'Postal Code',
    postcodePlaceholder: 'e.g. 018956',
    phonePlaceholder: '+65 6123 4567',
    faxPlaceholder: '+65 6123 4568',
    cityLabel: 'District',
    stateLabel: 'Region',
    phoneRegex: /^\+65[\s-]?(?:\d[\s-]?){8}$/,
    postcodeRegex: /^\d{6}$/,
  },
  {
    code: 'AU',
    name: 'Australia',
    dialCode: '+61',
    states: ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'],
    postcodeLabel: 'Postcode',
    postcodePlaceholder: 'e.g. 2000',
    phonePlaceholder: '+61 2 9123 4567',
    faxPlaceholder: '+61 2 9123 4568',
    cityLabel: 'Suburb',
    stateLabel: 'State',
    phoneRegex: /^\+61[\s-]?(?:\d[\s-]?){8,9}$/,
    postcodeRegex: /^\d{4}$/,
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    dialCode: '+44',
    states: ['England', 'Scotland', 'Wales', 'Northern Ireland'],
    postcodeLabel: 'Postcode',
    postcodePlaceholder: 'e.g. SW1A 1AA',
    phonePlaceholder: '+44 20 7123 4567',
    faxPlaceholder: '+44 20 7123 4568',
    cityLabel: 'Town / City',
    stateLabel: 'County',
    phoneRegex: /^\+44[\s-]?(?:\d[\s-]?){9,10}$/,
    postcodeRegex: /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i,
  },
  {
    code: 'US',
    name: 'United States',
    dialCode: '+1',
    states: ['CA', 'NY', 'TX', 'FL', 'IL', 'WA', 'MA', 'NV'],
    postcodeLabel: 'ZIP Code',
    postcodePlaceholder: 'e.g. 10001',
    phonePlaceholder: '+1 (212) 555-0100',
    faxPlaceholder: '+1 (212) 555-0101',
    cityLabel: 'City',
    stateLabel: 'State',
    phoneRegex: /^\+1[\s-]?(?:\(\s*\d{3}\s*\)|\d{3})[\s-]?\d{3}[\s-]?\d{4}$/,
    postcodeRegex: /^\d{5}(-\d{4})?$/,
  },
];

export function getCountry(code: string): CountryConfig {
  return COUNTRIES.find(c => c.code === code) ?? COUNTRIES[0];
}

export const inputCls = 'bg-background border border-border rounded-md px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full';
export const selectCls = `${inputCls} cursor-pointer`;
