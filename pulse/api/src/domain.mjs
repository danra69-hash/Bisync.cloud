/** Pure Pulse domain helpers — no DB drivers (safe for CI unit tests). */

export const ROLES = ['management', 'admin', 'accounting', 'fitness_coach', 'sales'];

export const ROLE_LABELS = {
  management: 'Management',
  admin: 'Admin',
  accounting: 'Accounting',
  fitness_coach: 'Fitness Coach',
  sales: 'Sales',
};

export const ROLE_MODULES = {
  management: ['dashboard', 'members', 'payments', 'invoices', 'promotions', 'appointments', 'equipment', 'training', 'team'],
  admin: ['dashboard', 'members', 'payments', 'invoices', 'promotions', 'appointments', 'equipment', 'training', 'team'],
  accounting: ['dashboard', 'members', 'payments', 'invoices', 'promotions'],
  fitness_coach: ['dashboard', 'appointments', 'equipment', 'training', 'members'],
  sales: ['dashboard', 'members', 'promotions', 'appointments'],
};

export function requireRole(user, modules) {
  const allowed = ROLE_MODULES[user.role] ?? [];
  return modules.every((m) => allowed.includes(m));
}

export function computeInvoiceTotals(lines, taxRate = 0.08) {
  const subtotal = lines.reduce((s, l) => s + Number(l.qty) * Number(l.unitPrice), 0);
  const tax = Math.round(subtotal * taxRate * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;
  return { subtotal, tax, total };
}

export function isPromotionActive(promo, at = new Date()) {
  if (!promo || (promo.status !== 'scheduled' && promo.status !== 'active')) return false;
  const t = at.getTime();
  const start = new Date(promo.startsAt).getTime();
  const end = new Date(promo.endsAt).getTime();
  return t >= start && t <= end;
}

export function applyPromotion(amount, promo) {
  if (!promo) return { amount, discount: 0 };
  const base = Number(amount);
  let discount = 0;
  if (promo.discountType === 'percent') {
    discount = Math.round(base * (Number(promo.discountValue) / 100) * 100) / 100;
  } else {
    discount = Math.min(base, Number(promo.discountValue));
  }
  return { amount: Math.round((base - discount) * 100) / 100, discount };
}

export function nowIso() {
  return new Date().toISOString();
}
