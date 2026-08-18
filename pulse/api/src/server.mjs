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
  ALL_MODULES,
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
  mapProduct,
  loadUserMemberships,
  isCompanyWideRole,
  resolveRoleAccess,
  listRolesForCompany,
  createCompanyRole,
} from './db.mjs';
import { seed } from './seed.mjs';
import { mountMobileRoutes } from './mobile-routes.mjs';

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));
mountMobileRoutes(app);

function publicUser(u, extras = {}) {
  if (!u) return null;
  const { password, ...rest } = u;
  return {
    ...rest,
    roleLabel: ROLE_LABELS[u.role] ?? String(u.role || '').replace(/_/g, ' '),
    modules: ROLE_MODULES[u.role] ?? [],
    ...extras,
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
    req.sessionToken = token;
    req.sessionRow = session.rows[0];
    next();
  } catch (err) {
    next(err);
  }
}

/** Resolve company (+ optional location) from headers / session sticky context. */
async function tenant(req, res, next) {
  try {
    const memberships = await loadUserMemberships(req.user.id);
    if (!memberships.length) {
      return res.status(403).json({ error: 'No company membership' });
    }
    req.memberships = memberships;

    const headerCompany =
      req.headers['x-pulse-company-id'] ||
      req.headers['x-company-id'] ||
      req.sessionRow?.company_id ||
      memberships[0].companyId;
    const membership = memberships.find((m) => m.companyId === headerCompany);
    if (!membership) {
      return res.status(403).json({ error: 'Not a member of that company' });
    }

    const rawLocation =
      req.headers['x-pulse-location-id'] ||
      req.headers['x-location-id'] ||
      req.sessionRow?.location_id ||
      '';
    const locationId = rawLocation && rawLocation !== 'all' ? String(rawLocation) : null;

    if (locationId) {
      const allowed = membership.locations.some((l) => l.id === locationId);
      if (!allowed) {
        return res.status(403).json({ error: 'No access to that location' });
      }
    }

    // Sticky context on session
    await query(
      `UPDATE sessions SET company_id = $2, location_id = $3 WHERE token = $1`,
      [req.sessionToken, membership.companyId, locationId],
    );

    req.user = {
      ...req.user,
      role: membership.role,
      modules: membership.modules || (await resolveRoleAccess(membership.role, membership.companyId)).modules,
    };
    req.tenant = {
      companyId: membership.companyId,
      locationId,
      role: membership.role,
      membership,
      companyWide: Boolean(membership.companyWide),
    };
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

/** Allow either payments or invoices module (billing merged into Payments UI). */
function gateBilling(req, res, next) {
  if (requireRole(req.user, ['payments']) || requireRole(req.user, ['invoices'])) {
    return next();
  }
  return res.status(403).json({ error: 'Requires access to: payments' });
}

function companyFilter(alias = '') {
  const prefix = alias ? `${alias}.` : '';
  return `${prefix}company_id = $1`;
}

function locationAnd(alias = '', startIdx = 2) {
  return {
    sql: (hasLoc) => (hasLoc ? ` AND ${alias ? `${alias}.` : ''}location_id = $${startIdx}` : ''),
    params: (companyId, locationId) => (locationId ? [companyId, locationId] : [companyId]),
  };
}

app.get('/api/health', asyncHandler(async (_req, res) => {
  await query('SELECT 1');
  res.json({ ok: true, service: 'pulse-api', db: 'postgres', multiTenant: true, time: nowIso() });
}));

app.get('/api/meta', asyncHandler(async (req, res) => {
  const companyId = req.headers['x-pulse-company-id'] || null;
  const meta = await getMeta(companyId);
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
  const memberships = await loadUserMemberships(user.id);
  if (!memberships.length) {
    return res.status(403).json({ error: 'User has no company membership' });
  }

  const preferredCompany = req.body?.companyId;
  const membership =
    memberships.find((m) => m.companyId === preferredCompany) || memberships[0];
  const preferredLocation = req.body?.locationId;
  const locationId =
    preferredLocation && membership.locations.some((l) => l.id === preferredLocation)
      ? preferredLocation
      : membership.locations[0]?.id || null;

  const token = id('tok');
  await query(
    'INSERT INTO sessions (token, user_id, company_id, location_id, created_at) VALUES ($1,$2,$3,$4,$5)',
    [token, user.id, membership.companyId, locationId, nowIso()],
  );
  await query(`
    DELETE FROM sessions WHERE token IN (
      SELECT token FROM sessions ORDER BY created_at DESC OFFSET 40
    )
  `);

  const access = await resolveRoleAccess(membership.role, membership.companyId);
  const scopedUser = publicUser(
    { ...user, role: membership.role },
    { memberships, modules: access.modules, roleLabel: access.label },
  );
  res.json({
    token,
    user: scopedUser,
    memberships,
    defaultCompanyId: membership.companyId,
    defaultLocationId: locationId,
  });
}));

app.post('/api/auth/logout', auth, asyncHandler(async (req, res) => {
  await query('DELETE FROM sessions WHERE token = $1', [req.sessionToken]);
  res.json({ ok: true });
}));

app.get('/api/auth/me', auth, asyncHandler(async (req, res) => {
  const memberships = await loadUserMemberships(req.user.id);
  const companyId = req.headers['x-pulse-company-id'] || req.sessionRow?.company_id || memberships[0]?.companyId;
  const membership = memberships.find((m) => m.companyId === companyId) || memberships[0];
  const role = membership?.role || req.user.role;
  const access = await resolveRoleAccess(role, membership?.companyId || null);
  res.json({
    user: publicUser(
      { ...req.user, role },
      { memberships, modules: access.modules, roleLabel: access.label },
    ),
    memberships,
    defaultCompanyId: membership?.companyId || null,
    defaultLocationId: req.sessionRow?.location_id || membership?.locations?.[0]?.id || null,
    meta: await getMeta(membership?.companyId),
  });
}));

app.get('/api/tenants', auth, asyncHandler(async (req, res) => {
  const memberships = await loadUserMemberships(req.user.id);
  res.json({ memberships });
}));

app.get('/api/companies', auth, tenant, gate('team'), asyncHandler(async (req, res) => {
  // Admin/management of current company can list only companies they belong to.
  const memberships = req.memberships;
  res.json(memberships.map((m) => ({
    id: m.companyId,
    code: m.companyCode,
    name: m.companyName,
    role: m.role,
    locations: m.locations,
  })));
}));

app.get('/api/locations', auth, tenant, asyncHandler(async (req, res) => {
  res.json(req.tenant.membership.locations);
}));

app.get('/api/dashboard', auth, tenant, gate('dashboard'), asyncHandler(async (req, res) => {
  const { companyId, locationId } = req.tenant;
  const loc = locationAnd('m');
  const locA = locationAnd('a');
  const locE = locationAnd('e');
  const locT = locationAnd('t');
  const p = loc.params(companyId, locationId);

  const [active, leads, openInv, captured, upcoming, equipmentDown, trainingCount] =
    await Promise.all([
      query(
        `SELECT COUNT(*)::int AS n FROM members m
         WHERE ${companyFilter('m')}${locationId ? ' AND m.home_location_id = $2' : ''} AND m.status = 'active'`,
        p,
      ),
      query(
        `SELECT COUNT(*)::int AS n FROM members m
         WHERE ${companyFilter('m')}${locationId ? ' AND m.home_location_id = $2' : ''} AND m.status = 'lead'`,
        p,
      ),
      query(
        `SELECT COUNT(*)::int AS n, COALESCE(SUM(total),0)::float AS total
         FROM invoices WHERE company_id = $1 AND status = 'open'`,
        [companyId],
      ),
      query(
        `SELECT COALESCE(SUM(amount),0)::float AS total FROM payments
         WHERE company_id = $1 AND status = 'captured'`,
        [companyId],
      ),
      query(
        `SELECT * FROM appointments a
         WHERE ${companyFilter('a')}${locA.sql(!!locationId)}
           AND status = 'scheduled' AND starts_at >= NOW()
         ORDER BY starts_at ASC LIMIT 5`,
        locA.params(companyId, locationId),
      ),
      query(
        `SELECT * FROM equipment e
         WHERE ${companyFilter('e')}${locE.sql(!!locationId)} AND status <> 'available'
         ORDER BY code`,
        locE.params(companyId, locationId),
      ),
      query(
        `SELECT COUNT(*)::int AS n FROM training_sessions t
         WHERE ${companyFilter('t')}${locT.sql(!!locationId)}`,
        locT.params(companyId, locationId),
      ),
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
    tenant: { companyId, locationId },
  });
}));

app.get('/api/team', auth, tenant, gate('team'), asyncHandler(async (req, res) => {
  const companyId = req.tenant.companyId;
  const { rows } = await query(
    `SELECT u.*, m.role AS membership_role
     FROM users u
     JOIN user_company_memberships m ON m.user_id = u.id
     WHERE m.company_id = $1
     ORDER BY u.created_at`,
    [companyId],
  );
  const locRes = await query(
    `SELECT id, code, name, address, active
     FROM locations
     WHERE company_id = $1 AND active = TRUE
     ORDER BY name`,
    [companyId],
  );
  const locations = locRes.rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    address: r.address || '',
    active: r.active,
  }));

  const teammates = [];
  for (const r of rows) {
    const role = r.membership_role;
    const access = await resolveRoleAccess(role, companyId);
    const companyWide = access.companyWide;
    let locationIds = [];
    if (!companyWide) {
      const accessLocs = await query(
        `SELECT ula.location_id
         FROM user_location_access ula
         JOIN locations l ON l.id = ula.location_id
         WHERE ula.user_id = $1 AND l.company_id = $2 AND l.active = TRUE
         ORDER BY l.name`,
        [r.id, companyId],
      );
      locationIds = accessLocs.rows.map((a) => a.location_id);
    } else {
      locationIds = locations.map((l) => l.id);
    }
    const pub = publicUser(
      { ...mapUser(r), role },
      { modules: access.modules, roleLabel: access.label },
    );
    teammates.push({
      ...pub,
      locationIds,
      locations: locations.filter((l) => locationIds.includes(l.id)),
      companyWide,
    });
  }

  const roles = await listRolesForCompany(companyId, {
    includeSuperuser: req.user.role === 'superuser',
  });
  res.json({ teammates, locations, roles, allModules: ALL_MODULES });
}));

