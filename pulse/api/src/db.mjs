import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { nanoid } from 'nanoid';
export {
  ROLES,
  ROLE_LABELS,
  ROLE_MODULES,
  requireRole,
  computeInvoiceTotals,
  isPromotionActive,
  applyPromotion,
  nowIso,
} from './domain.mjs';

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
    // Cloud Run + Cloud SQL Auth Proxy unix socket (object form avoids URL password quirks)
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
  return {
    id: row.id,
    memberId: row.member_id,
    coachUserId: row.coach_user_id,
    title: row.title,
    startsAt: row.starts_at?.toISOString?.() ?? row.starts_at,
    endsAt: row.ends_at?.toISOString?.() ?? row.ends_at,
    status: row.status,
    location: row.location,
    notes: row.notes,
  };
}

export function mapEquipment(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    status: row.status,
    location: row.location,
    lastServiceAt: row.last_service_at?.toISOString?.() ?? row.last_service_at,
    notes: row.notes,
  };
}

export function mapActivity(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
  };
}

export function mapTraining(row) {
  if (!row) return null;
  return {
    id: row.id,
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

export async function ensureDatabaseExists() {
  // Cloud Run + Cloud SQL: the deploy workflow already creates the DB.
  // The app DB user typically cannot CREATE DATABASE / connect as admin.
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

export async function migrate() {
  await ensureDatabaseExists();
  const schemaPath = path.resolve(__dirname, '../sql/schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await query(sql);
  await query(
    `INSERT INTO club_meta (id) VALUES (1) ON CONFLICT (id) DO NOTHING`,
  );
}

export async function getMeta() {
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

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
