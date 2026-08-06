import { fromApiUom, resolveDetailConfigForRow, type AltUnitEntry, type ComponentRow } from './componentForm';
import { formatCountryNumber } from '../utils/numberFormat';

export type ParStockUomBasis = 'recipe';

export function calcBaseParStockInRecipeUom(dailyUsage: number, orderFreqDays: number): number {
  return dailyUsage > 0 && orderFreqDays > 0 ? dailyUsage * orderFreqDays : 0;
}

export function resolveParStockDisplay(options: {
  dailyUsage: number;
  orderFreqDays: number;
  recipeUnit: string;
}): { value: number; uom: string } {
  return {
    value: calcBaseParStockInRecipeUom(options.dailyUsage, options.orderFreqDays),
    uom: options.recipeUnit,
  };
}

export function resolveDailyUsageInBasis(dailyUsageRecipe: number): number {
  return dailyUsageRecipe;
}

export function dailyUsageToRecipeBasis(displayValue: number): number {
  return displayValue;
}

export function resolveComponentParStock(row: ComponentRow): { value: number; uom: string } {
  return resolveParStockDisplay({
    dailyUsage: row.dailyUsage,
    orderFreqDays: row.orderFreqDays,
    recipeUnit: fromApiUom(row.recipeUOM),
  });
}

export function formatParStock(value: number, uom: string, countryCode = 'MY'): string {
  if (value <= 0) return '—';
  return `${formatCountryNumber(value, countryCode)} ${uom}`;
}

export type ComponentUomSource = {
  recipeUom: string;
  altRecipeUnits: AltUnitEntry[];
};

function normalizeComponentUom(value: string): string {
  const trimmed = value.trim();
  return trimmed ? fromApiUom(trimmed) || trimmed : '';
}

function sameUom(left: string, right: string): boolean {
  return normalizeComponentUom(left).toLowerCase() === normalizeComponentUom(right).toLowerCase();
}

export function collectComponentUoms(source: ComponentUomSource): string[] {
  const values = [source.recipeUom, ...source.altRecipeUnits.map(alt => alt.unit)]
    .map(normalizeComponentUom)
    .filter(Boolean);
  return [...new Set(values)];
}

export function componentParStockUomOptions(source: ComponentUomSource, currentUom = ''): string[] {
  const values = [...collectComponentUoms(source), currentUom]
    .map(normalizeComponentUom)
    .filter(Boolean);
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export function isValidComponentParStockUom(uom: string, source: ComponentUomSource): boolean {
  return collectComponentUoms(source).some(unit => sameUom(unit, uom));
}

function alternateMultiplier(source: ComponentUomSource, uom: string): number | null {
  if (sameUom(uom, source.recipeUom)) return 1;
  const alternate = source.altRecipeUnits.find(alt => sameUom(alt.unit, uom));
  if (!alternate) return null;
  const alternateQty = parseFloat(alternate.fromQty || '1') || 1;
  const principalQty = parseFloat(alternate.qty || '1') || 1;
  return alternateQty > 0 && principalQty > 0 ? principalQty / alternateQty : null;
}

export function convertComponentQtyBetweenUoms(
  qty: number,
  fromUom: string,
  toUom: string,
  source: ComponentUomSource,
): number | null {
  if (!Number.isFinite(qty)) return null;
  const fromMultiplier = alternateMultiplier(source, fromUom);
  const toMultiplier = alternateMultiplier(source, toUom);
  if (fromMultiplier === null || toMultiplier === null || toMultiplier === 0) return null;
  return qty * fromMultiplier / toMultiplier;
}

export function deriveDailyUsageFromParStock(
  parStock: number,
  parStockUom: string,
  orderFreqDays: number,
  source: ComponentUomSource,
): number | null {
  if (parStock <= 0 || orderFreqDays <= 0) return null;
  const principalQty = convertComponentQtyBetweenUoms(parStock, parStockUom, source.recipeUom, source);
  return principalQty !== null && principalQty > 0 ? principalQty / orderFreqDays : null;
}

export function exportComponentParStockFields(
  row: ComponentRow,
  preferredUom?: string,
  countryCode = 'MY',
): { parStock: string; parStockUom: string } {
  const detail = resolveDetailConfigForRow(row);
  const recipeUom = fromApiUom(row.recipeUOM);
  const source: ComponentUomSource = { recipeUom, altRecipeUnits: detail.altRecipeUnits };
  const baseRecipe = calcBaseParStockInRecipeUom(row.dailyUsage, row.orderFreqDays);
  if (baseRecipe <= 0) return { parStock: '', parStockUom: '' };

  const exportUom = preferredUom && isValidComponentParStockUom(preferredUom, source)
    ? normalizeComponentUom(preferredUom)
    : recipeUom;
  const value = convertComponentQtyBetweenUoms(baseRecipe, recipeUom, exportUom, source);
  if (value === null || value <= 0) return { parStock: String(baseRecipe), parStockUom: recipeUom };
  return { parStock: formatCountryNumber(value, countryCode), parStockUom: exportUom };
}
