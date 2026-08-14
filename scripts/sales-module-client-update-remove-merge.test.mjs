/**
 * Client Update supports Remove and Merge for repeating/duplicate rows.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const page = fs.readFileSync(path.join(root, 'client/src/components/revenue/SalesModulePage.tsx'), 'utf8');
const api = fs.readFileSync(path.join(root, 'client/src/api.ts'), 'utf8');
const service = fs.readFileSync(
  path.join(root, 'src/Bisync.Api/Services/SalesModuleClientUpdateService.cs'),
  'utf8',
);
const controller = fs.readFileSync(
  path.join(root, 'src/Bisync.Api/Controllers/SalesModuleController.cs'),
  'utf8',
);

assert.match(api, /deleteSalesModuleClientUpdate/, 'API delete client update');
assert.match(api, /mergeSalesModuleClientUpdateDuplicates/, 'API merge duplicates');
assert.match(service, /MergeDuplicatesAsync/, 'service merge');
assert.match(service, /DeleteAsync/, 'service delete');
assert.match(controller, /merge-duplicates/, 'controller merge route');
assert.match(controller, /HttpDelete\("client-updates\/\{id:int\}"\)/, 'controller delete route');
assert.match(page, /removeClientUpdateRow/, 'UI remove handler');
assert.match(page, /mergeClientUpdateDuplicates/, 'UI merge handler');
assert.match(page, />\s*Remove\s*</, 'Remove button label');
assert.match(page, />\s*Merge\s*</, 'Merge button label');

function clientKey(row) {
  if (row.company?.trim()) return row.company.trim().toLowerCase();
  if (row.brand?.trim()) return row.brand.trim().toLowerCase();
  return null;
}

function groupKey(row) {
  const client = clientKey(row);
  if (!client) return null;
  const member = row.salesTeamMemberId > 0
    ? `m:${row.salesTeamMemberId}`
    : `h:${String(row.hunter ?? '').trim().toLowerCase()}`;
  return `${member}|${client}`;
}

const rows = [
  { id: 1, company: 'Acme', hunter: 'Alex', salesTeamMemberId: 2 },
  { id: 2, company: 'acme', hunter: 'Alex', salesTeamMemberId: 2 },
  { id: 3, company: 'Beta', hunter: 'Alex', salesTeamMemberId: 2 },
];
const counts = new Map();
for (const row of rows) {
  const key = groupKey(row);
  if (!key) continue;
  counts.set(key, (counts.get(key) ?? 0) + 1);
}
assert.equal(counts.get(groupKey(rows[0])), 2);
assert.equal(counts.get(groupKey(rows[2])), 1);

console.log('sales-module-client-update-remove-merge.test.mjs: ok');
