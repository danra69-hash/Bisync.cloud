-- Pulse schema — applied by pulse/api on startup (idempotent).
-- Multi-tenancy: companies → locations; business rows carry company_id (+ location_id where needed).

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  plans JSONB NOT NULL DEFAULT '["Day Pass","Silver","Gold","Platinum"]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, code)
);

CREATE TABLE IF NOT EXISTS club_meta (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  club_name TEXT NOT NULL DEFAULT 'Pulse Fitness Club',
  currency TEXT NOT NULL DEFAULT 'USD',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  plans JSONB NOT NULL DEFAULT '["Day Pass","Silver","Gold","Platinum"]'::jsonb
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  password TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_company_memberships (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  PRIMARY KEY (user_id, company_id)
);

CREATE TABLE IF NOT EXISTS user_location_access (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  location_id TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, location_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id TEXT REFERENCES companies(id) ON DELETE SET NULL,
  location_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  company_id TEXT REFERENCES companies(id),
  home_location_id TEXT REFERENCES locations(id),
  member_code TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  plan TEXT NOT NULL DEFAULT 'Silver',
  status TEXT NOT NULL DEFAULT 'lead',
  joined_at TIMESTAMPTZ,
  renews_at TIMESTAMPTZ,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT NOT NULL DEFAULT '',
  sales_owner_email TEXT
);

CREATE TABLE IF NOT EXISTS promotions (
  id TEXT PRIMARY KEY,
  company_id TEXT REFERENCES companies(id),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  discount_type TEXT NOT NULL,
  discount_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  applies_to TEXT NOT NULL DEFAULT 'any',
  status TEXT NOT NULL DEFAULT 'scheduled',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  created_by TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  company_id TEXT REFERENCES companies(id),
  number TEXT NOT NULL,
  member_id TEXT NOT NULL REFERENCES members(id),
  status TEXT NOT NULL DEFAULT 'open',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_at TIMESTAMPTZ NOT NULL,
  lines JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  promo_code TEXT,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  company_id TEXT REFERENCES companies(id),
  member_id TEXT NOT NULL REFERENCES members(id),
  invoice_id TEXT REFERENCES invoices(id),
  amount NUMERIC(12,2) NOT NULL,
  method TEXT NOT NULL DEFAULT 'card',
  status TEXT NOT NULL DEFAULT 'captured',
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reference TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  company_id TEXT REFERENCES companies(id),
  location_id TEXT REFERENCES locations(id),
  member_id TEXT NOT NULL REFERENCES members(id),
  coach_user_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  area TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS equipment (
  id TEXT PRIMARY KEY,
  company_id TEXT REFERENCES companies(id),
  location_id TEXT REFERENCES locations(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  status TEXT NOT NULL DEFAULT 'available',
  area TEXT NOT NULL DEFAULT '',
  last_service_at TIMESTAMPTZ,
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS activity_types (
  id TEXT PRIMARY KEY,
  company_id TEXT REFERENCES companies(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS training_sessions (
  id TEXT PRIMARY KEY,
  company_id TEXT REFERENCES companies(id),
  location_id TEXT REFERENCES locations(id),
  member_id TEXT NOT NULL REFERENCES members(id),
  coach_user_id TEXT REFERENCES users(id),
  activity_type_id TEXT NOT NULL REFERENCES activity_types(id),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  equipment_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT NOT NULL DEFAULT '',
  calories INTEGER
);

-- Subscription catalog (Product tab). Details expanded later via Create.
CREATE TABLE IF NOT EXISTS subscription_products (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  plan_code TEXT NOT NULL,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  billing_interval TEXT NOT NULL DEFAULT 'month',
  description TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, plan_code)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);
CREATE INDEX IF NOT EXISTS idx_invoices_member ON invoices(member_id);
CREATE INDEX IF NOT EXISTS idx_payments_member ON payments(member_id);
CREATE INDEX IF NOT EXISTS idx_appointments_starts ON appointments(starts_at);
CREATE INDEX IF NOT EXISTS idx_training_started ON training_sessions(started_at DESC);

-- ── mobile.pulse ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriber_accounts (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  pin TEXT NOT NULL DEFAULT '1234',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coaching_packages (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  stamp_total INTEGER NOT NULL DEFAULT 10,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS member_packages (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  package_id TEXT NOT NULL REFERENCES coaching_packages(id),
  stamps_total INTEGER NOT NULL,
  stamps_used INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance_stamps (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  member_package_id TEXT NOT NULL REFERENCES member_packages(id) ON DELETE CASCADE,
  stamp_index INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'available',
  location_id TEXT REFERENCES locations(id),
  session_date TEXT,
  session_time TEXT,
  random4 TEXT,
  qr_payload TEXT,
  created_by_role TEXT,
  created_by_id TEXT,
  confirmed_by_role TEXT,
  confirmed_by_id TEXT,
  confirmed_at TIMESTAMPTZ,
  mobile_session_id TEXT,
  UNIQUE (member_package_id, stamp_index)
);

CREATE TABLE IF NOT EXISTS mobile_sessions (
  token TEXT PRIMARY KEY,
  actor_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mobile_training_sessions (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  location_id TEXT REFERENCES locations(id),
  member_id TEXT NOT NULL REFERENCES members(id),
  coach_user_id TEXT REFERENCES users(id),
  owner_type TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  attendance_stamp_id TEXT REFERENCES attendance_stamps(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  end_qr_payload TEXT,
  end_random4 TEXT,
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS mobile_training_sets (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES mobile_training_sessions(id) ON DELETE CASCADE,
  set_index INTEGER NOT NULL,
  modality TEXT NOT NULL,
  equipment_id TEXT,
  equipment_name TEXT NOT NULL DEFAULT '',
  weight NUMERIC(12,2),
  reps INTEGER,
  sets_count INTEGER,
  speed NUMERIC(12,2),
  incline NUMERIC(12,2),
  duration_sec INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


