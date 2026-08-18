import {
  migrate,
  query,
  id,
  nowIso,
  ROLES,
  closePool,
} from './db.mjs';

const PASSWORD = 'pulse123';

const PULSE_USERS = [
  { email: 'admin@pulse.club', name: 'Ava Chen', role: 'admin' },
  { email: 'mgmt@pulse.club', name: 'Marcus Reed', role: 'management' },
  { email: 'accounting@pulse.club', name: 'Priya Shah', role: 'accounting' },
  { email: 'coach@pulse.club', name: 'Jordan Blake', role: 'fitness_coach' },
  { email: 'sales@pulse.club', name: 'Elena Ortiz', role: 'sales' },
];

const ATLAS_USERS = [
  { email: 'admin@atlas.fit', name: 'Noah Kim', role: 'admin' },
  { email: 'coach@atlas.fit', name: 'Mina Alvarez', role: 'fitness_coach' },
];

/** If Pulse already has data but no second company, add Atlas Fit for isolation demos. */
async function ensureSecondaryDemoTenant() {
  const atlas = await query(`SELECT id FROM companies WHERE code = 'ATLA'`);
  if (atlas.rowCount) return;

  const atlasCo = id('co');
  const atlasHb = id('loc');
  await query(
    `INSERT INTO companies (id, code, name, currency, timezone, plans, active, created_at)
     VALUES ($1,'ATLA','Atlas Fit','USD','America/New_York',$2::jsonb,TRUE,NOW())`,
    [atlasCo, JSON.stringify(['Day Pass', 'Silver', 'Gold', 'Platinum'])],
  );
  await query(
    `INSERT INTO locations (id, company_id, code, name, address, active, created_at)
     VALUES ($1,$2,'HB','Harbor','8 Pier Road',TRUE,NOW())`,
    [atlasHb, atlasCo],
  );

  for (const u of ATLAS_USERS) {
    let userId;
    const existing = await query('SELECT id FROM users WHERE lower(email) = $1', [u.email]);
    if (existing.rowCount) {
      userId = existing.rows[0].id;
    } else {
      userId = id('usr');
      await query(
        `INSERT INTO users (id, name, email, role, password, active, created_at)
         VALUES ($1,$2,$3,$4,$5,TRUE,$6)`,
        [userId, u.name, u.email, u.role, PASSWORD, nowIso()],
      );
    }
    await query(
      `INSERT INTO user_company_memberships (user_id, company_id, role)
       VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
      [userId, atlasCo, u.role],
    );
    if (u.role === 'fitness_coach') {
      await query(
        `INSERT INTO user_location_access (user_id, location_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [userId, atlasHb],
      );
    }
  }

  const hasMember = await query(
    `SELECT 1 FROM members WHERE company_id = $1 AND member_code = 'ATL-2001'`,
    [atlasCo],
  );
  if (!hasMember.rowCount) {
    await query(
      `INSERT INTO members
        (id, company_id, home_location_id, member_code, first_name, last_name, email, phone, plan, status, joined_at, renews_at, tags, notes, sales_owner_email)
       VALUES ($1,$2,$3,'ATL-2001','Dev','Singh','dev.singh@email.com','+1-555-0201','Gold','active',NOW(),NOW() + interval '180 days','[]'::jsonb,'Atlas Harbor member','admin@atlas.fit')`,
      [id('mem'), atlasCo, atlasHb],
    );
  }
  console.log('Added secondary demo company Atlas Fit (ATLA / Harbor).');
}

