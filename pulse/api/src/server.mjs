import express from 'express';
import cors from 'cors';
import {
  loadDb,
  saveDb,
  id,
  nowIso,
  ROLE_LABELS,
  ROLE_MODULES,
  requireRole,
  computeInvoiceTotals,
  isPromotionActive,
  applyPromotion,
} from './db.mjs';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.resolve(__dirname, '../../data/pulse-db.json');
if (!existsSync(dataPath)) {
  await import('./seed.mjs');
}

const app = express();
const PORT = Number(process.env.PULSE_API_PORT || 5400);

app.use(cors());
app.use(express.json({ limit: '1mb' }));

function publicUser(u) {
  if (!u) return null;
  const { password, ...rest } = u;
  return {
    ...rest,
    roleLabel: ROLE_LABELS[u.role] ?? u.role,
    modules: ROLE_MODULES[u.role] ?? [],
  };
}

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const db = loadDb();
  const session = db.sessions.find((s) => s.token === token);
  if (!session) return res.status(401).json({ error: 'Session expired' });
  const user = db.users.find((u) => u.id === session.userId && u.active);
  if (!user) return res.status(401).json({ error: 'User inactive' });
  req.user = user;
  req.db = db;
  next();
}

function gate(...modules) {
  return (req, res, next) => {
    if (!requireRole(req.user, modules)) {
      return res.status(403).json({ error: `Requires access to: ${modules.join(', ')}` });
    }
    next();
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'pulse-api', time: nowIso() });
});

app.get('/api/meta', (_req, res) => {
  const db = loadDb();
  res.json({
    ...db.meta,
    roles: Object.entries(ROLE_LABELS).map(([id, label]) => ({
      id,
      label,
      modules: ROLE_MODULES[id],
    })),
  });
});

app.post('/api/auth/login', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const db = loadDb();
  const user = db.users.find((u) => u.email.toLowerCase() === email && u.active);
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = id('tok');
  db.sessions.push({ token, userId: user.id, createdAt: nowIso() });
  // keep last 40 sessions
  if (db.sessions.length > 40) db.sessions = db.sessions.slice(-40);
  saveDb(db);
  res.json({ token, user: publicUser(user) });
});

app.post('/api/auth/logout', auth, (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.slice(7);
  req.db.sessions = req.db.sessions.filter((s) => s.token !== token);
  saveDb(req.db);
  res.json({ ok: true });
});

app.get('/api/auth/me', auth, (req, res) => {
  res.json({ user: publicUser(req.user), meta: req.db.meta });
});

app.get('/api/dashboard', auth, gate('dashboard'), (req, res) => {
  const db = req.db;
  const openInvoices = db.invoices.filter((i) => i.status === 'open');
  const activeMembers = db.members.filter((m) => m.status === 'active');
  const leads = db.members.filter((m) => m.status === 'lead');
  const upcoming = db.appointments
    .filter((a) => a.status === 'scheduled' && new Date(a.startsAt) >= new Date())
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, 5);
  const equipmentDown = db.equipment.filter((e) => e.status !== 'available');
  const captured = db.payments
    .filter((p) => p.status === 'captured')
    .reduce((s, p) => s + Number(p.amount), 0);

  res.json({
    stats: {
      activeMembers: activeMembers.length,
      leads: leads.length,
      openInvoices: openInvoices.length,
      openInvoiceTotal: openInvoices.reduce((s, i) => s + Number(i.total), 0),
      capturedRevenue: Math.round(captured * 100) / 100,
      upcomingAppointments: upcoming.length,
      equipmentIssues: equipmentDown.length,
      trainingSessions: db.trainingSessions.length,
    },
    upcoming,
    equipmentIssues: equipmentDown,
    role: publicUser(req.user),
  });
});

app.get('/api/team', auth, gate('team'), (req, res) => {
  res.json(req.db.users.map(publicUser));
});

