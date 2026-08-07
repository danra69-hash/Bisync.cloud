import { migrateInventoryUomsIntoComponentAlts, parseDetailConfigJson, type AltUnitEntry } from '../data/componentForm';
import type { StockCardListRow } from '../api';

/**
 * Principal Component UOM + first alternate component UOM conversion for inventory count.
 * Legacy Inventory UOM is folded into alternates via migrateInventoryUomsIntoComponentAlts.
 */
export type ComponentConversion = {
  recipeUom: string;
  /** First alternate component UOM (empty when none). */
  alternateUom: string;
  /** Legacy alias used by call sites that still name the second basis "inventory". */
  inventoryUom: string;
  convertFromInventoryQty: number;
  convertToRecipeQty: number;
  altRecipeUnits: AltUnitEntry[];
};

function normalizeUom(uom: string) {
  return uom.trim().toLowerCase();
}

export function buildComponentConversion(
  row: StockCardListRow,
  detailConfigJson?: string | null,
): ComponentConversion {
  const detail = parseDetailConfigJson(detailConfigJson ?? undefined);
  const migrated = migrateInventoryUomsIntoComponentAlts({
    recipeUnit: row.recipeUom || row.uom,
    inventoryUnit: row.inventoryUom || row.uom,
    altRecipeUnits: detail.altRecipeUnits,
    altInventoryUnits: detail.altInventoryUnits,
    convertFromInventoryQty: detail.convertFromInventoryQty,
    convertToRecipeQty: detail.convertToRecipeQty,
  });
  const firstAlt = migrated.altRecipeUnits[0];
  const fromQty = Number.parseFloat(firstAlt?.fromQty ?? '1');
  const toQty = Number.parseFloat(firstAlt?.qty ?? '0');
  const alternateUom = firstAlt?.unit?.trim() || '';
  return {
    recipeUom: migrated.recipeUnit || row.recipeUom || row.uom,
    alternateUom,
    inventoryUom: alternateUom || migrated.recipeUnit || row.uom,
    convertFromInventoryQty: Number.isFinite(fromQty) && fromQty > 0 ? fromQty : 1,
    convertToRecipeQty: Number.isFinite(toQty) && toQty > 0 ? toQty : 1,
    altRecipeUnits: migrated.altRecipeUnits,
  };
}

/** Convert principal qty → first alternate qty. */
export function recipeToInventoryQty(recipeQty: number, conv: ComponentConversion): number {
  if (!conv.alternateUom || conv.convertToRecipeQty === 0) return recipeQty;
  return recipeQty * (conv.convertFromInventoryQty / conv.convertToRecipeQty);
}

/** Convert first alternate qty → principal qty. */
export function inventoryToRecipeQty(inventoryQty: number, conv: ComponentConversion): number {
  if (!conv.alternateUom || conv.convertFromInventoryQty === 0) return inventoryQty;
  return inventoryQty * (conv.convertToRecipeQty / conv.convertFromInventoryQty);
}

/** Display UOM is always Principal Component Unit for stock/count views. */
export function displayUomForRow(row: StockCardListRow, _uomMode?: 'inventory' | 'recipe'): string {
  if (row.itemType !== 'component') return row.uom;
  return row.recipeUom || row.uom;
}

/**
 * On-hand qty shown in Principal Component Unit.
 * Stock cards load in native units; when a first alternate exists and differs from
 * principal, convert using the alternate ratio (legacy inventory fold-in included).
 */
export function displayOnHandQty(
  row: StockCardListRow,
  _uomMode: 'inventory' | 'recipe',
  conv: ComponentConversion,
): number {
  if (row.itemType !== 'component') return row.onHandQty;
  // Native stock qty is treated as principal when no distinct alternate conversion applies.
  if (!conv.alternateUom || normalizeUom(conv.alternateUom) === normalizeUom(conv.recipeUom)) {
    return row.onHandQty;
  }
  // If stock was historically stored in the alternate/inventory unit, convert to principal.
  if (normalizeUom(row.inventoryUom || '') === normalizeUom(conv.alternateUom)
    && normalizeUom(row.inventoryUom || '') !== normalizeUom(conv.recipeUom)) {
    return inventoryToRecipeQty(row.onHandQty, conv);
  }
  return row.onHandQty;
}

export function computeTotalQty(
  recipeQty: number | null,
  alternateQty: number | null,
  _uomMode: 'inventory' | 'recipe',
  conv: ComponentConversion,
  isComponent: boolean,
): number | null {
  const recipePart = recipeQty ?? 0;
  const altPart = alternateQty ?? 0;
  if (!isComponent) {
    const value = altPart || recipePart;
    return recipeQty == null && alternateQty == null ? null : value;
  }
  if (recipeQty == null && alternateQty == null) return null;
  if (!conv.alternateUom) {
    return recipePart || altPart;
  }
  return recipePart + inventoryToRecipeQty(altPart, conv);
}

export function supportsDualUomEntry(row: StockCardListRow, conv?: ComponentConversion): boolean {
  if (row.itemType !== 'component') return false;
  if (conv) return Boolean(conv.alternateUom);
  return normalizeUom(row.recipeUom) !== normalizeUom(row.inventoryUom)
    || row.recipeUom.trim() !== row.inventoryUom.trim();
}
