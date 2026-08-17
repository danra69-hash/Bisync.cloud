import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { nanoid } from 'nanoid';
import {
  ROLES,
  ROLE_LABELS,
  ROLE_MODULES,
  ALL_MODULES,
  DEFAULT_PLAN_PRICES,
  requireRole,
  normalizeRoleCode,
  sanitizeRoleModules,
  computeInvoiceTotals,
  isPromotionActive,
  applyPromotion,
  nowIso,
} from './domain.mjs';
export {
  ROLES,
  ROLE_LABELS,
  ROLE_MODULES,
  ALL_MODULES,
  DEFAULT_PLAN_PRICES,
  requireRole,
  normalizeRoleCode,
  sanitizeRoleModules,
  computeInvoiceTotals,
  isPromotionActive,
  applyPromotion,
  nowIso,
};
export { isCompanyWideRole, modulesForRole, tenantWhere, COMPANY_WIDE_ROLES } from './tenant.mjs';
import { COMPANY_WIDE_ROLES } from './tenant.mjs';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function connectionConfig() {
  if (process.env.PULSE_DATABASE_URL || process.env.DATABASE_URL) {
    return {
      connectionString: process.env.PULSE_DATABASE_URL || process.env.DATABASE_URL,
    };
  }

  const user = process.env.PULSE_DB_USER || process.env.DB_USER || 'bisync';
  const password = process.env.PULSE_DB_PASSWORD || process.env.DB_PASSWORD || 'bisync';
  const database = process.env.PULSE_DB_NAME || 'pulse';
  const cloudSql = process.env.PULSE_CLOUDSQL_CONNECTION || process.env.INSTANCE_CONNECTION_NAME;

  if (cloudSql) {
    return {
      user,
      password,
      database,
      host: `/cloudsql/${cloudSql}`,
    };
  }

  const host = process.env.PULSE_DB_HOST || '127.0.0.1';
  const port = Number(process.env.PULSE_DB_PORT || '5432');
  return {
    user,
    password,
    database,
    host,
    port,
  };
}

function adminConnectionConfig() {
  const cfg = connectionConfig();
  if (cfg.connectionString) {
    const url = new URL(cfg.connectionString);
    url.pathname = '/postgres';
    return { connectionString: url.toString() };
  }
  return { ...cfg, database: 'postgres' };
}

/** @type {pg.Pool | null} */
let pool = null;

export function getPool() {
  if (!pool) {
    pool = new Pool({
      ...connectionConfig(),
      connectionTimeoutMillis: 20_000,
      idleTimeoutMillis: 30_000,
      max: 5,
    });
    pool.on('error', (err) => {
      console.error('Unexpected Pulse Postgres pool error:', err);
    });
  }
  return pool;
}

export async function query(text, params = []) {
  return getPool().query(text, params);
}

export function id(prefix) {
  return `${prefix}_${nanoid(10)}`;
}

export function mapCompany(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    currency: row.currency,
    timezone: row.timezone,
    plans: row.plans ?? ['Day Pass', 'Silver', 'Gold', 'Platinum'],
    active: row.active,
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
  };
}

export function mapLocation(row) {
  if (!row) return null;
  return {
    id: row.id,
    companyId: row.company_id,
    code: row.code,
    name: row.name,
    address: row.address ?? '',
    active: row.active,
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
  };
}

export function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    password: row.password,
    active: row.active,
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
  };
}

export function mapMember(row) {
  if (!row) return null;
  return {
    id: row.id,
    companyId: row.company_id,
    homeLocationId: row.home_location_id ?? null,
    memberCode: row.member_code,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    plan: row.plan,
    status: row.status,
    joinedAt: row.joined_at?.toISOString?.() ?? row.joined_at,
    renewsAt: row.renews_at?.toISOString?.() ?? row.renews_at,
    tags: row.tags ?? [],
    notes: row.notes,
    salesOwnerEmail: row.sales_owner_email,
  };
}

export function mapPromo(row) {
  if (!row) return null;
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    code: row.code,
    discountType: row.discount_type,
    discountValue: Number(row.discount_value),
    appliesTo: row.applies_to,
    status: row.status,
    startsAt: row.starts_at?.toISOString?.() ?? row.starts_at,
    endsAt: row.ends_at?.toISOString?.() ?? row.ends_at,
    createdBy: row.created_by,
  };
}

export function mapInvoice(row) {
  if (!row) return null;
  return {
    id: row.id,
    companyId: row.company_id,
    number: row.number,
    memberId: row.member_id,
    status: row.status,
    issuedAt: row.issued_at?.toISOString?.() ?? row.issued_at,
    dueAt: row.due_at?.toISOString?.() ?? row.due_at,
    lines: row.lines ?? [],
    subtotal: Number(row.subtotal),
    tax: Number(row.tax),
    total: Number(row.total),
    promoCode: row.promo_code,
    discount: Number(row.discount),
  };
}

