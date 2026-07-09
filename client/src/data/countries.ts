export type CountryConfig = {
  code: string;
  name: string;
  dialCode: string;
  states: string[];
  citiesByState: Record<string, string[]>;
  postcodeLabel: string;
  postcodePlaceholder: string;
  phonePlaceholder: string;
  faxPlaceholder: string;
  cityLabel: string;
  stateLabel: string;
  phoneRegex: RegExp;
  postcodeRegex: RegExp;
};

const MY_CITIES: Record<string, string[]> = {
  'Wilayah Persekutuan': ['Kuala Lumpur', 'Putrajaya', 'Labuan'],
  Selangor: ['Shah Alam', 'Petaling Jaya', 'Subang Jaya', 'Klang', 'Kajang', 'Ampang', 'Puchong', 'Cyberjaya'],
  'Pulau Pinang': ['George Town', 'Butterworth', 'Bukit Mertajam', 'Bayan Lepas'],
  Johor: ['Johor Bahru', 'Iskandar Puteri', 'Kluang', 'Muar', 'Batu Pahat'],
  Sabah: ['Kota Kinabalu', 'Sandakan', 'Tawau', 'Lahad Datu'],
  Sarawak: ['Kuching', 'Miri', 'Sibu', 'Bintulu'],
  Perak: ['Ipoh', 'Taiping', 'Teluk Intan', 'Kampar'],
  Melaka: ['Melaka', 'Alor Gajah', 'Jasin'],
  'Negeri Sembilan': ['Seremban', 'Port Dickson', 'Nilai'],
  Kedah: ['Alor Setar', 'Sungai Petani', 'Kulim', 'Langkawi'],
  Kelantan: ['Kota Bharu', 'Pasir Mas', 'Tanah Merah'],
  Terengganu: ['Kuala Terengganu', 'Kemaman', 'Dungun'],
  Pahang: ['Kuantan', 'Temerloh', 'Bentong', 'Raub'],
  Perlis: ['Kangar', 'Arau'],
};

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

const US_CITIES: Record<string, string[]> = {
  CA: ['Los Angeles', 'San Francisco', 'San Diego', 'San Jose', 'Sacramento'],
  NY: ['New York', 'Buffalo', 'Rochester', 'Albany'],
  TX: ['Houston', 'Dallas', 'Austin', 'San Antonio', 'Fort Worth'],
  FL: ['Miami', 'Orlando', 'Tampa', 'Jacksonville'],
  IL: ['Chicago', 'Springfield', 'Naperville'],
  WA: ['Seattle', 'Spokane', 'Tacoma'],
  MA: ['Boston', 'Cambridge', 'Worcester'],
  NV: ['Las Vegas', 'Reno', 'Henderson'],
};

export const COUNTRIES: CountryConfig[] = [
  {
    code: 'MY',
    name: 'Malaysia',
    dialCode: '+60',
    states: Object.keys(MY_CITIES),
    citiesByState: MY_CITIES,
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
    citiesByState: {
      Singapore: [
        'Orchard', 'Marina Bay', 'Jurong East', 'Jurong West', 'Tampines',
        'Bedok', 'Woodlands', 'Ang Mo Kio', 'Toa Payoh', 'Changi',
      ],
    },
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
    citiesByState: {
      NSW: ['Sydney', 'Newcastle', 'Wollongong', 'Parramatta'],
      VIC: ['Melbourne', 'Geelong', 'Ballarat', 'Bendigo'],
      QLD: ['Brisbane', 'Gold Coast', 'Cairns', 'Townsville'],
      WA: ['Perth', 'Fremantle', 'Mandurah'],
      SA: ['Adelaide', 'Mount Gambier'],
      TAS: ['Hobart', 'Launceston'],
      ACT: ['Canberra'],
      NT: ['Darwin', 'Alice Springs'],
    },
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
    citiesByState: {
      England: ['London', 'Manchester', 'Birmingham', 'Leeds', 'Liverpool', 'Bristol'],
      Scotland: ['Edinburgh', 'Glasgow', 'Aberdeen', 'Dundee'],
      Wales: ['Cardiff', 'Swansea', 'Newport'],
      'Northern Ireland': ['Belfast', 'Derry'],
    },
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
    states: US_STATES,
    citiesByState: US_CITIES,
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

export function getCitiesForState(countryCode: string, state: string): string[] {
  const country = getCountry(countryCode);
  if (!state.trim()) {
    return [...new Set(Object.values(country.citiesByState).flat())].sort((a, b) => a.localeCompare(b));
  }
  return country.citiesByState[state] ?? [];
}

export const inputCls = 'bg-background border border-border rounded-md px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full';
export const selectCls = `${inputCls} cursor-pointer`;
