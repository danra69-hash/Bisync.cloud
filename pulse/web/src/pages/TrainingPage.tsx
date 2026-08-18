import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api, fmtWhen, type ActivityType, type Equipment, type Member, type TrainingSession } from '../lib/api';
import { TrainingCalorieLibrary } from './TrainingCalorieLibrary';

type TrainingTab = 'sessions' | 'library';

export function TrainingPage() {
  const [tab, setTab] = useState<TrainingTab>('sessions');
  const [rows, setRows] = useState<TrainingSession[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [activities, setActivities] = useState<ActivityType[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    memberId: '',
    activityTypeId: '',
    startedAt: '',
    endedAt: '',
    equipmentIds: [] as string[],
    notes: '',
    calories: '',
  });

  async function load() {
    const [t, m, a, e] = await Promise.all([
      api<TrainingSession[]>('/api/training'),
      api<Member[]>('/api/members'),
      api<ActivityType[]>('/api/activity-types'),
      api<Equipment[]>('/api/equipment'),
    ]);
    setRows(t);
    setMembers(m);
    setActivities(a);
    setEquipment(e);
  }

  useEffect(() => {
    if (tab !== 'sessions') return;
    load().catch((e) => setError(e.message));
  }, [tab]);

  function toggleEquipment(id: string) {
    setForm((prev) => ({
      ...prev,
      equipmentIds: prev.equipmentIds.includes(id)
        ? prev.equipmentIds.filter((x) => x !== id)
        : [...prev.equipmentIds, id],
    }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api('/api/training', {
        method: 'POST',
        body: JSON.stringify({
          memberId: form.memberId,
          activityTypeId: form.activityTypeId,
          startedAt: new Date(form.startedAt).toISOString(),
          endedAt: form.endedAt ? new Date(form.endedAt).toISOString() : undefined,
          equipmentIds: form.equipmentIds,
          notes: form.notes,
          calories: form.calories ? Number(form.calories) : undefined,
        }),
      });
      setForm({
        memberId: '',
        activityTypeId: '',
        startedAt: '',
        endedAt: '',
        equipmentIds: [],
        notes: '',
        calories: '',
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <div className="stack reveal is-in">
      <div className="training-subnav" role="tablist" aria-label="Training sections">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'sessions'}
          className={`chip${tab === 'sessions' ? ' is-active' : ''}`}
          onClick={() => setTab('sessions')}
        >
          Sessions
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'library'}
          className={`chip${tab === 'library' ? ' is-active' : ''}`}
          onClick={() => setTab('library')}
          data-testid="training-ref-library-tab"
        >
          Ref &amp; Library
        </button>
      </div>

      {tab === 'library' ? <TrainingCalorieLibrary /> : null}

      {tab === 'sessions' ? (
        <>
          <div className="page-head">
            <div>
              <p className="eyebrow">Training detail</p>
              <h1>Sessions</h1>
              <p>Log activity type plus which equipment was used on the floor.</p>
            </div>
          </div>
          {error ? <div className="error-banner">{error}</div> : null}

          <div className="grid-2">
            <section className="panel">
              <div className="panel-head">
                <h2>History</h2>
              </div>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Member</th>
                      <th>Activity</th>
                      <th>Equipment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((t) => (
                      <tr key={t.id}>
                        <td>{fmtWhen(t.startedAt)}</td>
                        <td>
                          {t.member ? `${t.member.firstName} ${t.member.lastName}` : t.memberId}
                          {t.calories ? (
                            <div className="muted" style={{ fontSize: '0.78rem' }}>
                              {t.calories} kcal
                            </div>
                          ) : null}
                        </td>
                        <td>{t.activityType?.name ?? '—'}</td>
                        <td>
                          {(t.equipment ?? []).map((e) => e.code).join(', ') || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <h2>Log training</h2>
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
                <label className="field">
                  <span>Activity type</span>
                  <select
                    required
                    value={form.activityTypeId}
                    onChange={(e) => setForm({ ...form, activityTypeId: e.target.value })}
                  >
                    <option value="">Select…</option>
                    {activities.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="form-grid two">
                  <label className="field">
                    <span>Started</span>
                    <input
                      required
                      type="datetime-local"
                      value={form.startedAt}
                      onChange={(e) => setForm({ ...form, startedAt: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span>Ended</span>
                    <input
                      type="datetime-local"
                      value={form.endedAt}
                      onChange={(e) => setForm({ ...form, endedAt: e.target.value })}
                    />
                  </label>
                </div>
                <label className="field">
                  <span>Equipment used</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {equipment.map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        className="chip"
                        style={
                          form.equipmentIds.includes(e.id)
                            ? { borderColor: 'var(--color-accent)', color: 'var(--color-accent)' }
                            : undefined
                        }
                        disabled={e.status === 'maintenance'}
                        onClick={() => toggleEquipment(e.id)}
                      >
                        {e.code}
                      </button>
                    ))}
                  </div>
                </label>
                <label className="field">
                  <span>Calories (optional)</span>
                  <input
                    type="number"
                    value={form.calories}
                    onChange={(e) => setForm({ ...form, calories: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Notes</span>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </label>
                <button type="submit" className="btn btn-primary">
                  Save session
                </button>
              </form>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
