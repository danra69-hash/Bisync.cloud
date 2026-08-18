import { fromApiUom, getConversion, type AltUnitEntry } from './componentForm';
import { parseYieldAltUnitsJson } from './productBatchUom';
import {
  parseB2bSalesConfigJson,
  type B2bSalesConfig,
} from './productB2bSales';
import {
  formatDeliveryUnitPath,
  totalSmallestMeasure,
  type DeliveryUnitBreakdown,
} from './vendorProductCatalog';

export type ProduceUomOption = {
  key: string;
  label: string;
  kind: 'production' | 'production-alt' | 'delivery' | 'delivery-alt' | 'batch';
  /** Multiply entered qty by this to get stock/base qty (principal delivery order units, or sub-product batch units). */
  factorToBase: number;
};

function unitsMatch(a: string, b: string): boolean {
  if (!a?.trim() || !b?.trim()) return false;
  const left = fromApiUom(a.trim()) || a.trim();
  const right = fromApiUom(b.trim()) || b.trim();
  return left.toLowerCase() === right.toLowerCase();
}

/** Convert qty expressed in `unit` into principal delivery order units. */
export function productionUnitToDeliveryOrderQty(
  qty: number,
  unit: string,
  delivery: DeliveryUnitBreakdown,
): number | null {
  if (!(qty > 0) || !unit.trim()) return null;
  const orderUnit = delivery.orderUnit?.trim() || '';
  const packUnit = delivery.packUnit?.trim() || orderUnit;
  const unitUnit = delivery.unitUnit?.trim() || packUnit;
  const orderQty = delivery.orderQty > 0 ? delivery.orderQty : 1;
  const packQty = delivery.packQty > 0 ? delivery.packQty : 1;
  const unitQty = delivery.unitQty > 0 ? delivery.unitQty : 1;
  const smallestPerOrder = orderQty * packQty * unitQty;

  if (unitsMatch(unit, unitUnit) && smallestPerOrder > 0) {
    return qty / smallestPerOrder;
  }
  if (unitsMatch(unit, packUnit) && orderQty * packQty > 0) {
    return qty / (orderQty * packQty);
  }
  if (unitsMatch(unit, orderUnit) && orderQty > 0) {
    return qty / orderQty;
  }

  const toSmallest = getConversion(fromApiUom(unit) || unit, fromApiUom(unitUnit) || unitUnit);
  if (toSmallest !== null && smallestPerOrder > 0) {
    return (qty * toSmallest) / smallestPerOrder;
  }
  return null;
}

function altToPrincipalQty(entered: number, alt: AltUnitEntry): number | null {
  const from = parseFloat(alt.fromQty || '1') || 1;
  const toPrincipal = parseFloat(alt.qty || '') || 0;
  if (!(from > 0) || !(toPrincipal > 0)) return null;
  // 1 alt (fromQty of alt.unit) = qty × principal → principal = entered * (qty / fromQty)
  return entered * (toPrincipal / from);
}

export function listProduceUomOptions(product: {
  isSubProduct: boolean;
  yieldUom?: string;
  yieldAltUnitsJson?: string;
  b2bPackageUnit?: string;
  b2bSalesConfigJson?: string;
  batchUnit?: string;
}): ProduceUomOption[] {
  const options: ProduceUomOption[] = [];
  const seen = new Set<string>();

  function push(option: ProduceUomOption) {
    const key = option.label.trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    options.push(option);
  }

  if (product.isSubProduct) {
    const production = fromApiUom(product.yieldUom || '') || (product.yieldUom || '').trim();
    if (production) {
      push({ key: 'production', label: production, kind: 'production', factorToBase: 1 });
      const alts = parseYieldAltUnitsJson(product.yieldAltUnitsJson);
      for (const [index, alt] of alts.entries()) {
        const unit = fromApiUom(alt.unit) || alt.unit.trim();
        if (!unit) continue;
        const principalPerAlt = altToPrincipalQty(1, alt);
        if (principalPerAlt == null || !(principalPerAlt > 0)) continue;
        push({
          key: `production-alt-${index}`,
          label: unit,
          kind: 'production-alt',
          factorToBase: principalPerAlt,
        });
      }
    }
    const batch = (product.batchUnit || '').trim();
    if (batch) {
      push({ key: 'batch', label: batch, kind: 'batch', factorToBase: 1 });
    }
    return options;
  }

  const config: B2bSalesConfig = parseB2bSalesConfigJson(product.b2bSalesConfigJson);
  const principalDelivery = config.principal.delivery;
  const principalPath = formatDeliveryUnitPath(principalDelivery).trim()
    || (product.b2bPackageUnit || '').trim()
    || (product.batchUnit || '').trim()
    || 'pcs';
  const principalSmallest = totalSmallestMeasure(principalDelivery);

  push({
    key: 'delivery',
    label: principalPath,
    kind: 'delivery',
    factorToBase: 1,
  });

  config.alternates.forEach((line, index) => {
    const path = formatDeliveryUnitPath(line.delivery).trim();
    if (!path) return;
    const altSmallest = totalSmallestMeasure(line.delivery);
    const factor = principalSmallest > 0 && altSmallest > 0
      ? altSmallest / principalSmallest
      : 1;
    push({
      key: `delivery-alt-${index}`,
      label: path,
      kind: 'delivery-alt',
      factorToBase: factor,
    });
  });

  const production = fromApiUom(product.yieldUom || '') || (product.yieldUom || '').trim();
  if (production) {
    const factor = productionUnitToDeliveryOrderQty(1, production, principalDelivery);
    push({
      key: 'production',
      label: production,
      kind: 'production',
      factorToBase: factor != null && factor > 0 ? factor : 1,
    });

    const alts = parseYieldAltUnitsJson(product.yieldAltUnitsJson);
    for (const [index, alt] of alts.entries()) {
      const unit = fromApiUom(alt.unit) || alt.unit.trim();
      if (!unit) continue;
      const principalQty = altToPrincipalQty(1, alt);
      if (principalQty == null) continue;
      const toOrder = productionUnitToDeliveryOrderQty(principalQty, production, principalDelivery);
      push({
        key: `production-alt-${index}`,
        label: unit,
        kind: 'production-alt',
        factorToBase: toOrder != null && toOrder > 0 ? toOrder : principalQty,
      });
    }
  }

  return options;
}

export function convertProduceQtyToBase(
  enteredQty: number,
  selectedLabel: string,
  options: ProduceUomOption[],
): number {
  if (!(enteredQty > 0)) return 0;
  const match = options.find(o => o.label === selectedLabel)
    || options.find(o => o.label.trim().toLowerCase() === selectedLabel.trim().toLowerCase());
  const factor = match?.factorToBase ?? 1;
  return enteredQty * factor;
}

export function defaultProduceUomLabel(
  options: ProduceUomOption[],
  fallbackBatchUnit: string,
): string {
  if (options.length === 0) return fallbackBatchUnit || 'pcs';
  const delivery = options.find(o => o.kind === 'delivery');
  if (delivery) return delivery.label;
  const production = options.find(o => o.kind === 'production');
  if (production) return production.label;
  return options[0].label;
}