app.get('/api/team/:id', auth, tenant, gate('team'), asyncHandler(async (req, res) => {
  const companyId = req.tenant.companyId;
  const { rows } = await query(
    `SELECT u.*, m.role AS membership_role
     FROM users u
     JOIN user_company_memberships m ON m.user_id = u.id
     WHERE u.id = $1 AND m.company_id = $2`,
    [req.params.id, companyId],
  );
  if (!rows.length) return res.status(404).json({ error: 'Teammate not found' });
  const r = rows[0];
  const role = r.membership_role;
  const access = await resolveRoleAccess(role, companyId);
  const companyWide = access.companyWide;
  const locRes = await query(
    `SELECT id, code, name FROM locations WHERE company_id = $1 AND active = TRUE ORDER BY name`,
    [companyId],
  );
  let locationIds = locRes.rows.map((l) => l.id);
  if (!companyWide) {
    const accessLocs = await query(
      `SELECT ula.location_id
       FROM user_location_access ula
       JOIN locations l ON l.id = ula.location_id
       WHERE ula.user_id = $1 AND l.company_id = $2`,
      [r.id, companyId],
    );
    locationIds = accessLocs.rows.map((a) => a.location_id);
  }
  res.json({
    ...publicUser({ ...mapUser(r), role }, { modules: access.modules, roleLabel: access.label }),
    locationIds,
    companyWide,
    modules: access.modules,
  });
}));

