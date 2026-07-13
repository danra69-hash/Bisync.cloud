import type { B2bCustomer, Product } from '../api';
import {
  b2bSalesUnitTitle,
  isB2bAlternateLineActive,
  isB2bPrincipalLineActive,
  parseB2bSalesConfigJson,
  resolveB2bSalesDeliveryToYieldUom,
  resolveLinkedSubProduct,
  resolveLinkedSubProductBatchCogs,
  seedAliasB2bSalesConfig,
  summarizeB2bSalesUnit,
  type B2bSalesConfig,
  type B2bSalesUnitLine,
} from './productB2bSales';
import { hasSmallestDeliveryBreakdown, totalSmallestMeasure, type DeliveryUnitBreakdown } from './vendorProductCatalog';
import {
  parseTaggedProductAliasIds,
  parseTaggedProductIds,
} from './customerListData';

export type TaggedB2bProductUnit = {
  productId: number;
  aliasId: number | null;
  unitKey: string;
};

export type B2bCustomerTaggableUnitRow = {
  key: string;
  productId: number;
  aliasId: number | null;
  unitKey: string;
  productName: string;
  productCode: string;
  aliasName: string | null;
  unitTitle: string;
  deliveryPath: string;
  deliverySortQty: number;
  rrp: number;
  unitCogs: number;
};

export type B2bCustomerTaggableUnitGroup = {
  key: string;
  productId: number;
  productName: string;
  productCode: string;
  aliasId: number | null;
  aliasName: string | null;
  units: B2bCustomerTaggableUnitRow[];
};

function resolveDeliveryUnitSortQty(
  delivery: DeliveryUnitBreakdown,
  linkedSubProduct: Product | null,
): number {
  if (linkedSubProduct?.yieldUom?.trim()) {
    const resolved = resolveB2bSalesDeliveryToYieldUom(delivery, linkedSubProduct);
    if (resolved.qty != null && resolved.qty > 0) return resolved.qty;
  }

  const measure = totalSmallestMeasure(delivery);
  return measure > 0 ? measure : Number.MAX_SAFE_INTEGER;
}

function productComponentLines(product: Product) {
  return (product.items ?? []).map(item => ({
    componentId: item.componentId,
    quantity: String(item.quantity),
    componentUomPrice: String(item.componentUomPrice),
    sourceProductId: undefined as number | undefined,
  }));
}

function taggedUnitKey(unit: TaggedB2bProductUnit): string {
  return `${unit.productId}:${unit.aliasId ?? 'p'}:${unit.unitKey}`;
}

function isTaggableLine(line: B2bSalesUnitLine): boolean {
  if (line.disabled) return false;
  // Alternate slots are always padded in config; only show ones that exist (have RRP).
  if (!line.isPrincipal) return isB2bAlternateLineActive(line);
  if (isB2bPrincipalLineActive(line)) return true;
  return hasSmallestDeliveryBreakdown(line.delivery);
}

/** Build a minimal delivery breakdown from B2bPackageUnit (e.g. "pcs" or "1 Box/12 Bottle"). */
function deliveryFromPackageUnit(packageUnit: string): DeliveryUnitBreakdown {
  const raw = packageUnit.trim() || 'pcs';
  const firstSegment = raw.split('/')[0]?.trim() || raw;
  const qtyMatch = firstSegment.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
  if (qtyMatch) {
    const qty = Number(qtyMatch[1]);
    const unit = qtyMatch[2].trim() || 'pcs';
    return {
      orderUnit: unit,
      orderQty: Number.isFinite(qty) && qty > 0 ? qty : 1,
      packUnit: unit,
      packQty: 1,
      unitUnit: unit,
      unitQty: 1,
    };
  }
  return {
    orderUnit: firstSegment,
    orderQty: 1,
    packUnit: firstSegment,
    packQty: 1,
    unitUnit: firstSegment,
    unitQty: 1,
  };
}

/**
 * B2B products with empty sales config (`{}`) were hidden from My Product tagging.
 * Seed principal DU from package unit + product RRP so every B2B product can be tagged.
 */
