/**
 * Overview "(Unassigned)" must resolve to blank-Hunter / untagged Client Update rows,
 * not a literal hunter name match.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const service = fs.readFileSync(
  path.join(root, 'src/Bisync.Api/Services/SalesModuleClientUpdateService.cs'),
  'utf8',
);
const page = fs.readFileSync(
  path.join(root, 'client/src/components/revenue/SalesModulePage.tsx'),
  'utf8',
);

assert.match(service, /IsUnassignedHunterLabel/, 'service recognizes Unassigned label');
assert.match(service, /IsUnassignedClientRow/, 'service filters blank untagged rows');
assert.match(
  service,
  /Equals\("\(Unassigned\)"/,
  'service treats (Unassigned) as blank-hunter bucket',
);
assert.match(page, /isUnassigned/, 'Overview detail click detects unassigned');
assert.match(
  page,
  /hunter: isUnassigned \? '\(Unassigned\)' : row\.hunter/,
  'Overview requests (Unassigned) hunter key for blank rows',
);

function isUnassignedHunterLabel(hunter) {
  const key = String(hunter ?? '').trim();
  return !key || key.toLowerCase() === '(unassigned)' || key.toLowerCase() === 'unassigned';
}

function isUnassignedClientRow(row) {
  return !(row.salesTeamMemberId > 0)
    && (isUnassignedHunterLabel(row.hunter) || !String(row.hunter ?? '').trim());
}

function listForHunter(rows, hunter) {
  if (isUnassignedHunterLabel(hunter)) return rows.filter(isUnassignedClientRow);
  const key = hunter.trim().toLowerCase();
  return rows.filter(r => String(r.hunter ?? '').trim().toLowerCase() === key);
}

const sample = [
  { id: 1, hunter: '', salesTeamMemberId: null, company: 'Acme' },
  { id: 2, hunter: '   ', salesTeamMemberId: null, company: 'Beta' },
  { id: 3, hunter: '(Unassigned)', salesTeamMemberId: null, company: 'Ghost' },
  { id: 4, hunter: 'Alex', salesTeamMemberId: 9, company: 'Tagged' },
  { id: 5, hunter: 'Alex', salesTeamMemberId: null, company: 'FreeText' },
];

assert.deepEqual(
  listForHunter(sample, '(Unassigned)').map(r => r.id),
  [1, 2, 3],
  'Unassigned lists blank and literal Unassigned hunters',
);
assert.deepEqual(
  listForHunter(sample, 'Alex').map(r => r.id),
  [4, 5],
  'Named hunter still matches free-text',
);
assert.equal(isUnassignedHunterLabel('(Unassigned)'), true);
assert.equal(isUnassignedHunterLabel('Unassigned'), true);
assert.equal(isUnassignedHunterLabel('Alex'), false);

console.log('sales-module-overview-unassigned.test.mjs: ok');
