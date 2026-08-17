import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api, type User } from '../lib/api';

const ROLES = [
  { id: 'management', label: 'Management' },
  { id: 'admin', label: 'Admin' },
  { id: 'accounting', label: 'Accounting' },
  { id: 'fitness_coach', label: 'Fitness Coach' },
  { id: 'sales', label: 'Sales' },
];

// Superuser is seeded / platform-only — not creatable from Team invite.

export function TeamPage() {
  const [rows, setRows] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', role: 'sales', password: 'pulse123' });

  async function load() {
    setRows(await api<User[]>('/api/team'));
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api('/api/team', { method: 'POST', body: JSON.stringify(form) });
      setForm({ name: '', email: '', role: 'sales', password: 'pulse123' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <div className="stack reveal is-in">
      <div className="page-head">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Team</h1>
          <p>Management / Admin / Accounting / Fitness Coach / Sales — module access follows role. Superuser is platform-seeded.</p>
        </div>
      </div>
      {error ? <div className="error-banner">{error}</div> : null}

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head">
            <h2>Directory</h2>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Modules</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id}>
                    <td>
                      {u.name}
                      <div className="muted" style={{ fontSize: '0.8rem' }}>
                        {u.email}
                      </div>
                    </td>
                    <td>
                      <span className="badge accent">{u.roleLabel}</span>
                    </td>
                    <td className="mono" style={{ textTransform: 'none', letterSpacing: 0, fontSize: '0.72rem' }}>
                      {(u.modules || []).join(' · ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Invite teammate</h2>
          </div>
          <form className="panel-body form-grid" onSubmit={submit}>
            <label className="field">
              <span>Name</span>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="field">
              <span>Email</span>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Role</span>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Temp password</span>
              <input
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </label>
            <button type="submit" className="btn btn-primary">
              Add teammate
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