app.patch('/api/team/:id', auth, tenant, gate('team'), asyncHandler(async (req, res) => {
  const companyId = req.tenant.companyId;
  const userId = req.params.id;
  const b = req.body || {};

  const existing = await query(
    `SELECT u.*, m.role AS membership_role
     FROM users u
     JOIN user_company_memberships m ON m.user_id = u.id
     WHERE u.id = $1 AND m.company_id = $2`,
    [userId, companyId],
  );
  if (!existing.rowCount) return res.status(404).json({ error: 'Teammate not found' });
  const current = existing.rows[0];
  if (current.membership_role === 'superuser' && req.user.role !== 'superuser') {
    return res.status(403).json({ error: 'Only a superuser can edit a superuser' });
  }

  const name = b.name != null ? String(b.name).trim() : current.name;
  const email = b.email != null ? String(b.email).trim().toLowerCase() : current.email;
  const role = b.role != null ? String(b.role) : current.membership_role;
  const active = b.active != null ? Boolean(b.active) : current.active;
  const password = b.password != null && String(b.password).trim() ? String(b.password) : null;

  if (!name || !email) return res.status(400).json({ error: 'name and email required' });
  if (role === 'superuser' && req.user.role !== 'superuser') {
    return res.status(403).json({ error: 'Only a superuser can assign the superuser role' });
  }
  const access = await resolveRoleAccess(role, companyId);
  if (!ROLE_MODULES[role] && !access.builtin && !(await roleCodeExists(companyId, role))) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  const emailClash = await query(
    `SELECT id FROM users WHERE lower(email) = $1 AND id <> $2`,
    [email, userId],
  );
  if (emailClash.rowCount) return res.status(409).json({ error: 'Email already in use' });

  if (password) {
    await query(
      `UPDATE users SET name = $2, email = $3, role = $4, active = $5, password = $6 WHERE id = $1`,
      [userId, name, email, role, active, password],
    );
  } else {
    await query(
      `UPDATE users SET name = $2, email = $3, role = $4, active = $5 WHERE id = $1`,
      [userId, name, email, role, active],
    );
  }

  await query(
    `UPDATE user_company_memberships SET role = $3 WHERE user_id = $1 AND company_id = $2`,
    [userId, companyId, role],
  );

  // Refresh location access for this company.
  await query(
    `DELETE FROM user_location_access ula
     USING locations l
     WHERE ula.location_id = l.id AND ula.user_id = $1 AND l.company_id = $2`,
    [userId, companyId],
  );

  const companyWide = access.companyWide;
  let locationIds = Array.isArray(b.locationIds) ? b.locationIds.map(String) : [];
  if (!companyWide) {
    if (!locationIds.length) {
      return res.status(400).json({ error: 'Select at least one location for this role' });
    }
    for (const lid of locationIds) {
      const ok = await query(
        `SELECT id FROM locations WHERE id = $1 AND company_id = $2 AND active = TRUE`,
        [lid, companyId],
      );
      if (!ok.rowCount) continue;
      await query(
        `INSERT INTO user_location_access (user_id, location_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [userId, lid],
      );
    }
  }

  const updated = await query('SELECT * FROM users WHERE id = $1', [userId]);
  res.json({
    ...publicUser(
      { ...mapUser(updated.rows[0]), role },
      { modules: access.modules, roleLabel: access.label },
    ),
    locationIds: companyWide
      ? (
          await query(`SELECT id FROM locations WHERE company_id = $1 AND active = TRUE`, [companyId])
        ).rows.map((r) => r.id)
      : locationIds,
    companyWide,
  });
}));

app.post('/api/team', auth, tenant, gate('team'), asyncHandler(async (req, res) => {
  const { name, email, role, password, locationIds } = req.body || {};
  if (!name || !email || !role) return res.status(400).json({ error: 'name, email, role required' });
  if (role === 'superuser' && req.user.role !== 'superuser') {
    return res.status(403).json({ error: 'Only a superuser can assign the superuser role' });
  }
  const access = await resolveRoleAccess(role, req.tenant.companyId);
  if (!ROLE_MODULES[role] && !(await roleCodeExists(req.tenant.companyId, role))) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  if (!access.companyWide) {
    const ids = Array.isArray(locationIds) ? locationIds : [];
    if (!ids.length) {
      return res.status(400).json({ error: 'Select at least one location for location-scoped roles' });
    }
  }
  const exists = await query('SELECT * FROM users WHERE lower(email) = $1', [
    String(email).toLowerCase(),
  ]);
  let userId;
  if (exists.rowCount) {
    userId = exists.rows[0].id;
    await query(
      `UPDATE users SET name = $2, role = $3, active = TRUE WHERE id = $1`,
      [userId, String(name).trim(), role],
    );
  } else {
    userId = id('usr');
    await query(
      `INSERT INTO users (id, name, email, role, password, active, created_at)
       VALUES ($1,$2,$3,$4,$5,TRUE,$6)`,
      [
        userId,
        String(name).trim(),
        String(email).trim().toLowerCase(),
        role,
        password || 'pulse123',
        nowIso(),
      ],
    );
  }
  await query(
    `INSERT INTO user_company_memberships (user_id, company_id, role)
     VALUES ($1,$2,$3)
     ON CONFLICT (user_id, company_id) DO UPDATE SET role = EXCLUDED.role`,
    [userId, req.tenant.companyId, role],
  );

  // Reset then apply location access for location-scoped roles.
  await query(
    `DELETE FROM user_location_access ula
     USING locations l
     WHERE ula.location_id = l.id AND ula.user_id = $1 AND l.company_id = $2`,
    [userId, req.tenant.companyId],
  );
  if (!access.companyWide && Array.isArray(locationIds)) {
    for (const lid of locationIds) {
      const ok = await query(
        `SELECT id FROM locations WHERE id = $1 AND company_id = $2 AND active = TRUE`,
        [lid, req.tenant.companyId],
      );
      if (!ok.rowCount) continue;
      await query(
        `INSERT INTO user_location_access (user_id, location_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [userId, lid],
      );
    }
  }
  const user = mapUser(
    (await query('SELECT * FROM users WHERE id = $1', [userId])).rows[0],
  );
  res.status(201).json(
    publicUser({ ...user, role }, { modules: access.modules, roleLabel: access.label }),
  );
}));

async function roleCodeExists(companyId, role) {
  if (ROLE_MODULES[role]) return true;
  const r = await query(
    `SELECT 1 FROM company_roles WHERE company_id = $1 AND code = $2 AND active = TRUE`,
    [companyId, role],
  );
  return r.rowCount > 0;
}

app.get('/api/roles', auth, tenant, gate('team'), asyncHandler(async (req, res) => {
  const roles = await listRolesForCompany(req.tenant.companyId, {
    includeSuperuser: req.user.role === 'superuser',
  });
  res.json({ roles, allModules: ALL_MODULES });
}));

app.post('/api/roles', auth, tenant, gate('team'), asyncHandler(async (req, res) => {
  const b = req.body || {};
  try {
    const role = await createCompanyRole(req.tenant.companyId, {
      label: b.label || b.name,
      modules: b.modules,
      companyWide: Boolean(b.companyWide),
    });
    res.status(201).json(role);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    throw err;
  }
}));

app.get('/api/members', auth, tenant, gate('members'), asyncHandler(async (req, res) => {
  const { companyId, locationId } = req.tenant;
  const q = String(req.query.q || '').trim().toLowerCase();
  const params = locationId ? [companyId, locationId] : [companyId];
  const locSql = locationId ? ' AND home_location_id = $2' : '';
  let result;
  if (q) {
    const qi = params.length + 1;
    params.push(`%${q}%`);
    result = await query(
      `SELECT * FROM members
       WHERE company_id = $1${locSql}
         AND lower(first_name || ' ' || last_name || ' ' || email || ' ' || member_code) LIKE $${qi}
       ORDER BY member_code`,
      params,
    );
  } else {
    result = await query(
      `SELECT * FROM members WHERE company_id = $1${locSql} ORDER BY member_code`,
      params,
    );
  }
  res.json(result.rows.map(mapMember));
}));

app.post('/api/members', auth, tenant, gate('members'), asyncHandler(async (req, res) => {
  const b = req.body || {};
  if (!b.firstName || !b.lastName || !b.email) {
    return res.status(400).json({ error: 'firstName, lastName, email required' });
  }
  const { companyId, locationId, membership } = req.tenant;
  const homeLocationId =
    b.homeLocationId ||
    locationId ||
    membership.locations[0]?.id ||
    null;
  if (homeLocationId && !membership.locations.some((l) => l.id === homeLocationId)) {
    return res.status(403).json({ error: 'Invalid home location' });
  }
  const count = await query('SELECT COUNT(*)::int AS n FROM members WHERE company_id = $1', [
    companyId,
  ]);
  const n = count.rows[0].n + 1001;
  const codePrefix = membership.companyCode?.slice(0, 3) || 'PLS';
  const member = {
    id: id('mem'),
    companyId,
    homeLocationId,
    memberCode: `${codePrefix}-${n}`,
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
      (id, company_id, home_location_id, member_code, first_name, last_name, email, phone, plan, status, joined_at, renews_at, tags, notes, sales_owner_email)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15)`,
    [
      member.id,
      member.companyId,
      member.homeLocationId,
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

app.patch('/api/members/:id', auth, tenant, gate('members'), asyncHandler(async (req, res) => {
  const cur = await query('SELECT * FROM members WHERE id = $1 AND company_id = $2', [
    req.params.id,
    req.tenant.companyId,
  ]);
  if (!cur.rowCount) return res.status(404).json({ error: 'Not found' });
  const member = mapMember(cur.rows[0]);
  const allowed = [
    'firstName',
    'lastName',
    'email',
    'phone',
    'plan',
    'status',
    'renewsAt',
    'tags',
    'notes',
    'homeLocationId',
  ];
  for (const key of allowed) {
    if (req.body?.[key] !== undefined) member[key] = req.body[key];
  }
  if (member.homeLocationId) {
    const ok = req.tenant.membership.locations.some((l) => l.id === member.homeLocationId);
    if (!ok) return res.status(403).json({ error: 'Invalid home location' });
  }
  if (req.body?.status === 'active' && !member.joinedAt) member.joinedAt = nowIso();
  await query(
    `UPDATE members SET
      first_name=$2, last_name=$3, email=$4, phone=$5, plan=$6, status=$7,
      renews_at=$8, tags=$9::jsonb, notes=$10, joined_at=$11, home_location_id=$12
     WHERE id=$1 AND company_id=$13`,
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
      member.homeLocationId,
      req.tenant.companyId,
    ],
  );
  res.json(member);
}));

app.get('/api/promotions', auth, tenant, gate('promotions'), asyncHandler(async (req, res) => {
  const { rows } = await query(
    'SELECT * FROM promotions WHERE company_id = $1 ORDER BY starts_at',
    [req.tenant.companyId],
  );
  res.json(
    rows.map((r) => {
      const p = mapPromo(r);
      return { ...p, currentlyActive: isPromotionActive(p) };
    }),
  );
}));

app.post('/api/promotions', auth, tenant, gate('promotions'), asyncHandler(async (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.code || !b.startsAt || !b.endsAt) {
    return res.status(400).json({ error: 'name, code, startsAt, endsAt required' });
  }
  const promo = {
    id: id('prm'),
    companyId: req.tenant.companyId,
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
      (id, company_id, name, code, discount_type, discount_value, applies_to, status, starts_at, ends_at, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      promo.id,
      promo.companyId,
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

app.patch('/api/promotions/:id', auth, tenant, gate('promotions'), asyncHandler(async (req, res) => {
  const cur = await query('SELECT * FROM promotions WHERE id = $1 AND company_id = $2', [
    req.params.id,
    req.tenant.companyId,
  ]);
  if (!cur.rowCount) return res.status(404).json({ error: 'Not found' });
  const promo = mapPromo(cur.rows[0]);
  const allowed = ['name', 'status', 'startsAt', 'endsAt', 'discountType', 'discountValue', 'appliesTo'];
  for (const key of allowed) {
    if (req.body?.[key] !== undefined) promo[key] = req.body[key];
  }
  await query(
    `UPDATE promotions SET
      name=$2, status=$3, starts_at=$4, ends_at=$5, discount_type=$6, discount_value=$7, applies_to=$8
     WHERE id=$1 AND company_id=$9`,
    [
      promo.id,
      promo.name,
      promo.status,
      promo.startsAt,
      promo.endsAt,
      promo.discountType,
      promo.discountValue,
      promo.appliesTo,
      req.tenant.companyId,
    ],
  );
  res.json({ ...promo, currentlyActive: isPromotionActive(promo) });
}));

app.get('/api/invoices', auth, tenant, gateBilling, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT i.*, row_to_json(m.*) AS member_row
     FROM invoices i
     LEFT JOIN members m ON m.id = i.member_id
     WHERE i.company_id = $1
     ORDER BY i.issued_at DESC`,
    [req.tenant.companyId],
  );
  res.json(
    rows.map((r) => ({
      ...mapInvoice(r),
      member: mapMember(r.member_row),
    })),
  );
}));

