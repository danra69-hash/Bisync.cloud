/**
 * Remaining gap after PRs 475–477:
 * TryResolvePurchaseForDisplay could still return false (tub→Gr) when Unit is bare
 * "tub" and only VendorProduct.DeliveryJson carries 3790 Gr — display path previously
 * ignored DeliveryJson (unlike PostReceived / healer) and then `continue`d, hiding BBQ.
 *
 * Fix: resolve principal from VendorProduct first; never drop a purchase when conversion fails.
 */
import assert from 'node:assert/strict';

function round4(n) {
  const f = 10000;
  return Math.sign(n) * Math.round(Math.abs(n) * f + Number.EPSILON) / f;
}

function toInboundPrincipal(packages, deliveryUnitPrice, principalPerPackage, recipeUom) {
  const stockQty = packages * principalPerPackage;
  const documentAmount = round4(packages * deliveryUnitPrice);
  const stockUnitPrice = stockQty > 0 ? round4(documentAmount / stockQty) : 0;
  return { stockQty, stockUnitPrice, documentAmount, uom: recipeUom };
}

function tryNormalize(sourceUom, displayUom, qty, price) {
  const a = String(sourceUom || '').toLowerCase();
  const b = String(displayUom || '').toLowerCase();
  const same =
    a === b
    || (['g', 'gr', 'gram', 'grams'].includes(a) && ['g', 'gr', 'gram', 'grams'].includes(b));
  return same ? { ok: true, qty, price } : { ok: false };
}

/** Mirrors fixed TryResolvePurchaseForDisplay with VP DeliveryJson before Unit path. */
function tryResolvePurchaseForDisplay({
  purchaseUom,
  purchaseQty,
  purchaseUnitPrice,
  displayUom,
  unitLabel,
  vendorProductPrincipal,
  recipeUom,
}) {
  const direct = tryNormalize(purchaseUom, displayUom, purchaseQty, purchaseUnitPrice);
  if (direct.ok) return { visible: true, ...direct, path: 'direct' };

  // NEW: VendorProduct principal before bare Unit "tub" path.
  const pathPrincipal = vendorProductPrincipal > 1 ? vendorProductPrincipal : null;
  if (!pathPrincipal) {
    // bare "tub" cannot convert without principal
    return { visible: false, path: 'dropped-legacy' };
  }

  const inbound = toInboundPrincipal(
    purchaseQty,
    purchaseUnitPrice > 0 ? purchaseUnitPrice : 125,
    pathPrincipal,
    recipeUom,
  );
  const via = tryNormalize(inbound.uom, displayUom, inbound.stockQty, inbound.stockUnitPrice);
  if (via.ok) return { visible: true, ...via, path: 'vendor-product-principal' };
  return { visible: false, path: 'dropped' };
}

function emitInboundOrNeverDrop(resolved, purchase) {
  if (resolved.visible) return { emitted: true, qty: resolved.qty, uom: 'Gr', path: resolved.path };
  // NEW never-drop: keep package row visible
  if (purchase.qty > 0) {
    return { emitted: true, qty: purchase.qty, uom: purchase.uom, path: 'never-drop' };
  }
  return { emitted: false };
}

// --- Legacy: VP has 3790 Gr but Unit is bare tub → display ignored VP → drop ---
{
  const legacyNoVp = tryResolvePurchaseForDisplay({
    purchaseUom: 'tub',
    purchaseQty: 6,
    purchaseUnitPrice: 125,
    displayUom: 'Gr',
    unitLabel: 'tub',
    vendorProductPrincipal: 0, // display path never saw DeliveryJson
    recipeUom: 'Gr',
  });
  assert.equal(legacyNoVp.visible, false);
  assert.equal(emitInboundOrNeverDrop(legacyNoVp, { qty: 6, uom: 'tub' }).path, 'never-drop');
}

// --- Fixed: VP principal 3790 → 22740 Gr visible ---
{
  const fixed = tryResolvePurchaseForDisplay({
    purchaseUom: 'tub',
    purchaseQty: 6,
    purchaseUnitPrice: 125,
    displayUom: 'Gr',
    unitLabel: 'tub',
    vendorProductPrincipal: 3790,
    recipeUom: 'Gr',
  });
  assert.equal(fixed.visible, true);
  assert.equal(fixed.qty, 22740);
  assert.equal(fixed.price, 0.033);
  assert.equal(fixed.path, 'vendor-product-principal');
}

// --- Never-drop still emits when principal truly missing ---
{
  const none = tryResolvePurchaseForDisplay({
    purchaseUom: 'tub',
    purchaseQty: 1,
    purchaseUnitPrice: 0,
    displayUom: 'Gr',
    unitLabel: 'tub',
    vendorProductPrincipal: 0,
    recipeUom: 'Gr',
  });
  const emitted = emitInboundOrNeverDrop(none, { qty: 1, uom: 'tub' });
  assert.equal(emitted.emitted, true);
  assert.equal(emitted.uom, 'tub');
}

console.log('stockcard-bbq-never-drop-inbound.test.mjs: OK');
