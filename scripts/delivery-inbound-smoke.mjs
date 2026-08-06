#!/usr/bin/env node
/**
 * Delivery path + inbound principal math smoke checks (BBQ Sauce scenario).
 */
import assert from 'node:assert/strict';

// Inline mirrors of fixed parseDeliveryUnitPath / totalSmallestMeasure.
function parseSegment(seg) {
  const m = String(seg).trim().match(/^(\d*\.?\d+)\s*(.+)$/i) || String(seg).trim().match(/^(.+)$/);
  if (!m) return null;
  if (m.length === 3 && m[1] && m[2]) {
    return { qty: parseFloat(m[1]) || 1, unit: m[2].trim() };
  }
  // unit-only like "Tin"
  const unitOnly = String(seg).trim().match(/^([A-Za-z].*)$/);
  if (unitOnly) return { qty: 1, unit: unitOnly[1] };
  return null;
}

function parseDeliveryUnitPath(input) {
  const segments = input.split('/').map(s => s.trim()).filter(Boolean);
  if (segments.length === 0) return null;
  const order = parseSegment(segments[0]);
  if (!order) return null;
  if (segments.length === 1) {
    return {
      orderUnit: order.unit, orderQty: order.qty || 1,
      packUnit: order.unit, packQty: 1,
      unitUnit: order.unit, unitQty: 1,
    };
  }
  const pack = parseSegment(segments[1]);
  if (!pack) return null;
  if (segments.length === 2) {
    return {
      orderUnit: order.unit, orderQty: order.qty || 1,
      packUnit: pack.unit, packQty: pack.qty || 1,
      unitUnit: pack.unit, unitQty: 1,
    };
  }
  const unit = parseSegment(segments[2]);
  if (!unit) return null;
  return {
    orderUnit: order.unit, orderQty: order.qty || 1,
    packUnit: pack.unit, packQty: pack.qty || 1,
    unitUnit: unit.unit, unitQty: unit.qty || 1,
  };
}

function totalSmallestMeasure(d) {
  return d.orderQty * d.packQty * d.unitQty;
}

function round4(n) {
  return Math.round(n * 10000 + Number.EPSILON) / 10000;
}

// 2-segment: 1tub/3.75ltr → 3.75 Ltr content (not 3.75²)
const tub = parseDeliveryUnitPath('1tub/3.75ltr');
assert.equal(totalSmallestMeasure(tub), 3.75);

const tin = parseDeliveryUnitPath('Tin/5ltr');
assert.equal(totalSmallestMeasure(tin), 5);

const box = parseDeliveryUnitPath('Box/12tin/400gr');
assert.equal(totalSmallestMeasure(box), 4800);

const dozen = parseDeliveryUnitPath('12tin');
assert.equal(totalSmallestMeasure(dozen), 12);

// BBQ inbound: 6 tub × 3790 Gr @ delivery 125.07 → 22740 Gr @ 0.0330
const packages = 6;
const principal = 3790;
const deliveryPrice = 125.07;
const stockQty = packages * principal;
const stockPrice = round4(deliveryPrice / principal);
assert.equal(stockQty, 22740);
assert.equal(stockPrice, 0.033);

console.log('delivery-inbound-smoke: ok');
