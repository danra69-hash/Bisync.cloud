/**
 * Pre-committed vendor products must surface on My Order for drawdown even when
 * they are not currently tagged on a component for the selected location.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const createOrderSrc = fs.readFileSync(path.join(root, 'client/src/data/createOrder.ts'), 'utf8');
const createOrderPageSrc = fs.readFileSync(
  path.join(root, 'client/src/components/revenue/CreateOrderPage.tsx'),
  'utf8',
);
const preCommittedPageSrc = fs.readFileSync(
  path.join(root, 'client/src/components/revenue/PreCommittedPoPage.tsx'),
  'utf8',
);

assert.match(
  createOrderSrc,
  /export function appendMissingCommittedOrderLines/,
  'appendMissingCommittedOrderLines must exist',
);
assert.match(
  createOrderSrc,
  /export function commitmentVendorProductLabel/,
  'commitmentVendorProductLabel must exist',
);
assert.match(
  createOrderPageSrc,
  /appendMissingCommittedOrderLines/,
  'My Order must append missing committed products',
);
assert.match(
  createOrderPageSrc,
  /applyCommitmentOverlays\(withCommitted,\s*committedPos\)/,
  'My Order must overlay commitments after injecting missing products',
);
assert.match(
  preCommittedPageSrc,
  /commitmentVendorProductLabel\(item\)/,
  'Pre-committed tab must show vendor product names on commitments',
);

console.log('precommitted-my-order-drawdown.test.mjs: ok');
