/** Case-insensitive trimmed equality for catalog labels (Category / Group). */
export function labelsEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();
}

/**
 * Deduplicate labels case-insensitively, preferring `preferred` casing when present.
 * Keeps first-seen casing for unknown labels.
 */
export function uniqueLabelsPreferCanonical(
  values: string[],
  preferred: readonly string[] = [],
): string[] {
  const preferredByKey = new Map(
    preferred
      .map(value => value.trim())
      .filter(Boolean)
      .map(value => [value.toLowerCase(), value] as const),
  );
  const byKey = new Map<string, string>();
  for (const raw of values) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    const preferredLabel = preferredByKey.get(key);
    if (!byKey.has(key)) {
      byKey.set(key, preferredLabel ?? trimmed);
    } else if (preferredLabel) {
      byKey.set(key, preferredLabel);
    }
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b));
}
