import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  migrate,
  query,
  id,
  nowIso,
  ROLE_LABELS,
  ROLE_MODULES,
  requireRole,
  computeInvoiceTotals,
  isPromotionActive,
  applyPromotion,
  getMeta,
  mapUser,
  mapMember,
  mapPromo,
  mapInvoice,
  mapPayment,
  mapAppointment,
  mapEquipment,
  mapActivity,
  mapTraining,
} from './db.mjs';
import { seed } from './seed.mjs';

const app = express();


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

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const session = await query('SELECT * FROM sessions WHERE token = $1', [token]);
    if (!session.rowCount) return res.status(401).json({ error: 'Session expired' });
    const userRes = await query('SELECT * FROM users WHERE id = $1 AND active = TRUE', [
      session.rows[0].user_id,
    ]);
    if (!userRes.rowCount) return res.status(401).json({ error: 'User inactive' });
    req.user = mapUser(userRes.rows[0]);
    next();
  } catch (err) {
    next(err);
  }
}

function gate(...modules) {
  return (req, res, next) => {
    if (!requireRole(req.user, modules)) {
      return res.status(403).json({ error: `Requires access to: ${modules.join(', ')}` });
    }
    next();
  };
}

app.get('/api/health', asyncHandler(async (_req, res) => {
  await query('SELECT 1');
  res.json({ ok: true, service: 'pulse-api', db: 'postgres', time: nowIso() });
}));

app.get('/api/meta', asyncHandler(async (_req, res) => {
  const meta = await getMeta();
  res.json({
    ...meta,
    roles: Object.entries(ROLE_LABELS).map(([id, label]) => ({
      id,
      label,
      modules: ROLE_MODULES[id],
    })),
  });
}));

app.post('/api/auth/login', asyncHandler(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const { rows } = await query(
    'SELECT * FROM users WHERE lower(email) = $1 AND active = TRUE',
    [email],
  );
  const user = mapUser(rows[0]);
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = id('tok');
  await query('INSERT INTO sessions (token, user_id, created_at) VALUES ($1,$2,$3)', [
    token,
    user.id,
    nowIso(),
  ]);
  await query(`
    DELETE FROM sessions WHERE token IN (
      SELECT token FROM sessions ORDER BY created_at DESC OFFSET 40
    )
  `);
  res.json({ token, user: publicUser(user) });
}));

app.post('/api/auth/logout', auth, asyncHandler(async (req, res) => {
  const token = (req.headers.authorization || '').slice(7);
  await query('DELETE FROM sessions WHERE token = $1', [token]);
  res.json({ ok: true });
}));

app.get('/api/auth/me', auth, asyncHandler(async (req, res) => {
  res.json({ user: publicUser(req.user), meta: await getMeta() });
}));

app.get('/api/dashboard', auth, gate('dashboard'), asyncHandler(async (req, res) => {
  const [active, leads, openInv, captured, upcoming, equipmentDown, trainingCount] =
    await Promise.all([
      query(`SELECT COUNT(*)::int AS n FROM members WHERE status = 'active'`),
      query(`SELECT COUNT(*)::int AS n FROM members WHERE status = 'lead'`),
      query(`SELECT COUNT(*)::int AS n, COALESCE(SUM(total),0)::float AS total FROM invoices WHERE status = 'open'`),
      query(`SELECT COALESCE(SUM(amount),0)::float AS total FROM payments WHERE status = 'captured'`),
      query(
        `SELECT * FROM appointments WHERE status = 'scheduled' AND starts_at >= NOW()
         ORDER BY starts_at ASC LIMIT 5`,
      ),
      query(`SELECT * FROM equipment WHERE status <> 'available' ORDER BY code`),
      query(`SELECT COUNT(*)::int AS n FROM training_sessions`),
    ]);

  res.json({
    stats: {
      activeMembers: active.rows[0].n,
      leads: leads.rows[0].n,
      openInvoices: openInv.rows[0].n,
      openInvoiceTotal: Number(openInv.rows[0].total),
      capturedRevenue: Math.round(Number(captured.rows[0].total) * 100) / 100,
      upcomingAppointments: upcoming.rowCount,
      equipmentIssues: equipmentDown.rowCount,
      trainingSessions: trainingCount.rows[0].n,
    },
    upcoming: upcoming.rows.map(mapAppointment),
    equipmentIssues: equipmentDown.rows.map(mapEquipment),
    role: publicUser(req.user),
  });
}));