export function mapPayment(row) {
  if (!row) return null;
  return {
    id: row.id,
    companyId: row.company_id,
    memberId: row.member_id,
    invoiceId: row.invoice_id,
    amount: Number(row.amount),
    method: row.method,
    status: row.status,
    paidAt: row.paid_at?.toISOString?.() ?? row.paid_at,
    reference: row.reference,
  };
}

export function mapAppointment(row) {
  if (!row) return null;
  const area = row.area ?? row.location ?? '';
  return {
    id: row.id,
    companyId: row.company_id,
    locationId: row.location_id ?? null,
    memberId: row.member_id,
    coachUserId: row.coach_user_id,
    title: row.title,
    startsAt: row.starts_at?.toISOString?.() ?? row.starts_at,
    endsAt: row.ends_at?.toISOString?.() ?? row.ends_at,
    status: row.status,
    area,
    location: area, // back-compat for older UI fields
    notes: row.notes,
  };
}

export function mapEquipment(row) {
  if (!row) return null;
  const area = row.area ?? row.location ?? '';
  return {
    id: row.id,
    companyId: row.company_id,
    locationId: row.location_id ?? null,
    code: row.code,
    name: row.name,
    category: row.category,
    status: row.status,
    area,
    location: area,
    lastServiceAt: row.last_service_at?.toISOString?.() ?? row.last_service_at,
    notes: row.notes,
  };
}

export function mapActivity(row) {
  if (!row) return null;
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    description: row.description,
  };
}

export function mapTraining(row) {
  if (!row) return null;
  return {
    id: row.id,
    companyId: row.company_id,
    locationId: row.location_id ?? null,
    memberId: row.member_id,
    coachUserId: row.coach_user_id,
    activityTypeId: row.activity_type_id,
    startedAt: row.started_at?.toISOString?.() ?? row.started_at,
    endedAt: row.ended_at?.toISOString?.() ?? row.ended_at,
    equipmentIds: row.equipment_ids ?? [],
    notes: row.notes,
    calories: row.calories == null ? null : Number(row.calories),
  };
}

export function mapProduct(row) {
  if (!row) return null;
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    planCode: row.plan_code,
    price: Number(row.price),
    billingInterval: row.billing_interval,
    description: row.description ?? '',
    active: row.active,
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
  };
}

