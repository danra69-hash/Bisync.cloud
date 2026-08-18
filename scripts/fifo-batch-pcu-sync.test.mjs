/**
 * FIFO batch remaining remap when InventoryPurchase is healed
 * from delivery packages → Principal Component Unit (PCU).
 *
 * Mirrors FifoBatchIssueService.ScaleBatchRemainingToPurchaseQty.
 * BBQ: 6 tub × 3790 Gr. Crediting 1 tub needs 3790 Gr; a stale batch
 * left at ~2.21 Gr causes "Short by 3787.7900".
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const QtyEpsilon = 0.00005;

function round4(n) {
  return Math.round(n * 10000 + Number.EPSILON) / 10000;
}

function scaleBatchRemainingToPurchaseQty(previousOriginalQty, previousRemainingQty, newPurchaseQty) {
  const newQty = round4(newPurchaseQty);
  if (newQty <= QtyEpsilon) return 0;
  if (previousOriginalQty <= QtyEpsilon) return newQty;
  if (previousRemainingQty + QtyEpsilon >= previousOriginalQty) return newQty;
  if (previousRemainingQty <= QtyEpsilon) return 0;
  return round4(newQty * (previousRemainingQty / previousOriginalQty));
}

describe('FIFO batch PCU sync remaining scale', () => {
  it('untouched 6-package batch becomes full 22740 Gr', () => {
    assert.equal(scaleBatchRemainingToPurchaseQty(6, 6, 22740), 22740);
  });

  it('partial package residual scales so 1 tub (3790 Gr) can be credited', () => {
    // Stale batch: original 6 "Gr", remaining 2.21 → short by 3787.79 for a 3790 credit.
    const remaining = scaleBatchRemainingToPurchaseQty(6, 2.21, 22740);
    assert.equal(remaining, round4(22740 * (2.21 / 6)));
    assert.ok(remaining >= 3790, `expected remaining ${remaining} >= 3790`);
  });

  it('fully depleted stays depleted', () => {
    assert.equal(scaleBatchRemainingToPurchaseQty(6, 0, 22740), 0);
  });

  it('credit math: 1 of 6 packages = 3790 Gr of 22740', () => {
    const delivered = 6;
    const postedQty = 22740;
    const creditPackages = 1;
    const stockQty = creditPackages * (postedQty / delivered);
    assert.equal(stockQty, 3790);
    assert.equal(round4(3790 - 2.21), 3787.79);
  });
});
