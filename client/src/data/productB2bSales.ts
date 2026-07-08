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
};

export type B2bSalesConfig = {
  principal: B2bSalesUnitLine;
  alternates: B2bSalesUnitLine[];
};

export function blankDeliveryUnit(): DeliveryUnitBreakdown {
  return {
    orderUnit: 'Box',
    orderQty: 1,
    packUnit: 'Each',
    packQty: 1,
    unitUnit: 'Gr',
    unitQty: 1,
  };
}

export function blankB2bSalesUnit(isPrincipal = false, key?: string): B2bSalesUnitLine {
  return {
    key: key || `b2b-unit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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
  return line.rrp.trim().length > 0;
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
  const blank = blankDeliveryUnit();
  return delivery.orderUnit === blank.orderUnit
    && delivery.orderQty === blank.orderQty
    && delivery.packUnit === blank.packUnit
    && delivery.packQty === blank.packQty
    && delivery.unitUnit === blank.unitUnit
    && delivery.unitQty === blank.unitQty;
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
    return { ok: false, message: 'Link a sub-product to resolve batch UOM.' };
  }
  const batchLabel = formatSubProductBatchPackageUnit(subProduct);
  const resolved = resolveB2bSalesDeliveryToYieldUom(delivery, subProduct);
  if (resolved.qty === null || resolved.qty <= 0) {
    return {
      ok: false,
      message: `Use Pack and Unit rows to break down batch UOM (${batchLabel}) into smaller sellable units.`,
    };
  }
  const yieldU = fromApiUom(subProduct.yieldUom) || subProduct.yieldUom;
  return {
    ok: true,
    message: `Resolves to ${resolved.qty} ${yieldU} per delivery unit.`,
  };
}

export function seedB2bSalesFromSubProduct(
  config: B2bSalesConfig,
  subProduct: Pick<Product, 'yieldQuantity' | 'yieldUom'>,
): B2bSalesConfig {
  return {
    ...config,
    principal: isDeliveryStillBlankDefault(config.principal.delivery)
      ? { ...config.principal, delivery: defaultB2bDeliveryFromSubProduct(subProduct) }
      : config.principal,
    alternates: config.alternates.map((line, index) => (
      isDeliveryStillBlankDefault(line.delivery)
        ? {
            ...line,
            delivery: index === 0
              ? defaultB2bAlternateFromSubProduct(subProduct)
              : defaultB2bAlternateFromSubProduct(subProduct),
          }
        : line
    )),
  };
}

export function parseB2bSalesConfigJson(json?: string | null): B2bSalesConfig {
  if (!json?.trim()) return blankB2bSalesConfig();
  try {
    const parsed = JSON.parse(json) as Partial<B2bSalesConfig>;
    const principal = parsed.principal
      ? {
          ...blankB2bSalesUnit(true),
          ...parsed.principal,
          isPrincipal: true,
          delivery: { ...blankDeliveryUnit(), ...parsed.principal.delivery },
        }
      : blankB2bSalesUnit(true);
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
  return JSON.stringify({
    principal: {
      key: config.principal.key,
      isPrincipal: true,
      delivery: config.principal.delivery,
      rrp: config.principal.rrp,
    },
    alternates: config.alternates.slice(0, MAX_B2B_ALTERNATE_DELIVERY_UNITS).map(line => ({
      key: line.key,
      isPrincipal: false,
      delivery: line.delivery,
      rrp: line.rrp.trim(),
    })),
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
  return parseFloat(config.principal.rrp) || fallbackRrp;
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

export function calcB2bSalesUnitCogs(
  delivery: DeliveryUnitBreakdown,
  subProduct: Pick<Product, 'totalCost' | 'packagingCost' | 'yieldQuantity' | 'yieldUom' | 'isSubProduct'>,
): number {
  const batchCogs = calcProductCogs(subProduct.totalCost, subProduct.packagingCost ?? 0, {
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

export function summarizeB2bSalesUnit(
  line: B2bSalesUnitLine,
  subProduct: Product | null,
  alternateIndex = 0,
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
  const rrp = parseFloat(line.rrp) || 0;
  const cogs = subProduct ? calcB2bSalesUnitCogs(line.delivery, subProduct) : 0;
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
