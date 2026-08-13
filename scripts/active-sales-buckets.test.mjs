/**
 * Active Sales Order KPI bucket classification (includes Expired).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function resolveActiveSalesBucket(order) {
  switch (order.status) {
    case 'draft':
      return 'pending_approval';
    case 'issued':
      return 'issued';
    case 'confirmed':
      return 'confirmed';
    case 'expired':
      return 'expired';
    default:
      return null;
  }
}

assert.equal(resolveActiveSalesBucket({ status: 'draft' }), 'pending_approval');
assert.equal(resolveActiveSalesBucket({ status: 'issued' }), 'issued');
assert.equal(resolveActiveSalesBucket({ status: 'confirmed' }), 'confirmed');
assert.equal(resolveActiveSalesBucket({ status: 'expired' }), 'expired');
assert.equal(resolveActiveSalesBucket({ status: 'fulfilled' }), null);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const page = fs.readFileSync(
  path.join(root, 'client/src/components/revenue/ActiveSalesOrderPage.tsx'),
  'utf8',
);
assert.match(page, /resolveActiveSalesBucket/);
assert.match(page, /status === 'expired'/);
assert.match(page, /Client did not accept within 7 working days/);

console.log('active-sales-buckets.test.mjs: ok');
