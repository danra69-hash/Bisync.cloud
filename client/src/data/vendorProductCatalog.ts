import { getConversion, RECIPE_UNITS, type AltUnitEntry } from './componentForm';
import { formatCountryNumber } from '../utils/numberFormat';
import { mergeServerVendorProductPrices, refreshVendorProductPricesFromApi } from './vendorProductPrices';
import { api, type VendorProductCatalogRow, type VendorProductCatalogUpsert } from '../api';
import { EXTENDED_VENDOR_CONTACTS, EXTENDED_VENDOR_PRODUCTS } from './vendorProductCatalogExtras';
import type { Vendor } from '../api';
import type { VendorProductPolicyTag } from './vendorPolicyRules';

export type DeliveryUnitBreakdown = {
  /** Order UOM — how the customer orders. */
  orderUnit: string;
  orderQty: number;
  /** Primary Packaging — packs inside the order unit. */
  packUnit: string;
  packQty: number;
  /** Secondary Packaging — smallest pack inside primary. */
  unitUnit: string;
  unitQty: number;
};

/** Shared UI labels for the three delivery-unit packaging levels. */
export const DELIVERY_UNIT_LEVEL_LABELS = {
  order: 'Order UOM',
  primary: 'Primary Packaging',
  secondary: 'Secondary Packaging',
} as const;

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
  productPolicyTag?: VendorProductPolicyTag;
  /** When true, product is only visible to assigned locations. */
  isPrivate?: boolean;
  /** Location external IDs that can see this product when isPrivate is true. */
  privateLocationIds?: string[];
  /** When true, orders attach a returnable deposit line. */
  returnableDeposit?: boolean;
  returnableItemName?: string;
  returnableUom?: string;
  returnableDepositAmount?: number;
};

export type VendorProductImportDraft = {
  vendorExternalId?: string;
  vendorName?: string;
  /** Optional template column; vendor products persist Group only (Category fills Group when Group blank). */
  category?: string;
  vendorProductId?: string;
  productName: string;
  group: string;
  specification: string;
  deliveryUnitText: string;
  principalDeliveryUnit?: string;
  duBreakdown1?: string;
  duBreakdown2?: string;
  duBreakdown1Unit?: string;
  duBreakdown1Qty?: string;
  duBreakdown2Unit?: string;
  duBreakdown2Qty?: string;
  deliveryPrice: number;
  productPolicyTag?: VendorProductPolicyTag;
  active?: boolean;
};

export const VENDOR_PRODUCT_TEMPLATE_HEADERS = [
  'Vendor ID',
  'Vendor Name',
  'Category',
  'Group',
  'Vendor Product',
  'Vendor Product ID',
  'Principal Delivery unit',
  'DU breakdown 1 Unit',
  'DU breakdown 1 Qty',
  'DU breakdown 2 Unit',
  'DU breakdown 2 Qty',
  'Delivery Unit Price',
] as const;

/** Legacy per-vendor template (still accepted on upload). */
export const VENDOR_PRODUCT_TEMPLATE_HEADERS_LEGACY = [
  'Vendor Product ID',
  'Product Name',
  'Group',
  'Specification',
  'Delivery Unit',
  'Price',
] as const;

/** Sample rows: 1 CTN / 12 BTL / 500 ML style (principal + unit/qty breakdowns). */
const VENDOR_PRODUCT_TEMPLATE_SAMPLE_ROWS: string[][] = [
  ['V007', 'Heritage Pantry Supply', '', 'Dry Goods', 'Baked Beans', 'VP-BEAN001', '1 Box', 'Tin', '12', 'Gr', '400', '42.00'],
  ['V015', 'Mediterranean Oil Co.', '', 'Dry Goods', 'Olive Oil Extra Virgin', 'VP-OIL001', '1 Tin', 'Ltr', '5', '', '', '165.00'],
  ['V004', 'Wine & Spirits Direct', '', 'Beverages', 'Prosecco DOC (case)', 'VP-WIN002', '1 CTN', 'BTL', '12', 'ML', '500', '720.00'],
];

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  values.push(current.trim());
  return values.map(v => v.replace(/^"|"$/g, '').trim());
}

function normalizeTemplateHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, ' ');
}

