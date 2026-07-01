import type { Vendor } from '../api';
import { fromApiUom, resolveDetailConfigForRow, type ComponentRow } from './componentForm';
import {
  applyVendorProductOverrides,
  formatDeliveryUnitPath,
  resolveComponentUomQty,
  type VendorProductCatalogItem,
} from './vendorProductCatalog';

export type CreateOrderLine = {
  key: string;
  component: ComponentRow;
  vendorProduct: VendorProductCatalogItem;
  stockOnHand: number | null;
  parStock: number;
  parStockUom: string;
  suggestedDeliveryUnits: number | null;
  deliveryUnitLabel: string;
  deliveryPrice: number;
};

export function componentMatchesLocations(
  component: ComponentRow,
  locationIds: string[],
): boolean {
  if (locationIds.length === 0) return false;
  if (component.locations.includes('all')) return true;
  return locationIds.some(id => component.locations.includes(id));
}

export function calcParStock(component: ComponentRow): number {
  if (component.dailyUsage <= 0 || component.orderFreqDays <= 0) return 0;
  return component.dailyUsage * component.orderFreqDays;
}

export function vendorProductMatchesLocations(
  component: ComponentRow,
  productId: string,
  locationIds: string[],
): boolean {
  if (locationIds.length === 0) return false;
  const detail = resolveDetailConfigForRow(component);
  const assigned = detail.vendorProductLocations[productId] ?? [];
  if (assigned.length === 0) return false;
  return locationIds.some(id => assigned.includes(id));
}

export function resolveTaggedProductsForComponent(
  component: ComponentRow,
  catalog: VendorProductCatalogItem[],
  options?: { vendorExternalId?: string; locationIds?: string[] },
): VendorProductCatalogItem[] {
  const detail = resolveDetailConfigForRow(component);
  let tagged = detail.taggedVendorProductIds
    .map(id => catalog.find(p => p.id === id))
    .filter((p): p is VendorProductCatalogItem => Boolean(p));

  if (options?.locationIds && options.locationIds.length > 0) {
    tagged = tagged.filter(p => vendorProductMatchesLocations(component, p.id, options.locationIds!));
  }

  if (options?.vendorExternalId) {
    tagged = tagged.filter(p => p.vendorExternalId === options.vendorExternalId);
  }

  return tagged;
}

export function resolveVendorsForSelectedLocations(
  components: ComponentRow[],
  locationIds: string[],
  vendors: Vendor[],
): Vendor[] {
  const catalog = applyVendorProductOverrides();
  const vendorIds = new Set<string>();

  for (const component of components) {
    if (!component.active) continue;
    if (!componentMatchesLocations(component, locationIds)) continue;

    for (const product of resolveTaggedProductsForComponent(component, catalog, { locationIds })) {
      vendorIds.add(product.vendorExternalId);
    }
  }

  return vendors
    .filter(v => v.engaged && vendorIds.has(v.externalId))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function buildCreateOrderLines(
  components: ComponentRow[],
  locationIds: string[],
  vendorExternalId: string,
  categoryFilter: string,
  search: string,
): CreateOrderLine[] {
  const catalog = applyVendorProductOverrides();
  const query = search.trim().toLowerCase();
  const lines: CreateOrderLine[] = [];

  for (const component of components) {
    if (!component.active) continue;
    if (!componentMatchesLocations(component, locationIds)) continue;
    if (categoryFilter && categoryFilter !== 'All' && component.category !== categoryFilter) continue;

    if (query) {
      const haystack = [
        component.componentId,
        component.name,
        component.category,
        component.group,
      ].join(' ').toLowerCase();
      if (!haystack.includes(query)) continue;
    }

    const resolveOptions = {
      vendorExternalId: vendorExternalId || undefined,
      locationIds,
    };
    const taggedProducts = resolveTaggedProductsForComponent(component, catalog, resolveOptions);
    if (vendorExternalId && taggedProducts.length === 0) continue;

    const products = taggedProducts.length > 0
      ? taggedProducts
      : vendorExternalId
        ? []
        : resolveTaggedProductsForComponent(component, catalog, { locationIds }).slice(0, 1);

    for (const product of products) {
      const detail = resolveDetailConfigForRow(component);
      const recipeUnit = fromApiUom(component.recipeUOM);
      const componentUom = detail.vendorProductComponentUom[product.id]
        || recipeUnit;
      const principal = resolveComponentUomQty(
        product.delivery,
        recipeUnit,
        detail.altRecipeUnits,
        componentUom,
      );
      const storedPrincipal = parseFloat(detail.vendorProductPrincipalQty[product.id] || '');
      const principalQty = storedPrincipal > 0 ? storedPrincipal : (principal.qty ?? 0);

      const parStock = calcParStock(component);
      const stockOnHand: number | null = null;
      const gap = parStock - (stockOnHand ?? 0);
      const suggestedDeliveryUnits = principalQty > 0 && gap > 0
        ? Math.ceil(gap / principalQty)
        : gap > 0
          ? null
          : 0;

      lines.push({
        key: `${component.id ?? component.componentId}::${product.id}`,
        component,
        vendorProduct: product,
        stockOnHand,
        parStock,
        parStockUom: componentUom,
        suggestedDeliveryUnits,
        deliveryUnitLabel: formatDeliveryUnitPath(product.delivery),
        deliveryPrice: product.deliveryPrice,
      });
    }
  }

  return lines.sort((a, b) => a.component.name.localeCompare(b.component.name));
}

export function formatRm(value: number): string {
  return `RM ${value.toFixed(2)}`;
}

export type OrderCartItem = {
  lineKey: string;
  componentId: string;
  componentName: string;
  componentUom: string;
  vendorProductId: string;
  vendorExternalId: string;
  vendorName: string;
  productName: string;
  deliveryUnitLabel: string;
  deliveryPrice: number;
  quantity: number;
  lineTotal: number;
};

export type OrderCartVendorGroup = {
  vendorExternalId: string;
  vendorName: string;
  items: OrderCartItem[];
  subtotal: number;
};

export function buildCartItems(
  lines: CreateOrderLine[],
  orderQtyByKey: Record<string, string>,
): OrderCartItem[] {
  return lines.flatMap(line => {
    const quantity = parseFloat(orderQtyByKey[line.key] || '') || 0;
    if (quantity <= 0) return [];
    return [{
      lineKey: line.key,
      componentId: line.component.componentId,
      componentName: line.component.name,
      componentUom: line.component.inventoryUOM,
      vendorProductId: line.vendorProduct.id,
      vendorExternalId: line.vendorProduct.vendorExternalId,
      vendorName: line.vendorProduct.vendorName,
      productName: line.vendorProduct.productName,
      deliveryUnitLabel: line.deliveryUnitLabel,
      deliveryPrice: line.deliveryPrice,
      quantity,
      lineTotal: quantity * line.deliveryPrice,
    }];
  });
}

export function groupCartByVendor(items: OrderCartItem[]): OrderCartVendorGroup[] {
  const groups = new Map<string, OrderCartVendorGroup>();
  for (const item of items) {
    const existing = groups.get(item.vendorExternalId);
    if (existing) {
      existing.items.push(item);
      existing.subtotal += item.lineTotal;
    } else {
      groups.set(item.vendorExternalId, {
        vendorExternalId: item.vendorExternalId,
        vendorName: item.vendorName,
        items: [item],
        subtotal: item.lineTotal,
      });
    }
  }
  return [...groups.values()].sort((a, b) => a.vendorName.localeCompare(b.vendorName));
}

export function countCartItems(items: OrderCartItem[]): number {
  return items.length;
}
