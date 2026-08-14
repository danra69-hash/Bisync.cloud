import { loadDb, saveDb, id, nowIso, ROLES } from './db.mjs';

const PASSWORD = 'pulse123';

const users = [
  { email: 'admin@pulse.club', name: 'Ava Chen', role: 'admin' },
  { email: 'mgmt@pulse.club', name: 'Marcus Reed', role: 'management' },
  { email: 'accounting@pulse.club', name: 'Priya Shah', role: 'accounting' },
  { email: 'coach@pulse.club', name: 'Jordan Blake', role: 'fitness_coach' },
  { email: 'sales@pulse.club', name: 'Elena Ortiz', role: 'sales' },
];

function seed() {
  const db = {
    users: users.map((u) => ({
      id: id('usr'),
      ...u,
      password: PASSWORD,
      active: true,
      createdAt: nowIso(),
    })),
    sessions: [],
    members: [
      {
        id: id('mem'),
        memberCode: 'PLS-1001',
        firstName: 'Sam',
        lastName: 'Nguyen',
        email: 'sam.nguyen@email.com',
        phone: '+1-555-0101',
        plan: 'Gold',
        status: 'active',
        joinedAt: '2026-01-12T00:00:00.000Z',
        renewsAt: '2026-09-12T00:00:00.000Z',
        tags: ['pt-interested'],
        notes: 'Prefers evening sessions',
        salesOwnerEmail: 'sales@pulse.club',
      },
      {
        id: id('mem'),
        memberCode: 'PLS-1002',
        firstName: 'Riley',
        lastName: 'Park',
        email: 'riley.park@email.com',
        phone: '+1-555-0102',
        plan: 'Silver',
        status: 'active',
        joinedAt: '2026-03-01T00:00:00.000Z',
        renewsAt: '2026-09-01T00:00:00.000Z',
        tags: [],
        notes: '',
        salesOwnerEmail: 'sales@pulse.club',
      },
      {
        id: id('mem'),
        memberCode: 'PLS-1003',
        firstName: 'Casey',
        lastName: 'Brooks',
        email: 'casey.brooks@email.com',
        phone: '+1-555-0103',
        plan: 'Day Pass',
        status: 'lead',
        joinedAt: null,
        renewsAt: null,
        tags: ['promo-summer'],
        notes: 'Trial from summer promo',
        salesOwnerEmail: 'sales@pulse.club',
      },
    ],
    payments: [],
    invoices: [],
    promotions: [
      {
        id: id('prm'),
        name: 'Summer Strength',
        code: 'SUMMER26',
        discountType: 'percent',
        discountValue: 20,
        appliesTo: 'Gold',
        status: 'active',
        startsAt: '2026-06-01T00:00:00.000Z',
        endsAt: '2026-08-31T23:59:59.000Z',
        createdBy: 'sales@pulse.club',
      },
      {
        id: id('prm'),
        name: 'September Reset',
        code: 'RESET26',
        discountType: 'fixed',
        discountValue: 50,
        appliesTo: 'any',
        status: 'scheduled',
        startsAt: '2026-09-01T00:00:00.000Z',
        endsAt: '2026-09-30T23:59:59.000Z',
        createdBy: 'accounting@pulse.club',
      },
    ],
    appointments: [],
    equipment: [
      {
        id: id('eq'),
        code: 'EQ-TRD-01',
        name: 'Treadmill Pro 9000',
        category: 'Cardio',
        status: 'available',
        location: 'Floor A',
        lastServiceAt: '2026-07-01T00:00:00.000Z',
        notes: '',
      },
      {
        id: id('eq'),
        code: 'EQ-RCK-02',
        name: 'Power Rack B',
        category: 'Strength',
        status: 'available',
        location: 'Floor B',
        lastServiceAt: '2026-06-15T00:00:00.000Z',
        notes: '',
      },
      {
        id: id('eq'),
        code: 'EQ-BIK-03',
        name: 'Spin Bike 12',
        category: 'Cardio',
        status: 'maintenance',
        location: 'Studio 1',
        lastServiceAt: '2026-08-01T00:00:00.000Z',
        notes: 'Belt replacement scheduled',
      },
      {
        id: id('eq'),
        code: 'EQ-ROW-04',
        name: 'Rower X1',
        category: 'Cardio',
        status: 'available',
        location: 'Floor A',
        lastServiceAt: '2026-05-20T00:00:00.000Z',
        notes: '',
      },
    ],
    activityTypes: [
      { id: id('act'), name: 'Strength', description: 'Free weights / machines' },
      { id: id('act'), name: 'HIIT', description: 'High intensity intervals' },
      { id: id('act'), name: 'Cardio', description: 'Steady-state cardio' },
      { id: id('act'), name: 'Mobility', description: 'Stretch / recovery' },
      { id: id('act'), name: 'Personal Training', description: '1:1 coached session' },
    ],
    trainingSessions: [],
    meta: {
      clubName: 'Pulse Fitness Club',
      currency: 'USD',
      timezone: 'UTC',
      plans: ['Day Pass', 'Silver', 'Gold', 'Platinum'],
      roles: ROLES,
    },
  };

  const gold = db.members[0];
  const silver = db.members[1];
  const coach = db.users.find((u) => u.role === 'fitness_coach');
  const eq = db.equipment.filter((e) => e.status === 'available');

  db.invoices.push({
    id: id('inv'),
    number: 'INV-2026-001',
    memberId: gold.id,
    status: 'paid',
    issuedAt: '2026-08-01T10:00:00.000Z',
    dueAt: '2026-08-08T10:00:00.000Z',
    lines: [{ description: 'Gold membership — Aug 2026', qty: 1, unitPrice: 89 }],
    subtotal: 89,
    tax: 7.12,
    total: 96.12,
    promoCode: null,
    discount: 0,
  });

  db.payments.push({
    id: id('pay'),
    memberId: gold.id,
    invoiceId: db.invoices[0].id,
    amount: 96.12,
    method: 'card',
    status: 'captured',
    paidAt: '2026-08-01T10:05:00.000Z',
    reference: 'ch_demo_001',
  });

  db.invoices.push({
    id: id('inv'),
    number: 'INV-2026-002',
    memberId: silver.id,
    status: 'open',
    issuedAt: '2026-08-10T10:00:00.000Z',
    dueAt: '2026-08-17T10:00:00.000Z',
    lines: [{ description: 'Silver membership — Aug 2026', qty: 1, unitPrice: 59 }],
    subtotal: 59,
    tax: 4.72,
    total: 63.72,
    promoCode: null,
    discount: 0,
  });

  const start = new Date();
  start.setHours(start.getHours() + 2, 0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  db.appointments.push({
    id: id('apt'),
    memberId: gold.id,
    coachUserId: coach.id,
    title: 'PT — lower body',
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    status: 'scheduled',
    location: 'Floor B',
    notes: 'Focus squat pattern',
  });

  db.trainingSessions.push({
    id: id('trn'),
    memberId: gold.id,
    coachUserId: coach.id,
    activityTypeId: db.activityTypes.find((a) => a.name === 'Personal Training').id,
    startedAt: '2026-08-12T18:00:00.000Z',
    endedAt: '2026-08-12T19:00:00.000Z',
    equipmentIds: [eq[1].id],
    notes: '5x5 back squat progression',
    calories: 420,
  });

  saveDb(db);
  console.log(`Seeded Pulse DB with ${db.users.length} users, ${db.members.length} members.`);
  console.log('Roles:', ROLES.join(', '));
}

seed();