function isVendorProductTemplateHeader(cols: string[]): boolean {
  const normalized = cols.map(normalizeTemplateHeader);
  const first = normalized[0] ?? '';
  return first.includes('vendor id')
    || first.includes('vendor product id')
    || first === 'product name'
    || first === 'vendor product'
    || normalized.some(h =>
      h.includes('principal delivery')
      || h === 'delivery unit'
      || h.includes('du breakdown'));
}

/** Collapse "12 tin" → "12tin" for slash-path parsing. */
export function normalizeDeliverySegment(raw: string): string {
  return raw.trim().replace(/\s+/g, '');
}

/** Build one delivery-path segment from separate Unit + Qty cells (e.g. BTL + 12 → "12 BTL"). */
export function composeDeliveryBreakdownSegment(unit: string, qty: string | number = ''): string {
  const u = String(unit ?? '').trim();
  const qRaw = String(qty ?? '').trim();
  if (!u && !qRaw) return '';
  const q = qRaw.replace(/[^0-9.]/g, '');
  if (!u) return q;
  if (!q) return u;
  return `${q} ${u}`;
}

/** Join Principal + DU breakdown columns into a parseable delivery path (1CTN/12BTL/500ML). */
export function composeDeliveryUnitText(
  principal: string,
  breakdown1 = '',
  breakdown2 = '',
): string {
  return [principal, breakdown1, breakdown2]
    .map(normalizeDeliverySegment)
    .filter(Boolean)
    .join('/');
}

export type DeliveryTemplateColumns = {
  principal: string;
  breakdown1Unit: string;
  breakdown1Qty: string;
  breakdown2Unit: string;
  breakdown2Qty: string;
  /** Combined legacy-style "12 Tin" / "400 Gr" for display or old importers. */
  breakdown1: string;
  breakdown2: string;
};

/** Split a product delivery into Principal + DU1/DU2 Unit & Qty template columns. */
export function deliveryTemplateColumns(delivery: DeliveryUnitBreakdown): DeliveryTemplateColumns {
  const orderQty = Number.isFinite(delivery.orderQty) && delivery.orderQty > 0
    ? delivery.orderQty
    : 1;
  const orderUnit = (delivery.orderUnit || '').trim();
  const principal = orderUnit
    ? `${orderQty} ${orderUnit}`.trim()
    : '';

  const hasPackLevel = Boolean(delivery.packUnit?.trim())
    && (delivery.packUnit.trim().toLowerCase() !== orderUnit.toLowerCase() || delivery.packQty !== 1);

  let breakdown1Unit = '';
  let breakdown1Qty = '';
  if (hasPackLevel) {
    breakdown1Unit = (delivery.packUnit || '').trim();
    breakdown1Qty = String(delivery.packQty > 0 ? delivery.packQty : 1);
  } else if (delivery.orderQty !== 1 && orderUnit) {
    // Rare: qty-only variance without a distinct pack unit — keep principal authoritative.
    breakdown1Unit = '';
    breakdown1Qty = '';
  }

  let breakdown2Unit = '';
  let breakdown2Qty = '';
  if (hasSmallestDeliveryBreakdown(delivery)) {
    breakdown2Unit = (delivery.unitUnit || '').trim();
    breakdown2Qty = String(delivery.unitQty > 0 ? delivery.unitQty : 1);
  }

  return {
    principal,
    breakdown1Unit,
    breakdown1Qty,
    breakdown2Unit,
    breakdown2Qty,
    breakdown1: composeDeliveryBreakdownSegment(breakdown1Unit, breakdown1Qty),
    breakdown2: composeDeliveryBreakdownSegment(breakdown2Unit, breakdown2Qty),
  };
}

function cellAt(cols: string[], indexMap: Map<string, number>, ...aliases: string[]): string {
  for (const alias of aliases) {
    const idx = indexMap.get(normalizeTemplateHeader(alias));
    if (idx !== undefined) return cols[idx] ?? '';
  }
  return '';
}

function buildHeaderIndexMap(headers: string[]): Map<string, number> {
  const map = new Map<string, number>();
  headers.forEach((header, index) => {
    const key = normalizeTemplateHeader(header);
    if (key && !map.has(key)) map.set(key, index);
  });
  return map;
}

