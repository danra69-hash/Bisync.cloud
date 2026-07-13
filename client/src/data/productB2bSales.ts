import type { Product } from '../api';
import { fromApiUom, toApiUom } from './componentForm';
import {
  calcProductCogs,
  calcSubProductUnitCost,
  formatCogsPercent,
  formatSubProductBatchPackageUnit,
} from './productForm';
import type { DeliveryUnitBreakdown } from './vendorProductCatalog';
import {
  DELIVERY_ORDER_UNITS,
  formatDeliveryUnitPath,
  hasSmallestDeliveryBreakdown,
  resolveDeliveryUnitLevels,
  resolvePrincipalQty,
  totalSmallestMeasure,
  type PrincipalQtyResult,
} from './vendorProductCatalog';

export const MAX_B2B_ALTERNATE_DELIVERY_UNITS = 2;

export type B2bSalesUnitLine = {
  key: string;
  isPrincipal: boolean;
  delivery: DeliveryUnitBreakdown;
  rrp: string;
  disabled?: boolean;
};

export type B2bSalesConfig = {
  principal: B2bSalesUnitLine;
  alternates: B2bSalesUnitLine[];
};

export function blankDeliveryUnit(): DeliveryUnitBreakdown {
  return {
    orderUnit: '',
    orderQty: 0,
    packUnit: '',
    packQty: 0,
    unitUnit: '',
    unitQty: 0,
  };
}

