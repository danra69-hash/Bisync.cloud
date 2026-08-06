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

/** 1 alternate = qty × principal → price in alternate = principalPrice * qty / fromQty */
function convertViaAlternate(principalPrice, selectedUom, principalUom, altUnits) {
  const selected = fromApiUom(selectedUom);
  const principal = fromApiUom(principalUom);
  if (sameUom(selected, principal)) return principalPrice;
  const alt = (altUnits || []).find(a => sameUom(a.unit, selected));
  if (!alt) return null;
  const fromQty = parseFloat(alt.fromQty || '1') || 1;
  const qty = parseFloat(alt.qty || '1') || 1;
  if (fromQty <= 0 || qty <= 0) return null;
  return principalPrice * (qty / fromQty);
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
  it('converts principal last price to alternate UOM (1 kg = 1000 g)', () => {
    const price = convertViaAlternate(0.021, 'Kg', 'g', [{ fromQty: '1', qty: '1000', unit: 'Kg' }]);
    assert.equal(price, 21);
  });

  it('converts principal last price to Bottle via alternate ratio', () => {
    const price = convertViaAlternate(0.127, 'Bottle', 'ml', [{ fromQty: '1', qty: '750', unit: 'Bottle' }]);
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
});
