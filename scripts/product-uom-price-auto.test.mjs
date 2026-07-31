/**
 * Guards Edit Product UOM → UOM price automation helpers.
 * Run: node --test scripts/product-uom-price-auto.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

function fromApiUom(unit) {
  const trimmed = (unit ?? '').trim();
  if (!trimmed) return '';
  const map = {
    mg: 'Mg', g: 'Gr', gr: 'Gr', gram: 'Gr', grams: 'Gr',
    kg: 'Kg', t: 'Tonne', tonne: 'Tonne',
    ml: 'Ml', cl: 'Cl', L: 'Ltr', l: 'Ltr', lt: 'Ltr', ltr: 'Ltr',
    pcs: 'Each', each: 'Each', pack: 'Pack',
    btl: 'Bottle', bottle: 'Bottle', can: 'Can', tin: 'Tin', slice: 'Slice',
    box: 'Box', set: 'Set',
  };
  const lower = trimmed.toLowerCase();
  if (map[trimmed]) return map[trimmed];
  if (map[lower]) return map[lower];
  return trimmed;
}

function uomKey(value) {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

function sameUom(left, right) {
  const a = fromApiUom(left) || left;
  const b = fromApiUom(right) || right;
  return Boolean(a) && uomKey(a) === uomKey(b);
}

function formatBomUnitPrice(value) {
  if (!(value > 0)) return '';
  const rounded = Math.round(value * 10_000) / 10_000;
  return String(rounded);
}

function convertViaInventory(recipePrice, selectedUom, recipeUom, inventoryUom, fromQty, toQty) {
  const selected = fromApiUom(selectedUom);
  const recipe = fromApiUom(recipeUom);
  const inventory = fromApiUom(inventoryUom);
  if (sameUom(selected, recipe)) return recipePrice;
  if (sameUom(selected, inventory) && fromQty > 0 && toQty > 0) {
    return recipePrice * (toQty / fromQty);
  }
  return null;
}

function resolveAutomatedComponentUomPrice({
  selected,
  estimatedPrice = '',
  convertedFromCurrent = '',
}) {
  if (estimatedPrice.trim()) return estimatedPrice.trim();
  if (convertedFromCurrent.trim()) return convertedFromCurrent.trim();
  if (selected.price > 0) return formatBomUnitPrice(selected.price);
  return '';
}

describe('product UOM price automation', () => {
  it('converts recipe last price to inventory UOM (1 kg = 1000 g)', () => {
    const price = convertViaInventory(0.021, 'Kg', 'g', 'kg', 1, 1000);
    assert.equal(price, 21);
  });

  it('converts recipe last price to Bottle via inventory ratio', () => {
    const price = convertViaInventory(0.127, 'Bottle', 'ml', 'btl', 1, 750);
    assert.equal(price, 0.127 * 750);
  });

  it('prefers estimated price, then converted current, then option catalog', () => {
    assert.equal(
      resolveAutomatedComponentUomPrice({
        selected: { label: 'Kg', price: 21 },
        estimatedPrice: '20.5',
        convertedFromCurrent: '21',
      }),
      '20.5',
    );
    assert.equal(
      resolveAutomatedComponentUomPrice({
        selected: { label: 'Kg', price: 21 },
        estimatedPrice: '',
        convertedFromCurrent: '21',
      }),
      '21',
    );
    assert.equal(
      resolveAutomatedComponentUomPrice({
        selected: { label: 'Kg', price: 21 },
        estimatedPrice: '',
        convertedFromCurrent: '',
      }),
      '21',
    );
  });

  it('normalizes g/Gr aliases as the same UOM', () => {
    assert.equal(sameUom('g', 'Gr'), true);
    assert.equal(sameUom('btl', 'Bottle'), true);
    assert.equal(sameUom('Ml', 'Kg'), false);
  });
});
