/**
 * Vendor Product template CSV: headers, delivery columns, parse/upsert matching.
 * Mirrors helpers in client/src/data/vendorProductCatalog.ts + vendorProductImportCatalog.ts.
 * Run: node --experimental-strip-types --test scripts/vendor-product-template-csv.test.mjs
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
  'DU breakdown 1',
  'DU breakdown 2',
  'Delivery Unit Price',
];

function normalizeDeliverySegment(raw) {
  return raw.trim().replace(/\s+/g, '');
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
  const orderUnit = delivery.orderUnit;
  const hasPackLevel = delivery.packUnit !== delivery.orderUnit || delivery.packQty !== 1;
  let firstBreakdown = null;
  if (hasPackLevel) {
    firstBreakdown = `${delivery.packQty} ${delivery.packUnit}`;
  } else if (delivery.orderQty !== 1) {
    firstBreakdown = `${delivery.orderQty} ${delivery.orderUnit}`;
  }
  const secondBreakdown = hasSmallestDeliveryBreakdown(delivery)
    ? `${delivery.unitQty} ${delivery.unitUnit}`
    : null;
  return {
    principal: (orderUnit || '').trim(),
    breakdown1: (firstBreakdown || '').trim(),
    breakdown2: (secondBreakdown || '').trim(),
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

function rowFromMap(cols, indexMap) {
  const vendorExternalId = cellAt(cols, indexMap, 'vendor id').trim().toUpperCase();
  const vendorName = cellAt(cols, indexMap, 'vendor name').trim();
  const category = cellAt(cols, indexMap, 'category').trim();
  const groupRaw = cellAt(cols, indexMap, 'group').trim();
  const group = groupRaw || category;
  const productName = cellAt(cols, indexMap, 'vendor product', 'product name').trim();
  const vendorProductId = cellAt(cols, indexMap, 'vendor product id').trim().toUpperCase();
  const principal = cellAt(cols, indexMap, 'principal delivery unit').trim();
  const du1 = cellAt(cols, indexMap, 'du breakdown 1').trim();
  const du2 = cellAt(cols, indexMap, 'du breakdown 2').trim();
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
  orderUnit: 'Box',
  orderQty: 1,
  packUnit: 'Tin',
  packQty: 12,
  unitUnit: 'Gr',
  unitQty: 400,
};

describe('vendor product template CSV', () => {
  it('uses the requested column headers in source', () => {
    assert.deepEqual(VENDOR_PRODUCT_TEMPLATE_HEADERS, [
      'Vendor ID',
      'Vendor Name',
      'Category',
      'Group',
      'Vendor Product',
      'Vendor Product ID',
      'Principal Delivery unit',
      'DU breakdown 1',
      'DU breakdown 2',
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

  it('splits delivery into principal + DU breakdown columns', () => {
    assert.deepEqual(deliveryTemplateColumns(sampleDelivery), {
      principal: 'Box',
      breakdown1: '12 Tin',
      breakdown2: '400 Gr',
    });
  });

  it('composes delivery path from principal + breakdowns', () => {
    assert.equal(composeDeliveryUnitText('Box', '12 tin', '400 gr'), 'Box/12tin/400gr');
    assert.equal(composeDeliveryUnitText('Tin', '5 ltr', ''), 'Tin/5ltr');
    assert.equal(composeDeliveryUnitText('Kg', '', ''), 'Kg');
  });

  it('parses the new template and plans update vs create by product ID', () => {
    const csv = [
      VENDOR_PRODUCT_TEMPLATE_HEADERS.join(','),
      '"V007","Heritage Pantry Supply","","Dry Goods","Baked Beans","VP-BEAN001","Box","12 tin","400 gr","45.50"',
      '"V007","Heritage Pantry Supply","","Dry Goods","New Beans","","Case","6 tin","400 gr","30.00"',
    ].join('\n');

    const drafts = parseVendorProductTemplateCsv(csv);
    assert.equal(drafts.length, 2);
    assert.equal(drafts[0].vendorExternalId, 'V007');
    assert.equal(drafts[0].deliveryUnitText, 'Box/12tin/400gr');
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
      '"V007","Heritage Pantry Supply","Dry Goods","","Cat Beans","VP-CAT001","Kg","","","12"',
    ].join('\n');
    const drafts = parseVendorProductTemplateCsv(csv);
    assert.equal(drafts.length, 1);
    assert.equal(drafts[0].group, 'Dry Goods');
    assert.equal(drafts[0].category, 'Dry Goods');
  });
});
