/**
 * Automated QA listings must cover latest RMS features (POS Sales, component suggestions, live reports).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const steps = fs.readFileSync(path.join(root, 'client/src/data/devQaExtendedSteps.ts'), 'utf8');
const guide = fs.readFileSync(path.join(root, 'client/src/data/devQaIssueGuide.ts'), 'utf8');
const scenes = fs.readFileSync(path.join(root, 'client/src/data/devQaScenes.ts'), 'utf8');
const cleanup = fs.readFileSync(path.join(root, 'src/Bisync.Api/Controllers/DevConsoleController.cs'), 'utf8');

const requiredStepIds = [
  'component-category-group-storage',
  'component-vendor-product-suggest-box',
  'sales-pos-sales-fields',
  'sales-pos-sales-upload',
  'order-returnable-goods',
  'order-credit-notes',
  'report-bcg-matrix',
  'report-ops-expenses',
];

for (const id of requiredStepIds) {
  assert.match(steps, new RegExp(`id: '${id}'`), `QA step missing: ${id}`);
  assert.match(guide, new RegExp(`'${id}':`), `Issue guide missing: ${id}`);
  assert.match(scenes, new RegExp(`'${id}':`), `Scene missing: ${id}`);
}

assert.match(steps, /api\.posSalesPreview/, 'POS Sales upload uses preview API');
assert.match(steps, /api\.posSalesImport/, 'POS Sales upload uses import API');
assert.match(steps, /api\.reportBcgMatrix/, 'BCG Matrix report is live (not skip)');
assert.match(steps, /api\.reportOpsExpensesAnalysis/, 'Ops Expenses report is live (not skip)');
assert.doesNotMatch(
  steps,
  /id: 'report-itemized-sales'[\s\S]{0,200}skipInactive/,
  'Itemized Sales Summary must not remain skipInactive',
);

assert.match(cleanup, /posSalesImportLines/, 'QA cleanup deletes POS Sales lines');
assert.match(cleanup, /posSalesImportBatches/, 'QA cleanup deletes POS Sales batches');
assert.match(cleanup, /posSalesHeaderMaps/, 'QA cleanup deletes POS Sales header maps');
assert.match(cleanup, /creditNotes/, 'QA cleanup deletes credit notes');
assert.match(cleanup, /returnableGoodsReturns/, 'QA cleanup deletes returnable goods returns');

console.log('automated-qa-listings.test.mjs: ok');
