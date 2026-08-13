/**
 * Category → Group filter hierarchy + hierarchy label merge.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

// Source-level guards for pages that previously leaked unscoped groups.
const productList = fs.readFileSync(path.join(root, 'client/src/components/revenue/ProductListPage.tsx'), 'utf8');
assert.match(productList, /listGroupFilterOptions\(products, categoryFilter\)/, 'Product List scopes groups to category');
assert.match(productList, /coerceGroupFilterForCategory/, 'Product List resets invalid group');

const productMgmt = fs.readFileSync(path.join(root, 'client/src/components/revenue/ProductManagementPage.tsx'), 'utf8');
assert.match(productMgmt, /listGroupFilterOptions\(managementScopedProducts, categoryFilter\)/, 'Product Management scopes groups');

const productsPage = fs.readFileSync(path.join(root, 'client/src/components/revenue/ProductsPage.tsx'), 'utf8');
assert.match(productsPage, /listGroupFormOptions\(category/, 'Product form groups scoped to category');
assert.match(productsPage, /setGroup\(''\)/, 'Product form clears group when category changes');

const sample = fs.readFileSync(path.join(root, 'client/src/components/revenue/RequestForSamplePanel.tsx'), 'utf8');
assert.match(sample, /listGroupFormOptions\(productCategory/, 'Sample request scopes groups');
assert.doesNotMatch(sample, /const GROUP_OPTIONS = getSiGroupFilterOptions\(\)/, 'Sample request no longer uses static unscoped groups');

const hierarchy = fs.readFileSync(path.join(root, 'client/src/data/componentHierarchy.ts'), 'utf8');
assert.match(hierarchy, /mergeDuplicateHierarchyLabels/, 'Hierarchy merges duplicate labels');
assert.match(hierarchy, /Strict hierarchy/, 'Group options never fall back to all groups');

const healer = fs.readFileSync(path.join(root, 'src/Bisync.Api/Services/CatalogLabelHealer.cs'), 'utf8');
assert.match(healer, /DeactivateDuplicateProductNamesAsync/, 'API deactivates duplicate product names in same category/group');
assert.match(healer, /TryMergeHierarchyJson/, 'API merges hierarchy JSON duplicates');

const productsController = fs.readFileSync(path.join(root, 'src/Bisync.Api/Controllers/ProductsController.cs'), 'utf8');
assert.match(productsController, /FindDuplicateProductNameAsync/, 'Product create/update blocks duplicate names in same category/group');

console.log('category-group-filter-hierarchy.test.mjs: ok');