app.get('/api/team', auth, gate('team'), asyncHandler(async (_req, res) => {
  const { rows } = await query('SELECT * FROM users ORDER BY created_at');
  res.json(rows.map((r) => publicUser(mapUser(r))));
}));

app.post('/api/team', auth, gate('team'), asyncHandler(async (req, res) => {
  const { name, email, role, password } = req.body || {};
  if (!name || !email || !role) return res.status(400).json({ error: 'name, email, role required' });
  if (!ROLE_MODULES[role]) return res.status(400).json({ error: 'Invalid role' });
  const exists = await query('SELECT 1 FROM users WHERE lower(email) = $1', [
    String(email).toLowerCase(),
  ]);
  if (exists.rowCount) return res.status(409).json({ error: 'Email already exists' });
  const user = {
    id: id('usr'),
    name: String(name).trim(),
    email: String(email).trim().toLowerCase(),
    role,
    password: password || 'pulse123',
    active: true,
    createdAt: nowIso(),
  };
  await query(
    `INSERT INTO users (id, name, email, role, password, active, created_at)
     VALUES ($1,$2,$3,$4,$5,TRUE,$6)`,
    [user.id, user.name, user.email, user.role, user.password, user.createdAt],
  );
  res.status(201).json(publicUser(user));
}));

app.get('/api/members', auth, gate('members'), asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  let result;
  if (q) {
    result = await query(
      `SELECT * FROM members
       WHERE lower(first_name || ' ' || last_name || ' ' || email || ' ' || member_code) LIKE $1
       ORDER BY member_code`,
      [`%${q}%`],
    );
  } else {
    result = await query('SELECT * FROM members ORDER BY member_code');
  }
  res.json(result.rows.map(mapMember));
}));

app.post('/api/members', auth, gate('members'), asyncHandler(async (req, res) => {
  const b = req.body || {};
  if (!b.firstName || !b.lastName || !b.email) {
    return res.status(400).json({ error: 'firstName, lastName, email required' });
  }
  const count = await query('SELECT COUNT(*)::int AS n FROM members');
  const n = count.rows[0].n + 1001;
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
  await query(
    `INSERT INTO members
      (id, member_code, first_name, last_name, email, phone, plan, status, joined_at, renews_at, tags, notes, sales_owner_email)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13)`,
    [
      member.id,
      member.memberCode,
      member.firstName,
      member.lastName,
      member.email,
      member.phone,
      member.plan,
      member.status,
      member.joinedAt,
      member.renewsAt,
      JSON.stringify(member.tags),
      member.notes,
      member.salesOwnerEmail,
    ],
  );
  res.status(201).json(member);
}));

app.patch('/api/members/:id', auth, gate('members'), asyncHandler(async (req, res) => {
  const cur = await query('SELECT * FROM members WHERE id = $1', [req.params.id]);
  if (!cur.rowCount) return res.status(404).json({ error: 'Not found' });
  const member = mapMember(cur.rows[0]);
  const allowed = ['firstName', 'lastName', 'email', 'phone', 'plan', 'status', 'renewsAt', 'tags', 'notes'];
  for (const key of allowed) {
    if (req.body?.[key] !== undefined) member[key] = req.body[key];
  }
  if (req.body?.status === 'active' && !member.joinedAt) member.joinedAt = nowIso();
  await query(
    `UPDATE members SET
      first_name=$2, last_name=$3, email=$4, phone=$5, plan=$6, status=$7,
      renews_at=$8, tags=$9::jsonb, notes=$10, joined_at=$11
     WHERE id=$1`,
    [
      member.id,
      member.firstName,
      member.lastName,
      member.email,
      member.phone,
      member.plan,
      member.status,
      member.renewsAt,
      JSON.stringify(member.tags || []),
      member.notes,
      member.joinedAt,
    ],
  );
  res.json(member);
}));

app.get('/api/promotions', auth, gate('promotions'), asyncHandler(async (_req, res) => {
  const { rows } = await query('SELECT * FROM promotions ORDER BY starts_at');
  res.json(
    rows.map((r) => {
      const p = mapPromo(r);
      return { ...p, currentlyActive: isPromotionActive(p) };
    }),
  );
}));

