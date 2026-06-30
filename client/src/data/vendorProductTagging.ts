import type { Ingredient } from '../api';
import {
  resolveDetailConfigForRow,
  serializeDetailConfig,
  toApiUom,
  type AltUnitEntry,
  type ComponentDetailConfig,
  type ComponentRow,
} from './componentForm';
import {
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
  const detailConfig = row.detailConfig ?? resolveDetailConfigForRow(row);
  return {
    id: row.id ?? 0,
    componentId: row.componentId,
    name: row.name,
    category: row.category,
    group: row.group,
    recipeUom: row.recipeUOM,
    inventoryUom: row.inventoryUOM,
    lastPriceRecipe: row.lastPriceRecipe,
    lastPriceInventory: row.lastPriceInventory,
    dailyUsage: row.dailyUsage,
    orderFreqDays: row.orderFreqDays,
    storageJson: JSON.stringify(row.storage),
    storageNote: row.storageNote ?? '',
    detailConfigJson: serializeDetailConfig(detailConfig),
    attachedProducts: row.attachedProducts,
    attachedVendors: detailConfig.taggedVendorProductIds.length,
    active: row.active,
    locationsJson: JSON.stringify(row.locations),
  };
}