function ensureTaggablePrincipalConfig(product: Product, config: B2bSalesConfig): B2bSalesConfig {
  if (collectLinesFromConfig(config).length > 0) return config;

  const hasOrderUnit = Boolean(config.principal.delivery.orderUnit?.trim())
    && config.principal.delivery.orderQty > 0;
  const delivery = hasOrderUnit
    ? config.principal.delivery
    : deliveryFromPackageUnit(product.b2bPackageUnit || 'pcs');
  const rrp = config.principal.rrp.trim()
    || (product.rrp > 0 ? String(product.rrp) : '0');

  return {
    ...config,
    principal: {
      ...config.principal,
      key: config.principal.key || 'b2b-principal',
      isPrincipal: true,
      disabled: false,
      delivery,
      rrp,
    },
  };
}

function collectLinesFromConfig(config: B2bSalesConfig): Array<{ line: B2bSalesUnitLine; alternateIndex: number }> {
  const rows: Array<{ line: B2bSalesUnitLine; alternateIndex: number }> = [];
  if (isTaggableLine(config.principal)) {
    rows.push({ line: config.principal, alternateIndex: 0 });
  }
  config.alternates.forEach((alternate, index) => {
    if (isTaggableLine(alternate)) {
      rows.push({ line: alternate, alternateIndex: index + 1 });
    }
  });
  return rows;
}

export function collectB2bCustomerTaggableUnits(
  products: Product[],
  catalogProducts: Product[] = products,
): B2bCustomerTaggableUnitRow[] {
  const rows: B2bCustomerTaggableUnitRow[] = [];

  for (const product of products) {
    const lines = productComponentLines(product);
    const linkedSubProduct = resolveLinkedSubProduct(lines, catalogProducts);
    const batchCogs = resolveLinkedSubProductBatchCogs(lines, catalogProducts);
    const principalConfig = ensureTaggablePrincipalConfig(
      product,
      parseB2bSalesConfigJson(product.b2bSalesConfigJson),
    );

    const pushConfigRows = (
      config: B2bSalesConfig,
      aliasId: number | null,
      aliasName: string | null,
    ) => {
      for (const { line, alternateIndex } of collectLinesFromConfig(config)) {
        const summary = summarizeB2bSalesUnit(
          line,
          linkedSubProduct,
          alternateIndex,
          batchCogs,
        );
        const deliveryPath = summary.detailPath
          || (hasSmallestDeliveryBreakdown(line.delivery) ? summary.detailPath : '—');

        rows.push({
          key: `${product.id}:${aliasId ?? 'p'}:${line.key}`,
          productId: product.id,
          aliasId,
          unitKey: line.key,
          productName: product.name,
          productCode: product.productId,
          aliasName,
          unitTitle: b2bSalesUnitTitle(line, line.isPrincipal ? 0 : alternateIndex - 1),
          deliveryPath: deliveryPath && deliveryPath !== '—'
            ? deliveryPath
            : (product.b2bPackageUnit?.trim() || '—'),
          deliverySortQty: resolveDeliveryUnitSortQty(line.delivery, linkedSubProduct),
          rrp: summary.rrp > 0 ? summary.rrp : (aliasId == null ? product.rrp : summary.rrp),
          unitCogs: summary.cogs,
        });
      }
    };

    pushConfigRows(principalConfig, null, null);

    for (const alias of product.aliases ?? []) {
      if (!alias.name?.trim() && alias.rrp <= 0 && !alias.b2bSalesConfigJson?.trim()) continue;
      const aliasConfig = seedAliasB2bSalesConfig(
        parseB2bSalesConfigJson(alias.b2bSalesConfigJson),
        principalConfig,
        alias.rrp,
      );
      pushConfigRows(aliasConfig, alias.id, alias.name.trim() || `Alias ${alias.id}`);
    }
  }

  return rows.sort((a, b) => {
    const byProduct = a.productName.localeCompare(b.productName);
    if (byProduct !== 0) return byProduct;
    if ((a.aliasId == null) !== (b.aliasId == null)) return a.aliasId == null ? -1 : 1;
    const byAlias = (a.aliasName ?? '').localeCompare(b.aliasName ?? '');
    if (byAlias !== 0) return byAlias;
    return a.deliverySortQty - b.deliverySortQty;
  });
}

