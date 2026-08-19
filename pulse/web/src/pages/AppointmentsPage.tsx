import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api, fmtWhen, type Appointment, type Member, type User } from '../lib/api';

export function AppointmentsPage() {
  const [rows, setRows] = useState<Appointment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [coaches, setCoaches] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    memberId: '',
    coachUserId: '',
    title: 'Personal training',
    startsAt: '',
    endsAt: '',
    location: 'Floor B',
    notes: '',
  });

  async function load() {
    const [a, m] = await Promise.all([
      api<Appointment[]>('/api/appointments'),
      api<Member[]>('/api/members'),
    ]);
    setRows(a);
    setMembers(m.filter((x) => x.status === 'active' || x.status === 'lead'));
    try {
      const team = await api<User[]>('/api/team');
      setCoaches(team.filter((u) => u.role === 'fitness_coach'));
    } catch {
      setCoaches([]);
    }
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const startsAt = new Date(form.startsAt).toISOString();
      const endsAt = new Date(form.endsAt).toISOString();
      await api('/api/appointments', {
        method: 'POST',
        body: JSON.stringify({ ...form, startsAt, endsAt, coachUserId: form.coachUserId || undefined }),
      });
      setForm({ ...form, notes: '' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function complete(id: string) {
    await api(`/api/appointments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'completed' }),
    });
    await load();
  }

  return (
    <div className="stack reveal is-in">
      <div className="page-head">
        <div>
          <p className="eyebrow">Coaching</p>
          <h1>Trainer appointments</h1>
          <p>Book PT sessions between members and fitness coaches.</p>
        </div>
      </div>
      {error ? <div className="error-banner">{error}</div> : null}

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head">
            <h2>Calendar list</h2>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Session</th>
                  <th>Coach</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id}>
                    <td>{fmtWhen(a.startsAt)}</td>
                    <td>
                      {a.title}
                      <div className="muted" style={{ fontSize: '0.8rem' }}>
                        {a.member ? `${a.member.firstName} ${a.member.lastName}` : a.memberId}
                      </div>
                    </td>
                    <td>{a.coach?.name ?? '—'}</td>
                    <td>
                      <span className={`badge ${a.status === 'completed' ? 'ok' : 'accent'}`}>
                        {a.status}
                      </span>
                    </td>
                    <td>
                      {a.status === 'scheduled' ? (
                        <button type="button" className="btn btn-ghost" onClick={() => void complete(a.id)}>
                          Complete
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Book appointment</h2>
          </div>
          <form className="panel-body form-grid" onSubmit={submit}>
            <label className="field">
              <span>Member</span>
              <select
                required
                value={form.memberId}
                onChange={(e) => setForm({ ...form, memberId: e.target.value })}
              >
                <option value="">Select…</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.firstName} {m.lastName}
                  </option>
                ))}
              </select>
            </label>
            {coaches.length > 0 ? (
              <label className="field">
                <span>Coach</span>
                <select
                  value={form.coachUserId}
                  onChange={(e) => setForm({ ...form, coachUserId: e.target.value })}
                >
                  <option value="">Default coach</option>
                  {coaches.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="field">
              <span>Title</span>
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </label>
            <div className="form-grid two">
              <label className="field">
                <span>Starts</span>
                <input
                  required
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Ends</span>
                <input
                  required
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                />
              </label>
            </div>
            <label className="field">
              <span>Location</span>
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </label>
            <label className="field">
              <span>Notes</span>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>
            <button type="submit" className="btn btn-primary">
              Book session
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
