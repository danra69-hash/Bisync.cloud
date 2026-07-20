/** Vendor type labels — Online = Cloud (PPT), Offline = Virtual (PPT). */
export type VendorKind = 'online' | 'offline';

/** Customer input levels on receive / consolidate (also used for offline delivery). */
export type VendorRatingLevel = 'satisfied' | 'acceptable' | 'poor';

export const VENDOR_RATING_LEVELS: { id: VendorRatingLevel; label: string; score: number }[] = [
  { id: 'satisfied', label: 'Satisfied', score: 100 },
  { id: 'acceptable', label: 'Acceptable', score: 80 },
  { id: 'poor', label: 'Poor', score: 50 },
];

export type RatingMood = 'green' | 'yellow' | 'red' | 'none';

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

/** Overall / category score as percent (0–100). */
export function formatOverallRating(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value.toFixed(0)}%`;
}

export function ratingLevelLabel(level: string | null | undefined): string {
  const normalized = (level ?? '').toLowerCase() === 'unsatisfied' ? 'poor' : (level ?? '');
  const found = VENDOR_RATING_LEVELS.find(l => l.id === normalized);
  return found?.label ?? '—';
}

export function moodFromAverage(value: number | null | undefined): RatingMood {
  if (value == null || !Number.isFinite(value)) return 'none';
  if (value >= 90) return 'green';
  if (value >= 70) return 'yellow';
  return 'red';
}