export function groupB2bCustomerTaggableUnits(
  rows: B2bCustomerTaggableUnitRow[],
): B2bCustomerTaggableUnitGroup[] {
  const groups: B2bCustomerTaggableUnitGroup[] = [];

  for (const row of rows) {
    const groupKey = `${row.productId}:${row.aliasId ?? 'p'}`;
    let group = groups.find(entry => entry.key === groupKey);
    if (!group) {
      group = {
        key: groupKey,
        productId: row.productId,
        productName: row.productName,
        productCode: row.productCode,
        aliasId: row.aliasId,
        aliasName: row.aliasName,
        units: [],
      };
      groups.push(group);
    }
    group.units.push(row);
  }

  return groups;
}

export function collectTaggedB2bCustomerUnits(
  customer: Pick<
    B2bCustomer,
    'taggedB2bProductUnitsJson' | 'taggedProductIdsJson' | 'taggedProductAliasIdsJson'
  >,
  products: Product[],
  catalogProducts: Product[] = products,
): B2bCustomerTaggableUnitRow[] {
  const tagged = parseTaggedB2bProductUnits(customer, products, catalogProducts);
  if (tagged.length === 0) return [];
  const all = collectB2bCustomerTaggableUnits(products, catalogProducts);
  const keys = new Set(tagged.map(taggedUnitKey));
  return all.filter(row => keys.has(row.key));
}

export function productsMissingSavedAliases(products: Product[]): Product[] {
  return products.filter(product => (product.aliases ?? []).length === 0);
}

/**
 * Older saves used ephemeral principal keys (`b2b-unit-<timestamp>-…`) that change on every
 * parse of empty B2B config. Remap orphan unitKeys onto the current taggable lines so ticks persist.
 */
function rematchTaggedUnitsToCurrentKeys(
  units: TaggedB2bProductUnit[],
  products: Product[],
  catalogProducts: Product[],
): TaggedB2bProductUnit[] {
  if (units.length === 0 || products.length === 0) return units;

  const available = collectB2bCustomerTaggableUnits(products, catalogProducts);
  const byGroup = new Map<string, B2bCustomerTaggableUnitRow[]>();
  for (const row of available) {
    const groupKey = `${row.productId}:${row.aliasId ?? 'p'}`;
    const list = byGroup.get(groupKey) ?? [];
    list.push(row);
    byGroup.set(groupKey, list);
  }

  const rematched: TaggedB2bProductUnit[] = [];
  const seen = new Set<string>();

  for (const unit of units) {
    const groupKey = `${unit.productId}:${unit.aliasId ?? 'p'}`;
    const candidates = byGroup.get(groupKey) ?? [];
    if (candidates.length === 0) continue;

    const resolved = candidates.find(row => row.unitKey === unit.unitKey)
      ?? (candidates.length === 1 ? candidates[0] : undefined)
      ?? candidates.find(row => row.unitKey === 'b2b-principal')
      ?? candidates.find(row => row.unitTitle === 'Principal Delivery Unit')
      ?? candidates[0];

    const next: TaggedB2bProductUnit = {
      productId: resolved.productId,
      aliasId: resolved.aliasId,
      unitKey: resolved.unitKey,
    };
    const key = taggedUnitKey(next);
    if (seen.has(key)) continue;
    seen.add(key);
    rematched.push(next);
  }

  return rematched;
}

