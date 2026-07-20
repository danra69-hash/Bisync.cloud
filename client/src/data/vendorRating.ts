/** Vendor type labels — Online = Cloud (PPT), Offline = Virtual (PPT). */
export type VendorKind = 'online' | 'offline';

export type VendorRatingLevel = 'satisfied' | 'acceptable' | 'unsatisfied';

export const VENDOR_RATING_LEVELS: { id: VendorRatingLevel; label: string; score: number }[] = [
  { id: 'satisfied', label: 'Satisfied', score: 5 },
  { id: 'acceptable', label: 'Acceptable', score: 3 },
  { id: 'unsatisfied', label: 'Unsatisfied', score: 1 },
];

export function normalizeVendorKind(type: string | null | undefined): VendorKind {
  return (type ?? '').trim().toLowerCase() === 'online' ? 'online' : 'offline';
}

export function vendorKindLabel(type: string | null | undefined): string {
  return normalizeVendorKind(type) === 'online' ? 'Online Vendor' : 'Offline Vendor';
}

export function vendorKindHint(type: string | null | undefined): string {
  return normalizeVendorKind(type) === 'online'
    ? 'Also on Bisync Cloud (cloud vendor). Control is in the vendor\'s hands.'
    : 'Not on Bisync Cloud (virtual vendor). Control is in the operator\'s hands.';
}

export function formatOverallRating(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toFixed(1);
}

export function ratingLevelLabel(level: string | null | undefined): string {
  const found = VENDOR_RATING_LEVELS.find(l => l.id === level);
  return found?.label ?? '—';
}
