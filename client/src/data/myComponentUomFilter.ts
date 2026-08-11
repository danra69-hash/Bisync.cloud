/**
 * My Component list: UOM filter is positional (Principal + Alternate 1–5).
 * Selecting Alternate N shows that slot when filled; otherwise the highest
 * filled alternate ≤ N; otherwise Principal.
 */

export type UomFilterMode = 'principal' | 'alt-1' | 'alt-2' | 'alt-3' | 'alt-4' | 'alt-5';

export const UOM_FILTER_OPTIONS: { value: UomFilterMode; label: string }[] = [
  { value: 'principal', label: 'Principal Component UOM' },
  { value: 'alt-1', label: 'Alternate UOM 1' },
  { value: 'alt-2', label: 'Alternate UOM 2' },
  { value: 'alt-3', label: 'Alternate UOM 3' },
  { value: 'alt-4', label: 'Alternate UOM 4' },
  { value: 'alt-5', label: 'Alternate UOM 5' },
];

/** Filled alternate slots from a length-5 (or shorter) unit list. */
export function listFilledAlternateSlots(
  altUnits: Array<string | null | undefined>,
): { index: number; unit: string }[] {
  const filled: { index: number; unit: string }[] = [];
  for (let i = 1; i <= 5; i++) {
    const unit = String(altUnits[i - 1] ?? '').trim();
    if (unit) filled.push({ index: i, unit });
  }
  return filled;
}

/**
 * Resolve display UOM for a filter mode.
 * @param principal Principal component UOM
 * @param altUnits Alternate slots 1–5 (index 0 = Alternate UOM 1)
 */
export function resolveDisplayUomForFilter(
  principal: string,
  altUnits: Array<string | null | undefined>,
  mode: UomFilterMode,
): string {
  const principalUnit = (principal || '').trim();
  if (mode === 'principal') return principalUnit;

  const match = /^alt-([1-5])$/.exec(mode);
  if (!match) return principalUnit;

  const requested = Number(match[1]);
  const filled = listFilledAlternateSlots(altUnits);
  if (filled.length === 0) return principalUnit;

  const exact = filled.find(entry => entry.index === requested);
  if (exact) return exact.unit;

  // Fall back to highest filled alternate at or below the requested slot.
  const le = filled.filter(entry => entry.index <= requested);
  if (le.length > 0) return le[le.length - 1].unit;

  // No alternate at or below requested → principal (do not jump to a higher slot).
  return principalUnit;
}
