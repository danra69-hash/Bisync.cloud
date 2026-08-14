/**
 * Employee Directory: Shift tick, leave columns before Active,
 * company/location as top filters, and employee search.
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

assert.match(list, /Outstanding RDO/, 'Outstanding RDO column');
assert.match(list, /Outstanding RPH/, 'Outstanding RPH column');
assert.match(list, /Outstanding AL/, 'Outstanding AL column');
assert.match(list, /Unpaid Leave taken/, 'Unpaid Leave taken column');
assert.match(list, /Medical Leave taken/, 'Medical Leave taken column');
assert.match(list, /key: 'outstandingRdo'[\s\S]*key: 'active'/, 'leave columns appear before Active');

assert.doesNotMatch(list, /key: 'company'/, 'Company removed as table column');
assert.doesNotMatch(list, /key: 'location'/, 'Location removed as table column');
assert.match(list, />Company</, 'Company filter label on top');
assert.match(list, />Location</, 'Location filter label on top');
assert.match(list, /Search employee/, 'Search employee control on top');
assert.match(list, /aria-label="Search employee"/, 'Search input labeled');

console.log('employee-directory-shift-checkbox.test.mjs: ok');