app.post('/api/team', auth, gate('team'), (req, res) => {
  const { name, email, role, password } = req.body || {};
  if (!name || !email || !role) return res.status(400).json({ error: 'name, email, role required' });
  if (!ROLE_MODULES[role]) return res.status(400).json({ error: 'Invalid role' });
  const db = req.db;
  if (db.users.some((u) => u.email.toLowerCase() === String(email).toLowerCase())) {
    return res.status(409).json({ error: 'Email already exists' });
  }
  const user = {
    id: id('usr'),
    name: String(name).trim(),
    email: String(email).trim().toLowerCase(),
    role,
    password: password || 'pulse123',
    active: true,
    createdAt: nowIso(),
  };
  db.users.push(user);
  saveDb(db);
  res.status(201).json(publicUser(user));
});

app.get('/api/members', auth, gate('members'), (req, res) => {
  const q = String(req.query.q || '').toLowerCase();
  let rows = req.db.members;
  if (q) {
    rows = rows.filter((m) =>
      `${m.firstName} ${m.lastName} ${m.email} ${m.memberCode}`.toLowerCase().includes(q),
    );
  }
  res.json(rows);
});

app.post('/api/members', auth, gate('members'), (req, res) => {
  const b = req.body || {};
  if (!b.firstName || !b.lastName || !b.email) {
    return res.status(400).json({ error: 'firstName, lastName, email required' });
  }
  const db = req.db;
  const n = db.members.length + 1001;
  const member = {
    id: id('mem'),
    memberCode: `PLS-${n}`,
    firstName: String(b.firstName).trim(),
    lastName: String(b.lastName).trim(),
    email: String(b.email).trim().toLowerCase(),
    phone: String(b.phone || ''),
    plan: b.plan || 'Silver',
    status: b.status || 'lead',
    joinedAt: b.status === 'active' ? nowIso() : null,
    renewsAt: b.renewsAt || null,
    tags: Array.isArray(b.tags) ? b.tags : [],
    notes: String(b.notes || ''),
    salesOwnerEmail: req.user.email,
  };
  db.members.push(member);
  saveDb(db);
  res.status(201).json(member);
});

app.patch('/api/members/:id', auth, gate('members'), (req, res) => {
  const db = req.db;
  const member = db.members.find((m) => m.id === req.params.id);
  if (!member) return res.status(404).json({ error: 'Not found' });
  const allowed = ['firstName', 'lastName', 'email', 'phone', 'plan', 'status', 'renewsAt', 'tags', 'notes'];
  for (const key of allowed) {
    if (req.body?.[key] !== undefined) member[key] = req.body[key];
  }
  if (req.body?.status === 'active' && !member.joinedAt) member.joinedAt = nowIso();
  saveDb(db);
  res.json(member);
});

app.get('/api/promotions', auth, gate('promotions'), (req, res) => {
  const db = req.db;
  const rows = db.promotions.map((p) => ({
    ...p,
    currentlyActive: isPromotionActive(p),
  }));
  res.json(rows);
});

app.post('/api/promotions', auth, gate('promotions'), (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.code || !b.startsAt || !b.endsAt) {
    return res.status(400).json({ error: 'name, code, startsAt, endsAt required' });
  }
  const promo = {
    id: id('prm'),
    name: String(b.name).trim(),
    code: String(b.code).trim().toUpperCase(),
    discountType: b.discountType === 'fixed' ? 'fixed' : 'percent',
    discountValue: Number(b.discountValue) || 0,
    appliesTo: b.appliesTo || 'any',
    status: b.status || 'scheduled',
    startsAt: b.startsAt,
    endsAt: b.endsAt,
    createdBy: req.user.email,
  };
  req.db.promotions.push(promo);
  saveDb(req.db);
  res.status(201).json({ ...promo, currentlyActive: isPromotionActive(promo) });
});

app.patch('/api/promotions/:id', auth, gate('promotions'), (req, res) => {
  const promo = req.db.promotions.find((p) => p.id === req.params.id);
  if (!promo) return res.status(404).json({ error: 'Not found' });
  const allowed = ['name', 'status', 'startsAt', 'endsAt', 'discountType', 'discountValue', 'appliesTo'];
  for (const key of allowed) {
    if (req.body?.[key] !== undefined) promo[key] = req.body[key];
  }
  saveDb(req.db);
  res.json({ ...promo, currentlyActive: isPromotionActive(promo) });
});

app.get('/api/invoices', auth, gate('invoices'), (req, res) => {
  const db = req.db;
  const rows = db.invoices.map((inv) => ({
    ...inv,
    member: db.members.find((m) => m.id === inv.memberId) || null,
  }));
  res.json(rows);
});

