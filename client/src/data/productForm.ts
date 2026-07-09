import { fromApiUom } from './componentForm';
import type { ComponentRow } from './componentForm';
import type { Product } from '../api';
import { formatCountryPercent } from '../utils/numberFormat';
import type { B2bSalesConfig } from './productB2bSales';
import { blankB2bSalesConfig } from './productB2bSales';

export type ProductAliasLine = {
  key: string;
  id?: number;
  name: string;
  rrp: string;
  b2bSalesConfig: B2bSalesConfig;
};

export function blankProductAlias(principalConfig?: B2bSalesConfig): ProductAliasLine {
  return {
    key: `alias-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: '',
    rrp: '',
    b2bSalesConfig: principalConfig
      ? structuredClone(principalConfig)
      : blankB2bSalesConfig(),
  };
}

export function formatCogsPercent(cogs: number, rrp: number, countryCode = 'MY'): string {
  const value = calcCogsPercentValue(cogs, rrp);
  if (value === null) return '—';
  return formatCountryPercent(value, countryCode);
}

export function calcCogsPercentValue(cogs: number, rrp: number): number | null {
  if (rrp <= 0 || cogs < 0) return null;
  return (cogs / rrp) * 100;
}

export type ProductCogsPercentInput = ProductCogsInput & {
  totalCost: number;
  packagingCost: number;
  rrp: number;
  isSubProduct: boolean;
  previousTotalCost?: number | null;
  previousPackagingCost?: number | null;
  previousRrp?: number | null;
};

export type CogsPercentTrend = 'up' | 'down';

export function resolveProductCogsPercent(product: ProductCogsPercentInput): number | null {
  if (product.isSubProduct) return null;
  const cogs = calcProductCogs(product.totalCost, product.packagingCost ?? 0, product);
  return calcCogsPercentValue(cogs, product.rrp);
}

export function resolvePriorProductCogsPercent(product: ProductCogsPercentInput): number | null {
  if (product.isSubProduct) return null;
  if (
    product.previousTotalCost == null
    || product.previousPackagingCost == null
    || product.previousRrp == null
  ) {
    return null;
  }
  const cogs = calcProductCogs(
    product.previousTotalCost,
    product.previousPackagingCost,
    product,
  );
  return calcCogsPercentValue(cogs, product.previousRrp);
}

export function resolveCogsPercentTrend(product: ProductCogsPercentInput): CogsPercentTrend | null {
  const current = resolveProductCogsPercent(product);
  const prior = resolvePriorProductCogsPercent(product);
  if (current === null || prior === null) return null;
  if (Math.abs(current - prior) < 0.05) return null;
  return current > prior ? 'up' : 'down';
}

export type ProductCogsInput = {
  isSubProduct: boolean;
  b2bEnabled: boolean;
  b2cEnabled: boolean;
};

export type ProductCogsContext = {
  /** B2C sales include packaging when POS marks the order as takeaway. */
  isTakeawaySale?: boolean;
};

/** Packaging is rolled into product COGS for sub-products, B2B, or B2C takeaway sales. */
export function shouldIncludePackagingInCogs(
  product: ProductCogsInput,
  context: ProductCogsContext = {},
): boolean {
  if (product.isSubProduct) return true;
  if (product.b2bEnabled) return true;
  if (context.isTakeawaySale) return true;
  return false;
}

export function calcProductCogs(
  componentCost: number,
  packagingCost: number,
  product: ProductCogsInput,
  context: ProductCogsContext = {},
): number {
  if (shouldIncludePackagingInCogs(product, context)) {
    return componentCost + packagingCost;
  }
  return componentCost;
}

export function calcSubProductUnitCost(productCogs: number, yieldQuantity: string): number {
  const qty = parseFloat(yieldQuantity) || 0;
  if (qty <= 0) return 0;
  return productCogs / qty;
}

/** Batch package label from sub-product yield, e.g. "10 pcs". */
export function formatSubProductBatchPackageUnit(product: {
  yieldQuantity: number;
  yieldUom: string;
}): string {
  if (product.yieldQuantity <= 0 || !product.yieldUom) return '—';
  const uom = fromApiUom(product.yieldUom);
  const qty = Number.isInteger(product.yieldQuantity)
    ? String(product.yieldQuantity)
    : product.yieldQuantity.toFixed(2).replace(/\.?0+$/, '');
  return `${qty} ${uom}`;
}

export function getSubProductBatchSize(product: { yieldQuantity: number }): number {
  return product.yieldQuantity > 0 ? product.yieldQuantity : 1;
}

export function resolveManagementBatchUnit(
  product: {
    isSubProduct: boolean;
    yieldQuantity: number;
    yieldUom: string;
    b2bPackageUnit?: string;
  },
  storedUnit?: string,
): string {
  if (product.isSubProduct) {
    const batchLabel = formatSubProductBatchPackageUnit(product);
    if (batchLabel !== '—') return batchLabel;
  }
  return storedUnit?.trim() || product.b2bPackageUnit?.trim() || 'pcs';
}

/** @deprecated Use resolveManagementBatchUnit */
export const resolveManagementPackageUnit = resolveManagementBatchUnit;

export function calcManagementBatchCogs(
  product: ProductCogsInput & { totalCost: number; packagingCost?: number },
): number {
  return calcProductCogs(product.totalCost, product.packagingCost ?? 0, product);
}

export function parseOptionalActivationPeriodHours(value: string): {
  hours: number;
  valid: boolean;
} {
  const trimmed = value.trim();
  if (!trimmed) return { hours: 0, valid: true };
  if (!/^\d+$/.test(trimmed)) return { hours: 0, valid: false };
  return { hours: parseInt(trimmed, 10), valid: true };
}

export function formatActivationPeriodHoursDisplay(hours: number): string {
  return hours > 0 ? String(hours) : '—';
}

export function hasActivationPeriod(hours: number): boolean {
  return hours > 0;
}

export type ProductKind = 'product' | 'subproduct';

export type ProductLine = {
  key: string;
  componentId: string;
  componentName: string;
  componentUom: string;
  componentUomPrice: string;
  quantity: string;
  /** Set when the line references a sub-product recipe (not a smart component). */
  sourceProductId?: number;
};

export function buildComponentIdPrefix(name: string): string {
  const alpha = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return alpha.slice(0, 6) || 'NEW';
}

export function generateProductId(
  name: string,
  kind: ProductKind,
  existingIds: string[],
): string {
  const prefix = kind === 'subproduct' ? 'SUB' : 'PRD';
  const baseId = `${prefix}-${buildComponentIdPrefix(name)}`;
  for (let seq = 1; seq <= 999; seq++) {
    const candidate = `${baseId}-${String(seq).padStart(3, '0')}`;
    if (!existingIds.includes(candidate)) return candidate;
  }
  return `${baseId}-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

export function resolveComponentUomPrice(component: ComponentRow): {
  uom: string;
  price: number;
} {
  const uom = fromApiUom(component.recipeUOM);
  return {
    uom,
    price: component.lastPriceRecipe ?? 0,
  };
}

export function calcLineSubtotal(quantity: string, unitPrice: string): number {
  const qty = parseFloat(quantity) || 0;
  const price = parseFloat(unitPrice) || 0;
  return qty * price;
}

export function calcTotalCost(lines: ProductLine[]): number {
  return lines.reduce(
    (sum, line) => sum + calcLineSubtotal(line.quantity, line.componentUomPrice),
    0,
  );
}

export function isProductLineFilled(line: ProductLine): boolean {
  return Boolean(line.componentId.trim()) && (parseFloat(line.quantity) || 0) > 0;
}

export function blankProductLine(): ProductLine {
  return {
    key: `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    componentId: '',
    componentName: '',
    componentUom: '',
    componentUomPrice: '',
    quantity: '1',
  };
}

export function productLineFromComponent(component: ComponentRow): ProductLine {
  const { uom, price } = resolveComponentUomPrice(component);
  return {
    key: `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    componentId: component.componentId,
    componentName: component.name,
    componentUom: uom,
    componentUomPrice: price > 0 ? String(price) : '',
    quantity: '1',
  };
}

export function productLineFromSubProduct(product: {
  id?: number;
  productId: string;
  name: string;
  totalCost: number;
  packagingCost?: number;
  yieldQuantity: number;
  yieldUom: string;
  isSubProduct: boolean;
}): ProductLine {
  const batchCogs = calcProductCogs(product.totalCost, product.packagingCost ?? 0, {
    isSubProduct: true,
    b2bEnabled: false,
    b2cEnabled: false,
  });
  const batchLabel = formatSubProductBatchPackageUnit(product);
  return {
    key: `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    componentId: product.productId,
    componentName: product.name,
    componentUom: batchLabel !== '—' ? batchLabel : fromApiUom(product.yieldUom),
    componentUomPrice: batchCogs > 0 ? String(batchCogs) : '',
    quantity: '1',
    sourceProductId: product.id,
  };
}

export function filterComponentsForPicker(
  components: ComponentRow[],
  query: string,
): ComponentRow[] {
  const normalized = query.trim().toLowerCase();
  const active = components.filter(c => c.active);

  if (!normalized) {
    return [...active].sort((a, b) => a.name.localeCompare(b.name));
  }

  const scored = active
    .map(component => {
      const name = component.name.toLowerCase();
      const id = component.componentId.toLowerCase();
      let score = 0;
      if (name === normalized || id === normalized) score = 100;
      else if (name.startsWith(normalized) || id.startsWith(normalized)) score = 80;
      else if (name.includes(normalized) || id.includes(normalized)) score = 60;
      else return null;
      return { component, score };
    })
    .filter((row): row is { component: ComponentRow; score: number } => row !== null);

  return scored
    .sort((a, b) => b.score - a.score || a.component.name.localeCompare(b.component.name))
    .map(row => row.component);
}

export function filterSubProductsForPicker(
  products: Product[],
  query: string,
): Product[] {
  const normalized = query.trim().toLowerCase();
  const active = products.filter(product => product.isSubProduct && product.active);

  if (!normalized) {
    return [...active].sort((a, b) => a.name.localeCompare(b.name));
  }

  const scored = active
    .map(product => {
      const name = product.name.toLowerCase();
      const id = product.productId.toLowerCase();
      let score = 0;
      if (name === normalized || id === normalized) score = 100;
      else if (name.startsWith(normalized) || id.startsWith(normalized)) score = 80;
      else if (name.includes(normalized) || id.includes(normalized)) score = 60;
      else return null;
      return { product, score };
    })
    .filter((row): row is { product: Product; score: number } => row !== null);

  return scored
    .sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name))
    .map(row => row.product);
}
