import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calcSplitUseLineAssignedValue,
  calcSplitUseNettUnitCost,
  createSplitUseLine,
  toSplitUseBasisQty,
  validateSplitUseConfig,
} from '../client/src/data/componentSplitUse.ts';

function carrotConfig(qty = '200') {
  return {
    enabled: true,
    componentQty: '1000',
    qtyBasis: 'recipe',
    lines: [
      createSplitUseLine({
        key: 'peels',
        name: 'Carrot Peels',
        qty,
        inventoryUom: 'Gr',
        valueAssignedPct: '20',
        isWaste: false,
      }),
    ],
  };
}

function beefRibConfig() {
  return {
    enabled: true,
    componentQty: '10',
    qtyBasis: 'inventory',
    lines: [
      createSplitUseLine({
        key: 'off-bone',
        name: 'Beef Rib Off Bone',
        qty: '8',
        inventoryUom: 'Kg',
        valueAssignedPct: '100',
        isWaste: false,
      }),
      createSplitUseLine({
        key: 'bone',
        name: 'Beef Bone',
        qty: '2',
        inventoryUom: 'Kg',
        valueAssignedPct: '0',
        noValue: true,
        isWaste: false,
      }),
    ],
  };
}

test('Split Use accepts outputs that leave nett parent stock', () => {
  const error = validateSplitUseConfig(carrotConfig(), 'Kg', 'Gr', '1', '1000');
  assert.equal(error, null);
});

test('Split Use accepts full butcher split where outputs equal component qty', () => {
  const error = validateSplitUseConfig(beefRibConfig(), 'Kg', 'Gr', '1', '1000');
  assert.equal(error, null);
});

test('Split Use rejects outputs that exceed component qty', () => {
  const error = validateSplitUseConfig(carrotConfig('1001'), 'Kg', 'Gr', '1', '1000');
  assert.match(error ?? '', /cannot exceed component quantity/i);
});

test('Split Use calculates percentage-assigned output value', () => {
  const config = carrotConfig();
  const value = calcSplitUseLineAssignedValue(
    config.lines[0],
    config,
    10,
    'Kg',
    'Gr',
    '1',
    '1000',
    1000,
  );
  assert.equal(value, 0.4);
});

test('Tagged 1kg delivery scales a 10kg Split Use recipe into basis qty', () => {
  const config = beefRibConfig();
  const receiptBasisQty = toSplitUseBasisQty(1, 'Kg', config, 'Kg', 'Gr', '1', '1000');
  assert.equal(receiptBasisQty, 1);

  // Full split against 1kg receipt → parent nett unit cost is 0 (value on children).
  const nett = calcSplitUseNettUnitCost(42, config, 'Kg', 'Gr', '1', '1000', receiptBasisQty);
  assert.equal(nett, 0);
});

test('Tagged receipt qty scales Split Use nett cost correctly', () => {
  const config = carrotConfig();
  // 1kg (=1000g) purchase at $10 with 200g peels @ 0% value → nett 800g @ $0.0125/g
  const configZeroValue = {
    ...config,
    lines: [
      createSplitUseLine({
        key: 'peels',
        name: 'Carrot Peels',
        qty: '200',
        inventoryUom: 'Gr',
        valueAssignedPct: '0',
      }),
    ],
  };
  const receiptBasisQty = toSplitUseBasisQty(1000, 'Gr', configZeroValue, 'Kg', 'Gr', '1', '1000');
  assert.equal(receiptBasisQty, 1000);
  const nett = calcSplitUseNettUnitCost(10, configZeroValue, 'Kg', 'Gr', '1', '1000', receiptBasisQty);
  assert.equal(Number(nett.toFixed(4)), 0.0125);

  // Same unit cost when tagging half the recipe qty at half the price.
  const halfReceipt = toSplitUseBasisQty(500, 'Gr', configZeroValue, 'Kg', 'Gr', '1', '1000');
  const halfNett = calcSplitUseNettUnitCost(5, configZeroValue, 'Kg', 'Gr', '1', '1000', halfReceipt);
  assert.equal(Number(halfNett.toFixed(4)), 0.0125);
});
