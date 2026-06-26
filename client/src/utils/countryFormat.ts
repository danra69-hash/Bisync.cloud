import { getCountry } from '../data/countries';

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