export function blankB2bSalesUnit(isPrincipal = false, key?: string): B2bSalesUnitLine {
  return {
    // Principal must stay stable across reloads so My Product tags keep matching.
    key: key || (isPrincipal
      ? 'b2b-principal'
      : `b2b-unit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
    isPrincipal,
    delivery: blankDeliveryUnit(),
    rrp: '',
  };
}

export function blankB2bSalesConfig(): B2bSalesConfig {
  return {
    principal: blankB2bSalesUnit(true, 'b2b-principal'),
    alternates: [
      blankB2bSalesUnit(false, 'b2b-alt-1'),
      blankB2bSalesUnit(false, 'b2b-alt-2'),
    ],
  };
}

function ensureB2bAlternates(alternates: B2bSalesUnitLine[]): B2bSalesUnitLine[] {
  const keys = ['b2b-alt-1', 'b2b-alt-2'];
  return keys.map((key, index) => {
    const line = alternates[index];
    if (!line) return blankB2bSalesUnit(false, key);
    return {
      ...blankB2bSalesUnit(false, key),
      ...line,
      key: line.key || key,
      isPrincipal: false,
      delivery: { ...blankDeliveryUnit(), ...line.delivery },
    };
  });
}

export function b2bSalesUnitTitle(line: B2bSalesUnitLine, alternateIndex = 0): string {
  if (line.isPrincipal) return 'Principal Delivery Unit';
  return `Alternate DU${alternateIndex + 1}`;
}

export function isB2bAlternateLineActive(line: B2bSalesUnitLine): boolean {
  if (line.disabled) return false;
  return line.rrp.trim().length > 0;
}

export function isB2bPrincipalLineActive(line: B2bSalesUnitLine): boolean {
  if (line.disabled) return false;
  return line.rrp.trim().length > 0 || parseFloat(line.rrp) > 0;
}

function unitsMatch(a: string, b: string): boolean {
  if (!a?.trim() || !b?.trim()) return false;
  const left = a.trim();
  const right = b.trim();
  if (left.toLowerCase() === right.toLowerCase()) return true;
  return fromApiUom(left) === fromApiUom(right) || toApiUom(left) === toApiUom(right);
}

function smallerUnitForYield(yieldU: string): string {
  if (['Gr', 'Kg', 'Mg', 'Tonne'].includes(yieldU)) return 'Gr';
  if (['Ml', 'Cl', 'Ltr', 'FlOz', 'Gal'].includes(yieldU)) return 'Ml';
  return 'Each';
}

export function defaultB2bDeliveryFromSubProduct(
  subProduct: Pick<Product, 'yieldQuantity' | 'yieldUom'>,
): DeliveryUnitBreakdown {
  const yieldUomRaw = subProduct.yieldUom?.trim() || 'Each';
  const yieldU = fromApiUom(yieldUomRaw) || yieldUomRaw;
  const yieldQty = subProduct.yieldQuantity > 0 ? Math.round(subProduct.yieldQuantity) : 1;
  return {
    orderUnit: 'Box',
    orderQty: 1,
    packUnit: yieldU,
    packQty: yieldQty,
    unitUnit: smallerUnitForYield(yieldU),
    unitQty: 1,
  };
}

export function defaultB2bAlternateFromSubProduct(
  subProduct: Pick<Product, 'yieldQuantity' | 'yieldUom'>,
): DeliveryUnitBreakdown {
  const yieldUomRaw = subProduct.yieldUom?.trim() || 'Each';
  const yieldU = fromApiUom(yieldUomRaw) || yieldUomRaw;
  return {
    orderUnit: 'Each',
    orderQty: 1,
    packUnit: yieldU,
    packQty: 1,
    unitUnit: smallerUnitForYield(yieldU),
    unitQty: 1,
  };
}

export function isDeliveryStillBlankDefault(delivery: DeliveryUnitBreakdown): boolean {
  return !delivery.orderUnit.trim()
    && delivery.orderQty <= 0
    && !delivery.packUnit.trim()
    && delivery.packQty <= 0
    && !delivery.unitUnit.trim()
    && delivery.unitQty <= 0;
}

export function getB2bDeliveryUnitChoices(
  subProduct: Pick<Product, 'yieldUom'> | null,
): string[] {
  const choices = new Set<string>(DELIVERY_ORDER_UNITS);
  if (subProduct?.yieldUom?.trim()) {
    const raw = subProduct.yieldUom.trim();
    const display = fromApiUom(raw);
    choices.add(display || raw);
    choices.add(raw);
  }
  return [...choices].sort((a, b) => a.localeCompare(b));
}

export function resolveB2bSalesDeliveryToYieldUom(
  delivery: DeliveryUnitBreakdown,
  subProduct: Pick<Product, 'yieldQuantity' | 'yieldUom'>,
): PrincipalQtyResult {
  const yieldUomRaw = subProduct.yieldUom?.trim() ?? '';
  const yieldU = fromApiUom(yieldUomRaw);
  const smallestUnit = delivery.unitUnit;
  const smallestTotal = totalSmallestMeasure(delivery);

  const direct = resolvePrincipalQty(delivery, yieldU);
  if (direct.qty !== null && direct.qty > 0) return direct;

  if (yieldUomRaw && yieldUomRaw !== yieldU) {
    const rawResolved = resolvePrincipalQty(delivery, yieldUomRaw);
    if (rawResolved.qty !== null && rawResolved.qty > 0) return rawResolved;
  }

  const packMatchesYield = unitsMatch(delivery.packUnit, yieldU) || unitsMatch(delivery.packUnit, yieldUomRaw);
  const orderMatchesYield = unitsMatch(delivery.orderUnit, yieldU) || unitsMatch(delivery.orderUnit, yieldUomRaw);

  if (packMatchesYield) {
    return {
      qty: delivery.orderQty * delivery.packQty,
      auto: true,
      smallestUnit,
      smallestTotal,
    };
  }

  if (orderMatchesYield && delivery.packQty === 1 && delivery.unitQty === 1) {
    return {
      qty: delivery.orderQty,
      auto: true,
      smallestUnit,
      smallestTotal,
    };
  }

  if (unitsMatch(delivery.packUnit, 'Each') && !unitsMatch(yieldU, 'Each') && yieldUomRaw) {
    const qty = delivery.orderQty * delivery.packQty;
    if (qty > 0) {
      return { qty, auto: true, smallestUnit, smallestTotal };
    }
  }

  return { qty: null, auto: false, smallestUnit, smallestTotal };
}

export function b2bDeliveryResolvesToYieldUom(
  delivery: DeliveryUnitBreakdown,
  subProduct: Pick<Product, 'yieldQuantity' | 'yieldUom'> | null,
): boolean {
  if (!subProduct?.yieldUom?.trim()) return false;
  const resolved = resolveB2bSalesDeliveryToYieldUom(delivery, subProduct);
  return resolved.qty !== null && resolved.qty > 0;
}

export function describeB2bDeliveryYieldResolution(
  delivery: DeliveryUnitBreakdown,
  subProduct: Pick<Product, 'yieldQuantity' | 'yieldUom'> | null,
): { ok: boolean; message: string } {
  if (!subProduct?.yieldUom?.trim()) {
    return { ok: false, message: 'Link a sub-product to resolve its Delivery Unit.' };
  }
  const batchLabel = formatSubProductBatchPackageUnit(subProduct);
  const resolved = resolveB2bSalesDeliveryToYieldUom(delivery, subProduct);
  if (resolved.qty === null || resolved.qty <= 0) {
    return {
      ok: false,
      message: `Use Primary / Secondary Packaging to break down Delivery Unit (${batchLabel}) into smaller sellable units that convert to the sub-product Order UOM.`,
    };
  }
  const yieldU = fromApiUom(subProduct.yieldUom) || subProduct.yieldUom;
  return {
    ok: true,
    message: `Resolves to ${resolved.qty} ${yieldU} per Delivery Unit.`,
  };
}

export function seedB2bSalesFromSubProduct(
  config: B2bSalesConfig,
  _subProduct: Pick<Product, 'yieldQuantity' | 'yieldUom'>,
): B2bSalesConfig {
  return config;
}

export function parseB2bSalesConfigJson(json?: string | null): B2bSalesConfig {
  if (!json?.trim()) return blankB2bSalesConfig();
  try {
    const parsed = JSON.parse(json) as Partial<B2bSalesConfig>;
    const principal = parsed.principal
      ? {
          ...blankB2bSalesUnit(true, 'b2b-principal'),
          ...parsed.principal,
          key: parsed.principal.key?.trim() || 'b2b-principal',
          isPrincipal: true,
          delivery: { ...blankDeliveryUnit(), ...parsed.principal.delivery },
        }
      : blankB2bSalesUnit(true, 'b2b-principal');
    const alternates = Array.isArray(parsed.alternates)
      ? ensureB2bAlternates(parsed.alternates.slice(0, MAX_B2B_ALTERNATE_DELIVERY_UNITS).map((line, index) => ({
          ...blankB2bSalesUnit(false, `b2b-alt-${index + 1}`),
          ...line,
          key: line.key || `b2b-alt-${index + 1}`,
          isPrincipal: false,
          delivery: { ...blankDeliveryUnit(), ...line.delivery },
        })))
      : ensureB2bAlternates([]);
    return { principal, alternates };
  } catch {
    return blankB2bSalesConfig();
  }
}

export function serializeB2bSalesConfig(config: B2bSalesConfig): string {
  const serializeLine = (line: B2bSalesUnitLine, isPrincipal: boolean) => {
    const payload: Record<string, unknown> = {
      key: line.key,
      isPrincipal,
      delivery: line.delivery,
      rrp: isPrincipal ? line.rrp : line.rrp.trim(),
    };
    if (line.disabled) payload.disabled = true;
    return payload;
  };

  return JSON.stringify({
    principal: serializeLine(config.principal, true),
    alternates: config.alternates.slice(0, MAX_B2B_ALTERNATE_DELIVERY_UNITS).map(line => serializeLine(line, false)),
  });
}

export function buildB2bConfigForSave(
  config: B2bSalesConfig,
  fallbackRrp: number,
): B2bSalesConfig {
  const principalRrp = config.principal.rrp.trim()
    || (fallbackRrp > 0 ? String(fallbackRrp) : '');
  return {
    ...config,
    principal: {
      ...config.principal,
      isPrincipal: true,
      rrp: principalRrp,
    },
  };
}

export function resolvePrincipalB2bRrp(config: B2bSalesConfig, fallbackRrp: number): number {
  if (!config.principal.disabled) {
    const principalRrp = parseFloat(config.principal.rrp);
    if (principalRrp > 0) return principalRrp;
  }

  const activeAlternate = config.alternates.find(
    alternate => !alternate.disabled && parseFloat(alternate.rrp) > 0,
  );
  if (activeAlternate) return parseFloat(activeAlternate.rrp);

  return fallbackRrp;
}

export function resolveLinkedSubProduct(
  lines: { componentId: string }[],
  savedProducts: Product[],
): Product | null {
  const subProductIds = new Set(
    savedProducts.filter(product => product.isSubProduct).map(product => product.productId),
  );
  const match = lines.find(line => subProductIds.has(line.componentId));
  if (!match) return null;
  return savedProducts.find(product => product.productId === match.componentId) ?? null;
}

export function resolveLinkedSubProductBatchCogs(
  lines: { componentId: string; quantity: string; componentUomPrice: string; sourceProductId?: number }[],
  savedProducts: Product[],
): number | null {
  const subProduct = resolveLinkedSubProduct(lines, savedProducts);
  if (!subProduct) return null;

  const line = lines.find(entry =>
    (entry.sourceProductId != null && entry.sourceProductId === subProduct.id)
    || entry.componentId === subProduct.productId,
  );
  if (line) {
    const qty = parseFloat(line.quantity) || 0;
    const price = parseFloat(line.componentUomPrice) || 0;
    if (qty > 0 && price > 0) return qty * price;
  }

  return calcProductCogs(subProduct.totalCost, subProduct.packagingCost ?? 0, {
    isSubProduct: true,
    b2bEnabled: false,
    b2cEnabled: false,
  });
}

export function calcB2bSalesUnitCogs(
  delivery: DeliveryUnitBreakdown,
  subProduct: Pick<Product, 'totalCost' | 'packagingCost' | 'yieldQuantity' | 'yieldUom' | 'isSubProduct'>,
  batchCogsOverride?: number | null,
): number {
  const batchCogs = batchCogsOverride != null && batchCogsOverride > 0
    ? batchCogsOverride
    : calcProductCogs(subProduct.totalCost, subProduct.packagingCost ?? 0, {
        isSubProduct: true,
        b2bEnabled: false,
        b2cEnabled: false,
      });
  const unitCogs = calcSubProductUnitCost(batchCogs, String(subProduct.yieldQuantity));
  const resolved = resolveB2bSalesDeliveryToYieldUom(delivery, subProduct);
  if (resolved.qty !== null && resolved.qty > 0) {
    return unitCogs * resolved.qty;
  }
  return 0;
}

function parseDeliveryUnitRrp(rrp: string): number {
  const parsed = parseFloat(String(rrp).trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function summarizeB2bSalesUnit(
  line: B2bSalesUnitLine,
  subProduct: Product | null,
  alternateIndex = 0,
  batchCogsOverride?: number | null,
): {
  label: string;
  detailPath: string;
  cogs: number;
  rrp: number;
  cogsPercent: string;
  yieldResolution: { ok: boolean; message: string };
} {
  const label = b2bSalesUnitTitle(line, alternateIndex);
  const detailPath = formatDeliveryUnitPath(line.delivery);
  const rrp = parseDeliveryUnitRrp(line.rrp);
  const cogs = subProduct ? calcB2bSalesUnitCogs(line.delivery, subProduct, batchCogsOverride) : 0;
  const yieldResolution = subProduct
    ? describeB2bDeliveryYieldResolution(line.delivery, subProduct)
    : { ok: false, message: '' };
  return {
    label,
    detailPath,
    cogs,
    rrp,
    cogsPercent: formatCogsPercent(cogs, rrp),
    yieldResolution,
  };
}

export function describeSubProductYield(subProduct: Product): string {
  const batchLabel = formatSubProductBatchPackageUnit(subProduct);
  return batchLabel !== '—' ? `${batchLabel} per batch` : 'Yield not set';
}

export function deliveryUnitHasPackLevel(delivery: DeliveryUnitBreakdown): boolean {
  return delivery.packUnit !== delivery.orderUnit || delivery.packQty !== 1;
}

export function deliveryUnitNeedsSecondLevel(delivery: DeliveryUnitBreakdown): boolean {
  return hasSmallestDeliveryBreakdown(delivery);
}

export function deliveryUnitDetailPath(delivery: DeliveryUnitBreakdown): string {
  return resolveDeliveryUnitLevels(delivery).firstBreakdown
    ? formatDeliveryUnitPath(delivery)
    : formatDeliveryUnitPath(delivery);
}

export function seedAliasB2bSalesConfig(
  aliasConfig: B2bSalesConfig,
  principalConfig: B2bSalesConfig,
  fallbackRrp = 0,
): B2bSalesConfig {
  const aliasHasDelivery = hasSmallestDeliveryBreakdown(aliasConfig.principal.delivery);
  const principal = {
    ...blankB2bSalesUnit(true, aliasConfig.principal.key),
    ...aliasConfig.principal,
    delivery: aliasHasDelivery
      ? aliasConfig.principal.delivery
      : { ...principalConfig.principal.delivery },
    rrp: aliasConfig.principal.rrp.trim()
      || (fallbackRrp > 0 ? String(fallbackRrp) : principalConfig.principal.rrp),
  };
  const alternates = aliasConfig.alternates.some(line => hasSmallestDeliveryBreakdown(line.delivery))
    ? aliasConfig.alternates
    : principalConfig.alternates.map((line, index) => ({
      ...blankB2bSalesUnit(false, line.key || `b2b-alt-${index + 1}`),
      ...line,
      isPrincipal: false,
    }));
  return { principal, alternates };
}

export function resolveCustomerProductB2bConfig(
  product: Product,
  taggedAliasIds: number[],
): { config: B2bSalesConfig; aliasId: number | null; aliasName: string | null } {
  const aliases = product.aliases ?? [];
  const taggedAlias = aliases.find(alias => taggedAliasIds.includes(alias.id));
  if (taggedAlias) {
    const config = parseB2bSalesConfigJson(taggedAlias.b2bSalesConfigJson);
    if (taggedAlias.rrp > 0 && !config.principal.rrp.trim()) {
      config.principal.rrp = String(taggedAlias.rrp);
    }
    return { config, aliasId: taggedAlias.id, aliasName: taggedAlias.name };
  }
  return {
    config: parseB2bSalesConfigJson(product.b2bSalesConfigJson),
    aliasId: null,
    aliasName: null,
  };
}

export function resolveCustomerProductB2bRrp(
  product: Product,
  taggedAliasIds: number[],
): number {
  const { config } = resolveCustomerProductB2bConfig(product, taggedAliasIds);
  return resolvePrincipalB2bRrp(config, product.rrp);
}
