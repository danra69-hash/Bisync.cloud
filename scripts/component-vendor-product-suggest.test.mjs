/**
 * My Component detail: Category/Group/Storage one line + Vendor Product suggestion box.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const panel = fs.readFileSync(
  path.join(root, 'client/src/components/revenue/ComponentEditPanel.tsx'),
  'utf8',
);
assert.match(panel, /VendorProductSuggestionBox/, 'Detail panel hosts suggestion box');
assert.match(panel, /grid-cols-1 sm:grid-cols-3/, 'Category / Group / Storage on one line');
assert.match(panel, /label="Storage Location"/, 'Storage Location field present');

const box = fs.readFileSync(
  path.join(root, 'client/src/components/revenue/VendorProductSuggestionBox.tsx'),
  'utf8',
);
assert.match(box, /Vendor Product suggestion/, 'Suggestion box title');
assert.match(box, /type="checkbox"/, 'Tickbox per suggestion');
assert.match(box, /engageVendor/, 'Engage flow for unengaged vendors');
assert.match(box, /normalizeVendorKind|vendorKindLabel/, 'Online vs offline vendor handling');
assert.match(box, /Online vendors must accept|online wait for vendor accept/, 'Online wait message');

const service = fs.readFileSync(
  path.join(root, 'src/Bisync.Api/Services/ComponentVendorTagSuggestionService.cs'),
  'utf8',
);
assert.match(service, /vendorType/, 'API returns vendor type');
assert.match(service, /packaging/, 'API returns packaging');
assert.match(service, /FormatDeliveryPackaging/, 'Packaging formatter');

console.log('component-vendor-product-suggest.test.mjs: ok');
