/** Postcode → locality hints used for city/state autofill on blur. */

export type LocalityHint = {
  city?: string;
  state?: string;
};

const MY_POSTCODE_RANGES: Array<{ min: number; max: number; state: string; city?: string }> = [
  { min: 5, max: 9, state: 'Kedah', city: 'Alor Setar' },
  { min: 10, max: 14, state: 'Wilayah Persekutuan', city: 'Kuala Lumpur' },
  { min: 15, max: 16, state: 'Wilayah Persekutuan', city: 'Putrajaya' },
  { min: 20, max: 21, state: 'Kelantan', city: 'Kota Bharu' },
  { min: 22, max: 24, state: 'Terengganu', city: 'Kuala Terengganu' },
  { min: 25, max: 28, state: 'Pahang', city: 'Kuantan' },
  { min: 30, max: 36, state: 'Perak', city: 'Ipoh' },
  { min: 40, max: 48, state: 'Selangor', city: 'Shah Alam' },
  { min: 50, max: 60, state: 'Wilayah Persekutuan', city: 'Kuala Lumpur' },
  { min: 62, max: 62, state: 'Wilayah Persekutuan', city: 'Putrajaya' },
  { min: 63, max: 69, state: 'Selangor', city: 'Petaling Jaya' },
  { min: 70, max: 73, state: 'Negeri Sembilan', city: 'Seremban' },
  { min: 75, max: 78, state: 'Melaka', city: 'Melaka' },
  { min: 80, max: 86, state: 'Johor', city: 'Johor Bahru' },
  { min: 87, max: 87, state: 'Wilayah Persekutuan', city: 'Labuan' },
  { min: 88, max: 91, state: 'Sabah', city: 'Kota Kinabalu' },
  { min: 93, max: 98, state: 'Sarawak', city: 'Kuching' },
];

const MY_EXACT_POSTCODES: Record<string, LocalityHint> = {
  '50000': { city: 'Kuala Lumpur', state: 'Wilayah Persekutuan' },
  '50050': { city: 'Kuala Lumpur', state: 'Wilayah Persekutuan' },
  '50250': { city: 'Kuala Lumpur', state: 'Wilayah Persekutuan' },
  '47500': { city: 'Subang Jaya', state: 'Selangor' },
  '47300': { city: 'Petaling Jaya', state: 'Selangor' },
  '40000': { city: 'Shah Alam', state: 'Selangor' },
  '43000': { city: 'Kajang', state: 'Selangor' },
  '80000': { city: 'Johor Bahru', state: 'Johor' },
  '81100': { city: 'Johor Bahru', state: 'Johor' },
  '30000': { city: 'Ipoh', state: 'Perak' },
  '10000': { city: 'George Town', state: 'Pulau Pinang' },
  '10200': { city: 'George Town', state: 'Pulau Pinang' },
  '14000': { city: 'Bukit Mertajam', state: 'Pulau Pinang' },
  '62000': { city: 'Putrajaya', state: 'Wilayah Persekutuan' },
  '87000': { city: 'Labuan', state: 'Wilayah Persekutuan' },
};

