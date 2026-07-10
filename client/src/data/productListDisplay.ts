import type { Product } from '../api';
import { formatRm } from './createOrder';
import { fromApiUom } from './componentForm';
import {
  calcProductCogs,
  calcCogsPercentValue,
  calcSubProductUnitCost,
  formatCogsPercent,
  formatSubProductBatchPackageUnit,
} from './productForm';
import {
  isB2bAlternateLineActive,
  isB2bPrincipalLineActive,
  parseB2bSalesConfigJson,
  resolveLinkedSubProduct,
  resolveLinkedSubProductBatchCogs,
  seedAliasB2bSalesConfig,
  summarizeB2bSalesUnit,
  type B2bSalesConfig,
} from './productB2bSales';
import { formatCountryPercent } from '../utils/numberFormat';
import { formatDeliveryUnitPath } from './vendorProductCatalog';

export type ProductListRrpPoint = {
  key: string;
  label: string;
  /** Delivery Unit path (B2B) or Product UOM (B2C / sub-product). */
  deliveryUnit: string;
  rrp: number;
  unitCogs: number | null;
  cogsPercent: number | null;
  cogsPercentLabel: string;
};

function productComponentLines(product: Product) {
  return (product.items ?? []).map(item => ({
    componentId: item.componentId,
    quantity: String(item.quantity),
    componentUomPrice: String(item.componentUomPrice),
    sourceProductId: undefined as number | undefined,
  }));
}

function pushRrpPoint(
  points: ProductListRrpPoint[],
  key: string,
  label: string,
  deliveryUnit: string,
  rrp: number,
  unitCogs: number | null,
) {
  if (rrp <= 0 && unitCogs == null && !deliveryUnit.trim()) return;
  const cogsPercent = unitCogs != null && rrp > 0 ? calcCogsPercentValue(unitCogs, rrp) : null;
  points.push({
    key,
    label,
    deliveryUnit: deliveryUnit.trim() || '—',
    rrp,
    unitCogs,
    cogsPercent,
    cogsPercentLabel: unitCogs != null && rrp > 0 ? formatCogsPercent(unitCogs, rrp) : '—',
  });
}

function addB2bConfigRrpPoints(
  points: ProductListRrpPoint[],
  config: B2bSalesConfig,
  keyPrefix: string,
  labelPrefix: string,
  linkedSubProduct: Product | null,
  batchCogs: number | null,
) {
  if (isB2bPrincipalLineActive(config.principal)) {
    const principal = summarizeB2bSalesUnit(
      config.principal,
      linkedSubProduct,
      0,
      batchCogs,
    );
    pushRrpPoint(
      points,
      `${keyPrefix}-principal`,
      labelPrefix,
      principal.detailPath,
      principal.rrp,
      linkedSubProduct ? principal.cogs : null,
    );
  }

  config.alternates.forEach((alternate, index) => {
    if (!isB2bAlternateLineActive(alternate)) return;
    const summary = summarizeB2bSalesUnit(
      alternate,
      linkedSubProduct,
      index + 1,
      batchCogs,
    );
    pushRrpPoint(
      points,
      `${keyPrefix}-alt-${index}`,
      `${labelPrefix} Alt ${index + 1}`,
      summary.detailPath,
      summary.rrp,
      linkedSubProduct ? summary.cogs : null,
    );
  });
}

