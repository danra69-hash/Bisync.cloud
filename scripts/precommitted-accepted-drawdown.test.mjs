/**
 * Vendor accept must not flip pre-committed masters to Accepted (that blocked drawdown).
 * Drawdown must treat open commitment statuses as available, skip already-linked lines,
 * and repair orphan releases on startup.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workflow = fs.readFileSync(
  path.join(root, 'src/Bisync.Api/Services/PurchaseOrderWorkflow.cs'),
  'utf8',
);
const drawdown = fs.readFileSync(
  path.join(root, 'src/Bisync.Api/Services/PreCommittedPoDrawdownService.cs'),
  'utf8',
);
const api = fs.readFileSync(
  path.join(root, 'src/Bisync.Api/Controllers/ApiControllers.cs'),
  'utf8',
);
const portal = fs.readFileSync(
  path.join(root, 'src/Bisync.Api/Controllers/VendorOrderPortalController.cs'),
  'utf8',
);
const patcher = fs.readFileSync(
  path.join(root, 'src/Bisync.Api/Data/SchemaPatcher.cs'),
  'utf8',
);

assert.match(workflow, /IsOpenPreCommitmentStatus/, 'open commitment status helper required');
assert.match(
  workflow,
  /if \(order\.IsPreCommitted\)[\s\S]*status = StatusCommitted/,
  'MapOrder must keep pre-committed masters as Committed',
);

assert.match(
  api,
  /!order\.IsPreCommitted[\s\S]*StatusAccepted/,
  'vendor-approve must not set Accepted on pre-committed masters',
);
assert.match(
  portal,
  /!order\.IsPreCommitted[\s\S]*StatusAccepted/,
  'vendor portal accept must not set Accepted on pre-committed masters',
);

assert.match(
  drawdown,
  /Status != PurchaseOrderWorkflow\.StatusCommitmentClosed/,
  'drawdown must not require exact Committed status only',
);
assert.match(
  drawdown,
  /SourceCommittedPurchaseOrderItemId is > 0/,
  'must skip already-linked release lines',
);
assert.match(
  drawdown,
  /RepairAcceptedMastersAndOrphanReleasesAsync/,
  'repair entry point required',
);
assert.match(
  drawdown,
  /ReleaseFallsInCommitmentWindow/,
  'orphan repair must respect commitment date window',
);

assert.match(
  patcher,
  /RepairAcceptedMastersAndOrphanReleasesAsync/,
  'SchemaPatcher must run drawdown repair on startup',
);

assert.match(
  api,
  /IsOpenPreCommitmentStatus/,
  'GetCommitted must accept open commitment statuses',
);

console.log('precommitted-accepted-drawdown.test.mjs: ok');
