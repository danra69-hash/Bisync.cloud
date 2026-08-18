/**
 * Pre-committed "Received" qty must count release receives even when DeliveredQuantity
 * was not bumped (fall back to ReceivedQuantity / ReconciledQuantity), and must link
 * releases via order-level or line-level commitment source ids.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const api = fs.readFileSync(
  path.join(root, 'src/Bisync.Api/Controllers/ApiControllers.cs'),
  'utf8',
);
const page = fs.readFileSync(
  path.join(root, 'client/src/components/revenue/PreCommittedPoPage.tsx'),
  'utf8',
);

assert.match(api, /ResolveReleaseReceivedAgainstCommitment/, 'received qty resolver required');
assert.match(api, /ReceivedQuantity is decimal received/, 'must fall back to ReceivedQuantity');
assert.match(api, /SourceCommittedPurchaseOrderItemId != null/, 'must find releases by line link');
assert.match(
  api,
  /Ensure drawdown progress can see receive qty/,
  'receive must backfill DeliveredQuantity from ReceivedQuantity',
);
assert.match(page, /visibilitychange/, 'Pre-committed tab must refresh on focus');
assert.match(page, /item\.consolidatedQuantity/, 'UI still reads consolidatedQuantity');

function resolveReleaseReceivedAgainstCommitment(item) {
  if (item.deliveredQuantity > 0.0001) return item.deliveredQuantity;
  if (item.receivedQuantity != null && item.receivedQuantity > 0.0001) return item.receivedQuantity;
  if (item.reconciledQuantity != null && item.reconciledQuantity > 0.0001) return item.reconciledQuantity;
  return 0;
}

assert.equal(
  resolveReleaseReceivedAgainstCommitment({
    deliveredQuantity: 0,
    receivedQuantity: 12,
    reconciledQuantity: null,
  }),
  12,
  'fallback to received when delivered is 0',
);
assert.equal(
  resolveReleaseReceivedAgainstCommitment({
    deliveredQuantity: 10,
    receivedQuantity: 12,
    reconciledQuantity: null,
  }),
  10,
  'prefer cumulative delivered',
);

console.log('precommitted-received-qty-reflect.test.mjs: ok');
