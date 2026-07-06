import { parseDetailConfigJson } from '../data/componentForm';
import type { StockCardListRow } from '../api';

export type ComponentConversion = {
  recipeUom: string;
  inventoryUom: string;
  convertFromInventoryQty: number;
  convertToRecipeQty: number;
};

function normalizeUom(uom: string) {
  return uom.trim().toLowerCase();
}

export function buildComponentConversion(
  row: StockCardListRow,
  detailConfigJson?: string | null,
): ComponentConversion {
  const detail = parseDetailConfigJson(detailConfigJson ?? undefined);
  const fromQty = Number.parseFloat(detail.convertFromInventoryQty);
  const toQty = Number.parseFloat(detail.convertToRecipeQty);
  return {
    recipeUom: row.recipeUom || row.uom,
    inventoryUom: row.inventoryUom || row.uom,
    convertFromInventoryQty: Number.isFinite(fromQty) && fromQty > 0 ? fromQty : 1,
    convertToRecipeQty: Number.isFinite(toQty) && toQty > 0 ? toQty : 1,
  };
}

export function recipeToInventoryQty(recipeQty: number, conv: ComponentConversion): number {
  if (conv.convertToRecipeQty === 0) return 0;
  return recipeQty * (conv.convertFromInventoryQty / conv.convertToRecipeQty);
}

export function inventoryToRecipeQty(inventoryQty: number, conv: ComponentConversion): number {
  if (conv.convertFromInventoryQty === 0) return 0;
  return inventoryQty * (conv.convertToRecipeQty / conv.convertFromInventoryQty);
}

export function displayUomForRow(row: StockCardListRow, uomMode: 'inventory' | 'recipe'): string {
  if (row.itemType !== 'component') return row.uom;
  return uomMode === 'recipe' ? row.recipeUom || row.uom : row.inventoryUom || row.uom;
}

export function displayOnHandQty(
  row: StockCardListRow,
  uomMode: 'inventory' | 'recipe',
  conv: ComponentConversion,
): number {
  if (row.itemType !== 'component') return row.onHandQty;
  if (uomMode === 'inventory') return row.onHandQty;
  return inventoryToRecipeQty(row.onHandQty, conv);
}

export function computeTotalQty(
  recipeQty: number | null,
  inventoryQty: number | null,
  uomMode: 'inventory' | 'recipe',
  conv: ComponentConversion,
  isComponent: boolean,
): number | null {
  const recipePart = recipeQty ?? 0;
  const inventoryPart = inventoryQty ?? 0;
  if (!isComponent) {
    const value = inventoryPart || recipePart;
    return recipeQty == null && inventoryQty == null ? null : value;
  }
  if (recipeQty == null && inventoryQty == null) return null;
  if (uomMode === 'inventory') {
    return inventoryPart + recipeToInventoryQty(recipePart, conv);
  }
  return recipePart + inventoryToRecipeQty(inventoryPart, conv);
}

export function supportsDualUomEntry(row: StockCardListRow): boolean {
  if (row.itemType !== 'component') return false;
  return normalizeUom(row.recipeUom) !== normalizeUom(row.inventoryUom)
    || row.recipeUom.trim() !== row.inventoryUom.trim();
}
