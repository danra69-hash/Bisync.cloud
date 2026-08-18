#!/usr/bin/env node
/**
 * Stock inbound Step 1 — BBQ Sauce / Smokey Mesquite regression.
 * stockQty = packages × principal
 * stockUnitPrice = round4(PO line amount ÷ stockQty)
 * roundingResidual = extended@4dp − document amount (shown on Stock Card; document is authority)
 */
import assert from 'node:assert/strict';

function round4AwayFromZero(n) {
  // Match C# MidpointRounding.AwayFromZero at 4dp for positive values.
  const f = 10000;
  return Math.sign(n) * Math.round(Math.abs(n) * f + Number.EPSILON) / f;
}

function convertDeliveryPackagesToPrincipal(deliveryPackages, deliveryUnitPrice, principalPerPackage) {
  const stockQty = deliveryPackages * principalPerPackage;
  const documentAmount = round4AwayFromZero(deliveryPackages * deliveryUnitPrice);
  const stockUnitPrice = round4AwayFromZero(documentAmount / stockQty);
  const extendedAtUnitPrice = round4AwayFromZero(stockQty * stockUnitPrice);
  const roundingResidual = round4AwayFromZero(extendedAtUnitPrice - documentAmount);
  return { stockQty, stockUnitPrice, documentAmount, extendedAtUnitPrice, roundingResidual };
}

// User example: 6 tub × 3790 Gr, PO total RM 750 → 22,740 Gr @ 0.0330
const packages = 6;
const principal = 3790;
const deliveryUnitPrice = 750 / 6; // RM 125 per tub
const {
  stockQty,
  stockUnitPrice,
  documentAmount,
  extendedAtUnitPrice,
  roundingResidual,
} = convertDeliveryPackagesToPrincipal(packages, deliveryUnitPrice, principal);

assert.equal(documentAmount, 750);
assert.equal(stockQty, 22740);
assert.equal(stockUnitPrice, 0.033);
assert.equal(extendedAtUnitPrice, 750.42);
assert.equal(roundingResidual, 0.42);

// Single tub: 125.00 → 3790 @ 0.0330 → extended 125.07 → residual +0.07
const one = convertDeliveryPackagesToPrincipal(1, 125, 3790);
assert.equal(one.documentAmount, 125);
assert.equal(one.stockQty, 3790);
assert.equal(one.stockUnitPrice, 0.033);
assert.equal(one.extendedAtUnitPrice, 125.07);
assert.equal(one.roundingResidual, 0.07);

console.log('stock-inbound-step1-bbq: ok', {
  stockQty,
  stockUnitPrice,
  documentAmount,
  extendedAtUnitPrice,
  roundingResidual,
  oneTub: one,
});
