import type { InventoryPurchase, Vendor } from '../api';
import {
  fromApiUom,
  getConversion,
  resolveDetailConfigForRow,
  type ComponentRow,
} from './componentForm';
import { resolveComparePriceCell } from './comparePrice';
import { resolveTaggedProductsForComponent } from './createOrder';
import {
  applyVendorProductOverrides,
  type VendorProductCatalogItem,
} from './vendorProductCatalog';
import { refreshVendorProductPricesFromApi } from './vendorProductPrices';

export type BomPriceSource = 'purchase' | 'vendor_average' | 'vendor_single' | 'last_price' | 'none';

export type BomComponentPriceResult = {
  unitPrice: number;
  source: BomPriceSource;
  label: string;
  sampleCount: number;
};

/** Convert a unit price from one UOM to another via recipe UOM (and inventory↔recipe when needed). */
export function convertComponentUnitPrice(
  unitPrice: number,
  fromUom: string,
  toUom: string,
  component: ComponentRow,
): number | null {
  if (!(unitPrice > 0)) return null;
  const from = fromApiUom(fromUom);
  const to = fromApiUom(toUom);
  if (!from || !to) return null;
  if (from === to) return unitPrice;

  const recipe = fromApiUom(component.recipeUOM);
  const inRecipe = unitPriceToRecipeUom(unitPrice, from, component);
  if (inRecipe === null) return null;
  if (to === recipe) return inRecipe;

  return recipePriceToSelectedUom(inRecipe, to, component);
}

function unitPriceToRecipeUom(
  unitPrice: number,
  fromUom: string,
  component: ComponentRow,
): number | null {
  const recipe = fromApiUom(component.recipeUOM);
  if (fromUom === recipe) return unitPrice;

  const direct = getConversion(fromUom, recipe);
  if (direct !== null && direct > 0) {
    // unitPrice is per `fromUom`; 1 from = `direct` recipe units → price per recipe = unitPrice / direct
    return unitPrice / direct;
  }

  const detail = resolveDetailConfigForRow(component);
  const inventoryUom = fromApiUom(component.inventoryUOM);
  if (fromUom === inventoryUom) {
    const fromQty = parseFloat(detail.convertFromInventoryQty) || 1;
    const toQty = parseFloat(detail.convertToRecipeQty) || 1;
    if (fromQty > 0 && toQty > 0) {
      // 1 inventory = (toQty/fromQty) recipe → price/recipe = unitPrice / (toQty/fromQty)
      return unitPrice / (toQty / fromQty);
    }
  }

  // Try via alt recipe units: alt.fromQty of recipe = alt.qty of alt unit
  const alt = detail.altRecipeUnits.find(item => fromApiUom(item.unit) === fromUom);
  if (alt) {
    const from = parseFloat(alt.fromQty || '1') || 1;
    const qty = parseFloat(alt.qty || '1') || 1;
    // Matches priceForComponentUom inverse: selectedPrice = recipePrice * (qty/from)
    // ⇒ recipePrice = selectedPrice * (from/qty)
    if (qty > 0 && from > 0) return unitPrice * (from / qty);
  }

  return null;
}

function recipePriceToSelectedUom(
  recipePrice: number,
  selectedUom: string,
  component: ComponentRow,
): number | null {
  const recipe = fromApiUom(component.recipeUOM);
  if (selectedUom === recipe) return recipePrice;

  const detail = resolveDetailConfigForRow(component);
  const alt = detail.altRecipeUnits.find(item => fromApiUom(item.unit) === selectedUom);
  if (alt) {
    const from = parseFloat(alt.fromQty || '1') || 1;
    const qty = parseFloat(alt.qty || '1') || 1;
    if (qty <= 0) return recipePrice;
    // Same ratio as productComponentUomOptions.priceForComponentUom
    return recipePrice * (qty / from);
  }

  const conv = getConversion(selectedUom, recipe);
  if (conv !== null && conv > 0) {
    return recipePrice * conv;
  }

  const inventoryUom = fromApiUom(component.inventoryUOM);
  if (selectedUom === inventoryUom) {
    const fromQty = parseFloat(detail.convertFromInventoryQty) || 1;
    const toQty = parseFloat(detail.convertToRecipeQty) || 1;
    if (fromQty > 0 && toQty > 0) {
      return recipePrice * (toQty / fromQty);
    }
  }

  return null;
}

function purchaseMatchesScope(
  purchase: InventoryPurchase,
  componentId: string,
  companyId: number | null,
  locationIds: string[],
): boolean {
  if (purchase.componentId !== componentId) return false;
  if (companyId != null && purchase.companyId != null && purchase.companyId !== companyId) {
    return false;
  }
  if (locationIds.length === 0) return true;
  const locs = purchase.locationExternalIds ?? [];
  if (locs.length === 0) return true;
  const selected = new Set(locationIds);
  return locs.some(loc => selected.has(loc));
}

