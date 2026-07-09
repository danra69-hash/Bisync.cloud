import type { Product } from '../api';
import { formatRm } from './createOrder';
import { calcProductCogs, calcCogsPercentValue, calcSubProductUnitCost } from './productForm';
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

export type ProductListRrpPoint = {
  key: string;
  label: string;
  rrp: number;
  unitCogs: number | null;
  cogsPercent: number | null;
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
  rrp: number,
  unitCogs: number | null,
) {
  if (rrp <= 0) return;
  points.push({
    key,
    label,
    rrp,
    unitCogs,
    cogsPercent: unitCogs != null ? calcCogsPercentValue(unitCogs, rrp) : null,
  });
}

function addB2bConfigRrpPoints(
  points: ProductListRrpPoint[],
  config: B2bSalesConfig,
  keyPrefix: string,
  labelPrefix: string,
  linkedSubProduct: Product,
  batchCogs: number | null,
) {
  const principal = summarizeB2bSalesUnit(
    config.principal,
    linkedSubProduct,
    0,
    batchCogs,
  );
  if (isB2bPrincipalLineActive(config.principal)) {
    pushRrpPoint(
      points,
      `${keyPrefix}-principal`,
      labelPrefix,
      principal.rrp,
      principal.cogs,
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
      summary.rrp,
      summary.cogs,
    );
  });
}

export function collectProductListRrpPoints(
  product: Product,
  allProducts: Product[],
): ProductListRrpPoint[] {
  if (product.isSubProduct) return [];

  const points: ProductListRrpPoint[] = [];
  const lines = productComponentLines(product);
  const linkedSubProduct = resolveLinkedSubProduct(lines, allProducts);
  const batchCogs = resolveLinkedSubProductBatchCogs(lines, allProducts);
  const productCogs = calcProductCogs(product.totalCost, product.packagingCost ?? 0, product);

  if (product.b2bEnabled && linkedSubProduct) {
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
  } else if (product.b2bEnabled) {
    const principalConfig = parseB2bSalesConfigJson(product.b2bSalesConfigJson);
    if (isB2bPrincipalLineActive(principalConfig.principal)) {
      const principalRrp = parseFloat(principalConfig.principal.rrp) || product.rrp;
      pushRrpPoint(points, 'principal', 'Principal', principalRrp, null);
    }

    principalConfig.alternates.forEach((alternate, index) => {
      if (!isB2bAlternateLineActive(alternate)) return;
      const rrp = parseFloat(alternate.rrp) || 0;
      pushRrpPoint(points, `alt-${index}`, `Alt ${index + 1}`, rrp, null);
    });

    for (const alias of product.aliases ?? []) {
      const aliasConfig = seedAliasB2bSalesConfig(
        parseB2bSalesConfigJson(alias.b2bSalesConfigJson),
        principalConfig,
        alias.rrp,
      );
      const aliasLabel = alias.name.trim() || `Alias ${alias.id}`;
      if (isB2bPrincipalLineActive(aliasConfig.principal)) {
        const aliasRrp = parseFloat(aliasConfig.principal.rrp) || alias.rrp;
        pushRrpPoint(points, `alias-${alias.id}`, aliasLabel, aliasRrp, null);
      }
    }
  } else {
    pushRrpPoint(points, 'principal', 'Principal', product.rrp, productCogs);
    for (const alias of product.aliases ?? []) {
      pushRrpPoint(
        points,
        `alias-${alias.id}`,
        alias.name.trim() || `Alias ${alias.id}`,
        alias.rrp,
        productCogs,
      );
    }
  }

  if (product.b2cEnabled && product.b2bEnabled) {
    const alreadyListed = points.some(
      point => point.rrp === product.rrp && point.unitCogs === productCogs,
    );
    if (product.rrp > 0 && !alreadyListed) {
      pushRrpPoint(points, 'b2c', 'B2C', product.rrp, productCogs);
    }
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