function isLegacyVendorProductTemplate(headers: string[]): boolean {
  const normalized = headers.map(normalizeTemplateHeader);
  return normalized.includes('delivery unit')
    || (normalized.includes('product name') && !normalized.includes('vendor product'))
    || (normalized[0] === 'vendor product id' && !normalized.includes('vendor id'));
}

function resolveBreakdownFromColumns(
  indexMap: Map<string, number>,
  cols: string[],
  combinedAliases: string[],
  unitAliases: string[],
  qtyAliases: string[],
): { combined: string; unit: string; qty: string } {
  const unit = cellAt(cols, indexMap, ...unitAliases).trim();
  const qty = cellAt(cols, indexMap, ...qtyAliases).trim();
  const combinedLegacy = cellAt(cols, indexMap, ...combinedAliases).trim();
  if (unit || qty) {
    return {
      unit,
      qty,
      combined: composeDeliveryBreakdownSegment(unit, qty),
    };
  }
  return { unit: '', qty: '', combined: combinedLegacy };
}

function rowToVendorProductDraftFromMap(
  cols: string[],
  indexMap: Map<string, number>,
): VendorProductImportDraft | null {
  const vendorExternalId = cellAt(cols, indexMap, 'vendor id', 'vendor external id').trim().toUpperCase();
  const vendorName = cellAt(cols, indexMap, 'vendor name').trim();
  const category = cellAt(cols, indexMap, 'category').trim();
  const groupRaw = cellAt(cols, indexMap, 'group').trim();
  const group = groupRaw || category;
  const productName = cellAt(cols, indexMap, 'vendor product', 'product name').trim();
  const vendorProductId = cellAt(cols, indexMap, 'vendor product id').trim().toUpperCase();
  const specification = cellAt(cols, indexMap, 'specification').trim();
  const principal = cellAt(cols, indexMap, 'principal delivery unit', 'principal delivery').trim();
  const du1 = resolveBreakdownFromColumns(
    indexMap,
    cols,
    ['du breakdown 1', 'du breakdown1'],
    ['du breakdown 1 unit', 'du breakdown1 unit', 'du breakdown unit 1'],
    ['du breakdown 1 qty', 'du breakdown1 qty', 'du breakdown qty 1', 'du breakdown 1 quantity'],
  );
  const du2 = resolveBreakdownFromColumns(
    indexMap,
    cols,
    ['du breakdown 2', 'du breakdown2'],
    ['du breakdown 2 unit', 'du breakdown2 unit', 'du breakdown unit 2'],
    ['du breakdown 2 qty', 'du breakdown2 qty', 'du breakdown qty 2', 'du breakdown 2 quantity'],
  );
  const legacyDelivery = cellAt(cols, indexMap, 'delivery unit').trim();
  const deliveryUnitText = legacyDelivery
    || composeDeliveryUnitText(principal, du1.combined, du2.combined);
  const priceRaw = cellAt(cols, indexMap, 'delivery unit price', 'price');
  const deliveryPrice = parseFloat(String(priceRaw).replace(/[^0-9.]/g, '')) || 0;

  if (!productName || !group || !deliveryUnitText || deliveryPrice <= 0) return null;

  return {
    vendorExternalId: vendorExternalId || undefined,
    vendorName: vendorName || undefined,
    category: category || undefined,
    vendorProductId: vendorProductId || undefined,
    productName,
    group,
    specification,
    deliveryUnitText,
    principalDeliveryUnit: principal || undefined,
    duBreakdown1: du1.combined || undefined,
    duBreakdown2: du2.combined || undefined,
    duBreakdown1Unit: du1.unit || undefined,
    duBreakdown1Qty: du1.qty || undefined,
    duBreakdown2Unit: du2.unit || undefined,
    duBreakdown2Qty: du2.qty || undefined,
    deliveryPrice,
  };
}

