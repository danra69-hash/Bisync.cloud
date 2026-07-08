import { fromApiUom, getConversion, toApiUom } from './componentForm';
import type { B2bSalesConfig } from './productB2bSales';
import { formatDeliveryUnitPath } from './vendorProductCatalog';

export function convertProductParStockQty(
  qty: number,
  fromUom: string,
  toUom: string,
): number | null {
  if (!Number.isFinite(qty) || qty <= 0) return qty;
  if (fromUom === toUom) return qty;
  const conv = getConversion(fromUom, toUom);
  if (conv === null) return null;
  return qty * conv;
}

export function resolveDefaultProductParStockUom(options: {
  isSubProduct: boolean;
  yieldUom?: string;
  b2bEnabled?: boolean;
  b2bSalesConfig?: B2bSalesConfig;
}): string {
  if (options.isSubProduct && options.yieldUom?.trim()) {
    return fromApiUom(options.yieldUom) || options.yieldUom;
  }
  if (options.b2bEnabled && options.b2bSalesConfig) {
    const deliveryLabel = formatDeliveryUnitPath(options.b2bSalesConfig.principal.delivery).trim();
    if (deliveryLabel) {
      const leaf = deliveryLabel.split('>').pop()?.trim();
      if (leaf) return fromApiUom(leaf) || leaf;
    }
  }
  return 'Each';
}

export function productParStockUomOptions(
  knownUnits: string[],
  currentUom: string,
  extraUnits: string[] = [],
): string[] {
  const values = [...knownUnits, ...extraUnits, currentUom]
    .map(unit => unit.trim())
    .filter(Boolean);
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export function serializeProductParStockUom(uom: string): string {
  return toApiUom(uom) || uom;
}

export function formatProductParStock(value: number, uom: string): string {
  if (value <= 0) return '—';
  const decimals = value < 1 ? 4 : value < 10 ? 2 : 1;
  return `${value.toFixed(decimals)} ${uom}`;
}
