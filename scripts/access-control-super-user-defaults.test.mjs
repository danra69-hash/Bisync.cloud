/**
 * Super User Access Control column is fully granted by default,
 * including newly added catalog line items.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = fs.readFileSync(
  path.join(root, 'client/src/data/accessControlCatalog.ts'),
  'utf8',
);
const tab = fs.readFileSync(
  path.join(root, 'client/src/components/admin/AccessControlTab.tsx'),
  'utf8',
);
const hook = fs.readFileSync(
  path.join(root, 'client/src/hooks/useAccessControlMatrix.ts'),
  'utf8',
);
const api = fs.readFileSync(
  path.join(root, 'src/Bisync.Api/Controllers/AccessControlController.cs'),
  'utf8',
);

assert.match(catalog, /SUPER_USER_ACCESS_TYPE_LABEL = 'Super User'/, 'Super User label constant');
assert.match(catalog, /index === 0 \? SUPER_USER_ACCESS_TYPE_LABEL/, 'default first column is Super User');
assert.match(catalog, /ensureSuperUserMatrixGrants/, 'backfill helper required');
assert.match(catalog, /typeId === SUPER_USER_ACCESS_TYPE_ID\) return true/, 'runtime always allows Super User');
assert.match(catalog, /Super User grant ticks cannot be cleared/, 'cannot untick Super User grants');

assert.match(tab, /ensureSuperUserMatrixGrants/, 'tab backfills Super User on load');
assert.match(tab, /disabled=\{superUserGrant\}/, 'Super User grant checkboxes locked');
assert.match(tab, /disabled=\{superUser\}/, 'Super User column All locked');

assert.match(hook, /ensureSuperUserMatrixGrants/, 'runtime matrix hook backfills Super User');
assert.match(api, /"Super User"/, 'API defaults first type to Super User');

console.log('access-control-super-user-defaults.test.mjs: ok');