/** Positional legacy parser (Vendor Product ID | Product Name | Group | Spec | Delivery Unit | Price). */
function rowToVendorProductDraftLegacy(cols: string[]): VendorProductImportDraft | null {
  if (cols.length >= 6) {
    const deliveryPrice = parseFloat(String(cols[5]).replace(/[^0-9.]/g, '')) || 0;
    const productName = cols[1];
    const group = cols[2];
    const deliveryUnitText = cols[4];
    if (!productName || !group || !deliveryUnitText || deliveryPrice <= 0) return null;
    const vendorProductId = cols[0].trim();
    return {
      vendorProductId: vendorProductId || undefined,
      productName,
      group,
      specification: cols[3],
      deliveryUnitText,
      deliveryPrice,
    };
  }
  if (cols.length >= 5) {
    const deliveryPrice = parseFloat(String(cols[4]).replace(/[^0-9.]/g, '')) || 0;
    const productName = cols[0];
    const group = cols[1];
    const deliveryUnitText = cols[3];
    if (!productName || !group || !deliveryUnitText || deliveryPrice <= 0) return null;
    return {
      productName,
      group,
      specification: cols[2],
      deliveryUnitText,
      deliveryPrice,
    };
  }
  return null;
}

function rowToVendorProductDraft(cols: string[]): VendorProductImportDraft | null {
  return rowToVendorProductDraftLegacy(cols);
}

export function productToVendorProductTemplateRow(
  product: VendorProductCatalogItem,
  countryCode = 'MY',
): string[] {
  const columns = deliveryTemplateColumns(product.delivery);
  return [
    product.vendorExternalId,
    product.vendorName,
    '',
    product.group,
    product.productName,
    product.id,
    columns.principal,
    columns.breakdown1Unit,
    columns.breakdown1Qty,
    columns.breakdown2Unit,
    columns.breakdown2Qty,
    formatCountryNumber(product.deliveryPrice, countryCode),
  ];
}

