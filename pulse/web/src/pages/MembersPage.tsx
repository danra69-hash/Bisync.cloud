import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api, type Member } from '../lib/api';

export function MembersPage() {
  const [rows, setRows] = useState<Member[]>([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    plan: 'Silver',
    status: 'lead',
  });

  async function load(query = q) {
    const data = await api<Member[]>(`/api/members?q=${encodeURIComponent(query)}`);
    setRows(data);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api('/api/members', { method: 'POST', body: JSON.stringify(form) });
      setForm({ firstName: '', lastName: '', email: '', phone: '', plan: 'Silver', status: 'lead' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function activate(id: string) {
    await api(`/api/members/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'active' }),
    });
    await load();
  }

  return (
    <div className="stack reveal is-in">
      <div className="page-head">
        <div>
          <p className="eyebrow">CRM</p>
          <h1>Members</h1>
          <p>Leads and active memberships — sales owns intake; accounting closes billing.</p>
        </div>
      </div>
      {error ? <div className="error-banner">{error}</div> : null}

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head">
            <h2>Directory</h2>
          </div>
          <div className="panel-body">
            <div className="toolbar">
              <input
                type="search"
                placeholder="Search members"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void load();
                }}
              />
              <button type="button" className="btn btn-ghost" onClick={() => void load()}>
                Search
              </button>
            </div>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Plan</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((m) => (
                    <tr key={m.id}>
                      <td className="mono">{m.memberCode}</td>
                      <td>
                        {m.firstName} {m.lastName}
                        <div className="muted" style={{ fontSize: '0.8rem' }}>
                          {m.email}
                        </div>
                      </td>
                      <td>{m.plan}</td>
                      <td>
                        <span className={`badge ${m.status === 'active' ? 'ok' : 'accent'}`}>
                          {m.status}
                        </span>
                      </td>
                      <td>
                        {m.status !== 'active' ? (
                          <button type="button" className="btn btn-ghost" onClick={() => void activate(m.id)}>
                            Activate
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Add member / lead</h2>
          </div>
          <form className="panel-body form-grid" onSubmit={create}>
            <div className="form-grid two">
              <label className="field">
                <span>First name</span>
                <input
                  required
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Last name</span>
                <input
                  required
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                />
              </label>
            </div>
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Phone</span>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </label>
            <div className="form-grid two">
              <label className="field">
                <span>Plan</span>
                <select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}>
                  <option>Day Pass</option>
                  <option>Silver</option>
                  <option>Gold</option>
                  <option>Platinum</option>
                </select>
              </label>
              <label className="field">
                <span>Status</span>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="lead">Lead</option>
                  <option value="active">Active</option>
                </select>
              </label>
            </div>
            <button type="submit" className="btn btn-primary">
              Save member
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
