/**
 * End-to-end API smoke for Pulse (requires API on :5400).
 */
const BASE = process.env.PULSE_API_URL || 'http://127.0.0.1:5400';

async function req(path, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(json)}`);
  return json;
}

async function main() {
  const health = await req('/api/health');
  if (!health.ok) throw new Error('health failed');
  if (health.db !== 'postgres') throw new Error(`expected postgres db, got ${health.db}`);

  const login = await req('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@pulse.club', password: 'pulse123' },
  });
  const token = login.token;

  const dash = await req('/api/dashboard', { token });
  const members = await req('/api/members', { token });
  const equipment = await req('/api/equipment', { token });
  const training = await req('/api/training', { token });

  // Coach role cannot hit payments
  const coach = await req('/api/auth/login', {
    method: 'POST',
    body: { email: 'coach@pulse.club', password: 'pulse123' },
  });
  let denied = false;
  try {
    await req('/api/payments', { token: coach.token });
  } catch {
    denied = true;
  }
  if (!denied) throw new Error('coach should be denied payments');

  console.log(
    JSON.stringify(
      {
        ok: true,
        activeMembers: dash.stats.activeMembers,
        members: members.length,
        equipment: equipment.length,
        training: training.length,
        coachDeniedPayments: denied,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
