import { getCountry, getCitiesForState } from '../data/countries';
import { lookupLocalityFromPostcode } from '../data/countryPostcodes';

export type LocalityParts = {
  city: string;
  state: string;
  postcode: string;
};

export const emptyLocalityParts = (): LocalityParts => ({
  city: '',
  state: '',
  postcode: '',
});

export type AddressParts = {
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateProvince: string;
  postcode: string;
};

export const emptyAddressParts = (): AddressParts => ({
  addressLine1: '',
  addressLine2: '',
  city: '',
  stateProvince: '',
  postcode: '',
});

export function validatePhone(countryCode: string, value: string, label = 'Phone number'): string | null {
  const trimmed = value.trim();
  if (!trimmed) return `${label} is required.`;
  const country = getCountry(countryCode);
  if (!trimmed.startsWith(country.dialCode)) {
    return `${label} must start with ${country.dialCode} (${country.name}).`;
  }
  if (!country.phoneRegex.test(trimmed)) {
    return `${label} must match ${country.name} format, e.g. ${country.phonePlaceholder}.`;
  }
  return null;
}

export function validateOptionalPhone(countryCode: string, value: string, label = 'Phone number'): string | null {
  if (!value.trim()) return null;
  return validatePhone(countryCode, value, label);
}

export function validatePostcode(countryCode: string, value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return 'Postcode is required.';
  const country = getCountry(countryCode);
  if (!country.postcodeRegex.test(trimmed)) {
    return `${country.postcodeLabel} must match ${country.name} format, e.g. ${country.postcodePlaceholder}.`;
  }
  return null;
}

export function validateOptionalPostcode(countryCode: string, value: string): string | null {
  if (!value.trim()) return null;
  return validatePostcode(countryCode, value);
}

export function hasAddressContent(parts: AddressParts): boolean {
  return Object.values(parts).some(v => v.trim().length > 0);
}

export function validateAddress(countryCode: string, parts: AddressParts): string | null {
  if (!hasAddressContent(parts)) return null;

  const country = getCountry(countryCode);
  if (!parts.addressLine1.trim()) return 'Address line 1 is required.';
  if (!parts.city.trim()) return `${country.cityLabel} is required.`;
  if (!parts.stateProvince.trim()) return `${country.stateLabel} is required.`;

  const postcodeError = validatePostcode(countryCode, parts.postcode);
  if (postcodeError) return postcodeError;

  return null;
}

export function formatAddress(parts: AddressParts): string {
  const lines = [parts.addressLine1.trim(), parts.addressLine2.trim()].filter(Boolean);
  const locality = [parts.city.trim(), parts.stateProvince.trim()].filter(Boolean).join(', ');
  const tail = [locality, parts.postcode.trim()].filter(Boolean).join(' ');
  if (tail) lines.push(tail);
  return lines.join('\n');
}

export function getCitySuggestions(countryCode: string, state: string, extra: string[] = []): string[] {
  const base = getCitiesForState(countryCode, state);
  return [...new Set([...base, ...extra.map(v => v.trim()).filter(Boolean)])].sort((a, b) => a.localeCompare(b));
}

export function autofillLocalityFromPostcode(
  countryCode: string,
  postcode: string,
  current: LocalityParts,
): LocalityParts {
  const hint = lookupLocalityFromPostcode(countryCode, postcode);
  if (!hint.city && !hint.state) return current;
  return {
    city: current.city.trim() || hint.city || current.city,
    state: current.state.trim() || hint.state || current.state,
    postcode: current.postcode,
  };
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function ensureDialCodePrefix(countryCode: string, value: string): string {
  const country = getCountry(countryCode);
  const trimmed = value.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('+')) {
    return `+${digitsOnly(trimmed)}`;
  }

  let local = digitsOnly(trimmed);
  const dialDigits = digitsOnly(country.dialCode);

  if (local.startsWith(dialDigits)) {
    return `+${local}`;
  }

  if (local.startsWith('0')) {
    local = local.slice(1);
  }

  return `${country.dialCode} ${local}`;
}

function chunkDigits(digits: string, sizes: number[]): string {
  const parts: string[] = [];
  let offset = 0;
  for (const size of sizes) {
    if (offset >= digits.length) break;
    parts.push(digits.slice(offset, offset + size));
    offset += size;
  }
  if (offset < digits.length) parts.push(digits.slice(offset));
  return parts.join(' ');
}

