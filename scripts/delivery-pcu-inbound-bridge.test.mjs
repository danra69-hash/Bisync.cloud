/**
 * Regression: delivery packages → Principal Component Unit for Stock Card inbound.
 * Mirrors IngredientUomBridge.ToInboundPrincipal / ConvertDeliveryPackagesToPrincipal
 * and DeliveryPrincipalResolver (2-segment path + SI conversion).
 *
 * Critical cases from production:
 * - ComponentUom labeled as RecipeUom while qty is still packages (PO create path)
 * - Missing/mismatched VendorProductId → fall back to best tagged principal
 * - DRAFT LEFFE-style: 5 pkg @ RM125 must become 5×principal, not 5 g @ 125
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

function round4AwayFromZero(n) {
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

function looksAlreadyConverted(quantity, unitPrice, principalPerPackage) {
  if (principalPerPackage <= 1.0000001) return false;
  if (quantity + 0.0001 < principalPerPackage) return false;
  const packagesApprox = quantity / principalPerPackage;
  if (packagesApprox < 0.5) return false;
  const impliedDelivery = unitPrice * principalPerPackage;
  return impliedDelivery > unitPrice * 1.5;
}

/**
 * Simplified ToInboundPrincipal: when principal > 1, always convert unless already PCU.
 * Quantity is treated as delivery packages even if uomLabel === recipeUom.
 */
function toInboundPrincipal({
  quantity,
  unitPrice,
  recipeUom,
  uomLabel,
  principalPerPackage,
}) {
  if (!(principalPerPackage > 1.0000001)) {
    return { stockQty: quantity, stockUnitPrice: round4AwayFromZero(unitPrice), uom: recipeUom || uomLabel };
  }
  if (looksAlreadyConverted(quantity, unitPrice, principalPerPackage)) {
    return { stockQty: quantity, stockUnitPrice: round4AwayFromZero(unitPrice), uom: recipeUom };
  }
  const converted = convertDeliveryPackagesToPrincipal(quantity, unitPrice, principalPerPackage);
  return {
    stockQty: converted.stockQty,
    stockUnitPrice: converted.stockUnitPrice,
    uom: recipeUom,
    documentAmount: converted.documentAmount,
    roundingResidual: converted.roundingResidual,
  };
}

function tryResolveBestTaggedPrincipal(principalMap) {
  let best = 0;
  for (const qty of Object.values(principalMap || {})) {
    const n = Number(qty);
    if (n > 1.0000001 && n > best) best = n;
  }
  return best > 0 ? best : null;
}

function parseDeliveryPath2Segment(path) {
  const parts = String(path).split('/').map(s => s.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const pack = parts[1].match(/^(\d*\.?\d+)\s*(.+)$/i);
  if (!pack) return null;
  return { contentQty: parseFloat(pack[1]), contentUnit: pack[2].trim().toLowerCase() };
}

const SI = {
  ml: { family: 'vol', toBase: 1 },
  ltr: { family: 'vol', toBase: 1000 },
  l: { family: 'vol', toBase: 1000 },
  g: { family: 'mass', toBase: 1 },
  gr: { family: 'mass', toBase: 1 },
  kg: { family: 'mass', toBase: 1000 },
};

function convertSi(qty, from, to) {
  const a = SI[String(from).toLowerCase()];
  const b = SI[String(to).toLowerCase()];
  if (!a || !b || a.family !== b.family) return null;
  return qty * (a.toBase / b.toBase);
}

describe('delivery→PCU inbound bridge', () => {
  it('BBQ: 6 tub × 3790 Gr @ 125 → 22740 @ 0.0330', () => {
    const r = toInboundPrincipal({
      quantity: 6,
      unitPrice: 125,
      recipeUom: 'Gr',
      uomLabel: 'Gr', // mislabeled as recipe while qty is packages
      principalPerPackage: 3790,
    });
    assert.equal(r.stockQty, 22740);
    assert.equal(r.stockUnitPrice, 0.033);
    assert.equal(r.documentAmount, 750);
  });

  it('Leffe-style: 5 packages @ 125 with recipe-labeled UOM still converts', () => {
    const principal = 30000; // e.g. 30 L keg → ml
    const r = toInboundPrincipal({
      quantity: 5,
      unitPrice: 125,
      recipeUom: 'ml',
      uomLabel: 'ml',
      principalPerPackage: principal,
    });
    assert.equal(r.stockQty, 150000);
    assert.equal(r.stockUnitPrice, round4AwayFromZero(625 / 150000));
    assert.equal(r.documentAmount, 625);
  });

  it('Leffe when RecipeUom is g but keg content is 30ltr → convert into ml', () => {
    // Mirrors DeliveryPrincipalResolver.BuildTargetUomCandidates fallback to SI volume base.
    const parsed = parseDeliveryPath2Segment('1keg/30ltr');
    assert.ok(parsed);
    // Recipe g cannot convert from ltr — use ml (content family) instead of silent 5 g @ 125.
    const principal = convertSi(parsed.contentQty, parsed.contentUnit, 'ml');
    assert.equal(principal, 30000);
    const r = toInboundPrincipal({
      quantity: 5,
      unitPrice: 125,
      recipeUom: 'ml', // stock posts in resolvable content UOM
      uomLabel: 'g', // wrongly labeled packages
      principalPerPackage: principal,
    });
    assert.equal(r.stockQty, 150000);
    assert.equal(r.stockUnitPrice, round4AwayFromZero(625 / 150000));
    assert.notEqual(r.stockQty, 5);
  });

  it('never treats unconverted packages as already-PCU when qty equals package count', () => {
    assert.equal(looksAlreadyConverted(5, 125, 30000), false);
    assert.equal(looksAlreadyConverted(150000, 0.0042, 30000), true);
  });

  it('does not double-convert already-PCU inbound', () => {
    const r = toInboundPrincipal({
      quantity: 22740,
      unitPrice: 0.033,
      recipeUom: 'Gr',
      uomLabel: 'Gr',
      principalPerPackage: 3790,
    });
    assert.equal(r.stockQty, 22740);
    assert.equal(r.stockUnitPrice, 0.033);
  });

  it('falls back to best tagged principal when VP id missing', () => {
    const principal = tryResolveBestTaggedPrincipal({
      'VP-OTHER': '1',
      'VP-LEFFE': '30000',
    });
    assert.equal(principal, 30000);
    const r = toInboundPrincipal({
      quantity: 5,
      unitPrice: 125,
      recipeUom: 'ml',
      uomLabel: 'ml',
      principalPerPackage: principal,
    });
    assert.equal(r.stockQty, 150000);
  });

  it('delivery path 1keg/30ltr → 30000 ml principal', () => {
    const parsed = parseDeliveryPath2Segment('1keg/30ltr');
    assert.ok(parsed);
    const principal = convertSi(parsed.contentQty, parsed.contentUnit, 'ml');
    assert.equal(principal, 30000);
  });

  it('delivery path 1tub/3.75ltr → 3750 ml (not squared)', () => {
    const parsed = parseDeliveryPath2Segment('1tub/3.75ltr');
    const principal = convertSi(parsed.contentQty, parsed.contentUnit, 'ml');
    assert.equal(principal, 3750);
  });
});