app.post('/api/invoices', auth, gate('invoices'), (req, res) => {
  const b = req.body || {};
  if (!b.memberId || !Array.isArray(b.lines) || b.lines.length === 0) {
    return res.status(400).json({ error: 'memberId and lines required' });
  }
  const db = req.db;
  const member = db.members.find((m) => m.id === b.memberId);
  if (!member) return res.status(404).json({ error: 'Member not found' });

  let lines = b.lines.map((l) => ({
    description: String(l.description || 'Line'),
    qty: Number(l.qty) || 1,
    unitPrice: Number(l.unitPrice) || 0,
  }));

  let discount = 0;
  let promoCode = null;
  if (b.promoCode) {
    const promo = db.promotions.find((p) => p.code === String(b.promoCode).toUpperCase());
    if (!promo || !isPromotionActive(promo)) {
      return res.status(400).json({ error: 'Promotion not active' });
    }
    if (promo.appliesTo !== 'any' && promo.appliesTo !== member.plan) {
      return res.status(400).json({ error: 'Promotion does not apply to this plan' });
    }
    const base = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
    const applied = applyPromotion(base, promo);
    discount = applied.discount;
    promoCode = promo.code;
    if (discount > 0 && lines.length) {
      lines = [
        ...lines,
        { description: `Promo ${promo.code}`, qty: 1, unitPrice: -discount },
      ];
    }
  }

  const totals = computeInvoiceTotals(lines.filter((l) => l.unitPrice >= 0));
  // recompute with discount line included for display
  const subtotal = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const tax = Math.round(Math.max(0, subtotal) * 0.08 * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;

  const invoice = {
    id: id('inv'),
    number: `INV-2026-${String(db.invoices.length + 1).padStart(3, '0')}`,
    memberId: member.id,
    status: 'open',
    issuedAt: nowIso(),
    dueAt: b.dueAt || new Date(Date.now() + 7 * 86400000).toISOString(),
    lines,
    subtotal: Math.round(subtotal * 100) / 100,
    tax,
    total,
    promoCode,
    discount,
  };
  db.invoices.push(invoice);
  saveDb(db);
  res.status(201).json({ ...invoice, member, previewTotals: totals });
});

app.get('/api/payments', auth, gate('payments'), (req, res) => {
  const db = req.db;
  res.json(
    db.payments.map((p) => ({
      ...p,
      member: db.members.find((m) => m.id === p.memberId) || null,
      invoice: db.invoices.find((i) => i.id === p.invoiceId) || null,
    })),
  );
});

app.post('/api/payments', auth, gate('payments'), (req, res) => {
  const b = req.body || {};
  if (!b.memberId || !b.amount) return res.status(400).json({ error: 'memberId and amount required' });
  const db = req.db;
  const member = db.members.find((m) => m.id === b.memberId);
  if (!member) return res.status(404).json({ error: 'Member not found' });

  let invoice = null;
  if (b.invoiceId) {
    invoice = db.invoices.find((i) => i.id === b.invoiceId);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  }

  const payment = {
    id: id('pay'),
    memberId: member.id,
    invoiceId: invoice?.id || null,
    amount: Number(b.amount),
    method: b.method || 'card',
    status: 'captured',
    paidAt: nowIso(),
    reference: b.reference || `ch_${nanoidish()}`,
  };
  db.payments.push(payment);
  if (invoice) {
    invoice.status = 'paid';
  }
  if (member.status === 'lead') {
    member.status = 'active';
    member.joinedAt = member.joinedAt || nowIso();
  }
  saveDb(db);
  res.status(201).json(payment);
});

function nanoidish() {
  return Math.random().toString(36).slice(2, 10);
}

app.get('/api/appointments', auth, gate('appointments'), (req, res) => {
  const db = req.db;
  res.json(
    db.appointments
      .map((a) => ({
        ...a,
        member: db.members.find((m) => m.id === a.memberId) || null,
        coach: publicUser(db.users.find((u) => u.id === a.coachUserId)),
      }))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
  );
});

app.post('/api/appointments', auth, gate('appointments'), (req, res) => {
  const b = req.body || {};
  if (!b.memberId || !b.startsAt || !b.endsAt) {
    return res.status(400).json({ error: 'memberId, startsAt, endsAt required' });
  }
  const db = req.db;
  const coachUserId =
    b.coachUserId ||
    (req.user.role === 'fitness_coach'
      ? req.user.id
      : db.users.find((u) => u.role === 'fitness_coach')?.id);
  if (!coachUserId) return res.status(400).json({ error: 'No coach available' });

  const appointment = {
    id: id('apt'),
    memberId: b.memberId,
    coachUserId,
    title: String(b.title || 'Trainer session'),
    startsAt: b.startsAt,
    endsAt: b.endsAt,
    status: 'scheduled',
    location: String(b.location || 'Floor B'),
    notes: String(b.notes || ''),
  };
  db.appointments.push(appointment);
  saveDb(db);
  res.status(201).json(appointment);
});

app.patch('/api/appointments/:id', auth, gate('appointments'), (req, res) => {
  const apt = req.db.appointments.find((a) => a.id === req.params.id);
  if (!apt) return res.status(404).json({ error: 'Not found' });
  for (const key of ['title', 'startsAt', 'endsAt', 'status', 'location', 'notes', 'coachUserId']) {
    if (req.body?.[key] !== undefined) apt[key] = req.body[key];
  }
  saveDb(req.db);
  res.json(apt);
});

app.get('/api/equipment', auth, gate('equipment'), (req, res) => {
  res.json(req.db.equipment);
});

app.post('/api/equipment', auth, gate('equipment'), (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.code) return res.status(400).json({ error: 'name and code required' });
  const row = {
    id: id('eq'),
    code: String(b.code).trim().toUpperCase(),
    name: String(b.name).trim(),
    category: b.category || 'General',
    status: b.status || 'available',
    location: b.location || '',
    lastServiceAt: b.lastServiceAt || nowIso(),
    notes: String(b.notes || ''),
  };
  req.db.equipment.push(row);
  saveDb(req.db);
  res.status(201).json(row);
});

