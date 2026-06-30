import type { Vendor } from '../api';
import { fromApiUom, resolveDetailConfigForRow, type ComponentRow } from './componentForm';
import {
  applyVendorProductOverrides,
  calcNettUomPrice,
  calcNettUomQty,
  formatDeliveryUnitPath,
  resolveComponentUomQty,
  type VendorProductCatalogItem,
} from './vendorProductCatalog';
import { componentRowTagsVendorProduct, resolveVendorProductPrincipalQty } from './vendorProductTagging';

export type ComparePriceCell = {
  product: VendorProductCatalogItem;
  componentRow: ComponentRow;
  componentUom: string;
  principalQty: number;
  principalQtyDisplay: string;
  autoResolvable: boolean;
  uomCost: number | null;
  lossYield: number;
};

export type ComparePriceSlot = {
  product: VendorProductCatalogItem;
  componentRow: ComponentRow;
  isTagged: boolean;
  pricing: ComparePriceCell | null;
};

const COMPARE_PRICE_MOVE_OVERRIDES_KEY = 'bisync.comparePriceMoveOverrides';

export function comparePriceCellKey(vendorExternalId: string, componentId: number): string {
  return `${vendorExternalId}::${componentId}`;
}

function comparePriceMoveOverrideKey(vendorExternalId: string, productId: string): string {
  return `${vendorExternalId}::${productId}`;
}

