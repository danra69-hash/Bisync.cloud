import { fromApiUom, getConversion, resolveDetailConfigForRow, type AltUnitEntry, type ComponentRow } from './componentForm';
import { formatCountryNumber } from '../utils/numberFormat';

export type ParStockUomBasis = 'recipe' | 'inventory';

export function calcBaseParStockInRecipeUom(dailyUsage: number, orderFreqDays: number): number {
  if (dailyUsage <= 0 || orderFreqDays <= 0) return 0;
  return dailyUsage * orderFreqDays;
}

export function convertQtyBetweenPrincipalUoms(
  qty: number,
  fromBasis: ParStockUomBasis,
  toBasis: ParStockUomBasis,
  recipeUnit: string,
  inventoryUnit: string,
  convertFromInventoryQty = '1',
  convertToRecipeQty = '1',
): number | null {
  if (!Number.isFinite(qty)) return null;
  if (fromBasis === toBasis) return qty;

  const fromInv = parseFloat(convertFromInventoryQty || '1') || 1;
  const toRecipe = parseFloat(convertToRecipeQty || '1') || 0;

  if (fromBasis === 'recipe' && toBasis === 'inventory') {
    if (recipeUnit === inventoryUnit) return qty;
    if (toRecipe > 0) return qty * (fromInv / toRecipe);
    const conv = getConversion(recipeUnit, inventoryUnit);
    return conv !== null ? qty * conv : null;
  }

  if (recipeUnit === inventoryUnit) return qty;
  if (fromInv > 0 && toRecipe > 0) return qty * (toRecipe / fromInv);
  const conv = getConversion(inventoryUnit, recipeUnit);
  return conv !== null ? qty * conv : null;
}

export function resolveParStockDisplay(options: {
  dailyUsage: number;
  orderFreqDays: number;
  basis: ParStockUomBasis;
  recipeUnit: string;
  inventoryUnit: string;
  convertFromInventoryQty?: string;
  convertToRecipeQty?: string;
}): { value: number; uom: string } {
  const {
    dailyUsage,
    orderFreqDays,
    basis,
    recipeUnit,
    inventoryUnit,
    convertFromInventoryQty = '1',
    convertToRecipeQty = '1',
  } = options;

  const baseRecipe = calcBaseParStockInRecipeUom(dailyUsage, orderFreqDays);
  const uom = basis === 'recipe' ? recipeUnit : inventoryUnit;

  if (basis === 'recipe') {
    return { value: baseRecipe, uom };
  }

  const converted = convertQtyBetweenPrincipalUoms(
    baseRecipe,
    'recipe',
    'inventory',
    recipeUnit,
    inventoryUnit,
    convertFromInventoryQty,
    convertToRecipeQty,
  );

  return { value: converted ?? baseRecipe, uom };
}

export function resolveDailyUsageInBasis(
  dailyUsageRecipe: number,
  basis: ParStockUomBasis,
  recipeUnit: string,
  inventoryUnit: string,
  convertFromInventoryQty = '1',
  convertToRecipeQty = '1',
): number {
  if (basis === 'recipe') return dailyUsageRecipe;
  const converted = convertQtyBetweenPrincipalUoms(
    dailyUsageRecipe,
    'recipe',
    'inventory',
    recipeUnit,
    inventoryUnit,
    convertFromInventoryQty,
    convertToRecipeQty,
  );
  return converted ?? dailyUsageRecipe;
}

export function dailyUsageToRecipeBasis(
  displayValue: number,
  basis: ParStockUomBasis,
  recipeUnit: string,
  inventoryUnit: string,
  convertFromInventoryQty = '1',
  convertToRecipeQty = '1',
): number {
  if (basis === 'recipe') return displayValue;
  const converted = convertQtyBetweenPrincipalUoms(
    displayValue,
    'inventory',
    'recipe',
    recipeUnit,
    inventoryUnit,
    convertFromInventoryQty,
    convertToRecipeQty,
  );
  return converted ?? displayValue;
}

export function resolveComponentParStock(
  row: ComponentRow,
  basis: ParStockUomBasis,
): { value: number; uom: string } {
  const detail = resolveDetailConfigForRow(row);
  return resolveParStockDisplay({
    dailyUsage: row.dailyUsage,
    orderFreqDays: row.orderFreqDays,
    basis,
    recipeUnit: fromApiUom(row.recipeUOM),
    inventoryUnit: fromApiUom(row.inventoryUOM),
    convertFromInventoryQty: detail.convertFromInventoryQty,
    convertToRecipeQty: detail.convertToRecipeQty,
  });
}

export function formatParStock(value: number, uom: string, countryCode = 'MY'): string {
  if (value <= 0) return '—';
  return `${formatCountryNumber(value, countryCode)} ${uom}`;
}

export type ComponentUomSource = {
  recipeUom: string;
  inventoryUom: string;
  altRecipeUnits: AltUnitEntry[];
  altInventoryUnits: AltUnitEntry[];
};

function normalizeComponentUom(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return fromApiUom(trimmed) || trimmed;
}

