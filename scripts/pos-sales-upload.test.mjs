/**
 * POS Sales header mapping + nav registration.
 * Run: node --experimental-strip-types --test scripts/pos-sales-upload.test.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const nav = fs.readFileSync(path.join(root, 'client/src/data/revenueManagement.ts'), 'utf8');
assert.match(nav, /label: 'POS Sales'/, 'RMS Sales nav must include POS Sales');

const section = fs.readFileSync(
  path.join(root, 'client/src/components/revenue/RevenueSection.tsx'),
  'utf8',
);
assert.match(section, /case 'POS Sales'/, 'RevenueSection must route POS Sales');
assert.match(section, /PosSalesPage/, 'RevenueSection must render PosSalesPage');

const page = fs.readFileSync(
  path.join(root, 'client/src/components/revenue/PosSalesPage.tsx'),
  'utf8',
);
assert.match(page, /posSalesPreview/, 'Page previews upload headers');
assert.match(page, /posSalesImport/, 'Page imports into POS DB');
assert.match(page, /Map headers/, 'First-time header mapping UI required');

const controller = fs.readFileSync(
  path.join(root, 'src/Bisync.Api/Controllers/PosSalesController.cs'),
  'utf8',
);
assert.match(controller, /Route\("api\/pos-sales"\)/, 'API route api/pos-sales');
assert.match(controller, /preview/, 'Preview endpoint');
assert.match(controller, /header-map/, 'Header map endpoint');

const patcher = fs.readFileSync(
  path.join(root, 'src/Bisync.Api/Data/SchemaPatcher.cs'),
  'utf8',
);
assert.match(
  patcher,
  /EnsurePosSalesImportTablesAsync[\s\S]*MappingJson[\s\S]*DEFAULT '\{\{\}\}'/,
  'MappingJson default must escape braces for ExecuteSqlRawAsync',
);

const service = fs.readFileSync(
  path.join(root, 'src/Bisync.Api/Services/PosSalesImportService.cs'),
  'utf8',
);
assert.match(service, /SuggestMapping/, 'Auto-suggest header mapping');
assert.match(service, /RequiresMapping/, 'First layout requires mapping');
assert.match(service, /PosClosedChecks/, 'Import mirrors into POS closed checks');
assert.match(service, /ParsePdf|UglyToad\.PdfPig/, 'PDF upload support');

const ownership = fs.readFileSync(path.join(root, 'ownership/structure-ownership.json'), 'utf8');
assert.match(ownership, /dr\.page\.pos-sales/, 'Page ownership registered');
assert.match(ownership, /dr\.api\.pos-sales/, 'API ownership registered');

console.log('pos-sales-upload.test.mjs: ok');
