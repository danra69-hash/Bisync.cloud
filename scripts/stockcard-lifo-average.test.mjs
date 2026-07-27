#!/usr/bin/env node
/**
 * Unit checks for StockCardFifoEngine LIFO average pricing rules.
 * Mirrors ResolveLifoAverageUnitPrice: newest-first, qty-weighted average.
 */
import assert from 'node:assert/strict';

const QtyEpsilon = 0.000000001;

function roundUnitPrice(value) {
  return Math.round(value * 10000) / 10000;
}

function resolveLifoAverageUnitPrice(layers, quantityNeeded) {
  if (quantityNeeded <= QtyEpsilon) {
    const newest = [...layers]
      .filter(l => l.Quantity > QtyEpsilon)
      .sort((a, b) => b.ReceivedAt - a.ReceivedAt || b.SourceId - a.SourceId)[0];
    return newest?.UnitPrice ?? 0;
  }

  let remaining = quantityNeeded;
  let totalCost = 0;
  let taken = 0;
  const ordered = [...layers]
    .filter(l => l.Quantity > QtyEpsilon)
    .sort((a, b) => b.ReceivedAt - a.ReceivedAt || b.SourceId - a.SourceId);

  for (const layer of ordered) {
    if (remaining <= QtyEpsilon) break;
    const take = Math.min(layer.Quantity, remaining);
    totalCost += take * layer.UnitPrice;
    taken += take;
    remaining -= take;
  }

  if (taken <= QtyEpsilon) return 0;

  if (remaining > QtyEpsilon) {
    const newest = ordered[0]?.UnitPrice ?? 0;
    totalCost += remaining * newest;
    taken += remaining;
  }

  return roundUnitPrice(totalCost / taken);
}

// User example: OB 200@2.00 was part of purchase 250@2.00 and previous 250@3.00.
// Debit 100 → newest remaining 200@2 then older @3 → (50×2 + 50×3)/100? 
// Wait: if on-hand layers are 200@2.00 only (oldest already partially consumed),
// LIFO takes all 100 from the 200@2.00 layer → price 2.00.
// User's scenario: current stock 200 was part of purchase 250@2 and previous purchase 250@3
// meaning layers left are 50@2 (newest) and 150@3 (older)? Or 200@2 only?
// Their wording: "current stock 200 was part of purchase 250 at 2.00 and previous purchase was 250 at 3.00.
// this means average price applied for this particular debit will be 100 but price will be at (50x2.00 and 50x3.00)/100"
// So remaining layers after FIFO ops: 50@2.00 (newest) + 150@3.00 (older). Debit 100 → 50@2 + 50@3 = 2.50.

const layers = [
  { ReceivedAt: 1, SourceId: 1, Quantity: 150, UnitPrice: 3.0 }, // older
  { ReceivedAt: 2, SourceId: 2, Quantity: 50, UnitPrice: 2.0 }, // newer
];
assert.equal(resolveLifoAverageUnitPrice(layers, 100), 2.5);

// Single layer: all from newest
assert.equal(resolveLifoAverageUnitPrice([{ ReceivedAt: 1, SourceId: 1, Quantity: 200, UnitPrice: 2.0 }], 100), 2.0);

// Exactly one newest layer covers debit
assert.equal(resolveLifoAverageUnitPrice([
  { ReceivedAt: 1, SourceId: 1, Quantity: 100, UnitPrice: 3.0 },
  { ReceivedAt: 2, SourceId: 2, Quantity: 100, UnitPrice: 2.0 },
], 80), 2.0);

console.log('stockcard-lifo-average.test.mjs: OK');
