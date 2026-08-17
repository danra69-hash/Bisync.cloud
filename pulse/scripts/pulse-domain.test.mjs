import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeInvoiceTotals,
  applyPromotion,
  isPromotionActive,
  ROLE_MODULES,
  DEFAULT_PLAN_PRICES,
  requireRole,
} from '../api/src/domain.mjs';
import { isCompanyWideRole, tenantWhere } from '../api/src/tenant.mjs';

test('role modules: sales cannot access payments', () => {
  const sales = { role: 'sales' };
  assert.equal(requireRole(sales, ['members']), true);
  assert.equal(requireRole(sales, ['payments']), false);
  assert.ok(ROLE_MODULES.fitness_coach.includes('training'));
  assert.ok(ROLE_MODULES.admin.includes('team'));
});

test('role modules: sales can access products', () => {
  const sales = { role: 'sales' };
  assert.equal(requireRole(sales, ['products']), true);
  assert.ok(ROLE_MODULES.admin.includes('products'));
  assert.equal(ROLE_MODULES.admin.indexOf('products'), 2, 'Product should sit early in admin nav modules');
  assert.ok(!ROLE_MODULES.fitness_coach.includes('products'));
  assert.equal(requireRole({ role: 'fitness_coach' }, ['products']), false);
});

test('default plan prices cover seed catalog', () => {
  assert.equal(DEFAULT_PLAN_PRICES.Gold.price, 89);
  assert.equal(DEFAULT_PLAN_PRICES.Silver.billingInterval, 'month');
  assert.equal(DEFAULT_PLAN_PRICES['Day Pass'].billingInterval, 'day');
});

test('invoice totals include tax', () => {
  const t = computeInvoiceTotals([{ qty: 1, unitPrice: 100 }]);
  assert.equal(t.subtotal, 100);
  assert.equal(t.tax, 8);
  assert.equal(t.total, 108);
});

test('percent promotion discount', () => {
  const promo = { discountType: 'percent', discountValue: 20 };
  const r = applyPromotion(100, promo);
  assert.equal(r.discount, 20);
  assert.equal(r.amount, 80);
});

test('fixed promotion never exceeds amount', () => {
  const promo = { discountType: 'fixed', discountValue: 150 };
  const r = applyPromotion(100, promo);
  assert.equal(r.discount, 100);
  assert.equal(r.amount, 0);
});

test('promotion scheduler window', () => {
  const promo = {
    status: 'active',
    startsAt: '2026-08-01T00:00:00.000Z',
    endsAt: '2026-08-31T23:59:59.000Z',
  };
  assert.equal(isPromotionActive(promo, new Date('2026-08-14T12:00:00.000Z')), true);
  assert.equal(isPromotionActive(promo, new Date('2026-09-01T00:00:00.000Z')), false);
  assert.equal(
    isPromotionActive({ ...promo, status: 'scheduled' }, new Date('2026-08-14T12:00:00.000Z')),
    true,
  );
  assert.equal(
    isPromotionActive({ ...promo, status: 'ended' }, new Date('2026-08-14T12:00:00.000Z')),
    false,
  );
});

test('company-wide roles see all locations', () => {
  assert.equal(isCompanyWideRole('admin'), true);
  assert.equal(isCompanyWideRole('management'), true);
  assert.equal(isCompanyWideRole('accounting'), true);
  assert.equal(isCompanyWideRole('fitness_coach'), false);
  assert.equal(isCompanyWideRole('sales'), false);
});

test('tenantWhere builds company and location clauses', () => {
  const companyOnly = tenantWhere('m', 'co_1', null);
  assert.equal(companyOnly.clause, 'm.company_id = $1');
  assert.deepEqual(companyOnly.params, ['co_1']);

  const withLoc = tenantWhere('e', 'co_1', 'loc_2', 1, 'location_id');
  assert.equal(withLoc.clause, 'e.company_id = $1 AND e.location_id = $2');
  assert.deepEqual(withLoc.params, ['co_1', 'loc_2']);
});
