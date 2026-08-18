/**
 * Drawdown release POs must mark lines that count against Pre-committed volume,
 * and Pre-committed tab must show received qty per vendor product.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const model = fs.readFileSync(path.join(root, 'src/Bisync.Api/Models/PurchaseOrder.cs'), 'utf8');
const drawdown = fs.readFileSync(
  path.join(root, 'src/Bisync.Api/Services/PreCommittedPoDrawdownService.cs'),
  'utf8',
);
const workflow = fs.readFileSync(
  path.join(root, 'src/Bisync.Api/Services/PurchaseOrderWorkflow.cs'),
  'utf8',
);
const panel = fs.readFileSync(
  path.join(root, 'client/src/components/revenue/ActivePurchasePanel.tsx'),
  'utf8',
);
const prePage = fs.readFileSync(
  path.join(root, 'client/src/components/revenue/PreCommittedPoPage.tsx'),
  'utf8',
);

assert.match(model, /SourceCommittedPurchaseOrderItemId/, 'model must store drawdown line link');
assert.match(
  drawdown,
  /SourceCommittedPurchaseOrderItemId\s*\?\?=/,
  'drawdown must stamp release lines with master item id',
);
assert.match(workflow, /isCommitmentDrawdown/, 'API must expose commitment drawdown flag');
assert.match(workflow, /sourceCommittedPoNumber/, 'API must expose master PO number on releases');
assert.match(panel, /isCommitmentDrawdown/, 'Active Purchase lines must show drawdown marker');
assert.match(panel, /Drawn from Pre-committed volume/, 'release PO banner required');
assert.match(prePage, /Received \{received\}/, 'Pre-committed tab must show received qty');
assert.match(prePage, /item\.consolidatedQuantity/, 'received qty must use consolidatedQuantity');

console.log('precommitted-drawdown-line-indicators.test.mjs: ok');
