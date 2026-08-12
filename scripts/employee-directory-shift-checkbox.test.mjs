/**
 * Employee Directory detail panel must show the Shift tick box
 * (read-only; driven by Employee Level), matching the directory list.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const detail = fs.readFileSync(
  path.join(root, 'client/src/components/admin/EmployeeDetailPanel.tsx'),
  'utf8',
);
const list = fs.readFileSync(
  path.join(root, 'client/src/components/admin/EmployeeDirectoryTab.tsx'),
  'utf8',
);

assert.match(list, /checked=\{employeeIsShift\(employee\)\}/, 'directory list has Shift tick');
assert.match(detail, /checked=\{employeeIsShift\(employee\)\}/, 'detail panel has Shift tick');
assert.match(detail, /aria-label="Shift"/, 'Shift checkbox labeled');
assert.match(detail, /disabled/, 'Shift tick remains read-only from level');
assert.match(detail, /Level &(?:amp;)? Entitlement/, 'hint points to Level & Entitlement');
assert.doesNotMatch(
  detail,
  /Shift status: \{employeeIsShift/,
  'text-only shift status replaced by checkbox',
);

console.log('employee-directory-shift-checkbox.test.mjs: ok');
