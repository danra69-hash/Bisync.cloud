/** Shared similar-name matching for Products and Components (duplicate prevention). */

export type CatalogNameCandidate = {
  id?: number;
  name: string;
  active: boolean;
  /** Product ID / Component ID shown in the notice. */
  code?: string;
  /** Optional type label (Product, Sub-Product, Alias, Component). */
  kindLabel?: string;
};

export type SimilarNameMatch = CatalogNameCandidate & {
  kind: 'exact' | 'similar';
  score: number;
};

/** Normalize for comparison: lowercase, collapse punctuation/spaces. */
export function normalizeCatalogNameKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(key: string): string[] {
  return key.split(' ').filter(token => token.length >= 2);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

function similarityScore(inputKey: string, candidateKey: string): { kind: 'exact' | 'similar'; score: number } | null {
  if (!inputKey || !candidateKey) return null;
  if (inputKey === candidateKey) return { kind: 'exact', score: 1 };

  const shorter = inputKey.length <= candidateKey.length ? inputKey : candidateKey;
  const longer = inputKey.length <= candidateKey.length ? candidateKey : inputKey;

  // Containment (e.g. "brown gravy" vs "base brown gravy")
  if (shorter.length >= 4 && longer.includes(shorter)) {
    return { kind: 'similar', score: 0.85 + (shorter.length / longer.length) * 0.1 };
  }

  const inputTokens = tokenize(inputKey);
  const candidateTokens = tokenize(candidateKey);
  if (inputTokens.length > 0 && candidateTokens.length > 0) {
    const candidateSet = new Set(candidateTokens);
    const overlap = inputTokens.filter(token => candidateSet.has(token)).length;
    const ratio = overlap / Math.max(inputTokens.length, candidateTokens.length);
    if (overlap >= 2 && ratio >= 0.6) {
      return { kind: 'similar', score: 0.55 + ratio * 0.3 };
    }
    // Single long shared token
    if (overlap === 1 && inputTokens.some(t => t.length >= 5 && candidateSet.has(t))) {
      return { kind: 'similar', score: 0.5 };
    }
  }

  const maxLen = Math.max(inputKey.length, candidateKey.length);
  if (maxLen >= 4) {
    const distance = levenshtein(inputKey, candidateKey);
    const relative = distance / maxLen;
    if (distance <= 2 || relative <= 0.22) {
      return { kind: 'similar', score: Math.max(0.4, 1 - relative) };
    }
  }

  return null;
}

/**
 * Find exact and similar catalog names. Exact matches first, then similar by score.
 * Dedupes by id+name so alias + principal for the same product can both appear.
 */
export function findSimilarCatalogNames(
  input: string,
  candidates: CatalogNameCandidate[],
  options?: { excludeId?: number; limit?: number; minInputLength?: number },
): SimilarNameMatch[] {
  const minLen = options?.minInputLength ?? 3;
  const limit = options?.limit ?? 8;
  const inputKey = normalizeCatalogNameKey(input);
  if (inputKey.length < minLen) return [];

  const matches: SimilarNameMatch[] = [];
  for (const candidate of candidates) {
    if (options?.excludeId != null && candidate.id === options.excludeId) continue;
    const candidateKey = normalizeCatalogNameKey(candidate.name);
    const hit = similarityScore(inputKey, candidateKey);
    if (!hit) continue;
    matches.push({ ...candidate, kind: hit.kind, score: hit.score });
  }

  matches.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'exact' ? -1 : 1;
    if (b.score !== a.score) return b.score - a.score;
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  // Prefer one row per catalog id (keep best match), unless names differ materially.
  const seen = new Set<string>();
  const deduped: SimilarNameMatch[] = [];
  for (const match of matches) {
    const key = `${match.id ?? 'x'}::${normalizeCatalogNameKey(match.name)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(match);
    if (deduped.length >= limit) break;
  }
  return deduped;
}

export function hasExactCatalogNameMatch(matches: SimilarNameMatch[]): boolean {
  return matches.some(match => match.kind === 'exact');
}
