import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nanoid } from 'nanoid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '../../data');
const dbPath = path.join(dataDir, 'pulse-db.json');

export const ROLES = ['management', 'admin', 'accounting', 'fitness_coach', 'sales'];

export const ROLE_LABELS = {
  management: 'Management',
  admin: 'Admin',
  accounting: 'Accounting',
  fitness_coach: 'Fitness Coach',
  sales: 'Sales',
};

/** Module access matrix — mirrors Bisync-style module gating. */
export const ROLE_MODULES = {
  management: ['dashboard', 'members', 'payments', 'invoices', 'promotions', 'appointments', 'equipment', 'training', 'team'],
  admin: ['dashboard', 'members', 'payments', 'invoices', 'promotions', 'appointments', 'equipment', 'training', 'team'],
  accounting: ['dashboard', 'members', 'payments', 'invoices', 'promotions'],
  fitness_coach: ['dashboard', 'appointments', 'equipment', 'training', 'members'],
  sales: ['dashboard', 'members', 'promotions', 'appointments'],
};

const emptyDb = () => ({
  users: [],
  sessions: [],
  members: [],
  payments: [],
  invoices: [],
  promotions: [],
  appointments: [],
  equipment: [],
  activityTypes: [],
  trainingSessions: [],
  meta: { clubName: 'Pulse Fitness Club', currency: 'USD', timezone: 'UTC' },
});

function ensureDir() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
}

export function loadDb() {
  ensureDir();
  if (!fs.existsSync(dbPath)) {
    const db = emptyDb();
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
    return db;
  }
  return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

export function saveDb(db) {
  ensureDir();
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

export function id(prefix) {
  return `${prefix}_${nanoid(10)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

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
  if (!promo || promo.status !== 'scheduled' && promo.status !== 'active') return false;
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