app.post('/api/promotions', auth, gate('promotions'), asyncHandler(async (req, res) => {
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
  await query(
    `INSERT INTO promotions
      (id, name, code, discount_type, discount_value, applies_to, status, starts_at, ends_at, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      promo.id,
      promo.name,
      promo.code,
      promo.discountType,
      promo.discountValue,
      promo.appliesTo,
      promo.status,
      promo.startsAt,
      promo.endsAt,
      promo.createdBy,
    ],
  );
  res.status(201).json({ ...promo, currentlyActive: isPromotionActive(promo) });
}));

app.patch('/api/promotions/:id', auth, gate('promotions'), asyncHandler(async (req, res) => {
  const cur = await query('SELECT * FROM promotions WHERE id = $1', [req.params.id]);
  if (!cur.rowCount) return res.status(404).json({ error: 'Not found' });
  const promo = mapPromo(cur.rows[0]);
  const allowed = ['name', 'status', 'startsAt', 'endsAt', 'discountType', 'discountValue', 'appliesTo'];
  for (const key of allowed) {
    if (req.body?.[key] !== undefined) promo[key] = req.body[key];
  }
  await query(
    `UPDATE promotions SET
      name=$2, status=$3, starts_at=$4, ends_at=$5, discount_type=$6, discount_value=$7, applies_to=$8
     WHERE id=$1`,
    [
      promo.id,
      promo.name,
      promo.status,
      promo.startsAt,
      promo.endsAt,
      promo.discountType,
      promo.discountValue,
      promo.appliesTo,
    ],
  );
  res.json({ ...promo, currentlyActive: isPromotionActive(promo) });
}));

app.get('/api/invoices', auth, gate('invoices'), asyncHandler(async (_req, res) => {
  const { rows } = await query(
    `SELECT i.*, row_to_json(m.*) AS member_row
     FROM invoices i
     LEFT JOIN members m ON m.id = i.member_id
     ORDER BY i.issued_at DESC`,
  );
  res.json(
    rows.map((r) => ({
      ...mapInvoice(r),
      member: mapMember(r.member_row),
    })),
  );
}));

app.post('/api/invoices', auth, gate('invoices'), asyncHandler(async (req, res) => {
  const b = req.body || {};
  if (!b.memberId || !Array.isArray(b.lines) || b.lines.length === 0) {
    return res.status(400).json({ error: 'memberId and lines required' });
  }
  const memRes = await query('SELECT * FROM members WHERE id = $1', [b.memberId]);
  if (!memRes.rowCount) return res.status(404).json({ error: 'Member not found' });
  const member = mapMember(memRes.rows[0]);

  let lines = b.lines.map((l) => ({
    description: String(l.description || 'Line'),
    qty: Number(l.qty) || 1,
    unitPrice: Number(l.unitPrice) || 0,
  }));

  let discount = 0;
  let promoCode = null;
  if (b.promoCode) {
    const promoRes = await query('SELECT * FROM promotions WHERE code = $1', [
      String(b.promoCode).toUpperCase(),
    ]);
    const promo = mapPromo(promoRes.rows[0]);
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
    if (discount > 0) {
      lines = [...lines, { description: `Promo ${promo.code}`, qty: 1, unitPrice: -discount }];
    }
  }

  const totals = computeInvoiceTotals(lines.filter((l) => l.unitPrice >= 0));
  const subtotal = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const tax = Math.round(Math.max(0, subtotal) * 0.08 * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;
  const count = await query('SELECT COUNT(*)::int AS n FROM invoices');
  const invoice = {
    id: id('inv'),
    number: `INV-2026-${String(count.rows[0].n + 1).padStart(3, '0')}`,
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
  await query(
    `INSERT INTO invoices
      (id, number, member_id, status, issued_at, due_at, lines, subtotal, tax, total, promo_code, discount)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12)`,
    [
      invoice.id,
      invoice.number,
      invoice.memberId,
      invoice.status,
      invoice.issuedAt,
      invoice.dueAt,
      JSON.stringify(invoice.lines),
      invoice.subtotal,
      invoice.tax,
      invoice.total,
      invoice.promoCode,
      invoice.discount,
    ],
  );
  res.status(201).json({ ...invoice, member, previewTotals: totals });
}));

app.get('/api/payments', auth, gate('payments'), asyncHandler(async (_req, res) => {
  const { rows } = await query(
    `SELECT p.*, row_to_json(m.*) AS member_row, row_to_json(i.*) AS invoice_row
     FROM payments p
     LEFT JOIN members m ON m.id = p.member_id
     LEFT JOIN invoices i ON i.id = p.invoice_id
     ORDER BY p.paid_at DESC`,
  );
  res.json(
    rows.map((r) => ({
      ...mapPayment(r),
      member: mapMember(r.member_row),
      invoice: mapInvoice(r.invoice_row),
    })),
  );
}));

app.post('/api/payments', auth, gate('payments'), asyncHandler(async (req, res) => {
  const b = req.body || {};
  if (!b.memberId || !b.amount) return res.status(400).json({ error: 'memberId and amount required' });
  const memRes = await query('SELECT * FROM members WHERE id = $1', [b.memberId]);
  if (!memRes.rowCount) return res.status(404).json({ error: 'Member not found' });
  const member = mapMember(memRes.rows[0]);

  let invoiceId = null;
  if (b.invoiceId) {
    const inv = await query('SELECT id FROM invoices WHERE id = $1', [b.invoiceId]);
    if (!inv.rowCount) return res.status(404).json({ error: 'Invoice not found' });
    invoiceId = b.invoiceId;
  }

  const payment = {
    id: id('pay'),
    memberId: member.id,
    invoiceId,
    amount: Number(b.amount),
    method: b.method || 'card',
    status: 'captured',
    paidAt: nowIso(),
    reference: b.reference || `ch_${Math.random().toString(36).slice(2, 10)}`,
  };

  await query(
    `INSERT INTO payments (id, member_id, invoice_id, amount, method, status, paid_at, reference)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      payment.id,
      payment.memberId,
      payment.invoiceId,
      payment.amount,
      payment.method,
      payment.status,
      payment.paidAt,
      payment.reference,
    ],
  );
  if (invoiceId) {
    await query(`UPDATE invoices SET status = 'paid' WHERE id = $1`, [invoiceId]);
  }
  if (member.status === 'lead') {
    await query(
      `UPDATE members SET status = 'active', joined_at = COALESCE(joined_at, $2) WHERE id = $1`,
      [member.id, nowIso()],
    );
  }
  res.status(201).json(payment);
}));