function formatMalaysiaPhone(value: string): string {
  const digits = digitsOnly(value);
  const local = digits.startsWith('60') ? digits.slice(2) : digits;
  if (!local) return '+60 ';

  if (local.startsWith('1')) {
    const mobile = local.slice(0, Math.min(local.length, 10));
    if (mobile.length <= 2) return `+60 ${mobile}`;
    if (mobile.length <= 5) return `+60 ${mobile.slice(0, 2)}-${mobile.slice(2)}`;
    return `+60 ${mobile.slice(0, 2)}-${mobile.slice(2, 5)} ${mobile.slice(5)}`;
  }

  const area = local[0];
  const rest = local.slice(1);
  if (!rest) return `+60 ${area}`;
  if (rest.length <= 4) return `+60 ${area}-${rest}`;
  return `+60 ${area}-${rest.slice(0, 4)} ${rest.slice(4)}`;
}

function formatSingaporePhone(value: string): string {
  const digits = digitsOnly(value);
  const local = digits.startsWith('65') ? digits.slice(2) : digits;
  if (!local) return '+65 ';
  return `+65 ${chunkDigits(local, [4, 4])}`.trim();
}

function formatAustraliaPhone(value: string): string {
  const digits = digitsOnly(value);
  const local = digits.startsWith('61') ? digits.slice(2) : digits;
  if (!local) return '+61 ';
  if (local.startsWith('4')) {
    return `+61 ${chunkDigits(local, [1, 3, 3, 3])}`.trim();
  }
  return `+61 ${chunkDigits(local, [1, 4, 4])}`.trim();
}

function formatUkPhone(value: string): string {
  const digits = digitsOnly(value);
  const local = digits.startsWith('44') ? digits.slice(2) : digits;
  if (!local) return '+44 ';
  if (local.startsWith('7')) {
    return `+44 ${chunkDigits(local, [4, 6])}`.trim();
  }
  return `+44 ${chunkDigits(local, [2, 4, 4])}`.trim();
}

function formatUsPhone(value: string): string {
  const digits = digitsOnly(value);
  const local = digits.startsWith('1') ? digits.slice(1) : digits;
  if (!local) return '+1 ';
  const area = local.slice(0, 3);
  const prefix = local.slice(3, 6);
  const line = local.slice(6, 10);
  if (local.length <= 3) return `+1 (${area}`;
  if (local.length <= 6) return `+1 (${area}) ${prefix}`;
  return `+1 (${area}) ${prefix}-${line}`;
}

export function formatPhoneInput(countryCode: string, value: string): string {
  const withPrefix = ensureDialCodePrefix(countryCode, value);
  if (!withPrefix) return '';

  switch (countryCode) {
    case 'MY':
      return formatMalaysiaPhone(withPrefix);
    case 'SG':
      return formatSingaporePhone(withPrefix);
    case 'AU':
      return formatAustraliaPhone(withPrefix);
    case 'GB':
      return formatUkPhone(withPrefix);
    case 'US':
      return formatUsPhone(withPrefix);
    default:
      return withPrefix;
  }
}

export function formatPostcodeInput(countryCode: string, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  switch (countryCode) {
    case 'MY':
    case 'SG':
    case 'AU':
      return digitsOnly(trimmed).slice(0, countryCode === 'AU' ? 4 : countryCode === 'SG' ? 6 : 5);
    case 'US': {
      const digits = digitsOnly(trimmed).slice(0, 9);
      if (digits.length <= 5) return digits;
      return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    }
    case 'GB': {
      const compact = trimmed.replace(/\s+/g, '').toUpperCase();
      if (compact.length <= 4) return compact;
      return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
    }
    default:
      return trimmed;
  }
}

export function parseAddress(value: string | null | undefined): AddressParts {
  if (!value?.trim()) return emptyAddressParts();

  const lines = value.split('\n').map(line => line.trim()).filter(Boolean);
  if (lines.length === 1) {
    return { ...emptyAddressParts(), addressLine1: lines[0] };
  }

  const lastLine = lines[lines.length - 1];
  const postcodeMatch = lastLine.match(/^(.+?)[\s,]+([A-Z0-9][A-Z0-9\s-]{2,})$/i);
  if (postcodeMatch) {
    const locality = postcodeMatch[1];
    const postcode = postcodeMatch[2].trim();
    const [city, ...stateParts] = locality.split(',').map(part => part.trim()).filter(Boolean);
    return {
      addressLine1: lines[0],
      addressLine2: lines.length > 2 ? lines.slice(1, -1).join(', ') : '',
      city: city ?? '',
      stateProvince: stateParts.join(', '),
      postcode,
    };
  }

  return {
    addressLine1: lines[0],
    addressLine2: lines.slice(1).join(', '),
    city: '',
    stateProvince: '',
    postcode: '',
  };
}