/** Flatten principal + alternate (+ alias) Delivery Units for Product List columns. */
export function collectProductListRrpPoints(
  product: Product,
  allProducts: Product[],
): ProductListRrpPoint[] {
  if (product.isSubProduct) {
    const productCogs = calcProductCogs(product.totalCost, product.packagingCost ?? 0, product);
    const deliveryUnit = formatSubProductBatchPackageUnit(product);
    const unitCost = product.yieldQuantity > 0
      ? calcSubProductUnitCost(productCogs, String(product.yieldQuantity))
      : null;
    return [{
      key: 'sub-product',
      label: 'Sub-Product',
      deliveryUnit,
      rrp: 0,
      unitCogs: unitCost,
      cogsPercent: null,
      cogsPercentLabel: '—',
    }];
  }

  const points: ProductListRrpPoint[] = [];
  const lines = productComponentLines(product);
  const linkedSubProduct = resolveLinkedSubProduct(lines, allProducts);
  const batchCogs = resolveLinkedSubProductBatchCogs(lines, allProducts);
  const productCogs = calcProductCogs(product.totalCost, product.packagingCost ?? 0, product);
  const b2cUom = product.yieldUom
    ? fromApiUom(product.yieldUom)
    : (product.b2bPackageUnit?.trim() || 'Each');

  if (product.b2bEnabled) {
    const principalConfig = parseB2bSalesConfigJson(product.b2bSalesConfigJson);
    addB2bConfigRrpPoints(
      points,
      principalConfig,
      'principal',
      'Principal',
      linkedSubProduct,
      batchCogs,
    );

    for (const alias of product.aliases ?? []) {
      const aliasConfig = seedAliasB2bSalesConfig(
        parseB2bSalesConfigJson(alias.b2bSalesConfigJson),
        principalConfig,
        alias.rrp,
      );
      const aliasLabel = alias.name.trim() || `Alias ${alias.id}`;
      addB2bConfigRrpPoints(
        points,
        aliasConfig,
        `alias-${alias.id}`,
        aliasLabel,
        linkedSubProduct,
        batchCogs,
      );
    }
  }

  if (product.b2cEnabled) {
    const alreadyListed = points.some(
      point => point.rrp === product.rrp && point.unitCogs === productCogs,
    );
    if (product.rrp > 0 && !alreadyListed) {
      pushRrpPoint(
        points,
        'b2c',
        'B2C',
        b2cUom,
        product.rrp,
        productCogs,
      );
    }
  }

  if (!product.b2bEnabled && !product.b2cEnabled && product.rrp > 0) {
    pushRrpPoint(points, 'principal', 'Principal', b2cUom, product.rrp, productCogs);
  }

  return points;
}

export function formatProductListCogsPercentRange(
  points: ProductListRrpPoint[],
  countryCode: string,
): string {
  const percents = points
    .map(point => point.cogsPercent)
    .filter((value): value is number => value != null);
  if (percents.length === 0) return '—';

  const min = Math.min(...percents);
  const max = Math.max(...percents);
  if (min === max) return formatCountryPercent(min, countryCode);
  return `${formatCountryPercent(min, countryCode)} to ${formatCountryPercent(max, countryCode)}`;
}

export function formatProductListRrpLines(
  points: ProductListRrpPoint[],
  countryCode: string,
): string[] {
  return points
    .filter(point => point.rrp > 0)
    .map(point => formatRm(point.rrp, countryCode));
}

export function resolveProductListCogsPercentSortValue(
  product: Product,
  allProducts: Product[],
): number {
  if (product.isSubProduct) return -1;
  const percents = collectProductListRrpPoints(product, allProducts)
    .map(point => point.cogsPercent)
    .filter((value): value is number => value != null);
  if (percents.length === 0) return -1;
  return Math.min(...percents);
}

export function resolveProductListRrpSortValue(
  product: Product,
  allProducts: Product[],
): number {
  if (product.isSubProduct) {
    const productCogs = calcProductCogs(product.totalCost, product.packagingCost ?? 0, product);
    if (product.yieldQuantity <= 0 || !product.yieldUom) return -1;
    return calcSubProductUnitCost(productCogs, String(product.yieldQuantity));
  }

  const rrps = collectProductListRrpPoints(product, allProducts)
    .map(point => point.rrp)
    .filter(rrp => rrp > 0);
  if (rrps.length === 0) return -1;
  return Math.min(...rrps);
}

export function resolveProductListDeliveryUnitSortValue(
  product: Product,
  allProducts: Product[],
): string {
  const points = collectProductListRrpPoints(product, allProducts);
  return points[0]?.deliveryUnit ?? '';
}

export function resolveProductListVariationCogsSortValue(
  product: Product,
  allProducts: Product[],
): number {
  const cogsValues = collectProductListRrpPoints(product, allProducts)
    .map(point => point.unitCogs)
    .filter((value): value is number => value != null);
  if (cogsValues.length === 0) return -1;
  return Math.min(...cogsValues);
}

/** Re-export for callers that format a single path. */
export { formatDeliveryUnitPath };
