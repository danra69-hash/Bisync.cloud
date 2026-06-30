import { getConversion, RECIPE_UNITS, type AltUnitEntry } from './componentForm';
import { EXTENDED_VENDOR_CONTACTS, EXTENDED_VENDOR_PRODUCTS } from './vendorProductCatalogExtras';
import type { Vendor } from '../api';

export type DeliveryUnitBreakdown = {
  orderUnit: string;
  orderQty: number;
  packUnit: string;
  packQty: number;
  unitUnit: string;
  unitQty: number;
};

export type DeliveryUnitLevels = {
  orderUnit: string;
  firstBreakdown: string | null;
  secondBreakdown: string | null;
};

export type VendorProductCatalogItem = {
  id: string;
  group: string;
  vendorExternalId: string;
  vendorName: string;
  productName: string;
  specification: string;
  imageUrl?: string;
  deliveryPrice: number;
  delivery: DeliveryUnitBreakdown;
};

export type VendorProductImportDraft = {
  productName: string;
  group: string;
  specification: string;
  deliveryUnitText: string;
  deliveryPrice: number;
};

export const VENDOR_PRODUCT_CATALOG: VendorProductCatalogItem[] = [
  {
    id: 'VP-WAG001', group: 'Proteins', vendorExternalId: 'V001', vendorName: 'Premium Meats Co.',
    productName: 'Wagyu Beef A5', specification: 'A5 grade wagyu, marbling score 8+, chilled',
    imageUrl: 'https://picsum.photos/seed/vp-wag001/80/80',
    deliveryPrice: 380,
    delivery: { orderUnit: 'Kg', orderQty: 1, packUnit: 'Kg', packQty: 1, unitUnit: 'Kg', unitQty: 1 },
  },
  {
    id: 'VP-RIB001', group: 'Proteins', vendorExternalId: 'V001', vendorName: 'Premium Meats Co.',
    productName: 'Ribeye Prime', specification: 'USDA Prime ribeye, boneless, vacuum packed',
    imageUrl: 'https://picsum.photos/seed/vp-rib001/80/80',
    deliveryPrice: 145,
    delivery: { orderUnit: 'Kg', orderQty: 1, packUnit: 'Kg', packQty: 1, unitUnit: 'Kg', unitQty: 1 },
  },
  {
    id: 'VP-CHX001', group: 'Proteins', vendorExternalId: 'V001', vendorName: 'Premium Meats Co.',
    productName: 'Free-range Chicken Breast', specification: 'Skinless chicken breast, free-range, trimmed',
    imageUrl: 'https://picsum.photos/seed/vp-chx001/80/80',
    deliveryPrice: 42,
    delivery: { orderUnit: 'Kg', orderQty: 2, packUnit: 'Kg', packQty: 1, unitUnit: 'Kg', unitQty: 1 },
  },
  {
    id: 'VP-TRU001', group: 'Produce', vendorExternalId: 'V002', vendorName: 'Fine Truffle Imports',
    productName: 'Black Truffle', specification: 'Fresh Périgord black truffle, brushed, refrigerated',
    imageUrl: 'https://picsum.photos/seed/vp-tru001/80/80',
    deliveryPrice: 180,
    delivery: { orderUnit: 'Gr', orderQty: 100, packUnit: 'Gr', packQty: 1, unitUnit: 'Gr', unitQty: 1 },
  },
  {
    id: 'VP-BUR001', group: 'Dairy', vendorExternalId: 'V003', vendorName: 'Artisan Dairy Co.',
    productName: 'Burrata', specification: 'Fresh burrata in whey, 125g each, Italian origin',
    imageUrl: 'https://picsum.photos/seed/vp-bur001/80/80',
    deliveryPrice: 52.5,
    delivery: { orderUnit: 'Case', orderQty: 1, packUnit: 'Each', packQty: 6, unitUnit: 'Each', unitQty: 1 },
  },
  {
    id: 'VP-WIN001', group: 'Beverages', vendorExternalId: 'V004', vendorName: 'Wine & Spirits Direct',
    productName: 'Merlot Reserve 2019', specification: '750ml bottle, 13.5% ABV, cork finish',
    imageUrl: 'https://picsum.photos/seed/vp-win001/80/80',
    deliveryPrice: 95,
    delivery: { orderUnit: 'Bottle', orderQty: 1, packUnit: 'Ml', packQty: 750, unitUnit: 'Ml', unitQty: 1 },
  },
  {
    id: 'VP-WIN002', group: 'Beverages', vendorExternalId: 'V004', vendorName: 'Wine & Spirits Direct',
    productName: 'Prosecco DOC (case)', specification: 'DOC Prosecco, 330ml bottles, 11% ABV',
    imageUrl: 'https://picsum.photos/seed/vp-win002/80/80',
    deliveryPrice: 720,
    delivery: { orderUnit: 'Box', orderQty: 1, packUnit: 'Bottle', packQty: 24, unitUnit: 'Ml', unitQty: 330 },
  },
  {
    id: 'VP-SPI001', group: 'Beverages', vendorExternalId: 'V004', vendorName: 'Wine & Spirits Direct',
    productName: 'Gin London Dry', specification: 'London dry gin, 1L bottle, 40% ABV',
    imageUrl: 'https://picsum.photos/seed/vp-spi001/80/80',
    deliveryPrice: 62,
    delivery: { orderUnit: 'Bottle', orderQty: 1, packUnit: 'Ltr', packQty: 1, unitUnit: 'Ltr', unitQty: 1 },
  },
  {
    id: 'VP-DRA001', group: 'Beverages', vendorExternalId: 'V004', vendorName: 'Wine & Spirits Direct',
    productName: 'Draught Lager (keg)', specification: '30L stainless keg, 4.5% ABV, returnable keg',
    imageUrl: 'https://picsum.photos/seed/vp-dra001/80/80',
    deliveryPrice: 210,
    delivery: { orderUnit: 'Keg', orderQty: 1, packUnit: 'Ltr', packQty: 30, unitUnit: 'Ltr', unitQty: 1 },
  },
  {
    id: 'VP-CRT001', group: 'Beverages', vendorExternalId: 'V004', vendorName: 'Wine & Spirits Direct',
    productName: 'Fountain Syrup (crate)', specification: 'Cola syrup concentrate, 1L bottles, food-grade',
    imageUrl: 'https://picsum.photos/seed/vp-crt001/80/80',
    deliveryPrice: 185,
    delivery: { orderUnit: 'Crate', orderQty: 1, packUnit: 'Bottle', packQty: 12, unitUnit: 'Ltr', unitQty: 1 },
  },
  {
    id: 'VP-ESP001', group: 'Beverages', vendorExternalId: 'V010', vendorName: 'Bean Brothers Roasters',
    productName: 'Espresso Beans', specification: 'Single-origin arabica, medium roast, whole bean',
    imageUrl: 'https://picsum.photos/seed/vp-esp001/80/80',
    deliveryPrice: 26,
    delivery: { orderUnit: 'Kg', orderQty: 1, packUnit: 'Kg', packQty: 1, unitUnit: 'Kg', unitQty: 1 },
  },
  {
    id: 'VP-SAL001', group: 'Seafood', vendorExternalId: 'V005', vendorName: 'Ocean Fresh Seafood',
    productName: 'Atlantic Salmon Fillet', specification: 'Skin-on fillet, sustainably farmed, chilled',
    imageUrl: 'https://picsum.photos/seed/vp-sal001/80/80',
    deliveryPrice: 88,
    delivery: { orderUnit: 'Kg', orderQty: 1, packUnit: 'Kg', packQty: 1, unitUnit: 'Kg', unitQty: 1 },
  },
  {
    id: 'VP-BER001', group: 'Produce', vendorExternalId: 'V006', vendorName: 'Green Valley Produce',
    productName: 'Strawberries', specification: 'Fresh strawberries, 250g punnet, chilled',
    imageUrl: 'https://picsum.photos/seed/vp-ber001/80/80',
    deliveryPrice: 12,
    delivery: { orderUnit: 'Punnet', orderQty: 1, packUnit: 'Gr', packQty: 250, unitUnit: 'Gr', unitQty: 1 },
  },
  {
    id: 'VP-BEA001', group: 'Dry Goods', vendorExternalId: 'V007', vendorName: 'Heritage Pantry Supply',
    productName: 'Baked Beans', specification: 'Baked beans in tomato sauce, 400g tins, shelf-stable',
    imageUrl: 'https://picsum.photos/seed/vp-bea001/80/80',
    deliveryPrice: 42,
    delivery: { orderUnit: 'Box', orderQty: 1, packUnit: 'Tin', packQty: 12, unitUnit: 'Gr', unitQty: 400 },
  },
  {
    id: 'VP-BEA002', group: 'Dry Goods', vendorExternalId: 'V011', vendorName: 'Metro Canned Foods',
    productName: 'Baked Beans', specification: 'Haricot beans in rich tomato sauce, 380g tins, Metro Classic line',
    imageUrl: 'https://picsum.photos/seed/vp-bea002/80/80',
    deliveryPrice: 39.5,
    delivery: { orderUnit: 'Box', orderQty: 1, packUnit: 'Tin', packQty: 12, unitUnit: 'Gr', unitQty: 380 },
  },
  ...EXTENDED_VENDOR_PRODUCTS,
];

