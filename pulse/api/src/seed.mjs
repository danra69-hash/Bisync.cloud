import {
  migrate,
  query,
  id,
  nowIso,
  ROLES,
  closePool,
} from './db.mjs';

const PASSWORD = 'pulse123';

const USERS = [
  { email: 'admin@pulse.club', name: 'Ava Chen', role: 'admin' },
  { email: 'mgmt@pulse.club', name: 'Marcus Reed', role: 'management' },
  { email: 'accounting@pulse.club', name: 'Priya Shah', role: 'accounting' },
  { email: 'coach@pulse.club', name: 'Jordan Blake', role: 'fitness_coach' },
  { email: 'sales@pulse.club', name: 'Elena Ortiz', role: 'sales' },
];

export async function seed({ force = false } = {}) {
  await migrate();

  const existing = await query('SELECT COUNT(*)::int AS n FROM users');
  if (existing.rows[0].n > 0 && !force) {
    console.log('Pulse Postgres already seeded — skipping (use --force to reset).');
    return;
  }

  if (force) {
    await query(`
      TRUNCATE training_sessions, appointments, payments, invoices, promotions,
               members, sessions, equipment, activity_types, users RESTART IDENTITY CASCADE
    `);
  }

  const userIds = {};
  for (const u of USERS) {
    const uid = id('usr');
    userIds[u.role] = uid;
    await query(
      `INSERT INTO users (id, name, email, role, password, active, created_at)
       VALUES ($1,$2,$3,$4,$5,TRUE,$6)`,
      [uid, u.name, u.email, u.role, PASSWORD, nowIso()],
    );
  }

  const memGold = id('mem');
  const memSilver = id('mem');
  const memLead = id('mem');

  await query(
    `INSERT INTO members
      (id, member_code, first_name, last_name, email, phone, plan, status, joined_at, renews_at, tags, notes, sales_owner_email)
     VALUES
      ($1,'PLS-1001','Sam','Nguyen','sam.nguyen@email.com','+1-555-0101','Gold','active',$2,$3,$4,'Prefers evening sessions','sales@pulse.club'),
      ($5,'PLS-1002','Riley','Park','riley.park@email.com','+1-555-0102','Silver','active',$6,$7,'[]'::jsonb,'','sales@pulse.club'),
      ($8,'PLS-1003','Casey','Brooks','casey.brooks@email.com','+1-555-0103','Day Pass','lead',NULL,NULL,$9,'Trial from summer promo','sales@pulse.club')`,
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
    ],
  );

  await query(
    `INSERT INTO promotions
      (id, name, code, discount_type, discount_value, applies_to, status, starts_at, ends_at, created_by)
     VALUES
      ($1,'Summer Strength','SUMMER26','percent',20,'Gold','active','2026-06-01T00:00:00.000Z','2026-08-31T23:59:59.000Z','sales@pulse.club'),
      ($2,'September Reset','RESET26','fixed',50,'any','scheduled','2026-09-01T00:00:00.000Z','2026-09-30T23:59:59.000Z','accounting@pulse.club')`,
    [id('prm'), id('prm')],
  );

  const eq = {
    tread: id('eq'),
    rack: id('eq'),
    bike: id('eq'),
    rower: id('eq'),
  };

  await query(
    `INSERT INTO equipment (id, code, name, category, status, location, last_service_at, notes) VALUES
      ($1,'EQ-TRD-01','Treadmill Pro 9000','Cardio','available','Floor A','2026-07-01T00:00:00.000Z',''),
      ($2,'EQ-RCK-02','Power Rack B','Strength','available','Floor B','2026-06-15T00:00:00.000Z',''),
      ($3,'EQ-BIK-03','Spin Bike 12','Cardio','maintenance','Studio 1','2026-08-01T00:00:00.000Z','Belt replacement scheduled'),
      ($4,'EQ-ROW-04','Rower X1','Cardio','available','Floor A','2026-05-20T00:00:00.000Z','')`,
    [eq.tread, eq.rack, eq.bike, eq.rower],
  );

  const acts = {
    strength: id('act'),
    hiit: id('act'),
    cardio: id('act'),
    mobility: id('act'),
    pt: id('act'),
  };

  await query(
    `INSERT INTO activity_types (id, name, description) VALUES
      ($1,'Strength','Free weights / machines'),
      ($2,'HIIT','High intensity intervals'),
      ($3,'Cardio','Steady-state cardio'),
      ($4,'Mobility','Stretch / recovery'),
      ($5,'Personal Training','1:1 coached session')`,
    [acts.strength, acts.hiit, acts.cardio, acts.mobility, acts.pt],
  );

  const invPaid = id('inv');
  await query(
    `INSERT INTO invoices
      (id, number, member_id, status, issued_at, due_at, lines, subtotal, tax, total, promo_code, discount)
     VALUES
      ($1,'INV-2026-001',$2,'paid','2026-08-01T10:00:00.000Z','2026-08-08T10:00:00.000Z',$3,89,7.12,96.12,NULL,0),
      ($4,'INV-2026-002',$5,'open','2026-08-10T10:00:00.000Z','2026-08-17T10:00:00.000Z',$6,59,4.72,63.72,NULL,0)`,
    [
      invPaid,
      memGold,
      JSON.stringify([{ description: 'Gold membership — Aug 2026', qty: 1, unitPrice: 89 }]),
      id('inv'),
      memSilver,
      JSON.stringify([{ description: 'Silver membership — Aug 2026', qty: 1, unitPrice: 59 }]),
    ],
  );

  await query(
    `INSERT INTO payments (id, member_id, invoice_id, amount, method, status, paid_at, reference)
     VALUES ($1,$2,$3,96.12,'card','captured','2026-08-01T10:05:00.000Z','ch_demo_001')`,
    [id('pay'), memGold, invPaid],
  );

  const start = new Date();
  start.setHours(start.getHours() + 2, 0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  await query(
    `INSERT INTO appointments
      (id, member_id, coach_user_id, title, starts_at, ends_at, status, location, notes)
     VALUES ($1,$2,$3,'PT — lower body',$4,$5,'scheduled','Floor B','Focus squat pattern')`,
    [id('apt'), memGold, userIds.fitness_coach, start.toISOString(), end.toISOString()],
  );

  await query(
    `INSERT INTO training_sessions
      (id, member_id, coach_user_id, activity_type_id, started_at, ended_at, equipment_ids, notes, calories)
     VALUES ($1,$2,$3,$4,'2026-08-12T18:00:00.000Z','2026-08-12T19:00:00.000Z',$5,'5x5 back squat progression',420)`,
    [
      id('trn'),
      memGold,
      userIds.fitness_coach,
      acts.pt,
      JSON.stringify([eq.rack]),
    ],
  );

  console.log(`Seeded Pulse Postgres with ${USERS.length} users. Roles: ${ROLES.join(', ')}`);
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