app.get('/api/appointments', auth, gate('appointments'), asyncHandler(async (_req, res) => {
  const { rows } = await query(
    `SELECT a.*, row_to_json(m.*) AS member_row, row_to_json(u.*) AS coach_row
     FROM appointments a
     LEFT JOIN members m ON m.id = a.member_id
     LEFT JOIN users u ON u.id = a.coach_user_id
     ORDER BY a.starts_at`,
  );
  res.json(
    rows.map((r) => ({
      ...mapAppointment(r),
      member: mapMember(r.member_row),
      coach: publicUser(mapUser(r.coach_row)),
    })),
  );
}));

app.post('/api/appointments', auth, gate('appointments'), asyncHandler(async (req, res) => {
  const b = req.body || {};
  if (!b.memberId || !b.startsAt || !b.endsAt) {
    return res.status(400).json({ error: 'memberId, startsAt, endsAt required' });
  }
  let coachUserId = b.coachUserId;
  if (!coachUserId) {
    if (req.user.role === 'fitness_coach') coachUserId = req.user.id;
    else {
      const coach = await query(
        `SELECT id FROM users WHERE role = 'fitness_coach' AND active = TRUE LIMIT 1`,
      );
      coachUserId = coach.rows[0]?.id;
    }
  }
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
  await query(
    `INSERT INTO appointments
      (id, member_id, coach_user_id, title, starts_at, ends_at, status, location, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      appointment.id,
      appointment.memberId,
      appointment.coachUserId,
      appointment.title,
      appointment.startsAt,
      appointment.endsAt,
      appointment.status,
      appointment.location,
      appointment.notes,
    ],
  );
  res.status(201).json(appointment);
}));

app.patch('/api/appointments/:id', auth, gate('appointments'), asyncHandler(async (req, res) => {
  const cur = await query('SELECT * FROM appointments WHERE id = $1', [req.params.id]);
  if (!cur.rowCount) return res.status(404).json({ error: 'Not found' });
  const apt = mapAppointment(cur.rows[0]);
  for (const key of ['title', 'startsAt', 'endsAt', 'status', 'location', 'notes', 'coachUserId']) {
    if (req.body?.[key] !== undefined) apt[key] = req.body[key];
  }
  await query(
    `UPDATE appointments SET
      title=$2, starts_at=$3, ends_at=$4, status=$5, location=$6, notes=$7, coach_user_id=$8
     WHERE id=$1`,
    [apt.id, apt.title, apt.startsAt, apt.endsAt, apt.status, apt.location, apt.notes, apt.coachUserId],
  );
  res.json(apt);
}));

app.get('/api/equipment', auth, gate('equipment'), asyncHandler(async (_req, res) => {
  const { rows } = await query('SELECT * FROM equipment ORDER BY code');
  res.json(rows.map(mapEquipment));
}));

app.post('/api/equipment', auth, gate('equipment'), asyncHandler(async (req, res) => {
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
  await query(
    `INSERT INTO equipment (id, code, name, category, status, location, last_service_at, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [row.id, row.code, row.name, row.category, row.status, row.location, row.lastServiceAt, row.notes],
  );
  res.status(201).json(row);
}));

app.patch('/api/equipment/:id', auth, gate('equipment'), asyncHandler(async (req, res) => {
  const cur = await query('SELECT * FROM equipment WHERE id = $1', [req.params.id]);
  if (!cur.rowCount) return res.status(404).json({ error: 'Not found' });
  const row = mapEquipment(cur.rows[0]);
  for (const key of ['name', 'category', 'status', 'location', 'lastServiceAt', 'notes']) {
    if (req.body?.[key] !== undefined) row[key] = req.body[key];
  }
  await query(
    `UPDATE equipment SET name=$2, category=$3, status=$4, location=$5, last_service_at=$6, notes=$7 WHERE id=$1`,
    [row.id, row.name, row.category, row.status, row.location, row.lastServiceAt, row.notes],
  );
  res.json(row);
}));

app.get('/api/activity-types', auth, gate('training'), asyncHandler(async (_req, res) => {
  const { rows } = await query('SELECT * FROM activity_types ORDER BY name');
  res.json(rows.map(mapActivity));
}));

app.get('/api/training', auth, gate('training'), asyncHandler(async (_req, res) => {
  const { rows } = await query(
    `SELECT t.*, row_to_json(m.*) AS member_row, row_to_json(u.*) AS coach_row,
            row_to_json(a.*) AS activity_row
     FROM training_sessions t
     LEFT JOIN members m ON m.id = t.member_id
     LEFT JOIN users u ON u.id = t.coach_user_id
     LEFT JOIN activity_types a ON a.id = t.activity_type_id
     ORDER BY t.started_at DESC`,
  );

  const eqAll = await query('SELECT * FROM equipment');
  const eqMap = new Map(eqAll.rows.map((e) => [e.id, mapEquipment(e)]));

  res.json(
    rows.map((r) => {
      const t = mapTraining(r);
      return {
        ...t,
        member: mapMember(r.member_row),
        coach: publicUser(mapUser(r.coach_row)),
        activityType: mapActivity(r.activity_row),
        equipment: (t.equipmentIds || []).map((eid) => eqMap.get(eid)).filter(Boolean),
      };
    }),
  );
}));

app.post('/api/training', auth, gate('training'), asyncHandler(async (req, res) => {
  const b = req.body || {};
  if (!b.memberId || !b.activityTypeId || !b.startedAt) {
    return res.status(400).json({ error: 'memberId, activityTypeId, startedAt required' });
  }
  const equipmentIds = Array.isArray(b.equipmentIds) ? b.equipmentIds : [];
  for (const eid of equipmentIds) {
    const eq = await query('SELECT * FROM equipment WHERE id = $1', [eid]);
    if (!eq.rowCount) return res.status(400).json({ error: `Unknown equipment ${eid}` });
    const mapped = mapEquipment(eq.rows[0]);
    if (mapped.status === 'maintenance') {
      return res.status(400).json({ error: `${mapped.name} is in maintenance` });
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
  await query(
    `INSERT INTO training_sessions
      (id, member_id, coach_user_id, activity_type_id, started_at, ended_at, equipment_ids, notes, calories)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)`,
    [
      session.id,
      session.memberId,
      session.coachUserId,
      session.activityTypeId,
      session.startedAt,
      session.endedAt,
      JSON.stringify(session.equipmentIds),
      session.notes,
      session.calories,
    ],
  );
  res.status(201).json(session);
}));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal error' });
});

await migrate();
await seed();

// Production: serve Team web SPA from the same Cloud Run service (isolated from Bisync).
const webDist = process.env.PULSE_WEB_DIST
  || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/dist');
if (existsSync(webDist)) {
  app.use(express.static(webDist, { index: false, fallthrough: true }));
  app.get(/^(?!\/api(?:\/|$)).*/, (req, res, next) => {
    // Missing static assets must 404 — never SPA-fallback them.
    if (/\.[a-z0-9]+$/i.test(req.path) && !req.path.endsWith('.html')) {
      return res.status(404).send('Not found');
    }
    res.sendFile(path.join(webDist, 'index.html'), (err) => (err ? next(err) : undefined));
  });
  console.log(`Serving Pulse web from ${webDist}`);
}

const listenPort = Number(process.env.PORT || process.env.PULSE_API_PORT || 5400);
app.listen(listenPort, () => {
  console.log(`Pulse API listening on http://localhost:${listenPort} (PostgreSQL)`);
});