type CatalogVendorContact = Pick<Vendor, 'contactPerson' | 'contactPosition' | 'mobile' | 'email'>;

const CATALOG_VENDOR_CONTACTS: Record<string, CatalogVendorContact> = {
  V001: { contactPerson: 'Ahmad Razali', contactPosition: 'Sales Manager', mobile: '+60 12-345 6789', email: 'sales@premiummeats.my' },
  V002: { contactPerson: 'Jean-Luc Prive', contactPosition: 'Account Manager', mobile: '+60 16-778 9900', email: 'jl@truffleimports.com' },
  V003: { contactPerson: 'Sofia Lim', contactPosition: 'Sales Executive', mobile: '+60 18-901 2233', email: 'orders@artisandairy.my' },
  V004: { contactPerson: 'Melissa Tan', contactPosition: 'Sales Executive', mobile: '+60 19-887 6543', email: 'melissa@winedirect.my' },
  V005: { contactPerson: 'Haji Sulaiman', contactPosition: 'Sales Manager', mobile: '+60 13-456 7890', email: 'fresh@oceanfish.my' },
  V006: { contactPerson: 'Lee Wei Jie', contactPosition: 'Account Manager', mobile: '+60 12-778 3344', email: 'sales@greenvalley.my' },
  V007: { contactPerson: 'Ravi Kumar', contactPosition: 'Sales Manager', mobile: '+60 17-234 5678', email: 'sales@heritagepantry.my' },
  V010: { contactPerson: 'Marcus Tan', contactPosition: 'Sales Manager', mobile: '+60 16-445 6677', email: 'wholesale@beanbrothers.my' },
  V011: { contactPerson: 'Nurul Izzati', contactPosition: 'Account Manager', mobile: '+60 12-556 7890', email: 'orders@metrocanned.my' },
  ...EXTENDED_VENDOR_CONTACTS,
};

