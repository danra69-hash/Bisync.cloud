import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const homeSrc = readFileSync(join(root, 'mobile/src/screens/HomeScreen.tsx'), 'utf8');
const appSrc = readFileSync(join(root, 'mobile/App.tsx'), 'utf8');
const routes = readFileSync(join(root, 'api/src/mobile-routes.mjs'), 'utf8');
const utils = readFileSync(join(root, 'mobile/src/calendarUtils.ts'), 'utf8');

test('coach Home tab is registered in App for coaches', () => {
  assert.match(appSrc, /name="Home"/);
  assert.match(appSrc, /isCoach/);
  assert.match(appSrc, /HomeScreen/);
});

test('HomeScreen has calendar + add appointment with member tag', () => {
  assert.match(homeSrc, /calendar\?scope=all/);
  assert.match(homeSrc, /New appointment/);
  assert.match(homeSrc, /Tag member/);
  assert.match(homeSrc, /scheduled:\s*true/);
  assert.match(homeSrc, /YYYY-MM-DD/);
  assert.match(homeSrc, /HH:MM/);
});

test('API supports coach scope=all and scheduled coach bookings', () => {
  assert.match(routes, /scopeAll/);
  assert.match(routes, /scope=all/);
  assert.match(routes, /b\.scheduled === true/);
});

test('calendarUtils helpers are present', () => {
  assert.match(utils, /export function monthMatrix/);
  assert.match(utils, /export function combineLocal/);
  assert.match(utils, /export function ymd/);
});