const SG_DISTRICTS: Record<string, LocalityHint> = {
  '01': { city: 'Raffles Place', state: 'Singapore' },
  '02': { city: 'Tanjong Pagar', state: 'Singapore' },
  '03': { city: 'Queenstown', state: 'Singapore' },
  '04': { city: 'Harbourfront', state: 'Singapore' },
  '05': { city: 'Outram', state: 'Singapore' },
  '06': { city: 'City Hall', state: 'Singapore' },
  '07': { city: 'Beach Road', state: 'Singapore' },
  '08': { city: 'Farrer Park', state: 'Singapore' },
  '09': { city: 'Orchard', state: 'Singapore' },
  '10': { city: 'Tanglin', state: 'Singapore' },
  '11': { city: 'Newton', state: 'Singapore' },
  '12': { city: 'Toa Payoh', state: 'Singapore' },
  '13': { city: 'Macpherson', state: 'Singapore' },
  '14': { city: 'Geylang', state: 'Singapore' },
  '15': { city: 'Katong', state: 'Singapore' },
  '16': { city: 'Bedok', state: 'Singapore' },
  '17': { city: 'Changi', state: 'Singapore' },
  '18': { city: 'Tampines', state: 'Singapore' },
  '19': { city: 'Hougang', state: 'Singapore' },
  '20': { city: 'Bishan', state: 'Singapore' },
  '21': { city: 'Upper Bukit Timah', state: 'Singapore' },
  '22': { city: 'Jurong East', state: 'Singapore' },
  '23': { city: 'Bukit Panjang', state: 'Singapore' },
  '24': { city: 'Lim Chu Kang', state: 'Singapore' },
  '25': { city: 'Woodlands', state: 'Singapore' },
  '26': { city: 'Mandai', state: 'Singapore' },
  '27': { city: 'Yishun', state: 'Singapore' },
  '28': { city: 'Seletar', state: 'Singapore' },
  '29': { city: 'Serangoon', state: 'Singapore' },
  '30': { city: 'Punggol', state: 'Singapore' },
  '31': { city: 'Punggol', state: 'Singapore' },
  '32': { city: 'Punggol', state: 'Singapore' },
  '33': { city: 'Punggol', state: 'Singapore' },
  '34': { city: 'Punggol', state: 'Singapore' },
  '35': { city: 'Punggol', state: 'Singapore' },
  '36': { city: 'Punggol', state: 'Singapore' },
  '37': { city: 'Punggol', state: 'Singapore' },
  '38': { city: 'Punggol', state: 'Singapore' },
  '39': { city: 'Punggol', state: 'Singapore' },
  '40': { city: 'Serangoon', state: 'Singapore' },
  '41': { city: 'Serangoon', state: 'Singapore' },
  '42': { city: 'Serangoon', state: 'Singapore' },
  '43': { city: 'Serangoon', state: 'Singapore' },
  '44': { city: 'Serangoon', state: 'Singapore' },
  '45': { city: 'Serangoon', state: 'Singapore' },
  '46': { city: 'Serangoon', state: 'Singapore' },
  '47': { city: 'Serangoon', state: 'Singapore' },
  '48': { city: 'Serangoon', state: 'Singapore' },
  '49': { city: 'Serangoon', state: 'Singapore' },
  '50': { city: 'Bukit Timah', state: 'Singapore' },
  '51': { city: 'Bukit Timah', state: 'Singapore' },
  '52': { city: 'Bukit Timah', state: 'Singapore' },
  '53': { city: 'Bukit Timah', state: 'Singapore' },
  '54': { city: 'Bukit Timah', state: 'Singapore' },
  '55': { city: 'Bukit Timah', state: 'Singapore' },
  '56': { city: 'Bukit Timah', state: 'Singapore' },
  '57': { city: 'Bukit Timah', state: 'Singapore' },
  '58': { city: 'Bukit Timah', state: 'Singapore' },
  '59': { city: 'Bukit Timah', state: 'Singapore' },
  '60': { city: 'Jurong West', state: 'Singapore' },
  '61': { city: 'Jurong West', state: 'Singapore' },
  '62': { city: 'Jurong West', state: 'Singapore' },
  '63': { city: 'Jurong West', state: 'Singapore' },
  '64': { city: 'Jurong West', state: 'Singapore' },
  '65': { city: 'Jurong West', state: 'Singapore' },
  '66': { city: 'Jurong West', state: 'Singapore' },
  '67': { city: 'Jurong West', state: 'Singapore' },
  '68': { city: 'Jurong West', state: 'Singapore' },
  '69': { city: 'Jurong West', state: 'Singapore' },
  '70': { city: 'Jurong East', state: 'Singapore' },
  '71': { city: 'Jurong East', state: 'Singapore' },
  '72': { city: 'Jurong East', state: 'Singapore' },
  '73': { city: 'Jurong East', state: 'Singapore' },
  '74': { city: 'Jurong East', state: 'Singapore' },
  '75': { city: 'Jurong East', state: 'Singapore' },
  '76': { city: 'Jurong East', state: 'Singapore' },
  '77': { city: 'Jurong East', state: 'Singapore' },
  '78': { city: 'Jurong East', state: 'Singapore' },
  '79': { city: 'Jurong East', state: 'Singapore' },
  '80': { city: 'Sentosa', state: 'Singapore' },
  '81': { city: 'Sentosa', state: 'Singapore' },
  '82': { city: 'Sentosa', state: 'Singapore' },
  '83': { city: 'Sentosa', state: 'Singapore' },
  '84': { city: 'Sentosa', state: 'Singapore' },
  '85': { city: 'Sentosa', state: 'Singapore' },
  '86': { city: 'Sentosa', state: 'Singapore' },
  '87': { city: 'Sentosa', state: 'Singapore' },
  '88': { city: 'Sentosa', state: 'Singapore' },
  '89': { city: 'Sentosa', state: 'Singapore' },
  '90': { city: 'Changi', state: 'Singapore' },
  '91': { city: 'Changi', state: 'Singapore' },
  '92': { city: 'Changi', state: 'Singapore' },
  '93': { city: 'Changi', state: 'Singapore' },
  '94': { city: 'Changi', state: 'Singapore' },
  '95': { city: 'Changi', state: 'Singapore' },
  '96': { city: 'Changi', state: 'Singapore' },
  '97': { city: 'Changi', state: 'Singapore' },
  '98': { city: 'Changi', state: 'Singapore' },
  '99': { city: 'Changi', state: 'Singapore' },
};

