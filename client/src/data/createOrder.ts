import type { Vendor } from '../api';
import { formatCountryCurrency } from '../utils/numberFormat';
import { fromApiUom, getConversion, resolveDetailConfigForRow, type ComponentRow } from './componentForm';
import { resolveComparePriceCell } from './comparePrice';
import {
  applyVendorProductOverrides,
  formatDeliveryUnitPath,
  resolveComponentUomQty,
  vendorProductPolicyTag,
  vendorProductVisibleToLocations,
  type VendorProductCatalogItem,
} from './vendorProductCatalog';
import {
  productMatchesOrgPolicy,
  vendorMatchesOrgPolicy,
  type CompanyVendorPolicyTag,
} from './vendorPolicyRules';
import { filterTaggedVendorProductIdsForLocations, isVendorProductTaggedAtLocations } from './vendorProductTagging';
import { calcBaseParStockInRecipeUom } from './componentParStock';

export type CreateOrderLineCommitment = {
  poId: number;
  poNumber: string;
  remaining: number;
  unitPrice: number;
  deliveryUnitLabel: string;
};

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
  /** Present when an active Pre-committed PO covers this vendor product for the current locations. */
  commitment?: CreateOrderLineCommitment | null;
};

type PurchaseOrderLike = {
  id: number;
  poNumber: string;
  orderDate?: string;
  commitmentStartDate?: string | null;
  items: Array<{
    vendorProductId?: string;
    componentId?: string;
    quantity: number;
    unitPrice: number;
    unit?: string;
    deliveryPackage?: string;
    drawnQuantity?: number;
    remainingQuantity?: number;
    remainingCommitmentQuantity?: number;
  }>;
};

/** Overlay active Pre-committed price / delivery unit onto My Order lines. */
export function applyCommitmentOverlays(
  lines: CreateOrderLine[],
  committedPos: PurchaseOrderLike[],
): CreateOrderLine[] {
  if (committedPos.length === 0) return lines.map(line => ({ ...line, commitment: null }));

  type Match = CreateOrderLineCommitment & { start: string };
  const byVendorProduct = new Map<string, Match>();
  const byComponent = new Map<string, Match>();

  for (const po of committedPos) {
    for (const item of po.items) {
      const remaining = item.remainingCommitmentQuantity
        ?? item.remainingQuantity
        ?? Math.max(0, item.quantity - (item.drawnQuantity ?? 0));
      if (remaining <= 0.0001) continue;
      const match: Match = {
        poId: po.id,
        poNumber: po.poNumber,
        remaining,
        unitPrice: item.unitPrice,
        deliveryUnitLabel: (item.deliveryPackage || item.unit || '').trim(),
        start: po.commitmentStartDate ?? po.orderDate ?? '',
      };
      const vp = (item.vendorProductId || '').trim();
      if (vp) {
        const prev = byVendorProduct.get(vp);
        if (!prev || match.start < prev.start) byVendorProduct.set(vp, match);
      }
      const comp = (item.componentId || '').trim();
      if (comp) {
        const prev = byComponent.get(comp);
        if (!prev || match.start < prev.start) byComponent.set(comp, match);
      }
    }
  }

  return lines.map(line => {
    const match = byVendorProduct.get(line.vendorProduct.id)
      ?? byComponent.get(line.component.componentId);
    if (!match) return { ...line, commitment: null };
    return {
      ...line,
      deliveryPrice: match.unitPrice,
      deliveryUnitLabel: match.deliveryUnitLabel || line.deliveryUnitLabel,
      commitment: {
        poId: match.poId,
        poNumber: match.poNumber,
        remaining: match.remaining,
        unitPrice: match.unitPrice,
        deliveryUnitLabel: match.deliveryUnitLabel || line.deliveryUnitLabel,
      },
    };
  });
}

export function componentMatchesLocations(
  component: ComponentRow,
  locationIds: string[],
): boolean {
  if (locationIds.length === 0) return false;
  if (component.locations.includes('all')) return true;
  return locationIds.some(id => component.locations.includes(id));
}

export function calcParStock(component: ComponentRow): number {
  return calcBaseParStockInRecipeUom(component.dailyUsage, component.orderFreqDays);
}

export function vendorProductMatchesLocations(
  component: ComponentRow,
  productId: string,
  locationIds: string[],
): boolean {
  const detail = resolveDetailConfigForRow(component);
  return isVendorProductTaggedAtLocations(
    productId,
    detail.taggedVendorProductIds,
    detail.vendorProductLocations,
    locationIds,
  );
}

