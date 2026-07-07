export type SortDirection = 'asc' | 'desc';

export type SortValue = string | number | boolean | null | undefined;

export type SortAccessor<T> = (row: T) => SortValue;

export function compareSortValues(a: SortValue, b: SortValue): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return String(a).localeCompare(String(b), undefined, { sensitivity: 'base', numeric: true });
}

export function sortTableRows<T, K extends string>(
  rows: T[],
  sortColumn: K | null,
  sortDirection: SortDirection,
  accessors: Partial<Record<K, SortAccessor<T>>>,
  options?: {
    compare?: Partial<Record<K, (a: T, b: T) => number>>;
    tieBreaker?: (a: T, b: T) => number;
  },
): T[] {
  if (!sortColumn) return rows;

  // Ascending on first click; sortDirection flips to desc on second click (see useTableSort).
  const direction = sortDirection === 'asc' ? 1 : -1;
  const compound = options?.compare?.[sortColumn];
  const accessor = accessors[sortColumn];

  return [...rows].sort((a, b) => {
    let cmp = 0;
    if (compound) cmp = compound(a, b);
    else if (accessor) cmp = compareSortValues(accessor(a), accessor(b));
    if (cmp === 0 && options?.tieBreaker) cmp = options.tieBreaker(a, b);
    return cmp * direction;
  });
}
