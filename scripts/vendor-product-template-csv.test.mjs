/**
 * Vendor Product template CSV: headers, delivery columns, parse/upsert matching.
 * Mirrors helpers in client/src/data/vendorProductCatalog.ts + vendorProductImportCatalog.ts.
 * Run: node --experimental-strip-types --test scripts/vendor-product-template-csv.test.mjs
 *
 * Path shape: 1 CTN (Principal) / 12 BTL / 500 ML
 * → Principal Delivery unit | DU breakdown 1 Unit+Qty | DU breakdown 2 Unit+Qty
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const VENDOR_PRODUCT_TEMPLATE_HEADERS = [
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
];

function normalizeDeliverySegment(raw) {
  return raw.trim().replace(/\s+/g, '');
}

function composeDeliveryBreakdownSegment(unit = '', qty = '') {
  const u = String(unit ?? '').trim();
  const qRaw = String(qty ?? '').trim();
  if (!u && !qRaw) return '';
  const q = qRaw.replace(/[^0-9.]/g, '');
  if (!u) return q;
  if (!q) return u;
  return `${q} ${u}`;
}

function composeDeliveryUnitText(principal, breakdown1 = '', breakdown2 = '') {
  return [principal, breakdown1, breakdown2]
    .map(normalizeDeliverySegment)
    .filter(Boolean)
    .join('/');
}

function hasSmallestDeliveryBreakdown(delivery) {
  if (!delivery.orderUnit?.trim() && delivery.orderQty <= 0 && !delivery.packUnit?.trim()) {
    return false;
  }
  const hasPackLevel = delivery.packUnit !== delivery.orderUnit || delivery.packQty !== 1;
  return hasPackLevel && (delivery.unitQty !== 1 || delivery.unitUnit !== delivery.packUnit);
}

function deliveryTemplateColumns(delivery) {
  const orderQty = Number.isFinite(delivery.orderQty) && delivery.orderQty > 0
    ? delivery.orderQty
    : 1;
  const orderUnit = (delivery.orderUnit || '').trim();
  const principal = orderUnit ? `${orderQty} ${orderUnit}`.trim() : '';
  const hasPackLevel = Boolean(delivery.packUnit?.trim())
    && (delivery.packUnit.trim().toLowerCase() !== orderUnit.toLowerCase() || delivery.packQty !== 1);

  let breakdown1Unit = '';
  let breakdown1Qty = '';
  if (hasPackLevel) {
    breakdown1Unit = (delivery.packUnit || '').trim();
    breakdown1Qty = String(delivery.packQty > 0 ? delivery.packQty : 1);
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

function parseCsvLine(line) {
  const values = [];
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

function normalizeTemplateHeader(header) {
  return header.trim().toLowerCase().replace(/\s+/g, ' ');
}

function buildHeaderIndexMap(headers) {
  const map = new Map();
  headers.forEach((header, index) => {
    const key = normalizeTemplateHeader(header);
    if (key && !map.has(key)) map.set(key, index);
  });
  return map;
}

function cellAt(cols, indexMap, ...aliases) {
  for (const alias of aliases) {
    const idx = indexMap.get(normalizeTemplateHeader(alias));
    if (idx !== undefined) return cols[idx] ?? '';
  }
  return '';
}

function isLegacyVendorProductTemplate(headers) {
  const normalized = headers.map(normalizeTemplateHeader);
  return normalized.includes('delivery unit')
    || (normalized.includes('product name') && !normalized.includes('vendor product'))
    || (normalized[0] === 'vendor product id' && !normalized.includes('vendor id'));
}

function resolveBreakdown(indexMap, cols, combinedAliases, unitAliases, qtyAliases) {
  const unit = cellAt(cols, indexMap, ...unitAliases).trim();
  const qty = cellAt(cols, indexMap, ...qtyAliases).trim();
  const combinedLegacy = cellAt(cols, indexMap, ...combinedAliases).trim();
  if (unit || qty) {
    return composeDeliveryBreakdownSegment(unit, qty);
  }
  return combinedLegacy;
}

function rowFromMap(cols, indexMap) {
  const vendorExternalId = cellAt(cols, indexMap, 'vendor id').trim().toUpperCase();
  const vendorName = cellAt(cols, indexMap, 'vendor name').trim();
  const category = cellAt(cols, indexMap, 'category').trim();
  const groupRaw = cellAt(cols, indexMap, 'group').trim();
  const group = groupRaw || category;
  const productName = cellAt(cols, indexMap, 'vendor product', 'product name').trim();
  const vendorProductId = cellAt(cols, indexMap, 'vendor product id').trim().toUpperCase();
  const principal = cellAt(cols, indexMap, 'principal delivery unit').trim();
  const du1 = resolveBreakdown(
    indexMap,
    cols,
    ['du breakdown 1'],
    ['du breakdown 1 unit'],
    ['du breakdown 1 qty'],
  );
  const du2 = resolveBreakdown(
    indexMap,
    cols,
    ['du breakdown 2'],
    ['du breakdown 2 unit'],
    ['du breakdown 2 qty'],
  );
  const legacyDelivery = cellAt(cols, indexMap, 'delivery unit').trim();
  const deliveryUnitText = legacyDelivery || composeDeliveryUnitText(principal, du1, du2);
  const deliveryPrice = parseFloat(String(cellAt(cols, indexMap, 'delivery unit price', 'price')).replace(/[^0-9.]/g, '')) || 0;
  if (!productName || !group || !deliveryUnitText || deliveryPrice <= 0) return null;
  return {
    vendorExternalId: vendorExternalId || undefined,
    vendorName: vendorName || undefined,
    category: category || undefined,
    vendorProductId: vendorProductId || undefined,
    productName,
    group,
    deliveryUnitText,
    deliveryPrice,
  };
}

function rowLegacy(cols) {
  if (cols.length < 6) return null;
  const deliveryPrice = parseFloat(String(cols[5]).replace(/[^0-9.]/g, '')) || 0;
  if (!cols[1] || !cols[2] || !cols[4] || deliveryPrice <= 0) return null;
  return {
    vendorProductId: cols[0].trim() || undefined,
    productName: cols[1],
    group: cols[2],
    deliveryUnitText: cols[4],
    deliveryPrice,
  };
}

function parseVendorProductTemplateCsv(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length <= 1) return [];
  const headers = parseCsvLine(lines[0]);
  const indexMap = buildHeaderIndexMap(headers);
  const useLegacy = isLegacyVendorProductTemplate(headers);
  return lines.slice(1)
    .map(parseCsvLine)
    .map(cols => (useLegacy ? rowLegacy(cols) : rowFromMap(cols, indexMap)))
    .filter(Boolean);
}

function buildImportPlan(drafts, existingProducts, vendors = []) {
  const vendorsById = new Map(vendors.map(v => [v.externalId.toUpperCase(), v]));
  const byProductId = new Map(existingProducts.map(p => [p.id.toUpperCase(), p]));
  const plan = { creates: [], updates: [], errors: [] };
  for (const draft of drafts) {
    if (draft.vendorExternalId && vendorsById.size > 0 && !vendorsById.has(draft.vendorExternalId)) {
      plan.errors.push(`unknown vendor ${draft.vendorExternalId}`);
      continue;
    }
    const existing = draft.vendorProductId ? byProductId.get(draft.vendorProductId) : undefined;
    if (existing) plan.updates.push({ existing, draft });
    else plan.creates.push(draft);
  }
  return plan;
}

const sampleDelivery = {
  orderUnit: 'CTN',
  orderQty: 1,
  packUnit: 'BTL',
  packQty: 12,
  unitUnit: 'ML',
  unitQty: 500,
};

describe('vendor product template CSV', () => {
  it('uses Unit/Qty DU breakdown headers in source', () => {
    assert.deepEqual(VENDOR_PRODUCT_TEMPLATE_HEADERS, [
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
    ]);
    const source = readFileSync(
      path.join(repoRoot, 'client/src/data/vendorProductCatalog.ts'),
      'utf8',
    );
    for (const header of VENDOR_PRODUCT_TEMPLATE_HEADERS) {
      assert.match(source, new RegExp(`'${header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`));
    }
    assert.match(source, /Download Vendor Product Template CSV|VENDOR_PRODUCT_TEMPLATE_HEADERS/);
    const page = readFileSync(
      path.join(repoRoot, 'client/src/components/revenue/VendorListPage.tsx'),
      'utf8',
    );
    assert.match(page, /Download Vendor Product Template CSV/);
    assert.match(page, /Upload Vendor Product Template/);
  });

  it('splits delivery into principal + Unit/Qty DU breakdown columns (1 CTN / 12 BTL / 500 ML)', () => {
    assert.deepEqual(deliveryTemplateColumns(sampleDelivery), {
      principal: '1 CTN',
      breakdown1Unit: 'BTL',
      breakdown1Qty: '12',
      breakdown2Unit: 'ML',
      breakdown2Qty: '500',
      breakdown1: '12 BTL',
      breakdown2: '500 ML',
    });
  });

  it('composes delivery path from principal + unit/qty breakdowns', () => {
    assert.equal(
      composeDeliveryUnitText(
        '1 CTN',
        composeDeliveryBreakdownSegment('BTL', '12'),
        composeDeliveryBreakdownSegment('ML', '500'),
      ),
      '1CTN/12BTL/500ML',
    );
    assert.equal(composeDeliveryUnitText('1 Tin', '5 ltr', ''), '1Tin/5ltr');
    assert.equal(composeDeliveryUnitText('1 Kg', '', ''), '1Kg');
  });

  it('parses Unit/Qty template and plans update vs create by product ID', () => {
    const csv = [
      VENDOR_PRODUCT_TEMPLATE_HEADERS.join(','),
      '"V007","Heritage Pantry Supply","","Dry Goods","Baked Beans","VP-BEAN001","1 Box","Tin","12","Gr","400","45.50"',
      '"V007","Heritage Pantry Supply","","Dry Goods","New Beans","","1 Case","Tin","6","Gr","400","30.00"',
    ].join('\n');

    const drafts = parseVendorProductTemplateCsv(csv);
    assert.equal(drafts.length, 2);
    assert.equal(drafts[0].vendorExternalId, 'V007');
    assert.equal(drafts[0].deliveryUnitText, '1Box/12Tin/400Gr');
    assert.equal(drafts[0].deliveryPrice, 45.5);

    const plan = buildImportPlan(
      drafts,
      [{ id: 'VP-BEAN001', vendorExternalId: 'V007', productName: 'Baked Beans', deliveryPrice: 42 }],
      [{ externalId: 'V007', name: 'Heritage Pantry Supply' }],
    );
    assert.equal(plan.errors.length, 0);
    assert.equal(plan.updates.length, 1);
    assert.equal(plan.updates[0].draft.deliveryPrice, 45.5);
    assert.equal(plan.creates.length, 1);
    assert.equal(plan.creates[0].productName, 'New Beans');
  });

  it('still parses combined DU breakdown 1/2 columns (previous template)', () => {
    const csv = [
      'Vendor ID,Vendor Name,Category,Group,Vendor Product,Vendor Product ID,Principal Delivery unit,DU breakdown 1,DU breakdown 2,Delivery Unit Price',
      '"V007","Heritage Pantry Supply","","Dry Goods","Baked Beans","VP-BEAN001","Box","12 tin","400 gr","42.00"',
    ].join('\n');
    const drafts = parseVendorProductTemplateCsv(csv);
    assert.equal(drafts.length, 1);
    assert.equal(drafts[0].deliveryUnitText, 'Box/12tin/400gr');
  });

  it('still parses legacy template columns', () => {
    const csv = [
      'Vendor Product ID,Product Name,Group,Specification,Delivery Unit,Price',
      'VP-BEAN001,Baked Beans,Dry Goods,Spec,Box/12tin/400gr,42.00',
    ].join('\n');
    const drafts = parseVendorProductTemplateCsv(csv);
    assert.equal(drafts.length, 1);
    assert.equal(drafts[0].vendorProductId, 'VP-BEAN001');
    assert.equal(drafts[0].deliveryUnitText, 'Box/12tin/400gr');
  });

  it('uses Category as Group when Group is blank', () => {
    const csv = [
      VENDOR_PRODUCT_TEMPLATE_HEADERS.join(','),
      '"V007","Heritage Pantry Supply","Dry Goods","","Cat Beans","VP-CAT001","1 Kg","","","","","12"',
    ].join('\n');
    const drafts = parseVendorProductTemplateCsv(csv);
    assert.equal(drafts.length, 1);
    assert.equal(drafts[0].group, 'Dry Goods');
    assert.equal(drafts[0].category, 'Dry Goods');
  });
});
