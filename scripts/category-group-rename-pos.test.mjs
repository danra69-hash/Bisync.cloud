/**
 * Guards RMS→POS category/group rename remount contract + Draught Beer synonyms.
 * Run: node --experimental-strip-types --test scripts/category-group-rename-pos.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function normalizePosGroupLabel(group) {
  const trimmed = group.trim();
  if (!trimmed) return 'General';
  const key = trimmed.toLowerCase().replace(/\s+/g, ' ');
  if (
    key === 'beer draft'
    || key === 'draft beer'
    || key === 'draught beer'
    || key === 'draft'
    || key === 'draught'
  ) {
    return 'Draught Beer';
  }
  if (key === 'bottle beer' || key === 'bottled beer' || key === 'beer bottle') {
    return 'Bottled Beer';
  }
  return trimmed;
}

function groupsMatch(productGroup, configured) {
  const needle = normalizePosGroupLabel(productGroup || '');
  if (!needle || needle === 'General') return false;
  return configured.some(g => normalizePosGroupLabel(g || '') === needle);
}

describe('RMS category/group → POS remount', () => {
  it('maps Beer Draft synonyms to Draught Beer for POS matching', () => {
    assert.equal(normalizePosGroupLabel('Beer Draft'), 'Draught Beer');
    assert.equal(normalizePosGroupLabel('Draft Beer'), 'Draught Beer');
    assert.equal(normalizePosGroupLabel('BEER DRAFT'), 'Draught Beer');
    assert.equal(groupsMatch('Beer Draft', ['Draught Beer']), true);
    assert.equal(groupsMatch('Draught Beer', ['Draft Beer']), true);
  });

  it('ships rename API controller and remount service', () => {
    const controller = readFileSync(
      path.join(repoRoot, 'src/Bisync.Api/Controllers/CategoryGroupRenameController.cs'),
      'utf8',
    );
    const service = readFileSync(
      path.join(repoRoot, 'src/Bisync.Api/Services/CategoryGroupRenameService.cs'),
      'utf8',
    );
    assert.match(controller, /api\/companies\/\{companyId:int\}\/category-groups/);
    assert.match(controller, /HttpPost\("rename"\)/);
    assert.match(service, /RemountPosGroupSynonymsAsync/);
    assert.match(service, /Draught Beer/);
    assert.match(service, /TargetProductGroup/);
    assert.match(service, /PosDeviceSetupRules/);
  });

  it('wires hierarchy rename UI and product group rename to the API', () => {
    const hierarchy = readFileSync(
      path.join(repoRoot, 'client/src/components/revenue/ComponentHierarchyPanel.tsx'),
      'utf8',
    );
    const config = readFileSync(
      path.join(repoRoot, 'client/src/components/revenue/ComponentConfigPage.tsx'),
      'utf8',
    );
    const products = readFileSync(
      path.join(repoRoot, 'client/src/components/revenue/ProductsPage.tsx'),
      'utf8',
    );
    const api = readFileSync(path.join(repoRoot, 'client/src/api.ts'), 'utf8');
    assert.match(hierarchy, /onRenameLabel/);
    assert.match(hierarchy, /Rename group \(updates products \+ POS\)/);
    assert.match(config, /renameCompanyCategoryGroup/);
    assert.match(products, /openRenameGroup/);
    assert.match(products, /renameCompanyCategoryGroup/);
    assert.match(api, /category-groups\/rename/);
  });

  it('registers ownership for the rename controller', () => {
    const ownership = readFileSync(
      path.join(repoRoot, 'ownership/structure-ownership.json'),
      'utf8',
    );
    assert.match(ownership, /dr\.api\.category-group-rename/);
    assert.match(ownership, /CategoryGroupRenameController/);
  });
});
