/**
 * Purchase Request Summary must support View by Location / Vendor / Vendor Product /
 * PO Number and a line detail table with clickable PO Number.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(
  path.join(root, 'client/src/components/revenue/ActivePurchasePage.tsx'),
  'utf8',
);

assert.match(src, /View by/, 'PR summary must expose View by controls');
assert.match(src, /id: 'location'/, 'View by Location required');
assert.match(src, /id: 'vendor'/, 'View by Vendor required');
assert.match(src, /id: 'vendor_product'/, 'View by Vendor Product required');
assert.match(src, /id: 'po_number'/, 'View by PO Number required');
assert.match(src, /label: 'PO Number'/, 'detail table needs PO Number column');
assert.match(src, /label: 'Vendor Product'/, 'detail table needs Vendor Product column');
assert.match(src, /label: 'Delivery Unit'/, 'detail table needs Delivery Unit column');
assert.match(src, /label: 'QTY Ordered'/, 'detail table needs QTY Ordered column');
assert.match(src, /label: 'Location'/, 'detail table needs Location column');
assert.match(src, /setSelectedOrderId\(line\.orderId\)/, 'PO Number must open PR detail');
assert.match(src, /buildPurchaseRequestSummaryLines/, 'PR lines must expand from order items');

console.log('pr-summary-view-by-detail.test.mjs: ok');
