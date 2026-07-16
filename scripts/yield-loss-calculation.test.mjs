import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calcSplitUseNettUnitCost,
  createSplitUseLine,
} from '../client/src/data/componentSplitUse.ts';

/** Mirrors ComponentYieldLossRules.ToGrossQuantity */
function toGrossQuantity(nettQty, yieldLossPct) {
  if (nettQty <= 0) return 0;
  if (yieldLossPct <= 0) return nettQty;
  const keep = 1 - yieldLossPct / 100;
  if (keep <= 0) throw new Error('Yield Loss % must be less than 100.');
  return nettQty / keep;
}

/** Mirrors calcNettUomPrice on the client */
function nettUnitCost(purchasePrice, purchaseQty, yieldLossPct) {
  const nettQty = purchaseQty * (1 - yieldLossPct / 100);
  return purchasePrice / nettQty;
}

test('Carrot Fresh 20% yield loss: nett cost is 0.0125/g', () => {
  const costPerGram = nettUnitCost(10, 1000, 20);
  assert.equal(Number(costPerGram.toFixed(4)), 0.0125);
});

test('Product recipe 100g depletes 125g gross stock at 20% yield loss', () => {
  assert.equal(toGrossQuantity(100, 20), 125);
});

test('Product COGS equals stock COGS after yield inflation', () => {
  const recipeNettGrams = 100;
  const yieldLoss = 20;
  const purchasePricePerKg = 10;
  const purchaseGrams = 1000;

  const nettCostPerGram = nettUnitCost(purchasePricePerKg, purchaseGrams, yieldLoss);
  const productCogs = recipeNettGrams * nettCostPerGram;

  const grossGrams = toGrossQuantity(recipeNettGrams, yieldLoss);
  const stockUnitCost = purchasePricePerKg / purchaseGrams;
  const stockCogs = grossGrams * stockUnitCost;

  assert.equal(Number(productCogs.toFixed(4)), 1.25);
  assert.equal(Number(stockCogs.toFixed(4)), 1.25);
  assert.equal(grossGrams, 125);
});

test('Split Use parent nett recipe cost is 0.0125/g when 20% peels take 0% value', () => {
  const config = {
    enabled: true,
    componentQty: '1000',
    qtyBasis: 'recipe',
    lines: [
      createSplitUseLine({
        key: 'peels',
        name: 'Carrot Peels',
        qty: '200',
        inventoryUom: 'Gr',
        valueAssignedPct: '0',
        isWaste: false,
      }),
    ],
  };
  const nettCost = calcSplitUseNettUnitCost(10, config, 'Kg', 'Gr', '1', '1000');
  assert.equal(Number(nettCost.toFixed(4)), 0.0125);
});
