/**
 * Appointment Calendar is embedded at the top of Sales Diary; calendar tab is removed.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const page = fs.readFileSync(
  path.join(root, 'client/src/components/revenue/SalesModulePage.tsx'),
  'utf8',
);

assert.doesNotMatch(page, /id: 'calendar'/, 'Appointment Calendar tab removed from TABS');
assert.match(page, /type TabId = 'overview' \| 'client-update' \| 'sales-diary'/, 'TabId has no calendar');
assert.match(page, /tab !== 'sales-diary'/, 'Calendar sync runs on Sales Diary');
assert.match(
  page,
  /tab === 'sales-diary'[\s\S]*Appointment Calendar[\s\S]*SalesDiaryPanel/,
  'Sales Diary renders calendar above diary panel',
);

console.log('sales-module-diary-calendar-merge.test.mjs: ok');