export function resolveTaggedProductsForComponent(
  component: ComponentRow,
  catalog: VendorProductCatalogItem[],
  options?: { vendorExternalId?: string; locationIds?: string[] },
): VendorProductCatalogItem[] {
  const detail = resolveDetailConfigForRow(component);
  let taggedIds = [...new Set(detail.taggedVendorProductIds.filter(Boolean))];

  if (options?.locationIds && options.locationIds.length > 0) {
    taggedIds = filterTaggedVendorProductIdsForLocations(
      taggedIds,
      detail.vendorProductLocations,
      options.locationIds,
    );
  }

  let tagged = taggedIds
    .map(id => catalog.find(p => p.id === id))
    .filter((p): p is VendorProductCatalogItem => Boolean(p));

  if (options?.locationIds && options.locationIds.length > 0) {
    tagged = tagged.filter(product => vendorProductVisibleToLocations(product, options.locationIds!));
  }

  if (options?.vendorExternalId) {
    tagged = tagged.filter(p => p.vendorExternalId === options.vendorExternalId);
  }

  return tagged;
}

function productAllowedByOrgPolicy(
  product: VendorProductCatalogItem,
  vendorsByExternalId: Map<string, Vendor>,
  orgPolicyTags: CompanyVendorPolicyTag[],
): boolean {
  const vendor = vendorsByExternalId.get(product.vendorExternalId);
  if (vendor && !vendorMatchesOrgPolicy(vendor.productPolicyTag, orgPolicyTags, vendor)) return false;
  const productTag = vendorProductPolicyTag(product, vendorsByExternalId);
  return productMatchesOrgPolicy(productTag, vendor?.productPolicyTag, orgPolicyTags, product.group);
}

export function catalogProductAllowedByOrgPolicy(
  product: VendorProductCatalogItem,
  vendors: Vendor[],
  orgPolicyTags: CompanyVendorPolicyTag[],
): boolean {
  return productAllowedByOrgPolicy(product, new Map(vendors.map(v => [v.externalId, v])), orgPolicyTags);
}

export type EngagedVendorReferencePrice = {
  unitPrice: number;
  principalUom: string;
  vendorName: string;
  productName: string;
};

function normalizeUnitPriceToPrincipalUom(
  unitPrice: number,
  componentUom: string,
  principalUom: string,
): number | null {
  if (componentUom === principalUom) return unitPrice;
  const conv = getConversion(componentUom, principalUom);
  if (conv === null || conv <= 0) return null;
  return unitPrice / conv;
}

export function unitPriceInPrincipalUom(
  deliveryPrice: number,
  quantity: number,
  uom: string,
  component: ComponentRow,
): number | null {
  if (quantity <= 0) return null;
  const unitPrice = deliveryPrice / quantity;
  const principalUom = fromApiUom(component.recipeUOM);
  const sourceUom = fromApiUom(uom);
  const direct = normalizeUnitPriceToPrincipalUom(unitPrice, sourceUom, principalUom);
  if (direct !== null) return direct;

  const detail = resolveDetailConfigForRow(component);
  const inventoryUom = fromApiUom(component.inventoryUOM);
  if (sourceUom === inventoryUom) {
    const fromQty = parseFloat(detail.convertFromInventoryQty) || 1;
    const toQty = parseFloat(detail.convertToRecipeQty) || 1;
    if (fromQty > 0 && toQty > 0) {
      return unitPrice / (toQty / fromQty);
    }
  }

  return null;
}

export function resolveLowestEngagedTaggedVendorPrice(
  component: ComponentRow,
  locationIds: string[],
  vendors: Vendor[],
  catalog: VendorProductCatalogItem[] = applyVendorProductOverrides(),
): EngagedVendorReferencePrice | null {
  const engagedVendorIds = new Set(
    vendors.filter(vendor => vendor.engaged).map(vendor => vendor.externalId),
  );
  if (engagedVendorIds.size === 0) return null;

  const principalUom = fromApiUom(component.recipeUOM);
  const taggedProducts = resolveTaggedProductsForComponent(component, catalog, { locationIds })
    .filter(product => engagedVendorIds.has(product.vendorExternalId));

  let best: EngagedVendorReferencePrice | null = null;

  for (const product of taggedProducts) {
    const cell = resolveComparePriceCell(component, product);
    if (cell.uomCost === null || cell.uomCost <= 0) continue;

    const unitPrice = normalizeUnitPriceToPrincipalUom(cell.uomCost, cell.componentUom, principalUom);
    if (unitPrice === null || unitPrice <= 0) continue;

    if (!best || unitPrice < best.unitPrice) {
      best = {
        unitPrice,
        principalUom,
        vendorName: product.vendorName,
        productName: product.productName,
      };
    }
  }

  return best;
}

