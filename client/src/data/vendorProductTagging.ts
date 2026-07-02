import type { Ingredient } from '../api';
import {
  fromApiUom,
  resolveDetailConfigForRow,
  serializeDetailConfig,
  toApiUom,
  type AltUnitEntry,
  type ComponentDetailConfig,
  type ComponentRow,
} from './componentForm';
import {
  applyVendorProductOverrides,
  calcNettUomPrice,
  calcNettUomQty,
  resolveComponentUomQty,
  type VendorProductCatalogItem,
} from './vendorProductCatalog';

export type VendorProductTagApplyOptions = {
  recipeUnit: string;
  inventoryUnit: string;
  componentUom: string;
  principalQty: string;
  yieldLossPct: string;
  productLocationIds: string[];
  storages?: string[];
};

export function resolveVendorProductPrincipalQty(
  product: VendorProductCatalogItem,
  recipeUnit: string,
  altRecipeUnits: AltUnitEntry[],
  componentUom: string,
  storedQty?: string,
): { qty: number; displayQty: string } {
  const resolved = resolveComponentUomQty(product.delivery, recipeUnit, altRecipeUnits, componentUom);
  const displayQty = storedQty !== undefined && storedQty !== ''
    ? storedQty
    : resolved.qty !== null
      ? String(resolved.qty)
      : '';
  return { qty: parseFloat(displayQty) || 0, displayQty };
}

export function isVendorProductTagReady(
  product: VendorProductCatalogItem,
  params: {
    recipeUnit: string;
    altRecipeUnits: AltUnitEntry[];
    componentUom: string;
    principalQty?: string;
    productLocationIds: string[];
    companyLocationCount: number;
  },
): { ready: boolean; reason?: string } {
  const { qty } = resolveVendorProductPrincipalQty(
    product,
    params.recipeUnit,
    params.altRecipeUnits,
    params.componentUom,
    params.principalQty,
  );
  if (qty <= 0) return { ready: false, reason: 'Enter principal UOM qty before tagging.' };
  if (!params.componentUom) return { ready: false, reason: 'Select component UOM before tagging.' };
  if (params.companyLocationCount > 0 && params.productLocationIds.length === 0) {
    return { ready: false, reason: 'Assign at least one location before tagging.' };
  }
  return { ready: true };
}

export function componentRowTagsVendorProduct(row: ComponentRow, productId: string): boolean {
  const detail = resolveDetailConfigForRow(row);
  return detail.taggedVendorProductIds.includes(productId);
}

export function findComponentRowForTaggedProduct(
  rows: ComponentRow[],
  productId: string,
): ComponentRow | null {
  return rows.find(r => componentRowTagsVendorProduct(r, productId)) ?? null;
}

function findCatalogProduct(productId: string): VendorProductCatalogItem | undefined {
  return applyVendorProductOverrides().find(p => p.id === productId);
}

/** Derive recipe/inventory prices from the primary tagged vendor product when missing. */
export function syncComponentPricesFromPrimaryTag(row: ComponentRow): ComponentRow {
  const detail = resolveDetailConfigForRow(row);
  const primaryId = detail.taggedVendorProductIds[0];
  if (!primaryId) return row;

  const product = findCatalogProduct(primaryId);
  if (!product) return row;

  const recipeUnit = fromApiUom(row.recipeUOM);
  const componentUom = detail.vendorProductComponentUom[primaryId] ?? recipeUnit;
  const resolved = resolveComponentUomQty(
    product.delivery,
    recipeUnit,
    detail.altRecipeUnits,
    componentUom,
  );
  const storedQty = detail.vendorProductPrincipalQty[primaryId];
  const principalQty = parseFloat(
    storedQty !== undefined && storedQty !== ''
      ? storedQty
      : resolved.qty !== null
        ? String(resolved.qty)
        : '',
  ) || 0;
  const lossYield = parseFloat(detail.vendorProductLossYield[primaryId] ?? '0') || 0;
  const nettQty = calcNettUomQty(principalQty, lossYield);
  const nettPrice = calcNettUomPrice(product.deliveryPrice, nettQty);

  if (nettPrice <= 0) return row;

  return {
    ...row,
    lastPriceRecipe: nettPrice,
    lastPriceInventory: product.deliveryPrice,
  };
}

