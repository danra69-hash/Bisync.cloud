import { getConversion, type AltUnitEntry } from './componentForm';

export type DeliveryUnitBreakdown = {
  orderUnit: string;
  orderQty: number;
  packUnit: string;
  packQty: number;
  unitUnit: string;
  unitQty: number;
};

export type VendorProductCatalogItem = {
  id: string;
  vendorExternalId: string;
  vendorName: string;
  productName: string;
  deliveryPrice: number;
  delivery: DeliveryUnitBreakdown;
};

export const VENDOR_PRODUCT_CATALOG: VendorProductCatalogItem[] = [
  {
    id: 'VP-WAG001', vendorExternalId: 'V001', vendorName: 'Premium Meats Co.',
    productName: 'Wagyu Beef A5', deliveryPrice: 380,
    delivery: { orderUnit: 'Kg', orderQty: 1, packUnit: 'Kg', packQty: 1, unitUnit: 'Kg', unitQty: 1 },
  },
  {
    id: 'VP-RIB001', vendorExternalId: 'V001', vendorName: 'Premium Meats Co.',
    productName: 'Ribeye Prime', deliveryPrice: 145,
    delivery: { orderUnit: 'Kg', orderQty: 1, packUnit: 'Kg', packQty: 1, unitUnit: 'Kg', unitQty: 1 },
  },
  {
    id: 'VP-CHX001', vendorExternalId: 'V001', vendorName: 'Premium Meats Co.',
    productName: 'Free-range Chicken Breast', deliveryPrice: 42,
    delivery: { orderUnit: 'Kg', orderQty: 2, packUnit: 'Kg', packQty: 1, unitUnit: 'Kg', unitQty: 1 },
  },
  {
    id: 'VP-TRU001', vendorExternalId: 'V002', vendorName: 'Fine Truffle Imports',
    productName: 'Black Truffle', deliveryPrice: 180,
    delivery: { orderUnit: 'Gr', orderQty: 100, packUnit: 'Gr', packQty: 1, unitUnit: 'Gr', unitQty: 1 },
  },
  {
    id: 'VP-BUR001', vendorExternalId: 'V003', vendorName: 'Artisan Dairy Co.',
    productName: 'Burrata', deliveryPrice: 52.5,
    delivery: { orderUnit: 'Case', orderQty: 1, packUnit: 'Each', packQty: 6, unitUnit: 'Each', unitQty: 1 },
  },
  {
    id: 'VP-WIN001', vendorExternalId: 'V004', vendorName: 'Wine & Spirits Direct',
    productName: 'Merlot Reserve 2019', deliveryPrice: 95,
    delivery: { orderUnit: 'Bottle', orderQty: 1, packUnit: 'Bottle', packQty: 1, unitUnit: 'Ml', unitQty: 750 },
  },
  {
    id: 'VP-WIN002', vendorExternalId: 'V004', vendorName: 'Wine & Spirits Direct',
    productName: 'Prosecco DOC (case)', deliveryPrice: 720,
    delivery: { orderUnit: 'Box', orderQty: 1, packUnit: 'Bottle', packQty: 24, unitUnit: 'Ml', unitQty: 330 },
  },
  {
    id: 'VP-SPI001', vendorExternalId: 'V004', vendorName: 'Wine & Spirits Direct',
    productName: 'Gin London Dry', deliveryPrice: 62,
    delivery: { orderUnit: 'Bottle', orderQty: 1, packUnit: 'Bottle', packQty: 1, unitUnit: 'Ltr', unitQty: 1 },
  },
  {
    id: 'VP-ESP001', vendorExternalId: 'V010', vendorName: 'Bean Brothers Roasters',
    productName: 'Espresso Beans', deliveryPrice: 26,
    delivery: { orderUnit: 'Kg', orderQty: 1, packUnit: 'Kg', packQty: 1, unitUnit: 'Kg', unitQty: 1 },
  },
  {
    id: 'VP-SAL001', vendorExternalId: 'V005', vendorName: 'Ocean Fresh Seafood',
    productName: 'Atlantic Salmon Fillet', deliveryPrice: 88,
    delivery: { orderUnit: 'Kg', orderQty: 1, packUnit: 'Kg', packQty: 1, unitUnit: 'Kg', unitQty: 1 },
  },
  {
    id: 'VP-BER001', vendorExternalId: 'V006', vendorName: 'Green Valley Produce',
    productName: 'Strawberries', deliveryPrice: 12,
    delivery: { orderUnit: 'Punnet', orderQty: 1, packUnit: 'Gr', packQty: 250, unitUnit: 'Gr', unitQty: 1 },
  },
];

export function formatDeliveryBreakdown(d: DeliveryUnitBreakdown): string {
  const parts: string[] = [`${d.orderQty} ${d.orderUnit}`];
  if (d.packQty !== 1 || d.packUnit !== d.orderUnit) {
    parts.push(`${d.packQty} ${d.packUnit}`);
  }
  if (d.unitQty !== 1 || d.unitUnit !== d.packUnit) {
    parts.push(`${d.unitQty} ${d.unitUnit}`);
  }
  return parts.join(' × ');
}

export function totalSmallestMeasure(d: DeliveryUnitBreakdown): number {
  return d.orderQty * d.packQty * d.unitQty;
}

export type PrincipalQtyResult = {
  qty: number | null;
  auto: boolean;
  smallestUnit: string;
  smallestTotal: number;
};