app.post('/api/invoices', auth, tenant, gateBilling, asyncHandler(async (req, res) => {
  const b = req.body || {};
  if (!b.memberId || !Array.isArray(b.lines) || b.lines.length === 0) {
    return res.status(400).json({ error: 'memberId and lines required' });
  }
  const memRes = await query('SELECT * FROM members WHERE id = $1 AND company_id = $2', [
    b.memberId,
    req.tenant.companyId,
  ]);
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
    const promoRes = await query(
      'SELECT * FROM promotions WHERE code = $1 AND company_id = $2',
      [String(b.promoCode).toUpperCase(), req.tenant.companyId],
    );
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
  const count = await query('SELECT COUNT(*)::int AS n FROM invoices WHERE company_id = $1', [
    req.tenant.companyId,
  ]);
  const invoice = {
    id: id('inv'),
    companyId: req.tenant.companyId,
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
      (id, company_id, number, member_id, status, issued_at, due_at, lines, subtotal, tax, total, promo_code, discount)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13)`,
    [
      invoice.id,
      invoice.companyId,
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

app.get('/api/payments', auth, tenant, gate('payments'), asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT p.*, row_to_json(m.*) AS member_row, row_to_json(i.*) AS invoice_row
     FROM payments p
     LEFT JOIN members m ON m.id = p.member_id
     LEFT JOIN invoices i ON i.id = p.invoice_id
     WHERE p.company_id = $1
     ORDER BY p.paid_at DESC`,
    [req.tenant.companyId],
  );
  res.json(
    rows.map((r) => ({
      ...mapPayment(r),
      member: mapMember(r.member_row),
      invoice: mapInvoice(r.invoice_row),
    })),
  );
}));

