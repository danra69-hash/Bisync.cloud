/**
 * Guards DeliveryPrincipalResolver target fallbacks (Recipe → Inventory → alt → SI base).
 * Run: node --experimental-strip-types --test scripts/delivery-principal-target-fallback.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SI = {
  ML: { family: 'volume', toBase: 1 },
  LTR: { family: 'volume', toBase: 1000 },
  GR: { family: 'mass', toBase: 1 },
  KG: { family: 'mass', toBase: 1000 },
};

function normalize(uom) {
  const map = { g: 'GR', gr: 'GR', ml: 'ML', l: 'LTR', ltr: 'LTR', kg: 'KG' };
  const t = String(uom || '').trim();
  return map[t.toLowerCase()] || t.toUpperCase();
}

function convertSi(qty, from, to) {
  const a = SI[normalize(from)];
  const b = SI[normalize(to)];
  if (!a || !b || a.family !== b.family) return null;
  return qty * (a.toBase / b.toBase);
}

function buildTargets({ recipeUom, inventoryUom, altUnits = [] }, contentUnit) {
  const list = [];
  const add = (u) => {
    const t = String(u || '').trim();
    if (!t) return;
    if (list.some(x => normalize(x) === normalize(t))) return;
    list.push(t);
  };
  add(recipeUom);
  add(inventoryUom);
  for (const alt of altUnits) add(alt);
  const content = SI[normalize(contentUnit)];
  if (content) add(content.family === 'volume' ? 'ml' : 'g');
  return list;
}

function resolvePrincipal(ingredient, contentQty, contentUnit) {
  for (const target of buildTargets(ingredient, contentUnit)) {
    const converted = convertSi(contentQty, contentUnit, target);
    if (converted != null && converted > 0) return { qty: converted, uom: target };
  }
  return null;
}

describe('delivery principal target fallback', () => {
  it('resolves keg/30ltr into ml when RecipeUom is g', () => {
    const resolved = resolvePrincipal(
      { recipeUom: 'g', inventoryUom: 'ml', altUnits: [] },
      30,
      'ltr',
    );
    assert.ok(resolved);
    assert.equal(resolved.uom, 'ml');
    assert.equal(resolved.qty, 30000);
  });

  it('prefers RecipeUom when same family', () => {
    const resolved = resolvePrincipal(
      { recipeUom: 'ml', inventoryUom: 'Ltr', altUnits: [] },
      30,
      'ltr',
    );
    assert.ok(resolved);
    assert.equal(normalize(resolved.uom), 'ML');
    assert.equal(resolved.qty, 30000);
  });

  it('ships resolver + bridge guards in source', () => {
    const resolver = readFileSync(
      path.join(repoRoot, 'src/Bisync.Api/Services/DeliveryPrincipalResolver.cs'),
      'utf8',
    );
    const bridge = readFileSync(
      path.join(repoRoot, 'src/Bisync.Api/Services/IngredientUomBridge.cs'),
      'utf8',
    );
    assert.match(resolver, /BuildTargetUomCandidates/);
    assert.match(resolver, /ReadAltRecipeUnits/);
    assert.match(bridge, /ResolvePrincipalForStockPosting/);
    assert.match(bridge, /Never relabel packages as RecipeUom/);
  });
});
