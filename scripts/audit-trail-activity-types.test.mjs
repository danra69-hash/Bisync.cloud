/**
 * Audit Trail columns + domain activity type titles for Platform Config.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tab = fs.readFileSync(
  path.join(root, 'client/src/components/admin/SystemAuditTrailTab.tsx'),
  'utf8',
);
const types = fs.readFileSync(
  path.join(root, 'src/Bisync.Api/Models/SystemAuditActivityTypes.cs'),
  'utf8',
);
const interceptor = fs.readFileSync(
  path.join(root, 'src/Bisync.Api/Services/SystemAuditSaveChangesInterceptor.cs'),
  'utf8',
);
const fifo = fs.readFileSync(
  path.join(root, 'src/Bisync.Api/Services/FifoBatchIssueService.cs'),
  'utf8',
);

assert.match(tab, /Login name \(email\)/, 'Login name column required');
assert.match(tab, /Activity type/, 'Activity type column required');
assert.match(tab, /Activity Detail/, 'Activity Detail column required');
assert.match(tab, /Effected DB bucket/, 'Effected DB bucket column required');
assert.match(tab, /Date \/ Time/, 'Date / Time column required');
assert.match(tab, /PR issue \/ approval/, 'PR activity type title');
assert.match(tab, /PO adjustment \/ issue/, 'PO activity type title');
assert.match(tab, /Received \/ Consolidation \/ adjustment/, 'Receive/consolidation title');
assert.match(tab, /Stock issue \/ receive/, 'Stock activity type title');
assert.match(tab, /Wastage \/ Transfer/, 'Wastage/Transfer title');
assert.match(tab, /Credit note/, 'Credit note title');
assert.match(tab, /Cash purchase/, 'Cash purchase title');

assert.match(types, /PrIssueApproval = "PR issue \/ approval"/, 'API PR type');
assert.match(types, /ClassifyEntity/, 'entity classifier required');
assert.match(interceptor, /GroupBy\(s => s\.ActivityType\)/, 'one audit row per activity type');
assert.match(fifo, /StockIssueReceive/, 'FIFO stock must write audit');
assert.match(fifo, /FifoIssue/, 'FIFO issue audited');
assert.match(fifo, /FifoReceipt/, 'FIFO receipt audited');

console.log('audit-trail-activity-types.test.mjs: ok');