app.patch('/api/equipment/:id', auth, gate('equipment'), (req, res) => {
  const row = req.db.equipment.find((e) => e.id === req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  for (const key of ['name', 'category', 'status', 'location', 'lastServiceAt', 'notes']) {
    if (req.body?.[key] !== undefined) row[key] = req.body[key];
  }
  saveDb(req.db);
  res.json(row);
});

app.get('/api/activity-types', auth, gate('training'), (req, res) => {
  res.json(req.db.activityTypes);
});

app.get('/api/training', auth, gate('training'), (req, res) => {
  const db = req.db;
  res.json(
    db.trainingSessions
      .map((t) => ({
        ...t,
        member: db.members.find((m) => m.id === t.memberId) || null,
        coach: publicUser(db.users.find((u) => u.id === t.coachUserId)),
        activityType: db.activityTypes.find((a) => a.id === t.activityTypeId) || null,
        equipment: db.equipment.filter((e) => (t.equipmentIds || []).includes(e.id)),
      }))
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
  );
});

app.post('/api/training', auth, gate('training'), (req, res) => {
  const b = req.body || {};
  if (!b.memberId || !b.activityTypeId || !b.startedAt) {
    return res.status(400).json({ error: 'memberId, activityTypeId, startedAt required' });
  }
  const db = req.db;
  const equipmentIds = Array.isArray(b.equipmentIds) ? b.equipmentIds : [];
  for (const eid of equipmentIds) {
    const eq = db.equipment.find((e) => e.id === eid);
    if (!eq) return res.status(400).json({ error: `Unknown equipment ${eid}` });
    if (eq.status === 'maintenance') {
      return res.status(400).json({ error: `${eq.name} is in maintenance` });
    }
  }
  const session = {
    id: id('trn'),
    memberId: b.memberId,
    coachUserId: b.coachUserId || (req.user.role === 'fitness_coach' ? req.user.id : null),
    activityTypeId: b.activityTypeId,
    startedAt: b.startedAt,
    endedAt: b.endedAt || null,
    equipmentIds,
    notes: String(b.notes || ''),
    calories: Number(b.calories) || null,
  };
  db.trainingSessions.push(session);
  saveDb(db);
  res.status(201).json(session);
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal error' });
});

app.listen(PORT, () => {
  console.log(`Pulse API listening on http://localhost:${PORT}`);
});