app.post('/api/payments', auth, tenant, gate('payments'), asyncHandler(async (req, res) => {
  const b = req.body || {};
  if (!b.memberId || !b.amount) return res.status(400).json({ error: 'memberId and amount required' });
  const memRes = await query('SELECT * FROM members WHERE id = $1 AND company_id = $2', [
    b.memberId,
    req.tenant.companyId,
  ]);
  if (!memRes.rowCount) return res.status(404).json({ error: 'Member not found' });
  const member = mapMember(memRes.rows[0]);

  let invoiceId = null;
  if (b.invoiceId) {
    const inv = await query('SELECT id FROM invoices WHERE id = $1 AND company_id = $2', [
      b.invoiceId,
      req.tenant.companyId,
    ]);
    if (!inv.rowCount) return res.status(404).json({ error: 'Invoice not found' });
    invoiceId = b.invoiceId;
  }

  const payment = {
    id: id('pay'),
    companyId: req.tenant.companyId,
    memberId: member.id,
    invoiceId,
    amount: Number(b.amount),
    method: b.method || 'card',
    status: 'captured',
    paidAt: nowIso(),
    reference: b.reference || `ch_${Math.random().toString(36).slice(2, 10)}`,
  };

  await query(
    `INSERT INTO payments (id, company_id, member_id, invoice_id, amount, method, status, paid_at, reference)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      payment.id,
      payment.companyId,
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
    await query(`UPDATE invoices SET status = 'paid' WHERE id = $1 AND company_id = $2`, [
      invoiceId,
      req.tenant.companyId,
    ]);
  } else {
    // Every captured payment gets a receipt invoice so ledger can offer Invoice actions.
    const count = await query('SELECT COUNT(*)::int AS n FROM invoices WHERE company_id = $1', [
      req.tenant.companyId,
    ]);
    const lines = [
      {
        description: String(b.description || `Payment (${payment.method})`),
        qty: 1,
        unitPrice: payment.amount,
      },
    ];
    const subtotal = payment.amount;
    const tax = 0;
    const total = payment.amount;
    invoiceId = id('inv');
    const invoiceNumber = `INV-2026-${String(count.rows[0].n + 1).padStart(3, '0')}`;
    await query(
      `INSERT INTO invoices
        (id, company_id, number, member_id, status, issued_at, due_at, lines, subtotal, tax, total, promo_code, discount)
       VALUES ($1,$2,$3,$4,'paid',$5,$5,$6::jsonb,$7,$8,$9,NULL,0)`,
      [
        invoiceId,
        req.tenant.companyId,
        invoiceNumber,
        member.id,
        payment.paidAt,
        JSON.stringify(lines),
        subtotal,
        tax,
        total,
      ],
    );
    await query(`UPDATE payments SET invoice_id = $2 WHERE id = $1`, [payment.id, invoiceId]);
    payment.invoiceId = invoiceId;
  }
  if (member.status === 'lead') {
    await query(
      `UPDATE members SET status = 'active', joined_at = COALESCE(joined_at, $2) WHERE id = $1 AND company_id = $3`,
      [member.id, nowIso(), req.tenant.companyId],
    );
  }
  let invoice = null;
  if (payment.invoiceId) {
    const invRes = await query(`SELECT * FROM invoices WHERE id = $1`, [payment.invoiceId]);
    invoice = mapInvoice(invRes.rows[0]);
  }
  res.status(201).json({ ...payment, member, invoice });
}));

app.get('/api/appointments', auth, tenant, gate('appointments'), asyncHandler(async (req, res) => {
  const { companyId, locationId } = req.tenant;
  const loc = locationAnd('a');
  const { rows } = await query(
    `SELECT a.*, row_to_json(m.*) AS member_row, row_to_json(u.*) AS coach_row
     FROM appointments a
     LEFT JOIN members m ON m.id = a.member_id
     LEFT JOIN users u ON u.id = a.coach_user_id
     WHERE ${companyFilter('a')}${loc.sql(!!locationId)}
     ORDER BY a.starts_at`,
    loc.params(companyId, locationId),
  );
  res.json(
    rows.map((r) => ({
      ...mapAppointment(r),
      member: mapMember(r.member_row),
      coach: publicUser(mapUser(r.coach_row)),
    })),
  );
}));

app.post('/api/appointments', auth, tenant, gate('appointments'), asyncHandler(async (req, res) => {
  const b = req.body || {};
  if (!b.memberId || !b.startsAt || !b.endsAt) {
    return res.status(400).json({ error: 'memberId, startsAt, endsAt required' });
  }
  const mem = await query('SELECT id FROM members WHERE id = $1 AND company_id = $2', [
    b.memberId,
    req.tenant.companyId,
  ]);
  if (!mem.rowCount) return res.status(404).json({ error: 'Member not found' });

  let coachUserId = b.coachUserId;
  if (!coachUserId) {
    if (req.user.role === 'fitness_coach') coachUserId = req.user.id;
    else {
      const coach = await query(
        `SELECT u.id FROM users u
         JOIN user_company_memberships m ON m.user_id = u.id
         WHERE m.company_id = $1 AND m.role = 'fitness_coach' AND u.active = TRUE
         LIMIT 1`,
        [req.tenant.companyId],
      );
      coachUserId = coach.rows[0]?.id;
    }
  }
  if (!coachUserId) return res.status(400).json({ error: 'No coach available' });

  const locationId =
    b.locationId || req.tenant.locationId || req.tenant.membership.locations[0]?.id;
  if (!locationId || !req.tenant.membership.locations.some((l) => l.id === locationId)) {
    return res.status(400).json({ error: 'Valid locationId required' });
  }

  const appointment = {
    id: id('apt'),
    companyId: req.tenant.companyId,
    locationId,
    memberId: b.memberId,
    coachUserId,
    title: String(b.title || 'Trainer session'),
    startsAt: b.startsAt,
    endsAt: b.endsAt,
    status: 'scheduled',
    area: String(b.area || b.location || ''),
    notes: String(b.notes || ''),
  };
  await query(
    `INSERT INTO appointments
      (id, company_id, location_id, member_id, coach_user_id, title, starts_at, ends_at, status, area, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      appointment.id,
      appointment.companyId,
      appointment.locationId,
      appointment.memberId,
      appointment.coachUserId,
      appointment.title,
      appointment.startsAt,
      appointment.endsAt,
      appointment.status,
      appointment.area,
      appointment.notes,
    ],
  );
  res.status(201).json(appointment);
}));

