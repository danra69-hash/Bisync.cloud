/**
 * Dev Console Team / Control Panel is limited to a hard email allowlist.
 * Control Panel tab hosts Team + Site launch mode (after Ref & Library).
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

const tabs = fs.readFileSync(
  path.join(root, 'src/Bisync.Api/Services/DevConsoleTabAccess.cs'),
  'utf8',
);
assert.match(tabs, /"control-panel"/);
assert.ok(
  tabs.indexOf('"ref-library"') < tabs.indexOf('"control-panel"'),
  'control-panel must follow ref-library in AllTabs',
);

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
assert.match(page, /id: 'control-panel'/);
assert.match(page, /label: 'Control Panel'/);
assert.match(page, /tab === 'control-panel'/);
assert.match(page, /tab === 'overview' && \(\s*<UsageDashboard \/>\s*\)/);
assert.match(page, /tab === 'control-panel'[\s\S]*DemoLaunchPanel/);
assert.match(page, /tab === 'control-panel'[\s\S]*Create Dev Console operators/);
assert.doesNotMatch(
  page,
  /tab === 'overview' && \(\s*<>[\s\S]*DemoLaunchPanel/,
  'Site launch mode must not remain on Overview',
);

const clientTabs = fs.readFileSync(
  path.join(root, 'client/src/data/devConsoleAuthApi.ts'),
  'utf8',
);
assert.match(clientTabs, /'control-panel'/);
assert.match(clientTabs, /DEV_CONSOLE_ASSIGNABLE_TAB_IDS/);

console.log('dev-console-control-panel-access.test.mjs: ok');
