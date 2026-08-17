/** Pure Pulse domain helpers — no DB drivers (safe for CI unit tests). */

export const ROLES = ['superuser', 'management', 'admin', 'accounting', 'fitness_coach', 'sales'];

export const ROLE_LABELS = {
  superuser: 'Superuser',
  management: 'Management',
  admin: 'Admin',
  accounting: 'Accounting',
  fitness_coach: 'Fitness Coach',
  sales: 'Sales',
};

/** Canonical module order used by nav + ROLE_MODULES. */
export const ALL_MODULES = [
  'dashboard',
  'members',
  'products',
  'system_config',
  'payments',
  'invoices',
  'promotions',
  'appointments',
  'equipment',
  'training',
  'team',
];

export const ROLE_MODULES = {
  // Platform operator — every module across every tenant membership.
  superuser: [...ALL_MODULES],
  management: [...ALL_MODULES],
  admin: [...ALL_MODULES],
  accounting: ['dashboard', 'members', 'products', 'payments', 'invoices', 'promotions'],
  fitness_coach: ['dashboard', 'appointments', 'equipment', 'training', 'members'],
  sales: ['dashboard', 'members', 'products', 'promotions', 'appointments'],
};

/** Default list prices used when seeding the Product catalog from company plans. */
export const DEFAULT_PLAN_PRICES = {
  'Day Pass': { price: 25, billingInterval: 'day' },
  Silver: { price: 59, billingInterval: 'month' },
  Gold: { price: 89, billingInterval: 'month' },
  Platinum: { price: 129, billingInterval: 'month' },
};

export function requireRole(user, modules) {
  const allowed = Array.isArray(user?.modules) && user.modules.length
    ? user.modules
    : (ROLE_MODULES[user.role] ?? []);
  return modules.every((m) => allowed.includes(m));
}

export function normalizeRoleCode(label) {
  const base = String(label || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 28);
  return base || 'role';
}

export function sanitizeRoleModules(modules) {
  const wanted = Array.isArray(modules) ? modules.map(String) : [];
  return ALL_MODULES.filter((m) => wanted.includes(m));
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
