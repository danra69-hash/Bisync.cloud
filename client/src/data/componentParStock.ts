import { fromApiUom, getConversion, resolveDetailConfigForRow, type ComponentRow } from './componentForm';

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

export function formatParStock(value: number, uom: string): string {
  if (value <= 0) return '—';
  const decimals = value < 1 ? 4 : value < 10 ? 2 : 1;
  return `${value.toFixed(decimals)} ${uom}`;
}
