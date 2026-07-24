import type { ProductComponentItem } from '../api';
import { fromApiUom, getConversionFactor } from './componentForm';
import {
  estimateNutritionalFactors,
  formatNutritionValue,
  type NutritionalFactorRow,
} from './productProductionMethod';

export type FnddsNutrientEntry = {
  k: 'i' | 'f';
  c: string;
  n: string;
  e: number;
  p: number;
  cb: number;
  sg: number;
  fb: number;
  ft: number;
  sf: number;
  na: number;
  ch: number;
};

export type FnddsNutrientCatalog = {
  source: string;
  citation: string;
  basis: string;
  count: number;
  entries: FnddsNutrientEntry[];
};

export type NutrientMatchDetail = {
  componentId: string;
  componentName: string;
  matchedName: string | null;
  matchScore: number;
  gramsUsed: number | null;
  source: 'fndds-ingredient' | 'fndds-food' | 'heuristic' | 'skipped';
};

export type EstimatedNutrientResult = {
  rows: NutritionalFactorRow[];
  matchedCount: number;
  totalCount: number;
  coverageGrams: number;
  details: NutrientMatchDetail[];
  sourceLabel: string;
  basisLabel: string;
};

type Totals = {
  energyKcal: number;
  proteinG: number;
  carbG: number;
  sugarsG: number;
  fiberG: number;
  fatG: number;
  satFatG: number;
  sodiumMg: number;
  cholesterolMg: number;
};

const CATALOG_URL = '/data/fndds-nutrients-2021-2023.json';
const MIN_MATCH_SCORE = 48;

let catalogPromise: Promise<FnddsNutrientCatalog | null> | null = null;
let catalogCache: FnddsNutrientCatalog | null = null;
let indexCache: { norm: string; entry: FnddsNutrientEntry }[] | null = null;

export function loadFnddsNutrientCatalog(): Promise<FnddsNutrientCatalog | null> {
  if (catalogCache) return Promise.resolve(catalogCache);
  if (catalogPromise) return catalogPromise;
  catalogPromise = fetch(CATALOG_URL)
    .then(async res => {
      if (!res.ok) throw new Error(`Failed to load nutrient catalog (${res.status})`);
      const data = (await res.json()) as FnddsNutrientCatalog;
      catalogCache = data;
      indexCache = data.entries.map(entry => ({
        norm: normalizeName(entry.n),
        entry,
      }));
      return data;
    })
    .catch(() => {
      catalogPromise = null;
      return null;
    });
  return catalogPromise;
}

export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function quantityToGrams(quantity: number, uomRaw: string): number | null {
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  const uom = fromApiUom(uomRaw?.trim() || '') || (uomRaw?.trim() || '');
  if (!uom) return null;

  const massFactor = getConversionFactor(uom, 'Gr');
  if (massFactor != null) return quantity * massFactor;

  // Approximate volume as water density (1 ml ≈ 1 g) for kitchen liquids.
  const volumeFactor = getConversionFactor(uom, 'Ml');
  if (volumeFactor != null) return quantity * volumeFactor;

  const lower = uom.toLowerCase();
  if (['g', 'gr', 'gram', 'grams'].includes(lower)) return quantity;
  if (['kg', 'kgs'].includes(lower)) return quantity * 1000;
  if (['mg'].includes(lower)) return quantity * 0.001;
  if (['ml', 'milliliter', 'millilitre'].includes(lower)) return quantity;
  if (['l', 'ltr', 'liter', 'litre'].includes(lower)) return quantity * 1000;
  if (['tsp', 'teaspoon'].includes(lower)) return quantity * 5;
  if (['tbsp', 'tablespoon'].includes(lower)) return quantity * 15;
  if (['cup'].includes(lower)) return quantity * 240;
  return null;
}

function tokenSet(name: string): Set<string> {
  return new Set(name.split(' ').filter(t => t.length > 2 && !STOP_WORDS.has(t)));
}

const STOP_WORDS = new Set([
  'and', 'with', 'from', 'the', 'for', 'raw', 'fresh', 'cooked', 'nfs', 'ns',
  'prepared', 'plain', 'regular', 'type',
]);

function scoreMatch(query: string, candidate: string): number {
  if (!query || !candidate) return 0;
  if (query === candidate) return 100;
  if (candidate.startsWith(query) || query.startsWith(candidate)) return 92;
  if (candidate.includes(query) || query.includes(candidate)) {
    const ratio = Math.min(query.length, candidate.length) / Math.max(query.length, candidate.length);
    return 78 + ratio * 12;
  }
  const qt = tokenSet(query);
  const ct = tokenSet(candidate);
  if (qt.size === 0) return 0;
  let hit = 0;
  for (const t of qt) {
    if (ct.has(t)) hit += 1;
  }
  const coverage = hit / qt.size;
  if (coverage <= 0) return 0;
  return coverage * 72;
}

function findBestMatch(componentName: string): { entry: FnddsNutrientEntry; score: number } | null {
  if (!indexCache || indexCache.length === 0) return null;
  const query = normalizeName(componentName);
  if (!query) return null;

  let best: { entry: FnddsNutrientEntry; score: number } | null = null;
  for (const row of indexCache) {
    let score = scoreMatch(query, row.norm);
    if (row.entry.k === 'i') score += 4; // prefer ingredient catalog for recipe BOM
    if (!best || score > best.score) {
      best = { entry: row.entry, score };
    }
  }
  if (!best || best.score < MIN_MATCH_SCORE) return null;
  return best;
}

