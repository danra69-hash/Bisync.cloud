/**
 * Desktop launcher version compare / update-offer rules + manifest present.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function compareDesktopVersions(a, b) {
  const pa = a.trim().split(/[.+-]/).map(n => Number.parseInt(n, 10) || 0);
  const pb = b.trim().split(/[.+-]/).map(n => Number.parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

function shouldOfferDesktopUpdate(published, opts = {}) {
  const installed = opts.installed ?? null;
  const dismissed = opts.dismissed ?? null;
  if (dismissed && compareDesktopVersions(published, dismissed) <= 0) return false;
  if (installed && compareDesktopVersions(published, installed) <= 0) return false;
  if (!installed && dismissed && compareDesktopVersions(published, dismissed) <= 0) return false;
  return true;
}

assert.equal(compareDesktopVersions('1.1.0', '1.0.0'), 1);
assert.equal(compareDesktopVersions('1.0.0', '1.1.0'), -1);
assert.equal(compareDesktopVersions('1.1.0', '1.1.0'), 0);
assert.equal(shouldOfferDesktopUpdate('1.1.0', { installed: '1.0.0', dismissed: null }), true);
assert.equal(shouldOfferDesktopUpdate('1.1.0', { installed: '1.1.0', dismissed: null }), false);
assert.equal(shouldOfferDesktopUpdate('1.1.0', { installed: '1.0.0', dismissed: '1.1.0' }), false);

const src = fs.readFileSync(path.join(root, 'client/src/data/desktopLauncher.ts'), 'utf8');
assert.match(src, /export function compareDesktopVersions/);
assert.match(src, /export function shouldOfferDesktopUpdate/);
assert.match(src, /version\.json/);

const version = JSON.parse(
  fs.readFileSync(path.join(root, 'client/public/downloads/bisync-desktop/version.json'), 'utf8'),
);
assert.ok(version.version, 'version.json must include version');
assert.match(version.windowsZip || '', /Windows\.zip/);

const bat = fs.readFileSync(
  path.join(root, 'client/public/downloads/bisync-desktop/windows/Bisync.cloud.bat'),
  'utf8',
);
assert.match(bat, new RegExp(`DESKTOP_VERSION=${version.version.replace(/\./g, '\\.')}`));
assert.match(bat, /desktop=1&desktopVersion=/);

console.log('desktop-launcher-version.test.mjs: ok');
