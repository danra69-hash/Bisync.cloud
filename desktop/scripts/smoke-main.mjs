/**
 * Lightweight sanity checks for the desktop Electron main process modules.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

for (const rel of ['src/main.js', 'src/preload.js', 'src/config.js', 'assets/icon.png', 'package.json']) {
  assert.ok(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
assert.equal(pkg.main, 'src/main.js');
assert.equal(pkg.build?.appId, 'cloud.bisync.desktop');

const { resolveAppUrl, DEFAULT_CLOUD_URL } = require(path.join(root, 'src/config.js'));
assert.match(DEFAULT_CLOUD_URL, /^https:\/\/bisync-cloud-/);
assert.equal(resolveAppUrl(), DEFAULT_CLOUD_URL);

process.env.BISYNC_DESKTOP_URL = 'http://localhost:5173/';
assert.equal(resolveAppUrl(), 'http://localhost:5173');
delete process.env.BISYNC_DESKTOP_URL;

const mainSrc = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8');
assert.match(mainSrc, /contextIsolation:\s*true/);
assert.match(mainSrc, /nodeIntegration:\s*false/);
assert.match(mainSrc, /requestSingleInstanceLock/);

console.log('desktop/scripts/smoke-main.mjs: ok');
