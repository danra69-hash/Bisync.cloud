#!/usr/bin/env node
/**
 * Stock inbound Step 1 — BBQ Sauce / Smokey Mesquite regression.
 * stockQty = packages × principal
 * stockUnitPrice = round4(PO line amount ÷ stockQty)
 */
import assert from 'node:assert/strict';

function round4AwayFromZero(n) {
  // Match C# MidpointRounding.AwayFromZero at 4dp for positive values.
  const f = 10000;
  return Math.sign(n) * Math.round(Math.abs(n) * f + Number.EPSILON) / f;
}

function convertDeliveryPackagesToPrincipal(deliveryPackages, deliveryUnitPrice, principalPerPackage) {
  const stockQty = deliveryPackages * principalPerPackage;
  const poLineAmount = deliveryPackages * deliveryUnitPrice;
  const stockUnitPrice = round4AwayFromZero(poLineAmount / stockQty);
  return { stockQty, stockUnitPrice, poLineAmount };
}

// User example: 6 tub × 3790 Gr, PO total RM 750 → 22,740 Gr @ 0.0330
const packages = 6;
const principal = 3790;
const deliveryUnitPrice = 750 / 6; // RM 125 per tub
const { stockQty, stockUnitPrice, poLineAmount } = convertDeliveryPackagesToPrincipal(
  packages,
  deliveryUnitPrice,
  principal,
);

assert.equal(poLineAmount, 750);
assert.equal(stockQty, 22740);
assert.equal(stockUnitPrice, 0.033);

// Explicit total÷qty path (same result)
const raw = 750 / 22740;
assert.ok(Math.abs(raw - 0.0329815303430079) < 1e-12);
assert.equal(round4AwayFromZero(raw), 0.033);

// Rounding residual is report-only: 22740 × 0.0330 ≠ 750 exactly
const stockExtended = stockQty * stockUnitPrice;
assert.ok(Math.abs(stockExtended - 750.42) < 1e-9);
assert.notEqual(Number(stockExtended.toFixed(4)), poLineAmount);

console.log('stock-inbound-step1-bbq: ok', { stockQty, stockUnitPrice, stockExtended, poLineAmount });
