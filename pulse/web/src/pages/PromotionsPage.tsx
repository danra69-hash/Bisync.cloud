import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api, fmtWhen, type Promotion } from '../lib/api';

export function PromotionsPage() {
  const [rows, setRows] = useState<Promotion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    code: '',
    discountType: 'percent',
    discountValue: '15',
    appliesTo: 'any',
    startsAt: '',
    endsAt: '',
    status: 'scheduled',
  });

  async function load() {
    setRows(await api<Promotion[]>('/api/promotions'));
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api('/api/promotions', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          discountValue: Number(form.discountValue),
          startsAt: new Date(form.startsAt).toISOString(),
          endsAt: new Date(form.endsAt).toISOString(),
        }),
      });
      setForm({
        name: '',
        code: '',
        discountType: 'percent',
        discountValue: '15',
        appliesTo: 'any',
        startsAt: '',
        endsAt: '',
        status: 'scheduled',
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <div className="stack reveal is-in">
      <div className="page-head">
        <div>
          <p className="eyebrow">CRM · Growth</p>
          <h1>Promotion scheduler</h1>
          <p>Schedule discount windows by plan and apply codes on invoices.</p>
        </div>
      </div>
      {error ? <div className="error-banner">{error}</div> : null}

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head">
            <h2>Schedule</h2>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Window</th>
                  <th>Discount</th>
                  <th>Live</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="mono">{p.code}</div>
                      <div className="muted" style={{ fontSize: '0.8rem' }}>
                        {p.name}
                      </div>
                    </td>
                    <td>
                      {fmtWhen(p.startsAt)}
                      <div className="muted">→ {fmtWhen(p.endsAt)}</div>
                    </td>
                    <td>
                      {p.discountType === 'percent' ? `${p.discountValue}%` : `$${p.discountValue}`}
                      <div className="muted">{p.appliesTo}</div>
                    </td>
                    <td>
                      <span className={`badge ${p.currentlyActive ? 'ok' : 'accent'}`}>
                        {p.currentlyActive ? 'active now' : p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Schedule promotion</h2>
          </div>
          <form className="panel-body form-grid" onSubmit={submit}>
            <label className="field">
              <span>Name</span>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <div className="form-grid two">
              <label className="field">
                <span>Code</span>
                <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              </label>
              <label className="field">
                <span>Applies to</span>
                <select value={form.appliesTo} onChange={(e) => setForm({ ...form, appliesTo: e.target.value })}>
                  <option value="any">Any plan</option>
                  <option>Silver</option>
                  <option>Gold</option>
                  <option>Platinum</option>
                </select>
              </label>
            </div>
            <div className="form-grid two">
              <label className="field">
                <span>Type</span>
                <select
                  value={form.discountType}
                  onChange={(e) => setForm({ ...form, discountType: e.target.value })}
                >
                  <option value="percent">Percent</option>
                  <option value="fixed">Fixed</option>
                </select>
              </label>
              <label className="field">
                <span>Value</span>
                <input
                  required
                  type="number"
                  value={form.discountValue}
                  onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                />
              </label>
            </div>
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
            <button type="submit" className="btn btn-primary">
              Schedule
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
