import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api, type Equipment } from '../lib/api';

export function EquipmentPage() {
  const [rows, setRows] = useState<Equipment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: '',
    name: '',
    category: 'Cardio',
    location: 'Floor A',
    status: 'available',
    notes: '',
  });

  async function load() {
    setRows(await api<Equipment[]>('/api/equipment'));
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api('/api/equipment', { method: 'POST', body: JSON.stringify(form) });
      setForm({ code: '', name: '', category: 'Cardio', location: 'Floor A', status: 'available', notes: '' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function setStatus(id: string, status: string) {
    await api(`/api/equipment/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    await load();
  }

  return (
    <div className="stack reveal is-in">
      <div className="page-head">
        <div>
          <p className="eyebrow">Floor</p>
          <h1>Fitness equipment</h1>
          <p>Track availability, location, and maintenance for every machine.</p>
        </div>
      </div>
      {error ? <div className="error-banner">{error}</div> : null}

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head">
            <h2>Inventory</h2>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td className="mono">{e.code}</td>
                    <td>
                      {e.name}
                      <div className="muted" style={{ fontSize: '0.8rem' }}>
                        {e.location}
                      </div>
                    </td>
                    <td>{e.category}</td>
                    <td>
                      <span className={`badge ${e.status === 'available' ? 'ok' : 'warn'}`}>{e.status}</span>
                    </td>
                    <td>
                      {e.status === 'available' ? (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => void setStatus(e.id, 'maintenance')}
                        >
                          Maintenance
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => void setStatus(e.id, 'available')}
                        >
                          Mark available
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Add equipment</h2>
          </div>
          <form className="panel-body form-grid" onSubmit={submit}>
            <div className="form-grid two">
              <label className="field">
                <span>Code</span>
                <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              </label>
              <label className="field">
                <span>Category</span>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option>Cardio</option>
                  <option>Strength</option>
                  <option>Functional</option>
                  <option>Recovery</option>
                </select>
              </label>
            </div>
            <label className="field">
              <span>Name</span>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="field">
              <span>Location</span>
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </label>
            <label className="field">
              <span>Notes</span>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>
            <button type="submit" className="btn btn-primary">
              Add equipment
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
