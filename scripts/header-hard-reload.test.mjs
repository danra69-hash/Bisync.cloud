/**
 * Header must expose a hard-reload control next to Home (Ctrl+Shift+R equivalent).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const header = fs.readFileSync(path.join(root, 'client/src/components/layout/Header.tsx'), 'utf8');
const util = fs.readFileSync(path.join(root, 'client/src/utils/hardReload.ts'), 'utf8');
const en = fs.readFileSync(path.join(root, 'client/src/i18n/locales/en.ts'), 'utf8');

assert.match(header, /hardReloadPage/, 'Header imports/uses hardReloadPage');
assert.match(header, /header\.hardReload/, 'Header labels hard reload');
assert.match(header, /onGoHome[\s\S]*onHardReload|onClick=\{onGoHome\}[\s\S]*onClick=\{onHardReload\}/, 'Reload control sits with Home');
assert.match(util, /serviceWorker/, 'Hard reload unregisters service workers');
assert.match(util, /caches\.delete|caches\.keys/, 'Hard reload clears Cache Storage');
assert.match(util, /location\.reload/, 'Hard reload reloads the document');
assert.match(en, /hardReload: 'Reload page \(Ctrl\+Shift\+R\)'/, 'English tooltip mentions Ctrl+Shift+R');

console.log('header-hard-reload.test.mjs: ok');