/** Fallback vendor record when API list is stale or missing a catalog vendor (e.g. before API restart). */
export function catalogVendorStub(
  product: Pick<VendorProductCatalogItem, 'vendorExternalId' | 'vendorName' | 'group'>,
): Vendor {
  const contact = CATALOG_VENDOR_CONTACTS[product.vendorExternalId];
  return {
    id: 0,
    externalId: product.vendorExternalId,
    name: product.vendorName,
    type: 'offline',
    products: product.group,
    city: '',
    state: '',
    address: '',
    contactPerson: contact?.contactPerson ?? '',
    contactPosition: contact?.contactPosition ?? '',
    mobile: contact?.mobile ?? '',
    email: contact?.email ?? '',
    contactsJson: '[]',
    engaged: false,
  };
}

export function resolveCatalogVendor(
  product: VendorProductCatalogItem,
  vendorsByExternalId: Map<string, Vendor>,
): Vendor {
  return vendorsByExternalId.get(product.vendorExternalId) ?? catalogVendorStub(product);
}

/** Whether a unit can convert directly into a principal component UOM (e.g. Ltr → Ml). */
export function unitConvertsToPrincipalComponentUom(unit: string): boolean {
  if (RECIPE_UNITS.includes(unit)) return true;
  return RECIPE_UNITS.some(u => getConversion(unit, u) !== null);
}

/** Third delivery breakdown level (e.g. 400gr per tin in Box/12tin/400gr). */
export function hasSmallestDeliveryBreakdown(delivery: DeliveryUnitBreakdown): boolean {
  const hasPackLevel = delivery.packUnit !== delivery.orderUnit || delivery.packQty !== 1;
  return hasPackLevel && (delivery.unitQty !== 1 || delivery.unitUnit !== delivery.packUnit);
}

export function resolveDeliveryUnitLevels(delivery: DeliveryUnitBreakdown): DeliveryUnitLevels {
  const orderUnit = delivery.orderUnit;
  const hasPackLevel = delivery.packUnit !== delivery.orderUnit || delivery.packQty !== 1;

  let firstBreakdown: string | null = null;
  if (hasPackLevel) {
    firstBreakdown = `${delivery.packQty} ${delivery.packUnit}`;
  } else if (delivery.orderQty !== 1) {
    firstBreakdown = `${delivery.orderQty} ${delivery.orderUnit}`;
  }

  const needsSecondLevel = hasSmallestDeliveryBreakdown(delivery);

  const secondBreakdown = needsSecondLevel
    ? `${delivery.unitQty} ${delivery.unitUnit}`
    : null;

  return { orderUnit, firstBreakdown, secondBreakdown };
}