export function buildComponentRowWithVendorProductTag(
  row: ComponentRow,
  product: VendorProductCatalogItem,
  options: VendorProductTagApplyOptions,
): ComponentRow {
  const detail = resolveDetailConfigForRow(row);
  if (detail.taggedVendorProductIds.includes(product.id)) {
    return row;
  }

  const recipeUnit = options.recipeUnit;
  const inventoryUnit = options.inventoryUnit;
  const componentUom = options.componentUom;
  const lossYield = parseFloat(options.yieldLossPct) || 0;

  const resolved = resolveComponentUomQty(
    product.delivery,
    recipeUnit,
    detail.altRecipeUnits,
    componentUom,
  );
  const principalQty = options.principalQty.trim()
    || (resolved.qty !== null ? String(resolved.qty) : '');

  const taggedVendorProductIds = [...detail.taggedVendorProductIds, product.id];
  const isPrimary = taggedVendorProductIds.length === 1;

  const nextDetail: ComponentDetailConfig = {
    ...detail,
    taggedVendorProductIds,
    vendorProductPrincipalQty: {
      ...detail.vendorProductPrincipalQty,
      ...(principalQty ? { [product.id]: principalQty } : {}),
    },
    vendorProductLossYield: {
      ...detail.vendorProductLossYield,
      [product.id]: options.yieldLossPct || '0',
    },
    vendorProductComponentUom: {
      ...detail.vendorProductComponentUom,
      [product.id]: componentUom,
    },
    vendorProductLocations: {
      ...detail.vendorProductLocations,
      [product.id]: options.productLocationIds,
    },
    vendor: isPrimary ? product.vendorName : detail.vendor,
    vendorProduct: isPrimary ? product.productName : detail.vendorProduct,
    deliveryUnitPrice: isPrimary ? String(product.deliveryPrice) : detail.deliveryUnitPrice,
  };

  const principalQtyNum = parseFloat(principalQty) || 0;
  const nettQty = calcNettUomQty(principalQtyNum, lossYield);
  const nettPrice = calcNettUomPrice(product.deliveryPrice, nettQty);

  const storages = options.storages && options.storages.length > 0
    ? options.storages
    : row.storage;

  return {
    ...row,
    recipeUOM: toApiUom(recipeUnit),
    inventoryUOM: toApiUom(inventoryUnit),
    storage: storages,
    detailConfig: nextDetail,
    detailConfigJson: serializeDetailConfig(nextDetail),
    attachedVendors: taggedVendorProductIds.length,
    lastPriceInventory: isPrimary ? product.deliveryPrice : row.lastPriceInventory,
    lastPriceRecipe: isPrimary && nettPrice > 0 ? nettPrice : row.lastPriceRecipe,
  };
}

export function componentRowToIngredientPayload(row: ComponentRow): Ingredient {
  const pricedRow = syncComponentPricesFromPrimaryTag(row);
  const detailConfig = pricedRow.detailConfig ?? resolveDetailConfigForRow(pricedRow);
  return {
    id: pricedRow.id ?? 0,
    componentId: pricedRow.componentId,
    name: pricedRow.name,
    category: pricedRow.category,
    group: pricedRow.group,
    recipeUom: pricedRow.recipeUOM,
    inventoryUom: pricedRow.inventoryUOM,
    lastPriceRecipe: pricedRow.lastPriceRecipe,
    lastPriceInventory: pricedRow.lastPriceInventory,
    dailyUsage: pricedRow.dailyUsage,
    orderFreqDays: pricedRow.orderFreqDays,
    storageJson: JSON.stringify(pricedRow.storage),
    storageNote: pricedRow.storageNote ?? '',
    detailConfigJson: serializeDetailConfig(detailConfig),
    attachedProducts: pricedRow.attachedProducts,
    attachedVendors: detailConfig.taggedVendorProductIds.length || pricedRow.attachedVendors,
    active: pricedRow.active,
    locationsJson: JSON.stringify(pricedRow.locations),
  };
}