export function resolveVendorsForSelectedLocations(
  components: ComponentRow[],
  locationIds: string[],
  vendors: Vendor[],
  orgPolicyTags: CompanyVendorPolicyTag[] = [],
): Vendor[] {
  const catalog = applyVendorProductOverrides();
  const vendorsByExternalId = new Map(vendors.map(v => [v.externalId, v]));
  const vendorIds = new Set<string>();

  for (const component of components) {
    if (!component.active) continue;
    if (!componentMatchesLocations(component, locationIds)) continue;

    for (const product of resolveTaggedProductsForComponent(component, catalog, { locationIds })) {
      if (!productAllowedByOrgPolicy(product, vendorsByExternalId, orgPolicyTags)) continue;
      vendorIds.add(product.vendorExternalId);
    }
  }

  return vendors
    .filter(v => v.engaged
      && vendorIds.has(v.externalId)
      && vendorMatchesOrgPolicy(v.productPolicyTag, orgPolicyTags, v))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function buildCreateOrderLines(
  components: ComponentRow[],
  locationIds: string[],
  vendorExternalId: string,
  categoryFilter: string,
  search: string,
  vendors: Vendor[] = [],
  orgPolicyTags: CompanyVendorPolicyTag[] = [],
): CreateOrderLine[] {
  const catalog = applyVendorProductOverrides();
  const vendorsByExternalId = new Map(vendors.map(v => [v.externalId, v]));
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
    const taggedProducts = resolveTaggedProductsForComponent(component, catalog, resolveOptions)
      .filter(product => productAllowedByOrgPolicy(product, vendorsByExternalId, orgPolicyTags));
    if (vendorExternalId && taggedProducts.length === 0) continue;

    const products = taggedProducts.length > 0
      ? taggedProducts
      : vendorExternalId
        ? []
        : resolveTaggedProductsForComponent(component, catalog, { locationIds })
          .filter(product => productAllowedByOrgPolicy(product, vendorsByExternalId, orgPolicyTags))
          .slice(0, 1);

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

export function formatRm(value: number, countryCode = 'MY'): string {
  return formatCountryCurrency(value, countryCode);
}

export { formatCountryNumber, formatCountryCurrency, formatCountryPercent } from '../utils/numberFormat';

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
  /** True when this cart line is an auto-attached returnable deposit. */
  isReturnableDeposit?: boolean;
  returnableItemName?: string;
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
    const productLine: OrderCartItem = {
      lineKey: line.key,
      componentId: line.component.componentId,
      componentName: line.component.name,
      componentUom: fromApiUom(line.component.recipeUOM) || line.component.recipeUOM,
      vendorProductId: line.vendorProduct.id,
      vendorExternalId: line.vendorProduct.vendorExternalId,
      vendorName: line.vendorProduct.vendorName,
      productName: line.vendorProduct.productName,
      deliveryUnitLabel: line.deliveryUnitLabel,
      deliveryPrice: line.deliveryPrice,
      quantity,
      lineTotal: quantity * line.deliveryPrice,
    };

    const vp = line.vendorProduct;
    const depositName = (vp.returnableItemName ?? '').trim();
    const depositUom = (vp.returnableUom ?? '').trim();
    const depositAmount = Number(vp.returnableDepositAmount ?? 0);
    if (
      vp.returnableDeposit
      && depositName
      && depositUom
      && Number.isFinite(depositAmount)
      && depositAmount >= 0
    ) {
      return [
        productLine,
        {
          lineKey: `${line.key}::returnable`,
          componentId: '',
          componentName: depositName,
          componentUom: depositUom,
          vendorProductId: vp.id,
          vendorExternalId: vp.vendorExternalId,
          vendorName: vp.vendorName,
          productName: depositName,
          deliveryUnitLabel: depositUom,
          deliveryPrice: depositAmount,
          quantity,
          lineTotal: quantity * depositAmount,
          isReturnableDeposit: true,
          returnableItemName: depositName,
        },
      ];
    }

    return [productLine];
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
