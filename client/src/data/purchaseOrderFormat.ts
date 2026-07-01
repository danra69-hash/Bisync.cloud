import type { Company, LocationConfig, Vendor } from '../api';

const COMPANY_SKIP_WORDS = new Set(['sdn', 'bhd', 'sdn.', 'bhd.', 'co', 'ltd', 'inc', 'the', 'and', 'of']);

export function abbreviateCompanyName(name: string): string {
  const words = name
    .split(/\s+/)
    .map(w => w.trim().replace(/[.,]/g, ''))
    .filter(w => w && !COMPANY_SKIP_WORDS.has(w.toLowerCase()));
  if (words.length === 0) return 'CO';
  if (words.length === 1) return words[0].slice(0, 4).toUpperCase();
  return words.slice(0, 4).map(w => w[0]?.toUpperCase() ?? '').join('');
}

export function abbreviateLocationName(name: string, externalId: string): string {
  const id = externalId.trim();
  if (id && id.length <= 4) return id.toUpperCase();
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return words.slice(0, 3).map(w => w[0]?.toUpperCase() ?? '').join('');
  return (name || id).slice(0, 4).toUpperCase();
}

export function resolveLocationAbbreviation(
  locationExternalIds: string[],
  locations: LocationConfig[],
): string {
  if (locationExternalIds.length === 0) return 'GEN';
  if (locationExternalIds.length > 1) return 'MLT';
  const loc = locations.find(l => l.externalId === locationExternalIds[0]);
  if (!loc) return abbreviateLocationName('', locationExternalIds[0]);
  return abbreviateLocationName(loc.name, loc.externalId);
}

export function formatCompanyAddress(company: Company): string {
  return [
    company.addressLine1,
    company.addressLine2,
    [company.city, company.stateProvince, company.postcode].filter(Boolean).join(', '),
  ].filter(Boolean).join('\n');
}

export function formatLocationAddress(location: LocationConfig): string {
  return [
    location.addressLine1,
    location.addressLine2,
    [location.city, location.stateProvince, location.postcode].filter(Boolean).join(', '),
  ].filter(Boolean).join('\n');
}

export function formatVendorAddress(vendor: Vendor): string {
  return [
    vendor.address,
    [vendor.city, vendor.state].filter(Boolean).join(', '),
  ].filter(Boolean).join('\n');
}

export function formatVendorContact(vendor: Vendor): string {
  const lines = [
    vendor.contactPerson && vendor.contactPosition
      ? `${vendor.contactPerson} (${vendor.contactPosition})`
      : vendor.contactPerson,
    vendor.mobile,
    vendor.email,
  ].filter(Boolean);
  return lines.join('\n');
}

export const DEFAULT_TAX_RATE = 0;