const VENDOR_PRODUCT_OVERRIDES_KEY = 'bisync.vendorProductOverrides';
const VENDOR_IMPORTED_PRODUCTS_KEY = 'bisync.vendorImportedProducts';

export const DELIVERY_ORDER_UNITS = [
  'Box', 'Crate', 'Keg', 'Case', 'Carton', 'Bag', 'Pallet', 'Bottle', 'Can', 'Tin',
  ...RECIPE_UNITS,
];

export function loadVendorProductOverrides(): Record<string, Partial<VendorProductCatalogItem>> {
  try {
    const raw = localStorage.getItem(VENDOR_PRODUCT_OVERRIDES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Partial<VendorProductCatalogItem>>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function loadImportedVendorProducts(): VendorProductCatalogItem[] {
  try {
    const raw = localStorage.getItem(VENDOR_IMPORTED_PRODUCTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as VendorProductCatalogItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveImportedVendorProductsRaw(products: VendorProductCatalogItem[]) {
  localStorage.setItem(VENDOR_IMPORTED_PRODUCTS_KEY, JSON.stringify(products));
}

export function saveVendorProductOverride(product: VendorProductCatalogItem): void {
  const overrides = loadVendorProductOverrides();
  overrides[product.id] = {
    productName: product.productName,
    deliveryPrice: product.deliveryPrice,
    delivery: product.delivery,
  };
  localStorage.setItem(VENDOR_PRODUCT_OVERRIDES_KEY, JSON.stringify(overrides));
}

export function applyVendorProductOverrides(
  catalog: VendorProductCatalogItem[] = VENDOR_PRODUCT_CATALOG,
): VendorProductCatalogItem[] {
  const mergedCatalog = [...catalog, ...loadImportedVendorProducts()];
  const overrides = loadVendorProductOverrides();
  return mergedCatalog.map(item => {
    const patch = overrides[item.id];
    if (!patch) return item;
    return {
      ...item,
      ...patch,
      delivery: patch.delivery ? { ...item.delivery, ...patch.delivery } : item.delivery,
    };
  });
}

function normalizeUnitName(unit: string): string {
  const compact = unit.trim().toLowerCase();
  const map: Record<string, string> = {
    g: 'Gr', gr: 'Gr', gram: 'Gr', grams: 'Gr',
    kg: 'Kg', kilogram: 'Kg', kilograms: 'Kg',
    ml: 'Ml', milliliter: 'Ml', milliliters: 'Ml',
    l: 'Ltr', ltr: 'Ltr', litre: 'Ltr', liters: 'Ltr', litres: 'Ltr',
    pcs: 'Each', pc: 'Each', each: 'Each',
    tin: 'Tin', tins: 'Tin',
    bottle: 'Bottle', bottles: 'Bottle',
    can: 'Can', cans: 'Can',
    box: 'Box', case: 'Case', carton: 'Carton', crate: 'Crate',
    punnet: 'Punnet', bunch: 'Bunch', tray: 'Tray', bag: 'Bag',
  };
  return map[compact] ?? (unit ? `${unit[0].toUpperCase()}${unit.slice(1).toLowerCase()}` : 'Each');
}

function parseSegment(segment: string): { qty: number; unit: string } | null {
  const clean = segment.trim().toLowerCase();
  if (!clean) return null;
  const match = clean.match(/^(\d+(?:\.\d+)?)\s*([a-z]+)$/i);
  if (match) {
    return {
      qty: parseFloat(match[1]),
      unit: normalizeUnitName(match[2]),
    };
  }
  return { qty: 1, unit: normalizeUnitName(clean) };
}

export function parseDeliveryUnitPath(input: string): DeliveryUnitBreakdown | null {
  const segments = input
    .split('/')
    .map(s => s.trim())
    .filter(Boolean);
  if (segments.length === 0) return null;
  const order = parseSegment(segments[0]);
  if (!order) return null;
  const pack = segments[1] ? parseSegment(segments[1]) : order;
  const unit = segments[2] ? parseSegment(segments[2]) : pack;
  if (!pack || !unit) return null;
  return {
    orderUnit: order.unit,
    orderQty: order.qty || 1,
    packUnit: pack.unit,
    packQty: pack.qty || 1,
    unitUnit: unit.unit,
    unitQty: unit.qty || 1,
  };
}

export function parseVendorProductsFromOcrText(text: string): VendorProductImportDraft[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const drafts: VendorProductImportDraft[] = [];
  for (const line of lines) {
    const parts = line.split(/\t|,|;|\|/).map(p => p.trim());
    if (parts.length < 5) continue;
    const price = parseFloat(parts[4].replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(price)) continue;
    drafts.push({
      productName: parts[0],
      group: parts[1],
      specification: parts[2],
      deliveryUnitText: parts[3],
      deliveryPrice: price,
    });
  }
  return drafts;
}

function makeImportedProductId(vendorExternalId: string, productName: string, used: Set<string>): string {
  const slug = productName.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 4) || 'ITEM';
  for (let i = 1; i <= 999; i++) {
    const id = `VP-${vendorExternalId.replace(/^V/i, '')}${slug}${String(i).padStart(3, '0')}`;
    if (!used.has(id)) return id;
  }
  return `VP-${vendorExternalId.replace(/^V/i, '')}${Date.now().toString().slice(-6)}`;
}

export function saveImportedVendorProducts(
  vendorExternalId: string,
  vendorName: string,
  drafts: VendorProductImportDraft[],
): VendorProductCatalogItem[] {
  const existingImported = loadImportedVendorProducts();
  const used = new Set([...VENDOR_PRODUCT_CATALOG.map(p => p.id), ...existingImported.map(p => p.id)]);
  const nextProducts: VendorProductCatalogItem[] = [];
  for (const draft of drafts) {
    const delivery = parseDeliveryUnitPath(draft.deliveryUnitText);
    if (!delivery) continue;
    const id = makeImportedProductId(vendorExternalId, draft.productName, used);
    used.add(id);
    nextProducts.push({
      id,
      vendorExternalId,
      vendorName,
      productName: draft.productName.trim(),
      group: draft.group.trim() || 'Dry Goods',
      specification: draft.specification.trim(),
      deliveryPrice: draft.deliveryPrice,
      delivery,
      imageUrl: `https://picsum.photos/seed/${id.toLowerCase()}/80/80`,
    });
  }
  if (nextProducts.length === 0) return [];
  saveImportedVendorProductsRaw([...existingImported, ...nextProducts]);
  return nextProducts;
}

export function getVendorCatalogProducts(vendorExternalId: string): VendorProductCatalogItem[] {
  return applyVendorProductOverrides()
    .filter(p => p.vendorExternalId === vendorExternalId)
    .sort((a, b) => a.group.localeCompare(b.group) || a.productName.localeCompare(b.productName));
}
function formatUnitSegment(qty: number, unit: string, lowercaseUnit = false): string {
  const u = lowercaseUnit ? unit.toLowerCase() : unit;
  if (qty === 1) return u;
  return `${qty}${u.toLowerCase()}`;
}

/** Slash-separated delivery path, e.g. Box/12tin/400gr */
export function formatDeliveryUnitPath(d: DeliveryUnitBreakdown): string {
  const hasPackLevel = d.packUnit !== d.orderUnit || d.packQty !== 1;
  const needsSecondLevel = hasSmallestDeliveryBreakdown(d);

  if (!hasPackLevel && !needsSecondLevel) {
    if (d.orderQty === 1 && d.packQty === 1 && d.unitQty === 1
        && d.orderUnit === d.packUnit && d.packUnit === d.unitUnit) {
      return d.orderUnit;
    }
    return formatUnitSegment(d.orderQty, d.orderUnit);
  }

  const parts: string[] = [formatUnitSegment(d.orderQty, d.orderUnit)];
  if (hasPackLevel) {
    parts.push(formatUnitSegment(d.packQty, d.packUnit, true));
  }
  if (needsSecondLevel) {
    parts.push(formatUnitSegment(d.unitQty, d.unitUnit, true));
  }
  return parts.join('/');
}

export function formatDeliveryBreakdown(d: DeliveryUnitBreakdown): string {
  return formatDeliveryUnitPath(d);
}

/** Double-slash delivery path for vendor product detail, e.g. Box//12tin//400gr */
export function formatDeliveryUnitDetailPath(d: DeliveryUnitBreakdown): string {
  return formatDeliveryUnitPath(d).replace(/\//g, '//');
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
      || item.specification.toLowerCase().includes(q)
      || formatDeliveryUnitPath(item.delivery).toLowerCase().includes(q);
    return matchVendor && matchSearch;
  });
}