export async function ensureDatabaseExists() {
  const cloudSql = process.env.PULSE_CLOUDSQL_CONNECTION || process.env.INSTANCE_CONNECTION_NAME;
  if (cloudSql || process.env.PULSE_SKIP_ENSURE_DB === '1') {
    console.log('Skipping ensureDatabaseExists (Cloud SQL / managed DB).');
    return;
  }

  const cfg = connectionConfig();
  const dbName = (cfg.database || 'pulse').replace(/[^a-zA-Z0-9_]/g, '');
  const admin = new Pool(adminConnectionConfig());
  try {
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (exists.rowCount === 0) {
      await admin.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Created PostgreSQL database: ${dbName}`);
    }
  } finally {
    await admin.end();
  }
}

async function columnExists(table, column) {
  const { rows } = await query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, column],
  );
  return rows.length > 0;
}

async function addColumnIfMissing(table, column, ddl) {
  if (!(await columnExists(table, column))) {
    await query(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  }
}

async function dropUniqueIfExists(table, constraintName) {
  await query(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${constraintName}`);
}

async function ensureUnique(table, constraintName, columnsSql) {
  const { rows } = await query(
    `SELECT 1 FROM pg_constraint WHERE conname = $1`,
    [constraintName],
  );
  if (!rows.length) {
    await query(`ALTER TABLE ${table} ADD CONSTRAINT ${constraintName} UNIQUE ${columnsSql}`);
  }
}

/** Evolve legacy single-club tables into multi-tenant columns + backfill. */
async function ensureTenantColumnsAndBackfill() {
  await addColumnIfMissing('sessions', 'company_id', 'TEXT REFERENCES companies(id) ON DELETE SET NULL');
  await addColumnIfMissing('sessions', 'location_id', 'TEXT REFERENCES locations(id) ON DELETE SET NULL');

  await addColumnIfMissing('members', 'company_id', 'TEXT REFERENCES companies(id)');
  await addColumnIfMissing('members', 'home_location_id', 'TEXT REFERENCES locations(id)');

  await addColumnIfMissing('promotions', 'company_id', 'TEXT REFERENCES companies(id)');
  await addColumnIfMissing('invoices', 'company_id', 'TEXT REFERENCES companies(id)');
  await addColumnIfMissing('payments', 'company_id', 'TEXT REFERENCES companies(id)');

  await addColumnIfMissing('appointments', 'company_id', 'TEXT REFERENCES companies(id)');
  await addColumnIfMissing('appointments', 'location_id', 'TEXT REFERENCES locations(id)');
  await addColumnIfMissing('appointments', 'area', "TEXT NOT NULL DEFAULT ''");

  await addColumnIfMissing('equipment', 'company_id', 'TEXT REFERENCES companies(id)');
  await addColumnIfMissing('equipment', 'location_id', 'TEXT REFERENCES locations(id)');
  await addColumnIfMissing('equipment', 'area', "TEXT NOT NULL DEFAULT ''");

  await addColumnIfMissing('activity_types', 'company_id', 'TEXT REFERENCES companies(id)');
  await addColumnIfMissing('training_sessions', 'company_id', 'TEXT REFERENCES companies(id)');
  await addColumnIfMissing('training_sessions', 'location_id', 'TEXT REFERENCES locations(id)');

  // Rename free-text location → area when legacy column still exists.
  if (await columnExists('appointments', 'location')) {
    await query(`UPDATE appointments SET area = location WHERE (area IS NULL OR area = '') AND location IS NOT NULL`);
  }
  if (await columnExists('equipment', 'location')) {
    await query(`UPDATE equipment SET area = location WHERE (area IS NULL OR area = '') AND location IS NOT NULL`);
  }

  // Drop legacy global uniques so composite uniques can be added after backfill.
  await dropUniqueIfExists('members', 'members_member_code_key');
  await dropUniqueIfExists('promotions', 'promotions_code_key');
  await dropUniqueIfExists('invoices', 'invoices_number_key');
  await dropUniqueIfExists('equipment', 'equipment_code_key');
  await dropUniqueIfExists('activity_types', 'activity_types_name_key');

  const companies = await query('SELECT COUNT(*)::int AS n FROM companies');
  if (companies.rows[0].n === 0) {
    const companyId = id('co');
    const locDowntown = id('loc');
    const locWest = id('loc');
    const meta = await query('SELECT * FROM club_meta WHERE id = 1');
    const m = meta.rows[0];
    await query(
      `INSERT INTO companies (id, code, name, currency, timezone, plans, active, created_at)
       VALUES ($1,'PULS',$2,$3,$4,$5::jsonb,TRUE,NOW())`,
      [
        companyId,
        m?.club_name || 'Pulse Fitness Club',
        m?.currency || 'USD',
        m?.timezone || 'UTC',
        JSON.stringify(m?.plans || ['Day Pass', 'Silver', 'Gold', 'Platinum']),
      ],
    );
    await query(
      `INSERT INTO locations (id, company_id, code, name, address, active, created_at) VALUES
        ($1,$3,'DT','Downtown','100 Main St',TRUE,NOW()),
        ($2,$3,'WS','Westside','220 Harbor Ave',TRUE,NOW())`,
      [locDowntown, locWest, companyId],
    );

    await query(`UPDATE members SET company_id = $1, home_location_id = COALESCE(home_location_id, $2) WHERE company_id IS NULL`, [
      companyId,
      locDowntown,
    ]);
    await query(`UPDATE promotions SET company_id = $1 WHERE company_id IS NULL`, [companyId]);
    await query(`UPDATE invoices SET company_id = $1 WHERE company_id IS NULL`, [companyId]);
    await query(`UPDATE payments SET company_id = $1 WHERE company_id IS NULL`, [companyId]);
    await query(`UPDATE appointments SET company_id = $1, location_id = COALESCE(location_id, $2) WHERE company_id IS NULL`, [
      companyId,
      locDowntown,
    ]);
    await query(`UPDATE equipment SET company_id = $1, location_id = COALESCE(location_id, $2) WHERE company_id IS NULL`, [
      companyId,
      locDowntown,
    ]);
    await query(`UPDATE activity_types SET company_id = $1 WHERE company_id IS NULL`, [companyId]);
    await query(`UPDATE training_sessions SET company_id = $1, location_id = COALESCE(location_id, $2) WHERE company_id IS NULL`, [
      companyId,
      locDowntown,
    ]);

    const users = await query('SELECT id, role FROM users');
    for (const u of users.rows) {
      await query(
        `INSERT INTO user_company_memberships (user_id, company_id, role)
         VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [u.id, companyId, u.role],
      );
      // Location-scoped roles get both clubs; company-wide roles rely on membership alone.
      if (u.role === 'fitness_coach' || u.role === 'sales') {
        await query(
          `INSERT INTO user_location_access (user_id, location_id) VALUES ($1,$2), ($1,$3)
           ON CONFLICT DO NOTHING`,
          [u.id, locDowntown, locWest],
        );
      }
    }
    console.log(`Backfilled default company ${companyId} with Downtown + Westside locations.`);
  }

  await ensureUnique('members', 'members_company_code_uq', '(company_id, member_code)');
  await ensureUnique('promotions', 'promotions_company_code_uq', '(company_id, code)');
  await ensureUnique('invoices', 'invoices_company_number_uq', '(company_id, number)');
  await ensureUnique('equipment', 'equipment_company_code_uq', '(company_id, code)');
  await ensureUnique('activity_types', 'activity_types_company_name_uq', '(company_id, name)');

  // Indexes that reference tenant columns — must run AFTER columns exist on legacy DBs.
  await query(`CREATE INDEX IF NOT EXISTS idx_locations_company ON locations(company_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_members_company ON members(company_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_invoices_company ON invoices(company_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_payments_company ON payments(company_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_appointments_company ON appointments(company_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_equipment_company ON equipment(company_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_training_company ON training_sessions(company_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_subscription_products_company ON subscription_products(company_id)`);

  await addColumnIfMissing('users', 'pin', "TEXT NOT NULL DEFAULT '1234'");
  await addColumnIfMissing('appointments', 'request_origin', "TEXT NOT NULL DEFAULT 'subscriber'");
  await addColumnIfMissing('appointments', 'request_status', "TEXT NOT NULL DEFAULT 'scheduled'");
}

/** Ensure each company has catalog rows for its plans (idempotent). */
export async function ensureSubscriptionCatalog(companyId = null) {
  const companies = companyId
    ? await query('SELECT id, plans FROM companies WHERE id = $1', [companyId])
    : await query('SELECT id, plans FROM companies WHERE active = TRUE');
  for (const co of companies.rows) {
    const plans = Array.isArray(co.plans) ? co.plans : ['Day Pass', 'Silver', 'Gold', 'Platinum'];
    for (const planName of plans) {
      const defaults = DEFAULT_PLAN_PRICES[planName] || { price: 0, billingInterval: 'month' };
      await query(
        `INSERT INTO subscription_products
          (id, company_id, name, plan_code, price, billing_interval, description, active, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,NOW())
         ON CONFLICT (company_id, plan_code) DO NOTHING`,
        [
          id('prd'),
          co.id,
          `${planName} membership`,
          planName,
          defaults.price,
          defaults.billingInterval,
          `Subscription plan: ${planName}`,
        ],
      );
    }
  }
}

export async function migrate() {
  await ensureDatabaseExists();
  const schemaPath = path.resolve(__dirname, '../sql/schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await query(sql);
  await query(`INSERT INTO club_meta (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);
  await ensureTenantColumnsAndBackfill();
  await ensureSubscriptionCatalog();
}

export async function getMeta(companyId = null) {
  if (companyId) {
    const { rows } = await query('SELECT * FROM companies WHERE id = $1', [companyId]);
    const row = rows[0];
    if (row) {
      return {
        clubName: row.name,
        companyId: row.id,
        companyCode: row.code,
        currency: row.currency,
        timezone: row.timezone,
        plans: row.plans ?? ['Day Pass', 'Silver', 'Gold', 'Platinum'],
        roles: ROLES,
      };
    }
  }
  const { rows } = await query('SELECT * FROM club_meta WHERE id = 1');
  const row = rows[0];
  return {
    clubName: row?.club_name ?? 'Pulse Fitness Club',
    currency: row?.currency ?? 'USD',
    timezone: row?.timezone ?? 'UTC',
    plans: row?.plans ?? ['Day Pass', 'Silver', 'Gold', 'Platinum'],
    roles: ROLES,
  };
}

export async function resolveRoleAccess(role, companyId = null) {
  if (ROLE_MODULES[role]) {
    return {
      code: role,
      label: ROLE_LABELS[role] || role,
      modules: [...ROLE_MODULES[role]],
      companyWide: COMPANY_WIDE_ROLES.has(role),
      builtin: true,
    };
  }
  if (!companyId) {
    return { code: role, label: role, modules: [], companyWide: false, builtin: false };
  }
  const { rows } = await query(
    `SELECT * FROM company_roles
     WHERE company_id = $1 AND code = $2 AND active = TRUE
     LIMIT 1`,
    [companyId, role],
  );
  if (!rows.length) {
    return { code: role, label: role, modules: [], companyWide: false, builtin: false };
  }
  const r = rows[0];
  return {
    id: r.id,
    code: r.code,
    label: r.label,
    modules: sanitizeRoleModules(r.modules || []),
    companyWide: Boolean(r.company_wide),
    builtin: false,
  };
}

export async function listRolesForCompany(companyId, { includeSuperuser = false } = {}) {
  const builtin = ROLES.filter((r) => includeSuperuser || r !== 'superuser').map((r) => ({
    code: r,
    label: ROLE_LABELS[r] || r,
    modules: [...(ROLE_MODULES[r] || [])],
    companyWide: COMPANY_WIDE_ROLES.has(r),
    builtin: true,
  }));
  const { rows } = await query(
    `SELECT * FROM company_roles
     WHERE company_id = $1 AND active = TRUE
     ORDER BY label ASC`,
    [companyId],
  );
  const custom = rows.map((r) => ({
    id: r.id,
    code: r.code,
    label: r.label,
    modules: sanitizeRoleModules(r.modules || []),
    companyWide: Boolean(r.company_wide),
    builtin: false,
  }));
  return [...builtin, ...custom];
}

export async function createCompanyRole(companyId, { label, modules, companyWide = false }) {
  const cleanLabel = String(label || '').trim();
  if (!cleanLabel) throw Object.assign(new Error('Role name required'), { status: 400 });
  const mods = sanitizeRoleModules(modules);
  if (!mods.length) throw Object.assign(new Error('Select at least one module'), { status: 400 });

  let code = `custom_${normalizeRoleCode(cleanLabel)}`;
  if (ROLE_MODULES[code] || ROLES.includes(code)) {
    code = `${code}_${nanoid(4).toLowerCase()}`;
  }
  const clash = await query(
    `SELECT 1 FROM company_roles WHERE company_id = $1 AND code = $2`,
    [companyId, code],
  );
  if (clash.rowCount) {
    code = `${code}_${nanoid(4).toLowerCase()}`;
  }

  const roleId = id('role');
  await query(
    `INSERT INTO company_roles (id, company_id, code, label, modules, company_wide, active, created_at)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6,TRUE,$7)`,
    [roleId, companyId, code, cleanLabel, JSON.stringify(mods), Boolean(companyWide), nowIso()],
  );
  return {
    id: roleId,
    code,
    label: cleanLabel,
    modules: mods,
    companyWide: Boolean(companyWide),
    builtin: false,
  };
}

export async function loadUserMemberships(userId) {
  const { rows } = await query(
    `SELECT m.company_id, m.role, c.code AS company_code, c.name AS company_name,
            c.currency, c.timezone, c.plans, c.active AS company_active
     FROM user_company_memberships m
     JOIN companies c ON c.id = m.company_id
     WHERE m.user_id = $1 AND c.active = TRUE
     ORDER BY CASE WHEN c.code = 'PULS' THEN 0 ELSE 1 END, c.name`,
    [userId],
  );

  const memberships = [];
  for (const r of rows) {
    const access = await resolveRoleAccess(r.role, r.company_id);
    const locs = await query(
      `SELECT l.* FROM locations l
       WHERE l.company_id = $1 AND l.active = TRUE
         AND (
           EXISTS (
             SELECT 1 FROM user_company_memberships ucm
             WHERE ucm.user_id = $2 AND ucm.company_id = $1
               AND (
                 ucm.role IN ('superuser','management','admin','accounting')
                 OR EXISTS (
                   SELECT 1 FROM company_roles cr
                   WHERE cr.company_id = $1 AND cr.code = ucm.role
                     AND cr.company_wide = TRUE AND cr.active = TRUE
                 )
               )
           )
           OR EXISTS (
             SELECT 1 FROM user_location_access ula
             WHERE ula.user_id = $2 AND ula.location_id = l.id
           )
         )
       ORDER BY l.name`,
      [r.company_id, userId],
    );
    // Company-wide roles see all locations even if access rows are empty.
    let locationRows = locs.rows;
    if (!locationRows.length && access.companyWide) {
      const all = await query(
        `SELECT * FROM locations WHERE company_id = $1 AND active = TRUE ORDER BY name`,
        [r.company_id],
      );
      locationRows = all.rows;
    }
    memberships.push({
      companyId: r.company_id,
      companyCode: r.company_code,
      companyName: r.company_name,
      role: r.role,
      roleLabel: access.label,
      modules: access.modules,
      companyWide: access.companyWide,
      currency: r.currency,
      timezone: r.timezone,
      plans: r.plans,
      locations: locationRows.map(mapLocation),
    });
  }
  return memberships;
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
