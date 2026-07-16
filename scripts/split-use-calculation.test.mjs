import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calcSplitUseLineAssignedValue,
  createSplitUseLine,
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

test('Split Use accepts outputs that leave nett parent stock', () => {
  const error = validateSplitUseConfig(carrotConfig(), 'Kg', 'Gr', '1', '1000');
  assert.equal(error, null);
});

test('Split Use rejects outputs that consume all parent stock', () => {
  const error = validateSplitUseConfig(carrotConfig('1000'), 'Kg', 'Gr', '1', '1000');
  assert.match(error ?? '', /positive nett component quantity/i);
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
