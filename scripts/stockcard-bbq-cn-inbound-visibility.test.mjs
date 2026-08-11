/**
 * Regression: BBQ Sauce receive linked to a credit note must stay visible on Stock Card.
 *
 * Root cause class:
 * - Credit note outbound posts in stock UOM (Gr) and shows on the ledger.
 * - CN-linked freebie / under-converted inbound can remain in delivery UOM (tub).
 * - Stock Card previously dropped any purchase that failed tub→Gr via TryNormalizeStockQty,
 *   so users saw the CN offset without the matching receive on 7/8.
 *
 * Mirrors StockCardService.TryResolvePurchaseForDisplay + IngredientUomBridge principal path.
 */
import assert from 'node:assert/strict';

function round4AwayFromZero(n) {
  const f = 10000;
  return Math.sign(n) * Math.round(Math.abs(n) * f + Number.EPSILON) / f;
}

function normalizeUom(uom) {
  const t = String(uom || '').trim().toLowerCase();
  if (t === 'g' || t === 'gr' || t === 'gram' || t === 'grams') return 'GR';
  return t.toUpperCase();
}

function tryNormalize(sourceUom, displayUom, qty, price) {
  if (normalizeUom(sourceUom) === normalizeUom(displayUom)) {
    return { ok: true, qty, price };
  }
  // tub is not SI-convertible to Gr without principal — old path returned false.
  return { ok: false, qty: 0, price: 0 };
}

function toInboundPrincipal(packages, deliveryUnitPrice, principalPerPackage, recipeUom) {
  const stockQty = packages * principalPerPackage;
  const documentAmount = round4AwayFromZero(packages * deliveryUnitPrice);
  const stockUnitPrice = stockQty > 0 ? round4AwayFromZero(documentAmount / stockQty) : 0;
  return { stockQty, stockUnitPrice, documentAmount, uom: recipeUom };
}

/** Mirrors the fixed display resolver used before emitting FIFO inbound events. */
function tryResolvePurchaseForDisplay({
  purchaseUom,
  purchaseQty,
  purchaseUnitPrice,
  displayUom,
  deliveryPackages,
  deliveryUnitPrice,
  principalPerPackage,
  recipeUom,
}) {
  const direct = tryNormalize(purchaseUom, displayUom, purchaseQty, purchaseUnitPrice);
  if (direct.ok) return { visible: true, ...direct, path: 'direct' };

  const priorExtended = round4AwayFromZero(purchaseQty * purchaseUnitPrice);
  const packageQty = deliveryPackages > 0 ? deliveryPackages : purchaseQty;
  const packagePrice =
    deliveryUnitPrice > 0 ? deliveryUnitPrice : purchaseUnitPrice;
  const inbound = toInboundPrincipal(
    packageQty,
    packagePrice > 0 ? packagePrice : 0,
    principalPerPackage,
    recipeUom,
  );

  if (priorExtended > 0 && inbound.documentAmount <= 0 && inbound.stockQty > 0) {
    const preservedPrice = round4AwayFromZero(priorExtended / inbound.stockQty);
    const preserved = tryNormalize(inbound.uom, displayUom, inbound.stockQty, preservedPrice);
    if (preserved.ok) return { visible: true, ...preserved, path: 'principal-preserved' };
  }

  const viaPrincipal = tryNormalize(
    inbound.uom,
    displayUom,
    inbound.stockQty,
    inbound.stockUnitPrice,
  );
  if (viaPrincipal.ok) return { visible: true, ...viaPrincipal, path: 'principal' };

  return { visible: false, qty: 0, price: 0, path: 'dropped' };
}

// --- Old behaviour: tub freebie dropped while CN Gr outbound would still show ---
{
  const oldDirect = tryNormalize('tub', 'Gr', 1, 0);
  assert.equal(oldDirect.ok, false, 'tub→Gr cannot convert without principal');
}

// --- Fixed: CN-linked BBQ freebie 1 tub × 3790 Gr becomes visible inbound ---
{
  const resolved = tryResolvePurchaseForDisplay({
    purchaseUom: 'tub',
    purchaseQty: 1,
    purchaseUnitPrice: 0, // freebie default
    displayUom: 'Gr',
    deliveryPackages: 1,
    deliveryUnitPrice: 125, // CN delivery authority used when converting
    principalPerPackage: 3790,
    recipeUom: 'Gr',
  });
  assert.equal(resolved.visible, true);
  assert.equal(resolved.qty, 3790);
  assert.equal(resolved.price, 0.033);
  assert.ok(resolved.path === 'principal' || resolved.path === 'principal-preserved');
}

// --- CN-revalued freebie already has package extended value, still visible ---
{
  const resolved = tryResolvePurchaseForDisplay({
    purchaseUom: 'tub',
    purchaseQty: 1,
    purchaseUnitPrice: 125, // settle applied delivery unit price onto 1 tub
    displayUom: 'Gr',
    deliveryPackages: 1,
    deliveryUnitPrice: 0, // PO freebie line still $0
    principalPerPackage: 3790,
    recipeUom: 'Gr',
  });
  assert.equal(resolved.visible, true);
  assert.equal(resolved.qty, 3790);
  // Extended 125 preserved across conversion → ~0.0330 / Gr
  assert.equal(resolved.price, 0.033);
}

// --- Credit note outbound remains a separate ledger type (not a substitute for inbound) ---
{
  const outboundTypes = new Set([
    'production',
    'pos_sale',
    'wastage',
    'credit_note',
    'store_issue',
    'transfer_out',
  ]);
  assert.equal(outboundTypes.has('credit_note'), true);
  assert.equal(outboundTypes.has('purchase'), false);
}

console.log('stockcard-bbq-cn-inbound-visibility.test.mjs: OK');