const AU_POSTCODE_STATE: Array<{ min: number; max: number; state: string }> = [
  { min: 200, max: 299, state: 'NSW' },
  { min: 2600, max: 2618, state: 'ACT' },
  { min: 2900, max: 2920, state: 'ACT' },
  { min: 300, max: 399, state: 'VIC' },
  { min: 400, max: 499, state: 'QLD' },
  { min: 500, max: 599, state: 'SA' },
  { min: 600, max: 699, state: 'WA' },
  { min: 700, max: 799, state: 'TAS' },
  { min: 800, max: 899, state: 'NT' },
];

const US_ZIP_STATE: Record<string, string> = {
  '10': 'NY', '11': 'NY', '12': 'NY', '13': 'NY', '14': 'NY',
  '90': 'CA', '91': 'CA', '92': 'CA', '93': 'CA', '94': 'CA', '95': 'CA', '96': 'CA',
  '60': 'IL', '61': 'IL', '62': 'IL',
  '75': 'TX', '76': 'TX', '77': 'TX', '78': 'TX', '79': 'TX',
  '33': 'FL', '34': 'FL',
  '98': 'WA', '99': 'WA',
  '02': 'MA', '01': 'MA',
  '89': 'NV',
};

function lookupMalaysiaPostcode(postcode: string): LocalityHint {
  const exact = MY_EXACT_POSTCODES[postcode];
  if (exact) return exact;

  const prefix = parseInt(postcode.slice(0, 2), 10);
  const range = MY_POSTCODE_RANGES.find(r => prefix >= r.min && prefix <= r.max);
  if (!range) return {};
  return { state: range.state, city: range.city };
}

function lookupSingaporePostcode(postcode: string): LocalityHint {
  const district = postcode.slice(0, 2);
  return SG_DISTRICTS[district] ?? { state: 'Singapore' };
}

function lookupAustraliaPostcode(postcode: string): LocalityHint {
  const value = parseInt(postcode, 10);
  const range = AU_POSTCODE_STATE.find(r => value >= r.min && value <= r.max);
  return range ? { state: range.state } : {};
}

function lookupUsPostcode(postcode: string): LocalityHint {
  const prefix = postcode.slice(0, 2);
  const state = US_ZIP_STATE[prefix];
  return state ? { state } : {};
}

function lookupUkPostcode(postcode: string): LocalityHint {
  const outward = postcode.replace(/\s+/g, '').slice(0, -3).toUpperCase();
  const area = outward.match(/^[A-Z]+/)?.[0] ?? '';
  const regionByArea: Record<string, string> = {
    E: 'England', EC: 'England', N: 'England', NW: 'England', SE: 'England', SW: 'England', W: 'England', WC: 'England',
    B: 'England', M: 'England', L: 'England', S: 'England', LS: 'England',
    G: 'Scotland', EH: 'Scotland', AB: 'Scotland',
    CF: 'Wales', SA: 'Wales',
    BT: 'Northern Ireland',
  };
  for (const key of Object.keys(regionByArea).sort((a, b) => b.length - a.length)) {
    if (outward.startsWith(key)) return { state: regionByArea[key] };
  }
  return area ? { state: 'England' } : {};
}

export function lookupLocalityFromPostcode(countryCode: string, postcode: string): LocalityHint {
  const trimmed = postcode.trim();
  if (!trimmed) return {};

  switch (countryCode) {
    case 'MY': {
      const digits = trimmed.replace(/\D/g, '');
      if (digits.length !== 5) return {};
      return lookupMalaysiaPostcode(digits);
    }
    case 'SG': {
      const digits = trimmed.replace(/\D/g, '');
      if (digits.length !== 6) return {};
      return lookupSingaporePostcode(digits);
    }
    case 'AU': {
      const digits = trimmed.replace(/\D/g, '');
      if (digits.length !== 4) return {};
      return lookupAustraliaPostcode(digits);
    }
    case 'US': {
      const digits = trimmed.replace(/\D/g, '').slice(0, 5);
      if (digits.length < 5) return {};
      return lookupUsPostcode(digits);
    }
    case 'GB': {
      if (!/^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i.test(trimmed)) return {};
      return lookupUkPostcode(trimmed);
    }
    default:
      return {};
  }
}
