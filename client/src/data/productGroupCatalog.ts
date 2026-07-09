import type { Product, UpsertProductPayload } from '../api';

export function groupsMatch(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

export function findProductsUsingGroup(products: Product[], groupName: string): Product[] {
  const key = groupName.trim().toLowerCase();
  if (!key) return [];
  return products.filter(product => product.group.trim().toLowerCase() === key);
}

export function productToUpsertPayload(
  product: Product,
  overrides: Partial<UpsertProductPayload> = {},
): UpsertProductPayload {
  return {
    productId: product.productId,
    name: product.name,
    category: product.category,
    group: product.group,
    isSubProduct: product.isSubProduct,
    b2cEnabled: product.b2cEnabled,
    b2bEnabled: product.b2bEnabled,
    b2bPackageUnit: product.b2bPackageUnit,
    b2bSalesConfigJson: product.b2bSalesConfigJson,
    rrp: product.rrp,
    yieldQuantity: product.isSubProduct ? product.yieldQuantity : undefined,
    yieldUom: product.isSubProduct && product.yieldUom ? product.yieldUom : undefined,
    yieldAltUnitsJson: product.yieldAltUnitsJson,
    expiryPeriodDays: product.expiryPeriodDays,
    activationPeriodHours: product.activationPeriodHours,
    parStock: product.parStock ?? 0,
    parStockUom: product.parStockUom || undefined,
    posEnabled: product.posEnabled,
    active: product.active,
    companyId: product.companyId,
    locationExternalIds: product.locationExternalIds ?? [],
    items: (product.items ?? []).map(item => ({
      componentId: item.componentId,
      componentName: item.componentName,
      componentUom: item.componentUom ?? '',
      componentUomPrice: item.componentUomPrice,
      quantity: item.quantity,
    })),
    packagingItems: (product.packagingItems ?? []).map(item => ({
      componentId: item.componentId,
      componentName: item.componentName,
      componentUom: item.componentUom ?? '',
      componentUomPrice: item.componentUomPrice,
      quantity: item.quantity,
    })),
    aliases: (product.aliases ?? []).map(alias => ({
      id: alias.id,
      name: alias.name,
      rrp: alias.rrp,
      b2bSalesConfigJson: alias.b2bSalesConfigJson,
    })),
    ...overrides,
  };
}
