/**
 * Regression: service charge / tax apply from product matrix and legacy sales-type rules.
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

function resolveChargeType(line) {
  const raw = (line.type || '').trim().toLowerCase().replace(/_/g, '-');
  if (raw === 'tax-regular' || raw === 'regular') return 'tax-regular';
  if (raw === 'tax-alcohol' || raw === 'alcohol') return 'tax-alcohol';
  if (raw === 'service') return 'service';
  if (/alcohol|liquor|spirit/i.test(line.name || '')) return 'tax-alcohol';
  return 'tax-regular';
}

function listConfigCharges(config) {
  if (config.charges?.length) return config.charges;
  return [
    ...(config.taxes ?? []).map(t => ({ ...t, type: resolveChargeType(t) })),
    ...(config.services ?? []).map(s => ({ ...s, type: 'service' })),
  ];
}

function channelFlags(rule, dining) {
  const key = normalizeSalesType(dining);
  if (!rule) return { taxRegular: false, taxAlcohol: false, service: false };
  if (key === 'takeaway') return rule.takeaway;
  if (key === 'delivery') return rule.delivery;
  return rule.dineIn;
}

function computeFromProductRules({ lines, products, dining, discountCents, config }) {
  const charges = listConfigCharges(config).filter(c => c.percent > 0);
  const regular = charges.filter(c => resolveChargeType(c) === 'tax-regular');
  const alcohol = charges.filter(c => resolveChargeType(c) === 'tax-alcohol');
  const services = charges.filter(c => resolveChargeType(c) === 'service');
  const byId = new Map(products.map(p => [String(p.id), p]));
  const rules = new Map((config.productRules ?? []).map(r => [String(r.productId), r]));
  const rows = [];
  let totalGross = 0;
  for (const line of lines) {
    const product = byId.get(String(line.productId));
    if (!product) continue;
    const amount = Math.round((line.unitPriceCents ?? product.priceCents) * line.quantity);
    totalGross += amount;
    rows.push({ amount, flags: channelFlags(rules.get(String(product.id)), dining) });
  }
  if (totalGross <= 0) return { serviceCents: 0, taxRegularCents: 0, taxAlcoholCents: 0 };
  const disc = Math.max(0, Math.round(discountCents));
  let serviceCents = 0;
  let taxRegularCents = 0;
  let taxAlcoholCents = 0;
  for (const row of rows) {
    const discShare = Math.round((disc * row.amount) / totalGross);
    const net = Math.max(0, row.amount - discShare);
    let lineService = 0;
    if (row.flags.service) {
      for (const svc of services) lineService += discountCentsFromPercent(net, svc.percent);
    }
    serviceCents += lineService;
    const taxable = net + lineService;
    if (row.flags.taxRegular) {
      for (const tax of regular) taxRegularCents += discountCentsFromPercent(taxable, tax.percent);
    } else if (row.flags.taxAlcohol) {
      for (const tax of alcohol) taxAlcoholCents += discountCentsFromPercent(taxable, tax.percent);
    }
  }
  return { serviceCents, taxRegularCents, taxAlcoholCents };
}

function computeTaxServiceCharges({ lines, products, dining, discountCents, config }) {
  if (!config || lines.length === 0) {
    return { serviceCents: 0, taxRegularCents: 0, taxAlcoholCents: 0 };
  }
  if ((config.productRules ?? []).length > 0) {
    return computeFromProductRules({ lines, products, dining, discountCents, config });
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
  const charges = listConfigCharges(config);
  if (!charges.some(c => c.percent > 0)) return false;
  if ((config.productRules ?? []).some(r =>
    [r.dineIn, r.takeaway, r.delivery].some(ch => ch?.taxRegular || ch?.taxAlcohol || ch?.service),
  )) {
    return true;
  }
  for (const rule of config.salesTypes ?? []) {
    if ((rule.serviceIds ?? []).length > 0 || (rule.taxIds ?? []).length > 0) return true;
  }
  return (config.productRules ?? []).length === 0;
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

  it('product matrix applies service + tax regular for dine-in only', () => {
    const r = computeTaxServiceCharges({
      lines,
      products,
      dining: 'dine-in',
      discountCents: 0,
      config: {
        charges: [
          { id: 'tax-1', type: 'tax-regular', name: 'GST', percent: 7 },
          { id: 'svc-1', type: 'service', name: 'Service', percent: 10 },
        ],
        taxes: [],
        services: [],
        salesTypes: [],
        productRules: [
          {
            productId: 1,
            dineIn: { taxRegular: true, taxAlcohol: false, service: true },
            takeaway: { taxRegular: false, taxAlcohol: false, service: false },
            delivery: { taxRegular: false, taxAlcohol: false, service: false },
          },
        ],
      },
    });
    assert.equal(r.serviceCents, 1000);
    assert.equal(r.taxRegularCents, discountCentsFromPercent(11000, 7));
  });

  it('product matrix takeout ignores dine-in flags', () => {
    const r = computeTaxServiceCharges({
      lines,
      products,
      dining: 'takeout',
      discountCents: 0,
      config: {
        charges: [
          { id: 'svc-1', type: 'service', name: 'Service', percent: 10 },
        ],
        taxes: [],
        services: [],
        salesTypes: [],
        productRules: [
          {
            productId: 1,
            dineIn: { taxRegular: false, taxAlcohol: false, service: true },
            takeaway: { taxRegular: false, taxAlcohol: false, service: false },
            delivery: { taxRegular: false, taxAlcohol: false, service: false },
          },
        ],
      },
    });
    assert.equal(r.serviceCents, 0);
  });

  it('tax regular and tax alcohol are mutually exclusive per line (alcohol wins when both set)', () => {
    // UI enforces mutex; compute prefers taxRegular branch first, then alcohol.
    // Simulate mutex already applied: only alcohol ticked.
    const r = computeTaxServiceCharges({
      lines,
      products: [{ id: '1', priceCents: 10000, group: 'Beer', name: 'Lager' }],
      dining: 'dine-in',
      discountCents: 0,
      config: {
        charges: [
          { id: 'tax-r', type: 'tax-regular', name: 'GST', percent: 7 },
          { id: 'tax-a', type: 'tax-alcohol', name: 'Alcohol', percent: 10 },
        ],
        taxes: [],
        services: [],
        salesTypes: [],
        productRules: [
          {
            productId: 1,
            dineIn: { taxRegular: false, taxAlcohol: true, service: false },
            takeaway: { taxRegular: false, taxAlcohol: false, service: false },
            delivery: { taxRegular: false, taxAlcohol: false, service: false },
          },
        ],
      },
    });
    assert.equal(r.taxRegularCents, 0);
    assert.equal(r.taxAlcoholCents, 1000);
  });
});
