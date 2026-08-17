import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api, getCompanyId } from '../lib/api';

interface SystemCompany {
  id: string;
  code: string;
  name: string;
  currency: string;
  timezone: string;
  plans: string[];
  active?: boolean;
  createdAt?: string;
}

interface SystemLocation {
  id: string;
  companyId: string;
  code: string;
  name: string;
  address: string;
  active: boolean;
}

interface RoleInfo {
  id: string;
  label: string;
  modules: string[];
}

interface SystemConfigResponse {
  company: SystemCompany;
  locations: SystemLocation[];
  roles: RoleInfo[];
  isSuperuser: boolean;
  companies?: { id: string; code: string; name: string; role: string; locationCount: number }[];
}

export function SystemConfigPage() {
  const [data, setData] = useState<SystemConfigResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    name: '',
    currency: 'USD',
    timezone: 'UTC',
    plans: '',
  });
  const [locForm, setLocForm] = useState({ code: '', name: '', address: '' });
  const companyId = getCompanyId();

  async function load() {
    const res = await api<SystemConfigResponse>('/api/system-config');
    setData(res);
    setForm({
      name: res.company.name,
      currency: res.company.currency,
      timezone: res.company.timezone,
      plans: (res.company.plans || []).join(', '),
    });
  }

  useEffect(() => {
    setError(null);
    setSaved(false);
    setData(null);
    load().catch((e) => setError(e.message));
  }, [companyId]);

  async function saveCompany(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    try {
      await api('/api/system-config', {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.name,
          currency: form.currency,
          timezone: form.timezone,
          plans: form.plans,
        }),
      });
      setSaved(true);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
  }

  async function addLocation(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api('/api/system-config/locations', {
        method: 'POST',
        body: JSON.stringify(locForm),
      });
      setLocForm({ code: '', name: '', address: '' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add location');
    }
  }

  return (
    <div className="stack reveal is-in">
      <div className="page-head">
        <div>
          <p className="eyebrow">Platform</p>
          <h1>System Config</h1>
          <p>Company profile, membership plans, locations, and role module map.</p>
        </div>
      </div>
      {error ? <div className="error-banner">{error}</div> : null}
      {saved ? <div className="badge ok">Company settings saved</div> : null}
      {!error && !data ? <p className="mono muted">Loading system config…</p> : null}

      {data ? (
        <>
          {data.isSuperuser && data.companies?.length ? (
            <section className="panel">
              <div className="panel-head">
                <h2>Tenant overview</h2>
              </div>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th>Code</th>
                      <th>Your role</th>
                      <th>Locations</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.companies.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <strong>{c.name}</strong>
                          {c.id === data.company.id ? (
                            <span className="badge accent" style={{ marginLeft: '0.4rem' }}>
                              current
                            </span>
                          ) : null}
                        </td>
                        <td className="mono">{c.code}</td>
                        <td>
                          <span className="badge accent">{c.role}</span>
                        </td>
                        <td>{c.locationCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <div className="grid-2">
            <section className="panel">
              <div className="panel-head">
                <h2>Company</h2>
              </div>
              <form className="panel-body form-grid" onSubmit={saveCompany}>
                <label className="field">
                  <span>Name</span>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </label>
                <div className="form-grid two">
                  <label className="field">
                    <span>Currency</span>
                    <input
                      required
                      value={form.currency}
                      onChange={(e) => setForm({ ...form, currency: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span>Timezone</span>
                    <input
                      required
                      value={form.timezone}
                      onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                    />
                  </label>
                </div>
                <label className="field">
                  <span>Membership plans (comma-separated)</span>
                  <textarea
                    required
                    value={form.plans}
                    onChange={(e) => setForm({ ...form, plans: e.target.value })}
                    placeholder="Day Pass, Silver, Gold, Platinum"
                  />
                </label>
                <p className="muted" style={{ margin: 0, fontSize: '0.82rem' }}>
                  Code <span className="mono">{data.company.code}</span> is immutable.
                </p>
                <button type="submit" className="btn btn-primary">
                  Save company
                </button>
              </form>
            </section>

            <section className="panel">
              <div className="panel-head">
                <h2>Add location</h2>
              </div>
              <form className="panel-body form-grid" onSubmit={addLocation}>
                <div className="form-grid two">
                  <label className="field">
                    <span>Code</span>
                    <input
                      required
                      value={locForm.code}
                      onChange={(e) => setLocForm({ ...locForm, code: e.target.value })}
                      placeholder="DT"
                    />
                  </label>
                  <label className="field">
                    <span>Name</span>
                    <input
                      required
                      value={locForm.name}
                      onChange={(e) => setLocForm({ ...locForm, name: e.target.value })}
                      placeholder="Downtown"
                    />
                  </label>
                </div>
                <label className="field">
                  <span>Address</span>
                  <input
                    value={locForm.address}
                    onChange={(e) => setLocForm({ ...locForm, address: e.target.value })}
                    placeholder="100 Main St"
                  />
                </label>
                <button type="submit" className="btn btn-primary">
                  Add location
                </button>
              </form>
            </section>
          </div>

          <section className="panel">
            <div className="panel-head">
              <h2>Locations</h2>
            </div>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Address</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.locations.length === 0 ? (
                    <tr>
                      <td colSpan={4}>
                        <div className="empty">No locations yet.</div>
                      </td>
                    </tr>
                  ) : (
                    data.locations.map((l) => (
                      <tr key={l.id}>
                        <td className="mono">{l.code}</td>
                        <td>{l.name}</td>
                        <td>{l.address || '—'}</td>
                        <td>
                          <span className={`badge ${l.active ? 'ok' : 'warn'}`}>
                            {l.active ? 'active' : 'inactive'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Role → modules</h2>
            </div>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Role</th>
                    <th>Modules</th>
                  </tr>
                </thead>
                <tbody>
                  {data.roles.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <span className="badge accent">{r.label}</span>
                      </td>
                      <td
                        className="mono"
                        style={{ textTransform: 'none', letterSpacing: 0, fontSize: '0.72rem' }}
                      >
                        {r.modules.join(' · ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
