/**
 * Guards My Component UOM filter fallback (Principal + Alternate 1–5).
 * Run: node --experimental-strip-types --test scripts/my-component-uom-filter.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  listFilledAlternateSlots,
  resolveDisplayUomForFilter,
  UOM_FILTER_OPTIONS,
} from '../client/src/data/myComponentUomFilter.ts';

describe('my component UOM filter', () => {
  it('exposes principal + alternate 1–5 options', () => {
    assert.deepEqual(
      UOM_FILTER_OPTIONS.map(o => o.value),
      ['principal', 'alt-1', 'alt-2', 'alt-3', 'alt-4', 'alt-5'],
    );
    assert.equal(UOM_FILTER_OPTIONS[0].label, 'Principal Component UOM');
    assert.equal(UOM_FILTER_OPTIONS[3].label, 'Alternate UOM 3');
  });

  it('lists only filled alternate slots', () => {
    assert.deepEqual(listFilledAlternateSlots(['Kg', '', 'Case', null, 'Pallet']), [
      { index: 1, unit: 'Kg' },
      { index: 3, unit: 'Case' },
      { index: 5, unit: 'Pallet' },
    ]);
  });

  it('returns principal when filter is principal', () => {
    assert.equal(resolveDisplayUomForFilter('Gr', ['Kg', 'Bag'], 'principal'), 'Gr');
  });

  it('returns principal when no alternates exist', () => {
    assert.equal(resolveDisplayUomForFilter('Gr', ['', '', '', '', ''], 'alt-3'), 'Gr');
  });

  it('returns exact alternate when that slot is filled', () => {
    assert.equal(resolveDisplayUomForFilter('Gr', ['Kg', 'Bag', 'Case'], 'alt-2'), 'Bag');
  });

  it('falls back to highest alternate at or below requested slot', () => {
    // Alt 3 requested, only alt 1–2 filled → alt 2
    assert.equal(resolveDisplayUomForFilter('Gr', ['Kg', 'Bag', '', '', ''], 'alt-3'), 'Bag');
    // Alt 5 requested, only alt 1 filled → alt 1
    assert.equal(resolveDisplayUomForFilter('Gr', ['Kg'], 'alt-5'), 'Kg');
  });

  it('does not jump to a higher alternate when requested slot is empty', () => {
    // Alt 2 requested, only alt 4 filled → principal (not alt 4)
    assert.equal(resolveDisplayUomForFilter('Gr', ['', '', '', 'Case', ''], 'alt-2'), 'Gr');
  });
});
