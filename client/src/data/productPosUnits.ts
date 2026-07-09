import type { Product } from '../api';
import { calcProductCogs } from './productForm';
import {
  b2bSalesUnitTitle,
  isB2bAlternateLineActive,
  isB2bPrincipalLineActive,
  parseB2bSalesConfigJson,
  resolveB2bSalesDeliveryToYieldUom,
  resolveLinkedSubProduct,
  resolveLinkedSubProductBatchCogs,
  summarizeB2bSalesUnit,
  type B2bSalesConfig,
  type B2bSalesUnitLine,
} from './productB2bSales';
import { hasSmallestDeliveryBreakdown, totalSmallestMeasure, type DeliveryUnitBreakdown } from './vendorProductCatalog';

export type PosDeliveryUnitSelection = {
  unitKey: string;
};

export type ProductPosUnitRow = {
  key: string;
  unitKey: string;
  unitTitle: string;
  deliveryPath: string;
  deliverySortQty: number;
  rrp: number;
  unitCogs: number;
};

function productComponentLines(product: Product) {
  return (product.items ?? []).map(item => ({
    componentId: item.componentId,
    quantity: String(item.quantity),
    componentUomPrice: String(item.componentUomPrice),
    sourceProductId: undefined as number | undefined,
  }));
}

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

function isTaggableLine(line: B2bSalesUnitLine): boolean {
  if (line.disabled) return false;
  if (hasSmallestDeliveryBreakdown(line.delivery)) return true;
  if (line.isPrincipal) return isB2bPrincipalLineActive(line);
  return isB2bAlternateLineActive(line);
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

export function collectProductPosUnitRows(
  product: Product,
  catalogProducts: Product[],
): ProductPosUnitRow[] {
  const rows: ProductPosUnitRow[] = [];
  const lines = productComponentLines(product);
  const linkedSubProduct = resolveLinkedSubProduct(lines, catalogProducts);
  const batchCogs = resolveLinkedSubProductBatchCogs(lines, catalogProducts);
  const productCogs = calcProductCogs(product.totalCost, product.packagingCost ?? 0, product);

  if (product.b2bEnabled) {
    const config = parseB2bSalesConfigJson(product.b2bSalesConfigJson);
    for (const { line, alternateIndex } of collectLinesFromConfig(config)) {
      const summary = summarizeB2bSalesUnit(
        line,
        linkedSubProduct,
        alternateIndex,
        batchCogs,
      );
      rows.push({
        key: line.key,
        unitKey: line.key,
        unitTitle: b2bSalesUnitTitle(line, line.isPrincipal ? 0 : alternateIndex - 1),
        deliveryPath: summary.detailPath || '—',
        deliverySortQty: resolveDeliveryUnitSortQty(line.delivery, linkedSubProduct),
        rrp: summary.rrp,
        unitCogs: summary.cogs,
      });
    }
  }

  if (product.b2cEnabled && product.rrp > 0) {
    const duplicate = rows.some(row => row.rrp === product.rrp && row.unitCogs === productCogs);
    if (!duplicate) {
      rows.push({
        key: 'b2c-retail',
        unitKey: 'b2c-retail',
        unitTitle: 'B2C Retail',
        deliveryPath: 'Standard retail unit',
        deliverySortQty: 0,
        rrp: product.rrp,
        unitCogs: productCogs,
      });
    }
  }

  if (rows.length === 0 && product.rrp > 0) {
    rows.push({
      key: 'b2c-retail',
      unitKey: 'b2c-retail',
      unitTitle: 'Retail',
      deliveryPath: 'Standard retail unit',
      deliverySortQty: 0,
      rrp: product.rrp,
      unitCogs: productCogs,
    });
  }

  return rows.sort((a, b) => a.deliverySortQty - b.deliverySortQty);
}

export function parsePosDeliveryUnits(
  product: Pick<Product, 'posDeliveryUnitsJson'>,
): PosDeliveryUnitSelection[] {
  if (!product.posDeliveryUnitsJson?.trim() || product.posDeliveryUnitsJson === '[]') return [];
  try {
    const parsed = JSON.parse(product.posDeliveryUnitsJson) as Record<string, unknown>[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(row => ({
        unitKey: String(row.unitKey ?? row.UnitKey ?? '').trim(),
      }))
      .filter(row => row.unitKey.length > 0);
  } catch {
    return [];
  }
}

export function serializePosDeliveryUnits(units: PosDeliveryUnitSelection[]): string {
  return JSON.stringify(units.map(unit => ({ unitKey: unit.unitKey })));
}

export function isPosDeliveryUnitSelected(
  selected: PosDeliveryUnitSelection[],
  unitKey: string,
): boolean {
  return selected.some(unit => unit.unitKey === unitKey);
}

export function togglePosDeliveryUnit(
  selected: PosDeliveryUnitSelection[],
  unitKey: string,
): PosDeliveryUnitSelection[] {
  if (selected.some(unit => unit.unitKey === unitKey)) {
    return selected.filter(unit => unit.unitKey !== unitKey);
  }
  return [...selected, { unitKey }];
}