export async function seed({ force = false } = {}) {
  await migrate();

  const existing = await query('SELECT COUNT(*)::int AS n FROM users');
  if (existing.rows[0].n > 0 && !force) {
    console.log('Pulse Postgres already seeded — skipping full seed (use --force to reset).');
    try {
      await ensureSecondaryDemoTenant();
    } catch (err) {
      console.warn('ensureSecondaryDemoTenant:', err.message);
    }
    return;
  }

  if (force) {
    await query(`
      TRUNCATE training_sessions, appointments, payments, invoices, promotions,
               members, sessions, equipment, activity_types,
               user_location_access, user_company_memberships,
               locations, companies, users RESTART IDENTITY CASCADE
    `);
  }

  const pulseCo = id('co');
  const atlasCo = id('co');
  const pulseDt = id('loc');
  const pulseWs = id('loc');
  const atlasHb = id('loc');

  await query(
    `INSERT INTO companies (id, code, name, currency, timezone, plans, active, created_at) VALUES
      ($1,'PULS','Pulse Fitness Club','USD','America/Los_Angeles',$3::jsonb,TRUE,NOW()),
      ($2,'ATLA','Atlas Fit','USD','America/New_York',$3::jsonb,TRUE,NOW())`,
    [pulseCo, atlasCo, JSON.stringify(['Day Pass', 'Silver', 'Gold', 'Platinum'])],
  );

  await query(
    `INSERT INTO locations (id, company_id, code, name, address, active, created_at) VALUES
      ($1,$4,'DT','Downtown','100 Main St',TRUE,NOW()),
      ($2,$4,'WS','Westside','220 Harbor Ave',TRUE,NOW()),
      ($3,$5,'HB','Harbor','8 Pier Road',TRUE,NOW())`,
    [pulseDt, pulseWs, atlasHb, pulseCo, atlasCo],
  );

  const userIds = {};
  for (const u of [...PULSE_USERS, ...ATLAS_USERS]) {
    const uid = id('usr');
    userIds[u.email] = uid;
    await query(
      `INSERT INTO users (id, name, email, role, password, active, created_at)
       VALUES ($1,$2,$3,$4,$5,TRUE,$6)`,
      [uid, u.name, u.email, u.role, PASSWORD, nowIso()],
    );
  }

  for (const u of PULSE_USERS) {
    await query(
      `INSERT INTO user_company_memberships (user_id, company_id, role) VALUES ($1,$2,$3)`,
      [userIds[u.email], pulseCo, u.role],
    );
    if (u.role === 'fitness_coach' || u.role === 'sales') {
      await query(
        `INSERT INTO user_location_access (user_id, location_id) VALUES ($1,$2), ($1,$3)`,
        [userIds[u.email], pulseDt, pulseWs],
      );
    }
  }
  for (const u of ATLAS_USERS) {
    await query(
      `INSERT INTO user_company_memberships (user_id, company_id, role) VALUES ($1,$2,$3)`,
      [userIds[u.email], atlasCo, u.role],
    );
    if (u.role === 'fitness_coach') {
      await query(
        `INSERT INTO user_location_access (user_id, location_id) VALUES ($1,$2)`,
        [userIds[u.email], atlasHb],
      );
    }
  }

  const memGold = id('mem');
  const memSilver = id('mem');
  const memLead = id('mem');
  const memAtlas = id('mem');

  await query(
    `INSERT INTO members
      (id, company_id, home_location_id, member_code, first_name, last_name, email, phone, plan, status, joined_at, renews_at, tags, notes, sales_owner_email)
     VALUES
      ($1,$10,$11,'PLS-1001','Sam','Nguyen','sam.nguyen@email.com','+1-555-0101','Gold','active',$2,$3,$4,'Prefers evening sessions','sales@pulse.club'),
      ($5,$10,$12,'PLS-1002','Riley','Park','riley.park@email.com','+1-555-0102','Silver','active',$6,$7,'[]'::jsonb,'','sales@pulse.club'),
      ($8,$10,$11,'PLS-1003','Casey','Brooks','casey.brooks@email.com','+1-555-0103','Day Pass','lead',NULL,NULL,$9,'Trial from summer promo','sales@pulse.club'),
      ($13,$14,$15,'ATL-2001','Dev','Singh','dev.singh@email.com','+1-555-0201','Gold','active',$2,$3,'[]'::jsonb,'Atlas Harbor member','admin@atlas.fit')`,
    [
      memGold,
      '2026-01-12T00:00:00.000Z',
      '2026-09-12T00:00:00.000Z',
      JSON.stringify(['pt-interested']),
      memSilver,
      '2026-03-01T00:00:00.000Z',
      '2026-09-01T00:00:00.000Z',
      memLead,
      JSON.stringify(['promo-summer']),
      pulseCo,
      pulseDt,
      pulseWs,
      memAtlas,
      atlasCo,
      atlasHb,
    ],
  );

  await query(
    `INSERT INTO promotions
      (id, company_id, name, code, discount_type, discount_value, applies_to, status, starts_at, ends_at, created_by)
     VALUES
      ($1,$3,'Summer Strength','SUMMER26','percent',20,'Gold','active','2026-06-01T00:00:00.000Z','2026-08-31T23:59:59.000Z','sales@pulse.club'),
      ($2,$3,'September Reset','RESET26','fixed',50,'any','scheduled','2026-09-01T00:00:00.000Z','2026-09-30T23:59:59.000Z','accounting@pulse.club'),
      ($4,$5,'Harbor Launch','HARBOR26','percent',15,'any','active','2026-06-01T00:00:00.000Z','2026-12-31T23:59:59.000Z','admin@atlas.fit')`,
    [id('prm'), id('prm'), pulseCo, id('prm'), atlasCo],
  );

  const eq = {
    tread: id('eq'),
    rack: id('eq'),
    bike: id('eq'),
    rower: id('eq'),
    atlasBike: id('eq'),
  };

  await query(
    `INSERT INTO equipment (id, company_id, location_id, code, name, category, status, area, last_service_at, notes) VALUES
      ($1,$5,$6,'EQ-TRD-01','Treadmill Pro 9000','Cardio','available','Floor A','2026-07-01T00:00:00.000Z',''),
      ($2,$5,$7,'EQ-RCK-02','Power Rack B','Strength','available','Floor B','2026-06-15T00:00:00.000Z',''),
      ($3,$5,$6,'EQ-BIK-03','Spin Bike 12','Cardio','maintenance','Studio 1','2026-08-01T00:00:00.000Z','Belt replacement scheduled'),
      ($4,$5,$6,'EQ-ROW-04','Rower X1','Cardio','available','Floor A','2026-05-20T00:00:00.000Z',''),
      ($8,$9,$10,'EQ-ATL-01','Assault Bike','Cardio','available','Bay 2','2026-07-01T00:00:00.000Z','')`,
    [eq.tread, eq.rack, eq.bike, eq.rower, pulseCo, pulseDt, pulseWs, eq.atlasBike, atlasCo, atlasHb],
  );

  const acts = {
    strength: id('act'),
    hiit: id('act'),
    cardio: id('act'),
    mobility: id('act'),
    pt: id('act'),
    atlasPt: id('act'),
  };

  await query(
    `INSERT INTO activity_types (id, company_id, name, description) VALUES
      ($1,$6,'Strength','Free weights / machines'),
      ($2,$6,'HIIT','High intensity intervals'),
      ($3,$6,'Cardio','Steady-state cardio'),
      ($4,$6,'Mobility','Stretch / recovery'),
      ($5,$6,'Personal Training','1:1 coached session'),
      ($7,$8,'Personal Training','Atlas 1:1 coaching')`,
    [acts.strength, acts.hiit, acts.cardio, acts.mobility, acts.pt, pulseCo, acts.atlasPt, atlasCo],
  );

  const invPaid = id('inv');
  await query(
    `INSERT INTO invoices
      (id, company_id, number, member_id, status, issued_at, due_at, lines, subtotal, tax, total, promo_code, discount)
     VALUES
      ($1,$7,'INV-2026-001',$2,'paid','2026-08-01T10:00:00.000Z','2026-08-08T10:00:00.000Z',$3,89,7.12,96.12,NULL,0),
      ($4,$7,'INV-2026-002',$5,'open','2026-08-10T10:00:00.000Z','2026-08-17T10:00:00.000Z',$6,59,4.72,63.72,NULL,0),
      ($8,$9,'INV-2026-001',$10,'open','2026-08-10T10:00:00.000Z','2026-08-17T10:00:00.000Z',$11,99,7.92,106.92,NULL,0)`,
    [
      invPaid,
      memGold,
      JSON.stringify([{ description: 'Gold membership — Aug 2026', qty: 1, unitPrice: 89 }]),
      id('inv'),
      memSilver,
      JSON.stringify([{ description: 'Silver membership — Aug 2026', qty: 1, unitPrice: 59 }]),
      pulseCo,
      id('inv'),
      atlasCo,
      memAtlas,
      JSON.stringify([{ description: 'Atlas Gold — Aug 2026', qty: 1, unitPrice: 99 }]),
    ],
  );

  await query(
    `INSERT INTO payments (id, company_id, member_id, invoice_id, amount, method, status, paid_at, reference)
     VALUES ($1,$4,$2,$3,96.12,'card','captured','2026-08-01T10:05:00.000Z','ch_demo_001')`,
    [id('pay'), memGold, invPaid, pulseCo],
  );

  const start = new Date();
  start.setHours(start.getHours() + 2, 0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  await query(
    `INSERT INTO appointments
      (id, company_id, location_id, member_id, coach_user_id, title, starts_at, ends_at, status, area, notes)
     VALUES ($1,$6,$7,$2,$3,'PT — lower body',$4,$5,'scheduled','Floor B','Focus squat pattern')`,
    [
      id('apt'),
      memGold,
      userIds['coach@pulse.club'],
      start.toISOString(),
      end.toISOString(),
      pulseCo,
      pulseWs,
    ],
  );

  await query(
    `INSERT INTO training_sessions
      (id, company_id, location_id, member_id, coach_user_id, activity_type_id, started_at, ended_at, equipment_ids, notes, calories)
     VALUES ($1,$6,$7,$2,$3,$4,'2026-08-12T18:00:00.000Z','2026-08-12T19:00:00.000Z',$5,'5x5 back squat progression',420)`,
    [
      id('trn'),
      memGold,
      userIds['coach@pulse.club'],
      acts.pt,
      JSON.stringify([eq.rack]),
      pulseCo,
      pulseWs,
    ],
  );

  console.log(
    `Seeded Pulse multi-tenant demo: companies PULS + ATLA, locations Downtown/Westside/Harbor. Roles: ${ROLES.join(', ')}`,
  );
}

const isMain = process.argv[1] && process.argv[1].endsWith('seed.mjs');
if (isMain) {
  const force = process.argv.includes('--force');
  seed({ force })
    .then(() => closePool())
    .catch(async (err) => {
      console.error(err);
      await closePool();
      process.exit(1);
    });
}