function findMostRecentPurchase(
  purchases: InventoryPurchase[],
  componentId: string,
  companyId: number | null,
  locationIds: string[],
): InventoryPurchase | null {
  const matches = purchases
    .filter(p => purchaseMatchesScope(p, componentId, companyId, locationIds) && p.unitPrice > 0)
    .sort((a, b) => {
      const ta = Date.parse(a.dateCreatedInStock) || Date.parse(a.dateOrdered) || 0;
      const tb = Date.parse(b.dateCreatedInStock) || Date.parse(b.dateOrdered) || 0;
      if (tb !== ta) return tb - ta;
      return b.id - a.id;
    });
  return matches[0] ?? null;
}

function resolveTaggedVendorUnitPrices(
  component: ComponentRow,
  selectedUom: string,
  locationIds: string[],
  vendors: Vendor[],
  catalog: VendorProductCatalogItem[],
): number[] {
  const engagedVendorIds = new Set(
    vendors.filter(vendor => vendor.engaged).map(vendor => vendor.externalId),
  );
  if (engagedVendorIds.size === 0) return [];

  const tagged = resolveTaggedProductsForComponent(component, catalog, { locationIds })
    .filter(product => engagedVendorIds.has(product.vendorExternalId));

  const prices: number[] = [];
  for (const product of tagged) {
    const cell = resolveComparePriceCell(component, product);
    if (cell.uomCost === null || cell.uomCost <= 0) continue;
    const converted = convertComponentUnitPrice(
      cell.uomCost,
      cell.componentUom,
      selectedUom,
      component,
    );
    if (converted !== null && converted > 0) prices.push(converted);
  }
  return prices;
}

/**
 * Product-page BOM cost estimation:
 * 1) Most recent purchase for the component, converted to selected UOM
 * 2) Else tagged engaged vendor product(s) — average when 2+, single when 1
 * 3) Else Ingredients.lastPriceRecipe converted to selected UOM
 */
export function resolveBomComponentPrice(options: {
  component: ComponentRow;
  selectedUom: string;
  purchases: InventoryPurchase[];
  vendors: Vendor[];
  companyId: number | null;
  locationIds: string[];
  catalog?: VendorProductCatalogItem[];
}): BomComponentPriceResult {
  const {
    component,
    selectedUom,
    purchases,
    vendors,
    companyId,
    locationIds,
  } = options;
  const catalog = options.catalog ?? applyVendorProductOverrides();
  const uom = fromApiUom(selectedUom) || fromApiUom(component.recipeUOM);

  const purchase = findMostRecentPurchase(purchases, component.componentId, companyId, locationIds);
  if (purchase) {
    const converted = convertComponentUnitPrice(
      purchase.unitPrice,
      purchase.uom,
      uom,
      component,
    );
    if (converted !== null && converted > 0) {
      return {
        unitPrice: converted,
        source: 'purchase',
        label: 'Last purchase',
        sampleCount: 1,
      };
    }
  }

  const vendorPrices = resolveTaggedVendorUnitPrices(
    component,
    uom,
    locationIds,
    vendors,
    catalog,
  );
  if (vendorPrices.length >= 2) {
    const avg = vendorPrices.reduce((sum, p) => sum + p, 0) / vendorPrices.length;
    return {
      unitPrice: avg,
      source: 'vendor_average',
      label: `Avg of ${vendorPrices.length} tagged vendors`,
      sampleCount: vendorPrices.length,
    };
  }
  if (vendorPrices.length === 1) {
    return {
      unitPrice: vendorPrices[0],
      source: 'vendor_single',
      label: 'Tagged vendor',
      sampleCount: 1,
    };
  }

  const last = component.lastPriceRecipe ?? 0;
  if (last > 0) {
    const converted = convertComponentUnitPrice(last, component.recipeUOM, uom, component);
    if (converted !== null && converted > 0) {
      return {
        unitPrice: converted,
        source: 'last_price',
        label: 'Component last price',
        sampleCount: 1,
      };
    }
  }

  return {
    unitPrice: 0,
    source: 'none',
    label: 'No price',
    sampleCount: 0,
  };
}

export function formatBomUnitPrice(value: number): string {
  if (!(value > 0)) return '';
  const rounded = Math.round(value * 10_000) / 10_000;
  return String(rounded);
}

/** Warm vendor catalog/price overrides used by BOM estimation. */
export async function ensureBomPricingCatalogReady(): Promise<void> {
  try {
    await refreshVendorProductPricesFromApi();
  } catch {
    // Catalog may already be cached; estimation falls back to lastPriceRecipe.
  }
}
