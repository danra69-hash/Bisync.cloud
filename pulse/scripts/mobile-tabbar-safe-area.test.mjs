import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const appSrc = readFileSync(join(root, 'mobile/App.tsx'), 'utf8');
const appJson = readFileSync(join(root, 'mobile/app.json'), 'utf8');

test('bottom tab bar uses safe-area insets so labels stay visible', () => {
  assert.match(appSrc, /SafeAreaProvider/);
  assert.match(appSrc, /useSafeAreaInsets/);
  assert.match(appSrc, /paddingBottom:\s*bottomPad/);
  assert.match(appSrc, /TAB_BAR_BASE_HEIGHT/);
  assert.match(appSrc, /viewport-fit=cover/);
});

test('web viewport enables safe-area inset coverage', () => {
  assert.match(appJson, /viewport-fit=cover/);
});
