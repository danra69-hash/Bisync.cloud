/**
 * Credit-note outbound UOM residual — mirrors inbound BBQ math.
 * Document amount (delivery credit) is authority; residual = extended@4dp − document.
 */
import assert from 'node:assert/strict';

function round4AwayFromZero(n) {
  const f = 10000;
  return Math.sign(n) * Math.round(Math.abs(n) * f) / f;
}

function creditNoteOutbound(deliveryPackages, deliveryUnitPrice, stockQty) {
  const documentAmount = round4AwayFromZero(deliveryPackages * deliveryUnitPrice);
  const stockUnitPrice = stockQty > 0
    ? round4AwayFromZero(documentAmount / stockQty)
    : deliveryUnitPrice;
  const extendedAtUnitPrice = round4AwayFromZero(stockQty * stockUnitPrice);
  const roundingResidual = round4AwayFromZero(extendedAtUnitPrice - documentAmount);
  return { documentAmount, stockUnitPrice, extendedAtUnitPrice, roundingResidual };
}

// BBQ: credit 1 tub @ RM 125 → reverse 3790 Gr @ 0.0330
const one = creditNoteOutbound(1, 125, 3790);
assert.equal(one.documentAmount, 125);
assert.equal(one.stockUnitPrice, 0.033);
assert.equal(one.extendedAtUnitPrice, 125.07);
assert.equal(one.roundingResidual, 0.07);

// 6-tub proportion: credit 6 @ 125 → 22740 Gr
const six = creditNoteOutbound(6, 125, 22740);
assert.equal(six.documentAmount, 750);
assert.equal(six.stockUnitPrice, 0.033);
assert.equal(six.extendedAtUnitPrice, 750.42);
assert.equal(six.roundingResidual, 0.42);

console.log('credit-note-outbound-residual: ok', { one, six });
