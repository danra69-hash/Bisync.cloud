/**
 * Regression: service charge must apply to the bill when configured.
 * Mirrors computeTaxServiceCharges + configDrivesRegisterCharges.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

function discountCentsFromPercent(subtotalCents, percentage) {
  const sub = Math.max(0, Math.round(subtotalCents));
  const pct = Math.min(100, Math.max(0, Number(percentage) || 0));
  return Math.min(sub, Math.round((sub * pct) / 100));
}

function normalizeSalesType(dining) {
  const key = (dining || 'dine-in').trim().toLowerCase().replace(/_/g, '-');
  if (key === 'dinein' || key === 'dine in' || key === 'eat-in') return 'dine-in';
  if (key === 'take-out' || key === 'takeout' || key === 'to-go') return 'takeaway';
  return key || 'dine-in';
}

function computeTaxServiceCharges({ lines, products, dining, discountCents, config }) {
  if (!config || lines.length === 0) {
    return { serviceCents: 0, taxRegularCents: 0, taxAlcoholCents: 0 };
  }
  const key = normalizeSalesType(dining);
  const rule = config.salesTypes.find(r => normalizeSalesType(r.salesType) === key) ?? {
    taxIds: [],
    serviceIds: [],
    applyToAllProducts: true,
    productGroups: [],
  };

  let taxIds = new Set(rule.taxIds ?? []);
  let serviceIds = new Set(rule.serviceIds ?? []);
  const anyTax = (config.salesTypes ?? []).some(r => (r.taxIds ?? []).length > 0);
  const anySvc = (config.salesTypes ?? []).some(r => (r.serviceIds ?? []).length > 0);
  if (taxIds.size === 0 && !anyTax) {
    taxIds = new Set((config.taxes ?? []).filter(t => t.percent > 0).map(t => t.id));
  }
  if (serviceIds.size === 0 && !anySvc) {
    serviceIds = new Set((config.services ?? []).filter(s => s.percent > 0).map(s => s.id));
  }
  if (taxIds.size === 0 && serviceIds.size === 0) {
    return { serviceCents: 0, taxRegularCents: 0, taxAlcoholCents: 0 };
  }

  const byId = new Map(products.map(p => [String(p.id), p]));
  let eligibleGross = 0;
  for (const line of lines) {
    const product = byId.get(String(line.productId));
    if (!product) continue;
    const amount = Math.round((line.unitPriceCents ?? product.priceCents) * line.quantity);
    if (rule.applyToAllProducts === false) continue;
    eligibleGross += amount;
  }
  if (eligibleGross <= 0) {
    return { serviceCents: 0, taxRegularCents: 0, taxAlcoholCents: 0 };
  }
  const eligibleNet = Math.max(0, eligibleGross - Math.max(0, discountCents));
  let serviceCents = 0;
  for (const svc of (config.services ?? []).filter(s => serviceIds.has(s.id) && s.percent > 0)) {
    serviceCents += discountCentsFromPercent(eligibleNet, svc.percent);
  }
  const taxableBase = eligibleNet + serviceCents;
  let taxRegularCents = 0;
  for (const tax of (config.taxes ?? []).filter(t => taxIds.has(t.id) && t.percent > 0)) {
    taxRegularCents += discountCentsFromPercent(taxableBase, tax.percent);
  }
  return { serviceCents, taxRegularCents, taxAlcoholCents: 0 };
}

function configDrivesRegisterCharges(config) {
  if (!config) return false;
  for (const rule of config.salesTypes ?? []) {
    if ((rule.serviceIds ?? []).length > 0 || (rule.taxIds ?? []).length > 0) return true;
  }
  return (config.services ?? []).some(s => s.percent > 0)
    || (config.taxes ?? []).some(t => t.percent > 0);
}

describe('POS tax & service charge on bill', () => {
  const products = [{ id: '1', priceCents: 10000, group: 'Food', name: 'Burger' }];
  const lines = [{ productId: '1', quantity: 1, unitPriceCents: 10000 }];

  it('applies 10% service when attached to dine-in', () => {
    const r = computeTaxServiceCharges({
      lines,
      products,
      dining: 'dine-in',
      discountCents: 0,
      config: {
        taxes: [],
        services: [{ id: 'svc-1', name: 'Service', percent: 10 }],
        salesTypes: [
          { salesType: 'dine-in', taxIds: [], serviceIds: ['svc-1'], applyToAllProducts: true, productGroups: [] },
          { salesType: 'takeaway', taxIds: [], serviceIds: [], applyToAllProducts: true, productGroups: [] },
        ],
      },
    });
    assert.equal(r.serviceCents, 1000);
  });

  it('applies service when lines exist but nothing attached yet (legacy incomplete setup)', () => {
    const r = computeTaxServiceCharges({
      lines,
      products,
      dining: 'dine-in',
      discountCents: 0,
      config: {
        taxes: [{ id: 'tax-1', name: 'SST', percent: 6 }],
        services: [{ id: 'svc-1', name: 'Service', percent: 10 }],
        salesTypes: [
          { salesType: 'dine-in', taxIds: [], serviceIds: [], applyToAllProducts: true, productGroups: [] },
        ],
      },
    });
    assert.equal(r.serviceCents, 1000);
    assert.equal(r.taxRegularCents, discountCentsFromPercent(11000, 6));
  });

  it('empty config does not drive register charges (manual entry stays available)', () => {
    assert.equal(
      configDrivesRegisterCharges({
        taxes: [],
        services: [],
        salesTypes: [{ salesType: 'dine-in', taxIds: [], serviceIds: [], applyToAllProducts: true, productGroups: [] }],
      }),
      false,
    );
  });

  it('configured service drives register charges', () => {
    assert.equal(
      configDrivesRegisterCharges({
        taxes: [],
        services: [{ id: 'svc-1', name: 'Service', percent: 10 }],
        salesTypes: [
          { salesType: 'dine-in', taxIds: [], serviceIds: ['svc-1'], applyToAllProducts: true, productGroups: [] },
        ],
      }),
      true,
    );
  });
});