function loadComparePriceMoveOverrides(): Record<string, number> {
  try {
    const raw = localStorage.getItem(COMPARE_PRICE_MOVE_OVERRIDES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveComparePriceMoveOverrides(overrides: Record<string, number>) {
  localStorage.setItem(COMPARE_PRICE_MOVE_OVERRIDES_KEY, JSON.stringify(overrides));
}

export function moveComparePriceCellMapping(
  vendorExternalId: string,
  productId: string,
  targetComponentId: number,
): void {
  const overrides = loadComparePriceMoveOverrides();
  overrides[comparePriceMoveOverrideKey(vendorExternalId, productId)] = targetComponentId;
  saveComparePriceMoveOverrides(overrides);
}

function normalizeCompareName(value: string): string {
  return value.toLowerCase().replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim();
}

/** Match a vendor catalog product to a smart component name. */
export function findCatalogProductForComponent(
  vendorExternalId: string,
  componentName: string,
  componentId: number,
  catalog: VendorProductCatalogItem[],
  moveOverrides: Record<string, number>,
): VendorProductCatalogItem | null {
  const candidates = catalog.filter(p => p.vendorExternalId === vendorExternalId);
  if (candidates.length === 0) return null;

  const forced = candidates.find(
    p => moveOverrides[comparePriceMoveOverrideKey(vendorExternalId, p.id)] === componentId,
  );
  if (forced) return forced;

  const effectiveCandidates = candidates.filter(p => {
    const movedTo = moveOverrides[comparePriceMoveOverrideKey(vendorExternalId, p.id)];
    return movedTo === undefined || movedTo === componentId;
  });
  if (effectiveCandidates.length === 0) return null;

  const norm = normalizeCompareName(componentName);

  const exact = effectiveCandidates.find(p => normalizeCompareName(p.productName) === norm);
  if (exact) return exact;

  const substring = effectiveCandidates.find(p => {
    const productNorm = normalizeCompareName(p.productName);
    return productNorm.includes(norm) || norm.includes(productNorm);
  });
  if (substring) return substring;

  const words = norm.split(' ').filter(w => w.length > 2);
  if (words.length === 0) return null;

  let best: VendorProductCatalogItem | null = null;
  let bestScore = 0;
  for (const product of effectiveCandidates) {
    const productNorm = normalizeCompareName(product.productName);
    const score = words.filter(word => productNorm.includes(word)).length;
    if (score > bestScore) {
      bestScore = score;
      best = product;
    }
  }

  if (bestScore >= 2) return best;
  if (bestScore === 1 && words.length === 1) return best;
  return null;
}

export function isFoodOrBeverageComponent(row: ComponentRow): boolean {
  const category = row.category.toLowerCase();
  return category === 'food' || category === 'beverage';
}

export function resolveComparePriceCell(
  row: ComponentRow,
  product: VendorProductCatalogItem,
): ComparePriceCell {
  const detail = resolveDetailConfigForRow(row);
  const recipeUnit = fromApiUom(row.recipeUOM);
  const componentUom = detail.vendorProductComponentUom[product.id] ?? recipeUnit;
  const storedQty = detail.vendorProductPrincipalQty[product.id];
  const lossYield = parseFloat(detail.vendorProductLossYield[product.id] ?? '0') || 0;

  const autoCheck = resolveComponentUomQty(
    product.delivery,
    recipeUnit,
    detail.altRecipeUnits,
    componentUom,
  );

  const { qty, displayQty } = resolveVendorProductPrincipalQty(
    product,
    recipeUnit,
    detail.altRecipeUnits,
    componentUom,
    storedQty,
  );

  const nettQty = calcNettUomQty(qty, lossYield);
  const uomCost = nettQty > 0 ? calcNettUomPrice(product.deliveryPrice, nettQty) : null;

  return {
    product,
    componentRow: row,
    componentUom,
    principalQty: qty,
    principalQtyDisplay: displayQty,
    autoResolvable: autoCheck.auto && autoCheck.qty !== null,
    uomCost,
    lossYield,
  };
}

export function principalQtyFromUomCost(
  deliveryPrice: number,
  uomCost: number,
  lossYieldPct: number,
): string {
  if (uomCost <= 0 || deliveryPrice <= 0) return '';
  const nettQty = deliveryPrice / uomCost;
  const principalQty = lossYieldPct > 0
    ? nettQty / (1 - lossYieldPct / 100)
    : nettQty;
  if (!Number.isFinite(principalQty) || principalQty <= 0) return '';
  return String(Math.round(principalQty * 1_000_000) / 1_000_000);
}

export function buildComparePriceMatrix(
  componentRows: ComponentRow[],
  vendors: Vendor[],
  catalog: VendorProductCatalogItem[] = applyVendorProductOverrides(),
): {
  components: ComponentRow[];
  vendorColumns: Vendor[];
  slots: Map<string, ComparePriceSlot>;
} {
  const slots = new Map<string, ComparePriceSlot>();
  const moveOverrides = loadComparePriceMoveOverrides();

  const components = componentRows
    .filter(row => row.active && row.id && isFoodOrBeverageComponent(row))
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const row of components) {
    if (!row.id) continue;
    for (const vendor of vendors) {
      const product = findCatalogProductForComponent(
        vendor.externalId,
        row.name,
        row.id,
        catalog,
        moveOverrides,
      );
      if (!product) continue;

      const isTagged = componentRowTagsVendorProduct(row, product.id);
      slots.set(comparePriceCellKey(vendor.externalId, row.id), {
        product,
        componentRow: row,
        isTagged,
        pricing: isTagged ? resolveComparePriceCell(row, product) : null,
      });
    }
  }

  const vendorColumns = sortComparePriceVendorColumns(vendors, slots, catalog);

  return { components, vendorColumns, slots };
}

function minVendorUomCost(
  vendorExternalId: string,
  slots: Map<string, ComparePriceSlot>,
): number | null {
  let min: number | null = null;
  for (const slot of slots.values()) {
    if (slot.product.vendorExternalId !== vendorExternalId) continue;
    const uomCost = slot.pricing?.uomCost;
    if (uomCost === null || uomCost === undefined || uomCost <= 0) continue;
    if (min === null || uomCost < min) min = uomCost;
  }
  return min;
}

function minVendorCatalogPrice(
  vendorExternalId: string,
  catalog: VendorProductCatalogItem[],
): number | null {
  const prices = catalog
    .filter(p => p.vendorExternalId === vendorExternalId)
    .map(p => p.deliveryPrice);
  if (prices.length === 0) return null;
  return Math.min(...prices);
}

/** Engaged vendors first, then unengaged sorted by lowest known price. */
export function sortComparePriceVendorColumns(
  vendors: Vendor[],
  slots: Map<string, ComparePriceSlot>,
  catalog: VendorProductCatalogItem[],
): Vendor[] {
  const engaged = vendors.filter(v => v.engaged).sort((a, b) => a.name.localeCompare(b.name));
  const unengaged = vendors.filter(v => !v.engaged);

  unengaged.sort((a, b) => {
    const priceA = minVendorUomCost(a.externalId, slots) ?? minVendorCatalogPrice(a.externalId, catalog);
    const priceB = minVendorUomCost(b.externalId, slots) ?? minVendorCatalogPrice(b.externalId, catalog);
    if (priceA !== null && priceB !== null && priceA !== priceB) return priceA - priceB;
    if (priceA !== null && priceB === null) return -1;
    if (priceA === null && priceB !== null) return 1;
    return a.name.localeCompare(b.name);
  });

  return [...engaged, ...unengaged];
}

export function formatDeliveryPriceLine(product: VendorProductCatalogItem): string {
  return `${formatDeliveryUnitPath(product.delivery)} · $${product.deliveryPrice.toFixed(2)}`;
}

export function formatUomCost(uomCost: number | null, componentUom: string): string {
  if (uomCost === null || uomCost <= 0) return '—';
  return `$${uomCost.toFixed(4)}/${componentUom.toLowerCase()}`;
}

export function findBestUomCostByComponent(
  components: ComponentRow[],
  slots: Map<string, ComparePriceSlot>,
): Map<number, number> {
  const best = new Map<number, number>();
  for (const component of components) {
    if (!component.id) continue;
    let min: number | null = null;
    for (const slot of slots.values()) {
      if (slot.componentRow.id !== component.id) continue;
      const uomCost = slot.pricing?.uomCost;
      if (uomCost === null || uomCost === undefined || uomCost <= 0) continue;
      if (min === null || uomCost < min) min = uomCost;
    }
    if (min !== null) best.set(component.id, min);
  }
  return best;
}