export function buildVendorProductTemplateCsv(
  existingProducts: VendorProductCatalogItem[] = [],
  countryCode = 'MY',
): string {
  const rows = existingProducts.length > 0
    ? existingProducts.map(product => productToVendorProductTemplateRow(product, countryCode))
    : VENDOR_PRODUCT_TEMPLATE_SAMPLE_ROWS;

  return [VENDOR_PRODUCT_TEMPLATE_HEADERS, ...rows]
    .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

export function downloadVendorProductTemplateCsv(
  existingProducts: VendorProductCatalogItem[] = [],
  filename = 'vendor-product-template.csv',
  countryCode = 'MY',
): void {
  const stamp = new Date().toISOString().slice(0, 10);
  const resolvedName = filename.includes('.csv')
    ? filename
    : `vendor-product-template-${stamp}.csv`;
  const blob = new Blob([buildVendorProductTemplateCsv(existingProducts, countryCode)], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = resolvedName;
  link.click();
  URL.revokeObjectURL(url);
}

export function parseVendorProductTemplateCsv(text: string): VendorProductImportDraft[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const firstCols = parseCsvLine(lines[0]);
  const hasHeader = isVendorProductTemplateHeader(firstCols);
  const dataLines = hasHeader ? lines.slice(1) : lines;
  if (dataLines.length === 0) return [];

  if (hasHeader) {
    const indexMap = buildHeaderIndexMap(firstCols);
    const useLegacy = isLegacyVendorProductTemplate(firstCols);
    return dataLines
      .map(parseCsvLine)
      .map(cols => (useLegacy
        ? rowToVendorProductDraftLegacy(cols)
        : rowToVendorProductDraftFromMap(cols, indexMap)))
      .filter((draft): draft is VendorProductImportDraft => draft !== null);
  }

  return dataLines
    .map(parseCsvLine)
    .map(rowToVendorProductDraft)
    .filter((draft): draft is VendorProductImportDraft => draft !== null);
}

const NON_HALAL_VENDOR_IDS = new Set(['V004', 'V022', 'V026']);

const HALAL_VENDOR_IDS = new Set([
  'V042', 'V043', 'V044', 'V045', 'V046', 'V047', 'V048', 'V049', 'V050', 'V051',
]);

export function inferCatalogProductPolicyTag(
  product: Pick<VendorProductCatalogItem, 'vendorExternalId' | 'group' | 'specification' | 'productPolicyTag'>,
  vendorTag?: VendorProductPolicyTag | null,
): VendorProductPolicyTag {
  if (product.productPolicyTag) return product.productPolicyTag;
  if (vendorTag) return vendorTag;
  if (HALAL_VENDOR_IDS.has(product.vendorExternalId)) return 'halal';
  if (NON_HALAL_VENDOR_IDS.has(product.vendorExternalId)) return 'non-halal';

  const spec = product.specification.toLowerCase();
  const group = product.group.toLowerCase();
  if (spec.includes('non-halal') || spec.includes('pork') || spec.includes('wine') || spec.includes('spirit') || spec.includes('beer')) {
    return 'non-halal';
  }
  if (spec.includes('halal')) return 'halal';
  if (group.includes('beverage') && (spec.includes('abv') || spec.includes('wine') || spec.includes('spirit'))) {
    return 'non-halal';
  }
  return 'halal';
}

export function vendorProductPolicyTag(
  product: VendorProductCatalogItem,
  vendorsByExternalId: Map<string, Vendor>,
): VendorProductPolicyTag {
  const vendor = vendorsByExternalId.get(product.vendorExternalId);
  return inferCatalogProductPolicyTag(product, vendor?.productPolicyTag);
}

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
    brn: '',
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
    productPolicyTag: HALAL_VENDOR_IDS.has(product.vendorExternalId)
      ? 'halal'
      : NON_HALAL_VENDOR_IDS.has(product.vendorExternalId)
        ? 'non-halal'
        : 'halal',
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
  // Blank / unconfigured delivery must not count as a real breakdown.
  if (!delivery.orderUnit?.trim() && delivery.orderQty <= 0 && !delivery.packUnit?.trim()) {
    return false;
  }
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

const LEGACY_OVERRIDES_KEY = 'bisync.vendorProductOverrides';
const LEGACY_IMPORTED_KEY = 'bisync.vendorImportedProducts';
const LEGACY_DEACTIVATED_KEY = 'bisync.deactivatedVendorProductIds';

let catalogCache: VendorProductCatalogItem[] | null = null;
let catalogRefreshPromise: Promise<VendorProductCatalogItem[]> | null = null;

function mapApiRow(row: VendorProductCatalogRow): VendorProductCatalogItem {
  return {
    id: row.id,
    group: row.group,
    vendorExternalId: row.vendorExternalId,
    vendorName: row.vendorName,
    productName: row.productName,
    specification: row.specification,
    imageUrl: row.imageUrl,
    deliveryPrice: row.deliveryPrice,
    delivery: row.delivery,
    productPolicyTag: row.productPolicyTag as VendorProductPolicyTag | undefined,
    isPrivate: row.isPrivate,
    privateLocationIds: row.privateLocationIds ?? [],
    returnableDeposit: Boolean(row.returnableDeposit),
    returnableItemName: row.returnableItemName ?? '',
    returnableUom: row.returnableUom ?? '',
    returnableDepositAmount: row.returnableDepositAmount ?? 0,
  };
}

function toUpsertPayload(product: VendorProductCatalogItem): VendorProductCatalogUpsert {
  return {
    id: product.id,
    vendorExternalId: product.vendorExternalId,
    vendorName: product.vendorName,
    productName: product.productName,
    group: product.group,
    specification: product.specification,
    imageUrl: product.imageUrl,
    deliveryPrice: product.deliveryPrice,
    deliveryJson: JSON.stringify(product.delivery),
    productPolicyTag: product.productPolicyTag,
    isPrivate: product.isPrivate,
    privateLocationIds: product.privateLocationIds ?? [],
    returnableDeposit: Boolean(product.returnableDeposit),
    returnableItemName: product.returnableDeposit ? (product.returnableItemName ?? '').trim() : '',
    returnableUom: product.returnableDeposit ? (product.returnableUom ?? '').trim() : '',
    returnableDepositAmount: product.returnableDeposit ? (product.returnableDepositAmount ?? 0) : 0,
    active: true,
  };
}

function readLegacyOverrides(): Record<string, Partial<VendorProductCatalogItem>> {
  try {
    const raw = localStorage.getItem(LEGACY_OVERRIDES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Partial<VendorProductCatalogItem>>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function readLegacyImported(): VendorProductCatalogItem[] {
  try {
    const raw = localStorage.getItem(LEGACY_IMPORTED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as VendorProductCatalogItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readLegacyDeactivated(): Set<string> {
  try {
    const raw = localStorage.getItem(LEGACY_DEACTIVATED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function clearLegacyVendorProductStorage() {
  localStorage.removeItem(LEGACY_OVERRIDES_KEY);
  localStorage.removeItem(LEGACY_IMPORTED_KEY);
  localStorage.removeItem(LEGACY_DEACTIVATED_KEY);
}

async function upsertVendorProductCatalogItem(
  product: VendorProductCatalogItem,
  refreshAfter = true,
): Promise<void> {
  const payload = toUpsertPayload(product);
  try {
    await api.updateVendorProductCatalog(product.id, payload);
  } catch {
    await api.createVendorProductCatalog(payload);
  }
  if (refreshAfter) {
    invalidateVendorProductCatalog();
    await refreshVendorProductCatalog();
  }
}

async function migrateLegacyVendorProductsIfNeeded(): Promise<void> {
  const overrides = readLegacyOverrides();
  const imported = readLegacyImported();
  const deactivated = readLegacyDeactivated();
  if (imported.length === 0 && Object.keys(overrides).length === 0 && deactivated.size === 0) return;

  const baseCatalog = catalogCache ?? [];
  const merged = new Map<string, VendorProductCatalogItem>();

  for (const product of baseCatalog) {
    merged.set(product.id, product);
  }
  for (const product of imported) {
    merged.set(product.id, product);
  }
  for (const [id, patch] of Object.entries(overrides)) {
    const base = merged.get(id) ?? baseCatalog.find(item => item.id === id);
    if (!base) continue;
    merged.set(id, {
      ...base,
      ...patch,
      delivery: patch.delivery ? { ...base.delivery, ...patch.delivery } : base.delivery,
    });
  }

  const productsToUpsert = new Set<string>();
  for (const product of imported) productsToUpsert.add(product.id);
  for (const id of Object.keys(overrides)) productsToUpsert.add(id);

  for (const id of productsToUpsert) {
    const product = merged.get(id);
    if (!product) continue;
    await upsertVendorProductCatalogItem(product, false);
  }

  for (const id of deactivated) {
    try {
      await api.deactivateVendorProductCatalog(id);
    } catch {
      // ignore missing rows during migration
    }
  }

  clearLegacyVendorProductStorage();
}

export async function refreshVendorProductCatalog(): Promise<VendorProductCatalogItem[]> {
  if (!catalogRefreshPromise) {
    catalogRefreshPromise = (async () => {
      try {
        const rows = await api.vendorProductCatalog();
        catalogCache = rows.map(mapApiRow);
        await migrateLegacyVendorProductsIfNeeded();
        const rowsAfterMigration = await api.vendorProductCatalog();
        catalogCache = rowsAfterMigration.map(mapApiRow);
        await refreshVendorProductPricesFromApi();
        catalogCache = mergeServerVendorProductPrices(catalogCache);
      } catch {
        catalogCache = mergeServerVendorProductPrices([...VENDOR_PRODUCT_CATALOG]);
      }
      window.dispatchEvent(new CustomEvent('bisync:vendorProductCatalogChanged'));
      catalogRefreshPromise = null;
      return catalogCache;
    })();
  }
  return catalogRefreshPromise;
}

export function invalidateVendorProductCatalog() {
  catalogCache = null;
  catalogRefreshPromise = null;
}

export const DELIVERY_ORDER_UNITS = [
  'Box', 'Crate', 'Keg', 'Case', 'Carton', 'Bag', 'Pallet', 'Bottle', 'Can', 'Tin',
  ...RECIPE_UNITS,
];

/** @deprecated Overrides are stored in the database. */
export function loadVendorProductOverrides(): Record<string, Partial<VendorProductCatalogItem>> {
  return {};
}

/** @deprecated Imported products are stored in the database. */
export function loadImportedVendorProducts(): VendorProductCatalogItem[] {
  return catalogCache ?? [];
}

/** @deprecated Deactivated products are stored in the database. */
export function loadDeactivatedVendorProductIds(): Set<string> {
  return new Set();
}

export async function deactivateVendorProducts(productIds: string[]) {
  for (const id of productIds) {
    await api.deactivateVendorProductCatalog(id);
  }
  invalidateVendorProductCatalog();
  await refreshVendorProductCatalog();
}

export async function reactivateVendorProducts(productIds: string[]) {
  for (const id of productIds) {
    await api.reactivateVendorProductCatalog(id);
  }
  invalidateVendorProductCatalog();
  await refreshVendorProductCatalog();
}

export function vendorProductVisibleToLocations(
  product: Pick<VendorProductCatalogItem, 'isPrivate' | 'privateLocationIds'>,
  locationIds: string[],
): boolean {
  if (!product.isPrivate) return true;
  const assigned = product.privateLocationIds ?? [];
  if (assigned.length === 0) return false;
  if (locationIds.length === 0) return false;
  return locationIds.some(id => assigned.includes(id));
}

export function filterVendorProductsByLocationVisibility(
  products: VendorProductCatalogItem[],
  locationIds: string[],
): VendorProductCatalogItem[] {
  return products.filter(product => vendorProductVisibleToLocations(product, locationIds));
}

export function createBlankVendorProduct(
  vendor: Pick<Vendor, 'externalId' | 'name'>,
  selectedLocationIds: string[] = [],
): VendorProductCatalogItem {
  const catalog = applyVendorProductOverrides();
  const used = new Set(catalog.map(item => item.id));
  const id = makeImportedProductId(vendor.externalId, 'New Product', used);
  return {
    id,
    vendorExternalId: vendor.externalId,
    vendorName: vendor.name,
    productName: '',
    group: 'Dry Goods',
    specification: '',
    deliveryPrice: 0,
    delivery: {
      orderUnit: 'Box',
      orderQty: 1,
      packUnit: 'Box',
      packQty: 1,
      unitUnit: 'Each',
      unitQty: 1,
    },
    imageUrl: `https://picsum.photos/seed/${id.toLowerCase()}/80/80`,
    isPrivate: false,
    privateLocationIds: selectedLocationIds.length > 0 ? [...selectedLocationIds] : [],
  };
}

export async function saveNewVendorProduct(product: VendorProductCatalogItem): Promise<void> {
  await persistVendorProductUpdate(product);
}

/** @deprecated Use persistVendorProductUpdate. */
export function saveVendorProductOverride(product: VendorProductCatalogItem): void {
  void persistVendorProductUpdate(product);
}

export async function persistVendorProductUpdate(product: VendorProductCatalogItem): Promise<void> {
  await upsertVendorProductCatalogItem(product, true);
}

export function applyVendorProductOverrides(
  catalog: VendorProductCatalogItem[] = catalogCache ?? VENDOR_PRODUCT_CATALOG,
): VendorProductCatalogItem[] {
  return mergeServerVendorProductPrices(catalog);
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

  // 1 segment: "12tin" → 12 tin (do not cube orderQty across pack/unit).
  if (segments.length === 1) {
    return {
      orderUnit: order.unit,
      orderQty: order.qty || 1,
      packUnit: order.unit,
      packQty: 1,
      unitUnit: order.unit,
      unitQty: 1,
    };
  }

  const pack = parseSegment(segments[1]);
  if (!pack) return null;

  // 2 segments: "1tub/3.75ltr" or "Tin/5ltr" → order unit contains pack measure once
  // (avoid packQty×unitQty double-count when unit mirrors pack).
  if (segments.length === 2) {
    return {
      orderUnit: order.unit,
      orderQty: order.qty || 1,
      packUnit: pack.unit,
      packQty: pack.qty || 1,
      unitUnit: pack.unit,
      unitQty: 1,
    };
  }

  const unit = parseSegment(segments[2]);
  if (!unit) return null;
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
    const draft = rowToVendorProductDraft(parts);
    if (draft) drafts.push(draft);
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

function resolveImportedProductId(
  draft: VendorProductImportDraft,
  vendorExternalId: string,
  used: Set<string>,
): string | null {
  const requested = draft.vendorProductId?.trim().toUpperCase();
  if (requested) {
    if (used.has(requested)) return null;
    return requested;
  }
  return makeImportedProductId(vendorExternalId, draft.productName, used);
}

export async function saveImportedVendorProducts(
  vendorExternalId: string,
  vendorName: string,
  drafts: VendorProductImportDraft[],
): Promise<VendorProductCatalogItem[]> {
  const existingImported = loadImportedVendorProducts();
  const used = new Set([...applyVendorProductOverrides().map(p => p.id), ...existingImported.map(p => p.id)]);
  const nextProducts: VendorProductCatalogItem[] = [];
  for (const draft of drafts) {
    const delivery = parseDeliveryUnitPath(draft.deliveryUnitText);
    if (!delivery) continue;
    const id = resolveImportedProductId(draft, vendorExternalId, used);
    if (!id) continue;
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
  for (const product of nextProducts) {
    await persistVendorProductUpdate(product);
  }
  return nextProducts;
}

export function getVendorCatalogProducts(
  vendorExternalId: string,
  options?: { locationIds?: string[]; vendorDetailMode?: boolean },
): VendorProductCatalogItem[] {
  const products = applyVendorProductOverrides()
    .filter(p => p.vendorExternalId === vendorExternalId);
  const scoped = options?.vendorDetailMode
    ? products
    : filterVendorProductsByLocationVisibility(products, options?.locationIds ?? []);
  return scoped.sort((a, b) => a.group.localeCompare(b.group) || a.productName.localeCompare(b.productName));
}
/** Segment for display paths, e.g. 1box, 24tin, 200gr (qty always included). */
function formatUnitSegment(qty: number, unit: string): string {
  const safeQty = Number.isFinite(qty) && qty > 0 ? qty : 1;
  const u = (unit || '').trim().toLowerCase() || 'each';
  return `${safeQty}${u}`;
}

/**
 * Slash-separated delivery path for Vendor Products, B2B Products, and Sub-Products.
 * Examples: 1box/24tin/200gr · 1kg · 1tin/400gr
 */
export function formatDeliveryUnitPath(d: DeliveryUnitBreakdown): string {
  const orderUnit = (d.orderUnit || '').trim();
  if (!orderUnit) return '—';

  const hasPackLevel = Boolean(d.packUnit?.trim())
    && (d.packUnit.trim().toLowerCase() !== orderUnit.toLowerCase() || d.packQty !== 1);
  const needsSecondLevel = hasSmallestDeliveryBreakdown({
    ...d,
    packUnit: hasPackLevel ? d.packUnit : d.orderUnit,
    packQty: hasPackLevel ? d.packQty : 1,
  }) && Boolean(d.unitUnit?.trim());

  if (!hasPackLevel && !needsSecondLevel) {
    return formatUnitSegment(d.orderQty, orderUnit);
  }

  const parts: string[] = [formatUnitSegment(d.orderQty, orderUnit)];
  if (hasPackLevel) {
    parts.push(formatUnitSegment(d.packQty, d.packUnit));
  }
  if (needsSecondLevel) {
    parts.push(formatUnitSegment(d.unitQty, d.unitUnit));
  }
  return parts.join('/');
}

export function formatDeliveryBreakdown(d: DeliveryUnitBreakdown): string {
  return formatDeliveryUnitPath(d);
}

/** Same as formatDeliveryUnitPath — kept for call sites that previously used //. */
export function formatDeliveryUnitDetailPath(d: DeliveryUnitBreakdown): string {
  return formatDeliveryUnitPath(d);
}

/** True when Order UOM (+ optional packaging levels) can convert to a target UOM. */
export function deliveryUnitIsMeasurable(
  delivery: DeliveryUnitBreakdown,
  targetUom?: string,
): boolean {
  const orderUnit = delivery.orderUnit?.trim();
  if (!orderUnit || !(delivery.orderQty > 0)) return false;
  if (delivery.packUnit?.trim() && !(delivery.packQty > 0)) return false;
  if (delivery.unitUnit?.trim() && !(delivery.unitQty > 0)) return false;
  if (!targetUom?.trim()) return true;
  return resolvePrincipalQty(delivery, targetUom).qty !== null
    || unitConvertsToPrincipalComponentUom(orderUnit)
    || unitConvertsToPrincipalComponentUom(delivery.unitUnit || delivery.packUnit || orderUnit);
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
  // Same Step 1 rule as stock inbound: delivery (package) price ÷ principal qty per package.
  // Full PO line: (packages × deliveryPrice) ÷ (packages × principalQty) — identical per unit.
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
  locationIds: string[] = [],
): VendorProductCatalogItem[] {
  const q = productSearch.trim().toLowerCase();
  if (!q && !vendorName) return [];

  const visible = filterVendorProductsByLocationVisibility(catalog, locationIds);

  return visible.filter(item => {
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