export function parseTaggedB2bProductUnits(
  customer: Pick<
    B2bCustomer,
    'taggedB2bProductUnitsJson' | 'taggedProductIdsJson' | 'taggedProductAliasIdsJson'
  >,
  products: Product[],
  catalogProducts: Product[] = products,
): TaggedB2bProductUnit[] {
  let units: TaggedB2bProductUnit[] = [];

  if (customer.taggedB2bProductUnitsJson?.trim() && customer.taggedB2bProductUnitsJson !== '[]') {
    try {
      const parsed = JSON.parse(customer.taggedB2bProductUnitsJson) as Record<string, unknown>[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        units = parsed
          .map(row => ({
            productId: Number(row.productId ?? row.ProductId),
            aliasId: row.aliasId == null && row.AliasId == null
              ? null
              : Number(row.aliasId ?? row.AliasId),
            unitKey: String(row.unitKey ?? row.UnitKey ?? '').trim(),
          }))
          .filter(unit =>
            Number.isFinite(unit.productId)
            && unit.productId > 0
            && unit.unitKey.length > 0
            && (unit.aliasId == null || (Number.isFinite(unit.aliasId) && unit.aliasId > 0)),
          );
      }
    } catch {
      // Fall through to legacy tags.
    }
  }

  if (units.length === 0) {
    const taggedProductIds = parseTaggedProductIds(customer);
    const taggedAliasIds = parseTaggedProductAliasIds(customer);

    for (const productId of taggedProductIds) {
      const product = products.find(row => row.id === productId)
        ?? catalogProducts.find(row => row.id === productId);
      if (!product) continue;
      const config = ensureTaggablePrincipalConfig(
        product,
        parseB2bSalesConfigJson(product.b2bSalesConfigJson),
      );
      for (const { line } of collectLinesFromConfig(config)) {
        units.push({ productId, aliasId: null, unitKey: line.key });
      }
    }

    for (const aliasId of taggedAliasIds) {
      const product = catalogProducts.find(row => (row.aliases ?? []).some(alias => alias.id === aliasId))
        ?? products.find(row => (row.aliases ?? []).some(alias => alias.id === aliasId));
      const alias = product?.aliases?.find(row => row.id === aliasId);
      if (!product || !alias) continue;
      const principalConfig = ensureTaggablePrincipalConfig(
        product,
        parseB2bSalesConfigJson(product.b2bSalesConfigJson),
      );
      const aliasConfig = seedAliasB2bSalesConfig(
        parseB2bSalesConfigJson(alias.b2bSalesConfigJson),
        principalConfig,
        alias.rrp,
      );
      for (const { line } of collectLinesFromConfig(aliasConfig)) {
        units.push({ productId: product.id, aliasId, unitKey: line.key });
      }
    }
  }

  return rematchTaggedUnitsToCurrentKeys(units, products, catalogProducts);
}

export function serializeTaggedB2bProductUnits(units: TaggedB2bProductUnit[]): string {
  return JSON.stringify(
    units.map(unit => ({
      productId: unit.productId,
      aliasId: unit.aliasId,
      unitKey: unit.unitKey,
    })),
  );
}

export function deriveLegacyB2bProductTags(units: TaggedB2bProductUnit[]): {
  taggedProductIds: number[];
  taggedProductAliasIds: number[];
} {
  const taggedProductIds = new Set<number>();
  const taggedProductAliasIds = new Set<number>();

  for (const unit of units) {
    if (unit.aliasId != null) {
      taggedProductAliasIds.add(unit.aliasId);
    } else {
      taggedProductIds.add(unit.productId);
    }
  }

  return {
    taggedProductIds: [...taggedProductIds],
    taggedProductAliasIds: [...taggedProductAliasIds],
  };
}

export function isTaggedB2bProductUnit(
  units: TaggedB2bProductUnit[],
  productId: number,
  aliasId: number | null,
  unitKey: string,
): boolean {
  return units.some(unit =>
    unit.productId === productId
    && unit.aliasId === aliasId
    && unit.unitKey === unitKey,
  );
}

export function toggleTaggedB2bProductUnit(
  units: TaggedB2bProductUnit[],
  unit: TaggedB2bProductUnit,
): TaggedB2bProductUnit[] {
  const key = taggedUnitKey(unit);
  if (units.some(row => taggedUnitKey(row) === key)) {
    return units.filter(row => taggedUnitKey(row) !== key);
  }

  let next = [...units, unit];
  if (unit.aliasId == null) {
    next = next.filter(row => !(row.productId === unit.productId && row.aliasId != null));
  } else {
    next = next.filter(row => !(row.productId === unit.productId && row.aliasId == null));
  }
  return next;
}