function emptyTotals(): Totals {
  return {
    energyKcal: 0,
    proteinG: 0,
    carbG: 0,
    sugarsG: 0,
    fiberG: 0,
    fatG: 0,
    satFatG: 0,
    sodiumMg: 0,
    cholesterolMg: 0,
  };
}

function addScaled(totals: Totals, entry: FnddsNutrientEntry, grams: number) {
  const factor = grams / 100;
  totals.energyKcal += entry.e * factor;
  totals.proteinG += entry.p * factor;
  totals.carbG += entry.cb * factor;
  totals.sugarsG += entry.sg * factor;
  totals.fiberG += entry.fb * factor;
  totals.fatG += entry.ft * factor;
  totals.satFatG += entry.sf * factor;
  totals.sodiumMg += entry.na * factor;
  totals.cholesterolMg += entry.ch * factor;
}

function totalsToRows(totals: Totals, divisor: number): NutritionalFactorRow[] {
  const d = divisor > 0 ? divisor : 1;
  return [
    { factor: 'Energy', perRecipe: totals.energyKcal / d, unit: 'kcal' },
    { factor: 'Protein', perRecipe: totals.proteinG / d, unit: 'g' },
    { factor: 'Carbohydrates', perRecipe: totals.carbG / d, unit: 'g' },
    { factor: 'Total sugars', perRecipe: totals.sugarsG / d, unit: 'g' },
    { factor: 'Dietary fibre', perRecipe: totals.fiberG / d, unit: 'g' },
    { factor: 'Total fat', perRecipe: totals.fatG / d, unit: 'g' },
    { factor: 'Saturated fat', perRecipe: totals.satFatG / d, unit: 'g' },
    { factor: 'Sodium', perRecipe: totals.sodiumMg / d, unit: 'mg' },
    { factor: 'Cholesterol', perRecipe: totals.cholesterolMg / d, unit: 'mg' },
  ];
}

/**
 * Estimate product nutrients from recipe components using USDA FNDDS 2021-2023.
 * Falls back to the built-in heuristic profile when a component cannot be matched
 * or quantity cannot be converted to grams.
 */
export function estimateProductNutrientsFromFndds(
  components: ProductComponentItem[],
  options?: {
    yieldQuantity?: number;
    catalog?: FnddsNutrientCatalog | null;
  },
): EstimatedNutrientResult {
  const catalog = options?.catalog ?? catalogCache;
  const yieldQuantity = options?.yieldQuantity && options.yieldQuantity > 0
    ? options.yieldQuantity
    : 1;

  const usable = components.filter(c => (c.componentName || c.componentId) && Number(c.quantity) > 0);
  const details: NutrientMatchDetail[] = [];
  const totals = emptyTotals();
  let matchedCount = 0;
  let coverageGrams = 0;

  if (!catalog || !indexCache) {
    const heuristic = estimateNutritionalFactors(usable, '', yieldQuantity);
    return {
      rows: heuristic,
      matchedCount: 0,
      totalCount: usable.length,
      coverageGrams: 0,
      details: usable.map(c => ({
        componentId: c.componentId,
        componentName: c.componentName || c.componentId,
        matchedName: null,
        matchScore: 0,
        gramsUsed: null,
        source: 'heuristic' as const,
      })),
      sourceLabel: 'Heuristic estimate (FNDDS catalog not loaded)',
      basisLabel: 'Approximate per recipe unit',
    };
  }

  for (const item of usable) {
    const name = (item.componentName || item.componentId || '').trim();
    const qty = Number(item.quantity) || 0;
    const grams = quantityToGrams(qty, item.componentUom || '');
    const match = findBestMatch(name);

    if (match && grams != null) {
      addScaled(totals, match.entry, grams);
      matchedCount += 1;
      coverageGrams += grams;
      details.push({
        componentId: item.componentId,
        componentName: name,
        matchedName: match.entry.n,
        matchScore: match.score,
        gramsUsed: grams,
        source: match.entry.k === 'i' ? 'fndds-ingredient' : 'fndds-food',
      });
      continue;
    }

    // Fallback: heuristic per-UOM profile when grams or FNDDS match unavailable.
    const heuristicRows = estimateNutritionalFactors([item], '', 1);
    const byFactor = Object.fromEntries(heuristicRows.map(r => [r.factor, r.perRecipe]));
    totals.energyKcal += byFactor.Energy ?? 0;
    totals.proteinG += byFactor.Protein ?? 0;
    totals.carbG += byFactor.Carbohydrates ?? 0;
    totals.sugarsG += byFactor.Sugar ?? 0;
    totals.fiberG += byFactor.Fibre ?? 0;
    totals.fatG += byFactor.Fat ?? 0;
    totals.sodiumMg += byFactor.Sodium ?? 0;
    details.push({
      componentId: item.componentId,
      componentName: name,
      matchedName: match?.entry.n ?? null,
      matchScore: match?.score ?? 0,
      gramsUsed: grams,
      source: grams == null && !match ? 'skipped' : 'heuristic',
    });
  }

  return {
    rows: totalsToRows(totals, yieldQuantity),
    matchedCount,
    totalCount: usable.length,
    coverageGrams,
    details,
    sourceLabel: catalog.source,
    basisLabel: `${catalog.basis} · scaled by recipe qty`,
  };
}

export { formatNutritionValue };