export function collectComponentUoms(source: ComponentUomSource): string[] {
  const values = [
    source.recipeUom,
    source.inventoryUom,
    ...source.altRecipeUnits.map(alt => alt.unit),
    ...source.altInventoryUnits.map(alt => alt.unit),
  ]
    .map(normalizeComponentUom)
    .filter(Boolean);
  return [...new Set(values)];
}

export function componentParStockUomOptions(
  source: ComponentUomSource,
  currentUom = '',
): string[] {
  const values = [...collectComponentUoms(source), currentUom]
    .map(normalizeComponentUom)
    .filter(Boolean);
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export function isValidComponentParStockUom(
  uom: string,
  source: ComponentUomSource,
): boolean {
  const normalized = normalizeComponentUom(uom);
  if (!normalized) return false;
  const allowed = collectComponentUoms(source);
  return allowed.some(unit => unit.toLowerCase() === normalized.toLowerCase());
}

export function convertComponentQtyBetweenUoms(
  qty: number,
  fromUom: string,
  toUom: string,
  options: ComponentUomSource & {
    convertFromInventoryQty?: string;
    convertToRecipeQty?: string;
  },
): number | null {
  if (!Number.isFinite(qty)) return null;

  const from = normalizeComponentUom(fromUom);
  const to = normalizeComponentUom(toUom);
  if (!from || !to) return null;
  if (from.toLowerCase() === to.toLowerCase()) return qty;

  const recipeUom = normalizeComponentUom(options.recipeUom);
  const inventoryUom = normalizeComponentUom(options.inventoryUom);
  const {
    convertFromInventoryQty = '1',
    convertToRecipeQty = '1',
  } = options;

  const toRecipeBasis = (value: number, unit: string): number | null => {
    const normalized = normalizeComponentUom(unit);
    if (normalized.toLowerCase() === recipeUom.toLowerCase()) return value;
    if (normalized.toLowerCase() === inventoryUom.toLowerCase()) {
      return convertQtyBetweenPrincipalUoms(
        value,
        'inventory',
        'recipe',
        recipeUom,
        inventoryUom,
        convertFromInventoryQty,
        convertToRecipeQty,
      );
    }
    const conv = getConversion(normalized, recipeUom);
    return conv !== null ? value * conv : null;
  };

  const fromRecipe = toRecipeBasis(qty, from);
  if (fromRecipe === null) return null;
  if (to.toLowerCase() === recipeUom.toLowerCase()) return fromRecipe;
  if (to.toLowerCase() === inventoryUom.toLowerCase()) {
    return convertQtyBetweenPrincipalUoms(
      fromRecipe,
      'recipe',
      'inventory',
      recipeUom,
      inventoryUom,
      convertFromInventoryQty,
      convertToRecipeQty,
    );
  }
  const conv = getConversion(recipeUom, to);
  return conv !== null ? fromRecipe * conv : null;
}

export function deriveDailyUsageFromParStock(
  parStock: number,
  parStockUom: string,
  orderFreqDays: number,
  options: ComponentUomSource & {
    convertFromInventoryQty?: string;
    convertToRecipeQty?: string;
  },
): number | null {
  if (parStock <= 0 || orderFreqDays <= 0) return null;
  const recipeUom = normalizeComponentUom(options.recipeUom);
  const recipeParStock = convertComponentQtyBetweenUoms(
    parStock,
    parStockUom,
    recipeUom,
    options,
  );
  if (recipeParStock === null || recipeParStock <= 0) return null;
  return recipeParStock / orderFreqDays;
}

export function exportComponentParStockFields(
  row: ComponentRow,
  preferredUom?: string,
  countryCode = 'MY',
): { parStock: string; parStockUom: string } {
  const detail = resolveDetailConfigForRow(row);
  const recipeUom = fromApiUom(row.recipeUOM);
  const inventoryUom = fromApiUom(row.inventoryUOM);
  const source: ComponentUomSource = {
    recipeUom,
    inventoryUom,
    altRecipeUnits: detail.altRecipeUnits,
    altInventoryUnits: detail.altInventoryUnits,
  };
  const baseRecipe = calcBaseParStockInRecipeUom(row.dailyUsage, row.orderFreqDays);
  if (baseRecipe <= 0) return { parStock: '', parStockUom: '' };

  const options = componentParStockUomOptions(source, preferredUom || recipeUom);
  const exportUom = preferredUom && isValidComponentParStockUom(preferredUom, source)
    ? normalizeComponentUom(preferredUom)
    : (options[0] || recipeUom);

  const exportedValue = convertComponentQtyBetweenUoms(
    baseRecipe,
    recipeUom,
    exportUom,
    {
      ...source,
      convertFromInventoryQty: detail.convertFromInventoryQty,
      convertToRecipeQty: detail.convertToRecipeQty,
    },
  );

  if (exportedValue === null || exportedValue <= 0) {
    return { parStock: String(baseRecipe), parStockUom: recipeUom };
  }

  return {
    parStock: formatCountryNumber(exportedValue, countryCode),
    parStockUom: exportUom,
  };
}
