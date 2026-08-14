import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeInvoiceTotals,
  applyPromotion,
  isPromotionActive,
  ROLE_MODULES,
  requireRole,
} from '../api/src/db.mjs';

test('role modules: sales cannot access payments', () => {
  const sales = { role: 'sales' };
  assert.equal(requireRole(sales, ['members']), true);
  assert.equal(requireRole(sales, ['payments']), false);
  assert.ok(ROLE_MODULES.fitness_coach.includes('training'));
  assert.ok(ROLE_MODULES.admin.includes('team'));
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
