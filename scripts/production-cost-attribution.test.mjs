import assert from 'node:assert/strict';
import test from 'node:test';
import { allocateProductionCost } from '../client/src/data/productionCostAttribution.ts';

test('locked user example: base 10, total 20, bi 10 @ 50% → primary 15 / bi 5', () => {
  const result = allocateProductionCost({
    baseUnitCost: 10,
    totalQty: 20,
    primaryQty: 10,
    biLines: [{ key: 'bi', quantity: 10, attributionPct: 50 }],
  });
  assert.equal(result.batchTotalCost, 200);
  assert.equal(result.biLines[0].unitCost, 5);
  assert.equal(result.biLines[0].share, 50);
  assert.equal(result.primaryShare, 150);
  assert.equal(result.primaryUnitCost, 15);
});

test('all 100% attributions split batch total equally', () => {
  const result = allocateProductionCost({
    baseUnitCost: 10,
    totalQty: 20,
    primaryQty: 10,
    biLines: [{ key: 'bi', quantity: 10, attributionPct: 100 }],
  });
  assert.equal(result.batchTotalCost, 200);
  assert.equal(result.primaryShare, 100);
  assert.equal(result.primaryUnitCost, 10);
  assert.equal(result.biLines[0].share, 100);
  assert.equal(result.biLines[0].unitCost, 10);
});

test('no bi lines keeps full batch cost on primary', () => {
  const result = allocateProductionCost({
    baseUnitCost: 10,
    totalQty: 20,
    primaryQty: 20,
    biLines: [],
  });
  assert.equal(result.primaryUnitCost, 10);
  assert.equal(result.primaryShare, 200);
  assert.equal(result.biLines.length, 0);
});
