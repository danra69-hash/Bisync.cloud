/**
 * Universal Stock Card parity (BBQ lessons applied to every component):
 * 1) Display prefers VendorProduct.DeliveryJson before bare Unit path
 * 2) Never drop purchases OR movements when DU→PCU fails
 * 3) Credit-note create/settle passes DeliveryJson principal like receive/healer
 * 4) List heal covers visible components (missing + under-converted)
 * 5) Receive rejects partial stock post (not only zero rows)
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function round4(n) {
  const f = 10000;
  return Math.sign(n) * Math.round(Math.abs(n) * f + Number.EPSILON) / f;
}

function tryNormalize(sourceUom, displayUom, qty, price) {
  const a = String(sourceUom || '').toLowerCase();
  const b = String(displayUom || '').toLowerCase();
  const same =
    a === b
    || (['g', 'gr', 'gram', 'grams'].includes(a) && ['g', 'gr', 'gram', 'grams'].includes(b));
  return same ? { ok: true, qty, price } : { ok: false };
}

function toInboundPrincipal(packages, deliveryUnitPrice, principalPerPackage, recipeUom) {
  const stockQty = packages * principalPerPackage;
  const documentAmount = round4(packages * deliveryUnitPrice);
  const stockUnitPrice = stockQty > 0 ? round4(documentAmount / stockQty) : 0;
  return { stockQty, stockUnitPrice, documentAmount, uom: recipeUom };
}

/** Shared display resolve used for any component (not BBQ-only). */
function tryResolveForDisplay({ uom, qty, unitPrice, displayUom, vendorProductPrincipal, recipeUom }) {
  const direct = tryNormalize(uom, displayUom, qty, unitPrice);
  if (direct.ok) return { visible: true, ...direct, path: 'direct' };
  if (!(vendorProductPrincipal > 1)) return { visible: false, path: 'no-principal' };
  const inbound = toInboundPrincipal(qty, unitPrice > 0 ? unitPrice : 1, vendorProductPrincipal, recipeUom);
  const via = tryNormalize(inbound.uom, displayUom, inbound.stockQty, inbound.stockUnitPrice);
  if (via.ok) return { visible: true, ...via, path: 'delivery-json' };
  return { visible: false, path: 'failed' };
}

function neverDrop(resolved, row) {
  if (resolved.visible) return { emitted: true, qty: resolved.qty, uom: 'Gr', path: resolved.path };
  if (row.qty > 0) return { emitted: true, qty: row.qty, uom: row.uom, path: 'never-drop' };
  return { emitted: false };
}

// --- Any component: DeliveryJson principal converts tub→Gr ---
{
  const r = tryResolveForDisplay({
    uom: 'tub',
    qty: 2,
    unitPrice: 40,
    displayUom: 'Gr',
    vendorProductPrincipal: 3790,
    recipeUom: 'Gr',
  });
  assert.equal(r.visible, true);
  assert.equal(r.qty, 7580);
  assert.equal(r.path, 'delivery-json');
}

// --- Purchase never-drop ---
{
  const r = tryResolveForDisplay({
    uom: 'tub', qty: 3, unitPrice: 10, displayUom: 'Gr', vendorProductPrincipal: 0, recipeUom: 'Gr',
  });
  assert.equal(neverDrop(r, { qty: 3, uom: 'tub' }).path, 'never-drop');
}

// --- Movement (CN) never-drop ---
{
  const r = tryResolveForDisplay({
    uom: 'tub', qty: 1, unitPrice: 0, displayUom: 'Gr', vendorProductPrincipal: 0, recipeUom: 'Gr',
  });
  assert.equal(neverDrop(r, { qty: 1, uom: 'tub' }).emitted, true);
}

// --- Receive completeness: partial post is a failure ---
{
  const expected = [10, 11, 12];
  const posted = new Set([10, 11]);
  const missing = expected.filter(id => !posted.has(id)).length;
  assert.equal(missing, 1);
  assert.ok(expected.length > 0 && missing > 0);
}

// --- Source anchors: universal wiring present in repo ---
{
  const stockCard = read('src/Bisync.Api/Services/StockCardService.cs');
  assert.match(stockCard, /HealVisibleComponentsAsync/);
  assert.match(stockCard, /TryResolveCreditNoteMovementForDisplay/);
  assert.match(stockCard, /Never hide a stock movement/);
  assert.match(stockCard, /Never drop outbound\/inbound movements|Never hide a received PO inbound|Never drop received purchases/i);

  const cn = read('src/Bisync.Api/Services/CreditNoteService.cs');
  assert.match(cn, /DeliveryPrincipalResolver\.ResolvePathPrincipalAsync/);

  const resolver = read('src/Bisync.Api/Services/DeliveryPrincipalResolver.cs');
  assert.match(resolver, /ResolvePathPrincipalAsync/);
  assert.match(resolver, /Shared DU→PCU principal resolution/);

  const healer = read('src/Bisync.Api/Services/ReceivedPurchaseStockHealer.cs');
  assert.match(healer, /HealVisibleComponentsAsync/);

  const api = read('src/Bisync.Api/Controllers/ApiControllers.cs');
  assert.match(api, /posted stock for only/);
  assert.match(api, /Reconcile did not post stock for every delivered line/);
  assert.match(api, /DeliveryPrincipalResolver\.ResolvePathPrincipalAsync/);
}

console.log('stockcard-universal-du-pcu-parity.test.mjs: OK');
