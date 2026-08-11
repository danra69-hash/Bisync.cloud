/**
 * Product List: Ginger Ale (PRD-GINGER-002) was imported as Food/Specialties while
 * Soft Drink peers use Beverage/Soft Drinks — Category/Group filters hid it even on
 * the deactivated list. Healer remaps known Soft Drink product ids; list mode is
 * exclusive deactivated-only (parity with Smart Components).
 */
import assert from 'node:assert/strict';

const SOFT_DRINK_FIXES = [
  { productId: 'PRD-GINGER-002', name: 'GINGER ALE', category: 'Beverage', group: 'Soft Drinks' },
  { productId: 'PRD-GINGER-003', name: 'GINGER ALE MIXIER', category: 'Beverage', group: 'Soft Drinks' },
];

function healCategoryGroup(product) {
  const fix = SOFT_DRINK_FIXES.find(
    f => f.productId === product.productId
      || f.name.toLowerCase() === String(product.name || '').toLowerCase(),
  );
  if (!fix) return { ...product, healed: false };
  const categoryOk = (product.category || '').toLowerCase() === fix.category.toLowerCase();
  const groupOk = (product.group || '').toLowerCase() === fix.group.toLowerCase();
  if (categoryOk && groupOk) return { ...product, healed: false };
  return {
    ...product,
    category: fix.category,
    group: fix.group,
    healed: true,
  };
}

function productMatchesLocations(product, locationIds) {
  const productLocs = product.locationExternalIds ?? [];
  if (locationIds.length === 0) return false;
  if (productLocs.length === 0) return true;
  return locationIds.some(id => productLocs.includes(id));
}

/** Exclusive deactivated list (fixed Product List behaviour). */
function visibleProducts(products, { showDeactivated, categoryFilter = 'All', search = '', locationIds }) {
  let scoped = products.filter(p => productMatchesLocations(p, locationIds));
  scoped = scoped.filter(p => (showDeactivated ? !p.active : p.active));
  if (categoryFilter !== 'All') {
    scoped = scoped.filter(p => (p.category || '').toLowerCase() === categoryFilter.toLowerCase());
  }
  const q = search.trim().toLowerCase();
  if (q) {
    scoped = scoped.filter(p =>
      [p.productId, p.name, p.category, p.group].join(' ').toLowerCase().includes(q));
  }
  return scoped;
}

const pavilion = ['weissbrau-pavilion-kuala-lumpur'];
const gingerRaw = {
  productId: 'PRD-GINGER-002',
  name: 'GINGER ALE',
  active: false,
  category: 'Food',
  group: 'Specialties',
  locationExternalIds: pavilion,
};

// --- Healer remaps Food/Specialties → Beverage/Soft Drinks ---
{
  const healed = healCategoryGroup(gingerRaw);
  assert.equal(healed.healed, true);
  assert.equal(healed.category, 'Beverage');
  assert.equal(healed.group, 'Soft Drinks');
}

// --- Before heal: Beverage deactivated list hides Ginger Ale ---
{
  const rows = visibleProducts([gingerRaw], {
    showDeactivated: true,
    categoryFilter: 'Beverage',
    locationIds: pavilion,
  });
  assert.equal(rows.length, 0);
}

// --- After heal: Beverage + Soft Drinks deactivated list shows it ---
{
  const healed = healCategoryGroup(gingerRaw);
  const rows = visibleProducts([healed], {
    showDeactivated: true,
    categoryFilter: 'Beverage',
    search: 'ginger ale',
    locationIds: pavilion,
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, 'GINGER ALE');
}

// --- Exclusive deactivated: active Ginger Lime Fizz excluded ---
{
  const activeMocktail = {
    productId: 'PRD-GINGER-001',
    name: 'Ginger Lime Fizz',
    active: true,
    category: 'Beverage',
    group: 'Mocktails',
    locationExternalIds: pavilion,
  };
  const rows = visibleProducts([healCategoryGroup(gingerRaw), activeMocktail], {
    showDeactivated: true,
    locationIds: pavilion,
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, 'GINGER ALE');
}

// --- Idempotent heal ---
{
  const once = healCategoryGroup(gingerRaw);
  const twice = healCategoryGroup(once);
  assert.equal(twice.healed, false);
  assert.equal(twice.category, 'Beverage');
}

console.log('product-list-ginger-ale-visibility.test.mjs: OK');
