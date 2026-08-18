/**
 * My Order "All vendors" must list every engaged vendor for the selected locations,
 * not only vendors that already have tagged products on order lines.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseVendorEngagedLocationIds(vendor) {
  const raw = (vendor.engagedLocationIdsJson || '').trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(v => String(v ?? '').trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function vendorEngagedAtLocations(vendor, locationIds) {
  if (!vendor.engaged) return false;
  if (locationIds.length === 0) return false;
  const engagedLocs = parseVendorEngagedLocationIds(vendor);
  if (engagedLocs.length === 0) return true;
  const selected = new Set(locationIds.map(id => id.trim()).filter(Boolean));
  return engagedLocs.some(id => selected.has(id));
}

/** Fixed resolver: all engaged vendors at location (policy ignored in this unit test). */
function resolveVendorsForSelectedLocations(_components, locationIds, vendors, _policy = [], companyId = null) {
  return vendors
    .filter(v => {
      if (v.active === false) return false;
      if (companyId != null && v.companyId != null && v.companyId !== companyId) return false;
      return vendorEngagedAtLocations(v, locationIds);
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

const pavilion = ['weissbrau-pavilion-kuala-lumpur'];

const vendors = [
  {
    externalId: 'V-TAGGED',
    name: 'Tagged Engaged',
    engaged: true,
    active: true,
    companyId: 5,
    engagedLocationIdsJson: JSON.stringify(pavilion),
  },
  {
    externalId: 'V-UNTAGGED',
    name: 'Untagged Engaged',
    engaged: true,
    active: true,
    companyId: 5,
    engagedLocationIdsJson: JSON.stringify(pavilion),
  },
  {
    externalId: 'V-OTHER-LOC',
    name: 'Other Location Engaged',
    engaged: true,
    active: true,
    companyId: 5,
    engagedLocationIdsJson: JSON.stringify(['other-outlet']),
  },
  {
    externalId: 'V-WIDE',
    name: 'Company Wide Engaged',
    engaged: true,
    active: true,
    companyId: 5,
    engagedLocationIdsJson: '[]',
  },
  {
    externalId: 'V-OFF',
    name: 'Not Engaged',
    engaged: false,
    active: true,
    companyId: 5,
    engagedLocationIdsJson: JSON.stringify(pavilion),
  },
];

// Legacy (tagged-only) would miss V-UNTAGGED when no components/products passed.
{
  const options = resolveVendorsForSelectedLocations([], pavilion, vendors, [], 5);
  const ids = options.map(v => v.externalId);
  assert.ok(ids.includes('V-TAGGED'));
  assert.ok(ids.includes('V-UNTAGGED'), 'engaged vendor without tags must appear');
  assert.ok(ids.includes('V-WIDE'), 'empty engaged locations = company-wide');
  assert.ok(!ids.includes('V-OTHER-LOC'));
  assert.ok(!ids.includes('V-OFF'));
  assert.equal(options.length, 3);
}

// Source anchors
{
  const src = fs.readFileSync(path.join(root, 'client/src/data/createOrder.ts'), 'utf8');
  assert.match(src, /every active engaged vendor/);
  assert.match(src, /vendorEngagedAtLocations/);
  assert.doesNotMatch(src, /vendorIds\.has\(v\.externalId\)/);

  const page = fs.readFileSync(path.join(root, 'client/src/components/revenue/CreateOrderPage.tsx'), 'utf8');
  assert.match(page, /api\.vendors\(true,\s*selectedCompanyId\)/);
}

console.log('my-order-engaged-vendors-filter.test.mjs: OK');