export function resolvePrincipalQty(
  delivery: DeliveryUnitBreakdown,
  principalUom: string,
): PrincipalQtyResult {
  const smallestUnit = delivery.unitUnit;
  const smallestTotal = totalSmallestMeasure(delivery);

  if (smallestUnit === principalUom) {
    return { qty: smallestTotal, auto: true, smallestUnit, smallestTotal };
  }

  const fromSmallest = getConversion(smallestUnit, principalUom);
  if (fromSmallest !== null) {
    return { qty: smallestTotal * fromSmallest, auto: true, smallestUnit, smallestTotal };
  }

  if (delivery.packQty === 1 && delivery.unitQty === 1) {
    const fromOrder = getConversion(delivery.orderUnit, principalUom);
    if (fromOrder !== null) {
      return { qty: delivery.orderQty * fromOrder, auto: true, smallestUnit, smallestTotal };
    }
  }

  return { qty: null, auto: false, smallestUnit, smallestTotal };
}

function deliveryQtyInUnit(delivery: DeliveryUnitBreakdown, unit: string): number | null {
  const smallestUnit = delivery.unitUnit;
  const smallestTotal = totalSmallestMeasure(delivery);
  if (smallestUnit === unit) return smallestTotal;

  const conv = getConversion(smallestUnit, unit);
  if (conv !== null) return smallestTotal * conv;

  if (delivery.packQty === 1 && delivery.unitQty === 1 && delivery.orderUnit === unit) {
    return delivery.orderQty;
  }

  return null;
}

function convertAmountToPrincipalViaAlt(
  amount: number,
  amountUnit: string,
  alt: AltUnitEntry,
): number | null {
  if (amountUnit !== alt.unit) return null;
  const altFrom = parseFloat(alt.fromQty || '1') || 1;
  const altQty = parseFloat(alt.qty || '1') || 1;
  if (altFrom <= 0) return null;
  return (amount * altQty) / altFrom;
}

/** Resolve delivery quantity in the selected component UOM, including alternate UOM conversions. */
export function resolveComponentUomQty(
  delivery: DeliveryUnitBreakdown,
  principalUnit: string,
  altUnits: AltUnitEntry[],
  targetUom: string,
): PrincipalQtyResult {
  const smallestUnit = delivery.unitUnit;
  const smallestTotal = totalSmallestMeasure(delivery);

  const direct = resolvePrincipalQty(delivery, targetUom);
  if (direct.auto && direct.qty !== null) {
    return direct;
  }

  let qtyInPrincipal: number | null = null;
  let derivedFromAlt = false;

  const toPrincipal = resolvePrincipalQty(delivery, principalUnit);
  if (toPrincipal.auto && toPrincipal.qty !== null) {
    qtyInPrincipal = toPrincipal.qty;
  } else {
    for (const alt of altUnits) {
      const amountInAlt = deliveryQtyInUnit(delivery, alt.unit);
      if (amountInAlt === null) continue;
      const converted = convertAmountToPrincipalViaAlt(amountInAlt, alt.unit, alt);
      if (converted !== null) {
        qtyInPrincipal = converted;
        derivedFromAlt = true;
        break;
      }
    }
  }

  if (qtyInPrincipal === null) {
    return { qty: null, auto: false, smallestUnit, smallestTotal };
  }

  const auto = toPrincipal.auto || derivedFromAlt;

  if (targetUom === principalUnit) {
    return { qty: qtyInPrincipal, auto, smallestUnit, smallestTotal };
  }

  const altTarget = altUnits.find(a => a.unit === targetUom);
  if (altTarget) {
    const altFrom = parseFloat(altTarget.fromQty || '1') || 1;
    const altQty = parseFloat(altTarget.qty || '1') || 1;
    if (altQty <= 0) return { qty: null, auto: false, smallestUnit, smallestTotal };
    return {
      qty: qtyInPrincipal * (altFrom / altQty),
      auto,
      smallestUnit,
      smallestTotal,
    };
  }

  const convFromPrincipal = getConversion(principalUnit, targetUom);
  if (convFromPrincipal !== null) {
    return {
      qty: qtyInPrincipal * convFromPrincipal,
      auto,
      smallestUnit,
      smallestTotal,
    };
  }

  return { qty: null, auto: false, smallestUnit, smallestTotal };
}

export function calcComponentPrincipalUomPrice(deliveryPrice: number, principalQty: number): number {
  return principalQty > 0 ? deliveryPrice / principalQty : 0;
}

/** Nett quantity = delivery quantity after deducting yield loss %. */
export function calcNettUomQty(deliveryQty: number, lossYieldPct: number): number {
  return deliveryQty * (1 - lossYieldPct / 100);
}

/** Nett price = delivery price ÷ nett UOM quantity. */
export function calcNettUomPrice(deliveryPrice: number, nettUomQty: number): number {
  return nettUomQty > 0 ? deliveryPrice / nettUomQty : 0;
}

export function filterVendorProducts(
  catalog: VendorProductCatalogItem[],
  productSearch: string,
  vendorName: string,
): VendorProductCatalogItem[] {
  const q = productSearch.trim().toLowerCase();
  if (!q && !vendorName) return [];

  return catalog.filter(item => {
    const matchVendor = !vendorName || item.vendorName === vendorName;
    const matchSearch = !q
      || item.id.toLowerCase().includes(q)
      || item.productName.toLowerCase().includes(q)
      || item.vendorName.toLowerCase().includes(q)
      || formatDeliveryBreakdown(item.delivery).toLowerCase().includes(q);
    return matchVendor && matchSearch;
  });
}
