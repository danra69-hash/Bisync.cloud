/**
 * Dev Console Team (control panel) is limited to a hard email allowlist.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const allowed = [
  'dra@cubevalue.com',
  'james@cubevalue.com',
  'james@pasar.ai',
];

function canManage(email) {
  const normalized = (email ?? '').trim().toLowerCase();
  return allowed.includes(normalized);
}

assert.equal(canManage('dra@cubevalue.com'), true);
assert.equal(canManage('James@Cubevalue.com'), true);
assert.equal(canManage('james@pasar.ai'), true);
assert.equal(canManage('other@cubevalue.com'), false);
assert.equal(canManage(''), false);

const api = fs.readFileSync(
  path.join(root, 'src/Bisync.Api/Services/DevConsoleControlPanelAccess.cs'),
  'utf8',
);
assert.match(api, /dra@cubevalue\.com/);
assert.match(api, /james@cubevalue\.com/);
assert.match(api, /james@pasar\.ai/);

const auth = fs.readFileSync(
  path.join(root, 'src/Bisync.Api/Controllers/DevConsoleAuthController.cs'),
  'utf8',
);
assert.match(auth, /RequireControlPanelAsync/);
assert.match(auth, /canManageTeam/);

const page = fs.readFileSync(
  path.join(root, 'client/src/pages/DevConsolePage.tsx'),
  'utf8',
);
assert.match(page, /canManageTeam/);
assert.match(page, /canManageDevConsoleTeam/);
assert.doesNotMatch(
  page,
  /sessionUser\.isRoot && \(\s*<div className="flex items-center justify-between[\s\S]*Team/,
);

console.log('dev-console-control-panel-access.test.mjs: ok');