app.patch('/api/appointments/:id', auth, tenant, gate('appointments'), asyncHandler(async (req, res) => {
  const cur = await query('SELECT * FROM appointments WHERE id = $1 AND company_id = $2', [
    req.params.id,
    req.tenant.companyId,
  ]);
  if (!cur.rowCount) return res.status(404).json({ error: 'Not found' });
  const apt = mapAppointment(cur.rows[0]);
  for (const key of ['title', 'startsAt', 'endsAt', 'status', 'area', 'location', 'notes', 'coachUserId', 'locationId']) {
    if (req.body?.[key] !== undefined) {
      if (key === 'location') apt.area = req.body[key];
      else apt[key] = req.body[key];
    }
  }
  await query(
    `UPDATE appointments SET
      title=$2, starts_at=$3, ends_at=$4, status=$5, area=$6, notes=$7, coach_user_id=$8, location_id=$9
     WHERE id=$1 AND company_id=$10`,
    [
      apt.id,
      apt.title,
      apt.startsAt,
      apt.endsAt,
      apt.status,
      apt.area,
      apt.notes,
      apt.coachUserId,
      apt.locationId,
      req.tenant.companyId,
    ],
  );
  res.json(apt);
}));

app.get('/api/equipment', auth, tenant, gate('equipment'), asyncHandler(async (req, res) => {
  const { companyId, locationId } = req.tenant;
  const loc = locationAnd();
  const { rows } = await query(
    `SELECT * FROM equipment WHERE ${companyFilter()}${loc.sql(!!locationId)} ORDER BY code`,
    loc.params(companyId, locationId),
  );
  res.json(rows.map(mapEquipment));
}));

