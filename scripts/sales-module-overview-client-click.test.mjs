/**
 * Overview client detail names must open Client Update followup.
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

assert.match(
  page,
  /overviewDetailRows\.map\(row =>[\s\S]*?setFollowupRow\(row\)/,
  'Overview client name opens followup',
);
assert.match(
  page,
  /Open Client Update followup/,
  'Client name control titled for Client Update',
);
assert.match(
  page,
  /setOverviewDetailRows\(prev =>[\s\S]*?sortOverviewClientDetails/,
  'Followup save refreshes Overview detail list',
);

console.log('sales-module-overview-client-click.test.mjs: ok');