app.post('/api/equipment', auth, tenant, gate('equipment'), asyncHandler(async (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.code) return res.status(400).json({ error: 'name and code required' });
  const locationId =
    b.locationId || req.tenant.locationId || req.tenant.membership.locations[0]?.id;
  if (!locationId || !req.tenant.membership.locations.some((l) => l.id === locationId)) {
    return res.status(400).json({ error: 'Valid locationId required' });
  }
  const row = {
    id: id('eq'),
    companyId: req.tenant.companyId,
    locationId,
    code: String(b.code).trim().toUpperCase(),
    name: String(b.name).trim(),
    category: b.category || 'General',
    status: b.status || 'available',
    area: b.area || b.location || '',
    lastServiceAt: b.lastServiceAt || nowIso(),
    notes: String(b.notes || ''),
  };
  await query(
    `INSERT INTO equipment (id, company_id, location_id, code, name, category, status, area, last_service_at, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      row.id,
      row.companyId,
      row.locationId,
      row.code,
      row.name,
      row.category,
      row.status,
      row.area,
      row.lastServiceAt,
      row.notes,
    ],
  );
  res.status(201).json(row);
}));

app.patch('/api/equipment/:id', auth, tenant, gate('equipment'), asyncHandler(async (req, res) => {
  const cur = await query('SELECT * FROM equipment WHERE id = $1 AND company_id = $2', [
    req.params.id,
    req.tenant.companyId,
  ]);
  if (!cur.rowCount) return res.status(404).json({ error: 'Not found' });
  const row = mapEquipment(cur.rows[0]);
  for (const key of ['name', 'category', 'status', 'area', 'location', 'lastServiceAt', 'notes', 'locationId']) {
    if (req.body?.[key] !== undefined) {
      if (key === 'location') row.area = req.body[key];
      else row[key] = req.body[key];
    }
  }
  await query(
    `UPDATE equipment SET name=$2, category=$3, status=$4, area=$5, last_service_at=$6, notes=$7, location_id=$8
     WHERE id=$1 AND company_id=$9`,
    [
      row.id,
      row.name,
      row.category,
      row.status,
      row.area,
      row.lastServiceAt,
      row.notes,
      row.locationId,
      req.tenant.companyId,
    ],
  );
  res.json(row);
}));

app.get('/api/activity-types', auth, tenant, gate('training'), asyncHandler(async (req, res) => {
  const { rows } = await query(
    'SELECT * FROM activity_types WHERE company_id = $1 ORDER BY name',
    [req.tenant.companyId],
  );
  res.json(rows.map(mapActivity));
}));

app.get('/api/training', auth, tenant, gate('training'), asyncHandler(async (req, res) => {
  const { companyId, locationId } = req.tenant;
  const loc = locationAnd('t');
  const { rows } = await query(
    `SELECT t.*, row_to_json(m.*) AS member_row, row_to_json(u.*) AS coach_row,
            row_to_json(a.*) AS activity_row
     FROM training_sessions t
     LEFT JOIN members m ON m.id = t.member_id
     LEFT JOIN users u ON u.id = t.coach_user_id
     LEFT JOIN activity_types a ON a.id = t.activity_type_id
     WHERE ${companyFilter('t')}${loc.sql(!!locationId)}
     ORDER BY t.started_at DESC`,
    loc.params(companyId, locationId),
  );

  const eqAll = await query('SELECT * FROM equipment WHERE company_id = $1', [companyId]);
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

app.post('/api/training', auth, tenant, gate('training'), asyncHandler(async (req, res) => {
  const b = req.body || {};
  if (!b.memberId || !b.activityTypeId || !b.startedAt) {
    return res.status(400).json({ error: 'memberId, activityTypeId, startedAt required' });
  }
  const mem = await query('SELECT id FROM members WHERE id = $1 AND company_id = $2', [
    b.memberId,
    req.tenant.companyId,
  ]);
  if (!mem.rowCount) return res.status(404).json({ error: 'Member not found' });
  const act = await query('SELECT id FROM activity_types WHERE id = $1 AND company_id = $2', [
    b.activityTypeId,
    req.tenant.companyId,
  ]);
  if (!act.rowCount) return res.status(400).json({ error: 'Unknown activity type' });

  const equipmentIds = Array.isArray(b.equipmentIds) ? b.equipmentIds : [];
  for (const eid of equipmentIds) {
    const eq = await query('SELECT * FROM equipment WHERE id = $1 AND company_id = $2', [
      eid,
      req.tenant.companyId,
    ]);
    if (!eq.rowCount) return res.status(400).json({ error: `Unknown equipment ${eid}` });
    const mapped = mapEquipment(eq.rows[0]);
    if (mapped.status === 'maintenance') {
      return res.status(400).json({ error: `${mapped.name} is in maintenance` });
    }
  }
  const locationId =
    b.locationId || req.tenant.locationId || req.tenant.membership.locations[0]?.id || null;
  const session = {
    id: id('trn'),
    companyId: req.tenant.companyId,
    locationId,
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
      (id, company_id, location_id, member_id, coach_user_id, activity_type_id, started_at, ended_at, equipment_ids, notes, calories)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)`,
    [
      session.id,
      session.companyId,
      session.locationId,
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

app.get('/api/products', auth, tenant, gate('products'), asyncHandler(async (req, res) => {
  const companyId = req.tenant.companyId;
  const [productsRes, promosRes, memberCounts] = await Promise.all([
    query(
      `SELECT * FROM subscription_products
       WHERE company_id = $1
       ORDER BY price ASC, name ASC`,
      [companyId],
    ),
    query(
      `SELECT * FROM promotions WHERE company_id = $1 ORDER BY starts_at DESC`,
      [companyId],
    ),
    query(
      `SELECT plan, status, COUNT(*)::int AS n
       FROM members WHERE company_id = $1
       GROUP BY plan, status`,
      [companyId],
    ),
  ]);

  const countsByPlan = {};
  for (const row of memberCounts.rows) {
    if (!countsByPlan[row.plan]) countsByPlan[row.plan] = { active: 0, lead: 0, total: 0 };
    countsByPlan[row.plan][row.status] = (countsByPlan[row.plan][row.status] || 0) + row.n;
    countsByPlan[row.plan].total += row.n;
  }

  const promotions = promosRes.rows.map((r) => {
    const p = mapPromo(r);
    return { ...p, currentlyActive: isPromotionActive(p) };
  });

  const subscriptions = productsRes.rows.map((r) => {
    const product = mapProduct(r);
    const related = promotions.filter(
      (p) => p.appliesTo === 'any' || p.appliesTo === product.planCode,
    );
    const counts = countsByPlan[product.planCode] || { active: 0, lead: 0, total: 0 };
    return {
      ...product,
      memberCounts: counts,
      promotions: related,
      activePromotionCount: related.filter((p) => p.currentlyActive).length,
    };
  });

  res.json({
    subscriptions,
    promotions,
    summary: {
      productCount: subscriptions.length,
      activeProductCount: subscriptions.filter((s) => s.active).length,
      promotionCount: promotions.length,
      livePromotionCount: promotions.filter((p) => p.currentlyActive).length,
    },
  });
}));

app.post('/api/products', auth, tenant, gate('products'), asyncHandler(async (req, res) => {
  const b = req.body || {};
  const name = String(b.name || '').trim();
  const planCode = String(b.planCode || b.plan || name || '').trim();
  if (!name || !planCode) {
    return res.status(400).json({ error: 'name and planCode required' });
  }
  const product = {
    id: id('prd'),
    companyId: req.tenant.companyId,
    name,
    planCode,
    price: Number(b.price) || 0,
    billingInterval: String(b.billingInterval || 'month'),
    description: String(b.description || ''),
    active: b.active !== false,
    createdAt: nowIso(),
  };
  try {
    await query(
      `INSERT INTO subscription_products
        (id, company_id, name, plan_code, price, billing_interval, description, active, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        product.id,
        product.companyId,
        product.name,
        product.planCode,
        product.price,
        product.billingInterval,
        product.description,
        product.active,
        product.createdAt,
      ],
    );
  } catch (err) {
    if (err?.code === '23505') {
      return res.status(409).json({ error: 'A product with that plan code already exists' });
    }
    throw err;
  }
  res.status(201).json(product);
}));

app.get('/api/system-config', auth, tenant, gate('system_config'), asyncHandler(async (req, res) => {
  const companyId = req.tenant.companyId;
  const companyRes = await query(
    `SELECT id, code, name, currency, timezone, plans, active, created_at
     FROM companies WHERE id = $1`,
    [companyId],
  );
  const company = companyRes.rows[0];
  if (!company) return res.status(404).json({ error: 'Company not found' });

  const locationsRes = await query(
    `SELECT * FROM locations WHERE company_id = $1 ORDER BY name`,
    [companyId],
  );

  const memberships = await loadUserMemberships(req.user.id);
  const isSuper = req.user.role === 'superuser' || memberships.some((m) => m.role === 'superuser');

  res.json({
    company: {
      id: company.id,
      code: company.code,
      name: company.name,
      currency: company.currency,
      timezone: company.timezone,
      plans: company.plans ?? [],
      active: company.active,
      createdAt: company.created_at,
    },
    locations: locationsRes.rows.map((r) => ({
      id: r.id,
      companyId: r.company_id,
      code: r.code,
      name: r.name,
      address: r.address,
      active: r.active,
      createdAt: r.created_at,
    })),
    roles: Object.entries(ROLE_LABELS).map(([id, label]) => ({
      id,
      label,
      modules: ROLE_MODULES[id] || [],
    })),
    isSuperuser: isSuper,
    companies: isSuper
      ? memberships.map((m) => ({
          id: m.companyId,
          code: m.companyCode,
          name: m.companyName,
          role: m.role,
          locationCount: m.locations.length,
        }))
      : undefined,
  });
}));

app.patch('/api/system-config', auth, tenant, gate('system_config'), asyncHandler(async (req, res) => {
  const companyId = req.tenant.companyId;
  const b = req.body || {};
  const name = b.name != null ? String(b.name).trim() : null;
  const currency = b.currency != null ? String(b.currency).trim().toUpperCase() : null;
  const timezone = b.timezone != null ? String(b.timezone).trim() : null;
  let plans = null;
  if (b.plans != null) {
    if (Array.isArray(b.plans)) {
      plans = b.plans.map((p) => String(p).trim()).filter(Boolean);
    } else if (typeof b.plans === 'string') {
      plans = b.plans.split(/[,|\n]/).map((p) => p.trim()).filter(Boolean);
    }
  }

  const current = await query(`SELECT * FROM companies WHERE id = $1`, [companyId]);
  if (!current.rowCount) return res.status(404).json({ error: 'Company not found' });
  const row = current.rows[0];

  const nextName = name || row.name;
  const nextCurrency = currency || row.currency;
  const nextTimezone = timezone || row.timezone;
  const nextPlans = plans || row.plans;

  await query(
    `UPDATE companies
     SET name = $2, currency = $3, timezone = $4, plans = $5::jsonb
     WHERE id = $1`,
    [companyId, nextName, nextCurrency, nextTimezone, JSON.stringify(nextPlans)],
  );
  await query(
    `UPDATE club_meta SET club_name = $1, currency = $2, timezone = $3, plans = $4::jsonb WHERE id = 1`,
    [nextName, nextCurrency, nextTimezone, JSON.stringify(nextPlans)],
  );

  res.json({
    ok: true,
    company: {
      id: companyId,
      code: row.code,
      name: nextName,
      currency: nextCurrency,
      timezone: nextTimezone,
      plans: nextPlans,
    },
  });
}));

app.post('/api/system-config/locations', auth, tenant, gate('system_config'), asyncHandler(async (req, res) => {
  const companyId = req.tenant.companyId;
  const b = req.body || {};
  const code = String(b.code || '').trim().toUpperCase();
  const name = String(b.name || '').trim();
  const address = String(b.address || '').trim();
  if (!code || !name) return res.status(400).json({ error: 'code and name required' });

  const locId = id('loc');
  try {
    await query(
      `INSERT INTO locations (id, company_id, code, name, address, active, created_at)
       VALUES ($1,$2,$3,$4,$5,TRUE,$6)`,
      [locId, companyId, code, name, address, nowIso()],
    );
  } catch (err) {
    if (err?.code === '23505') {
      return res.status(409).json({ error: 'Location code already exists for this company' });
    }
    throw err;
  }

  const { rows } = await query(`SELECT * FROM locations WHERE id = $1`, [locId]);
  const r = rows[0];
  res.status(201).json({
    id: r.id,
    companyId: r.company_id,
    code: r.code,
    name: r.name,
    address: r.address,
    active: r.active,
    createdAt: r.created_at,
  });
}));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal error' });
});

await migrate();
await seed();

const webDist = process.env.PULSE_WEB_DIST
  || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/dist');
const mobileDist = process.env.PULSE_MOBILE_DIST
  || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../mobile/dist');

// mobile.pulse (Expo web) — must mount before the admin SPA catch-all.
if (existsSync(mobileDist)) {
  app.get(['/mobile', '/mobile/'], (_req, res) => res.redirect(302, '/m/'));
  app.use('/m', express.static(mobileDist, { index: false, fallthrough: true }));
  app.get(/^\/m(?:\/.*)?$/, (req, res, next) => {
    if (/\.[a-z0-9]+$/i.test(req.path) && !req.path.endsWith('.html')) {
      return res.status(404).send('Not found');
    }
    res.sendFile(path.join(mobileDist, 'index.html'), (err) => (err ? next(err) : undefined));
  });
  console.log(`Serving mobile.pulse from ${mobileDist} at /m/`);
}

if (existsSync(webDist)) {
  app.use(express.static(webDist, { index: false, fallthrough: true }));
  app.get(/^(?!\/api(?:\/|$)|\/m(?:\/|$)|\/mobile(?:\/|$)).*/, (req, res, next) => {
    if (/\.[a-z0-9]+$/i.test(req.path) && !req.path.endsWith('.html')) {
      return res.status(404).send('Not found');
    }
    res.sendFile(path.join(webDist, 'index.html'), (err) => (err ? next(err) : undefined));
  });
  console.log(`Serving Pulse web from ${webDist}`);
}

const listenPort = Number(process.env.PORT || process.env.PULSE_API_PORT || 5400);
app.listen(listenPort, '0.0.0.0', () => {
  console.log(`Pulse API listening on http://0.0.0.0:${listenPort} (PostgreSQL multi-tenant)`);
});
