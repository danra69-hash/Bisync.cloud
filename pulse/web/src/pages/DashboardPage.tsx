import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtWhen, money, type DashboardData } from '../lib/api';

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [productCount, setProductCount] = useState<number | null>(null);

  useEffect(() => {
    api<DashboardData>('/api/dashboard')
      .then(setData)
      .catch((e) => setError(e.message));
    api<{ summary?: { productCount?: number } }>('/api/products')
      .then((r) => setProductCount(r.summary?.productCount ?? 0))
      .catch(() => setProductCount(null));
  }, []);

  if (error) return <div className="error-banner">{error}</div>;
  if (!data) return <p className="mono muted">Loading dashboard…</p>;

  const s = data.stats;
  return (
    <div className="stack reveal is-in">
      <div className="page-head" style={{ alignItems: 'flex-end' }}>
        <div>
          <p className="eyebrow">Overview</p>
          <h1>Club pulse</h1>
          <p>Live membership, billing, trainer load, and equipment health.</p>
        </div>
        {productCount !== null ? (
          <Link to="/app/products" className="btn btn-primary">
            Product catalog ({productCount})
          </Link>
        ) : null}
      </div>

      <div className="stat-row">
        <div className="stat">
          <div className="label">Active members</div>
          <div className="value">{s.activeMembers}</div>
        </div>
        <div className="stat">
          <div className="label">Leads</div>
          <div className="value">{s.leads}</div>
        </div>
        <div className="stat">
          <div className="label">Open invoices</div>
          <div className="value">{money(s.openInvoiceTotal)}</div>
        </div>
        <div className="stat">
          <div className="label">Captured</div>
          <div className="value">{money(s.capturedRevenue)}</div>
        </div>
        <div className="stat">
          <div className="label">Upcoming PT</div>
          <div className="value">{s.upcomingAppointments}</div>
        </div>
        <div className="stat">
          <div className="label">Equipment issues</div>
          <div className="value">{s.equipmentIssues}</div>
        </div>
      </div>

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head">
            <h2>Upcoming trainer appointments</h2>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Title</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.upcoming.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="empty">
                      No upcoming sessions
                    </td>
                  </tr>
                ) : (
                  data.upcoming.map((a) => (
                    <tr key={a.id}>
                      <td>{fmtWhen(a.startsAt)}</td>
                      <td>{a.title}</td>
                      <td>
                        <span className="badge accent">{a.status}</span>
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
            <h2>Equipment attention</h2>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.equipmentIssues.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="empty">
                      All equipment available
                    </td>
                  </tr>
                ) : (
                  data.equipmentIssues.map((e) => (
                    <tr key={e.id}>
                      <td className="mono">{e.code}</td>
                      <td>{e.name}</td>
                      <td>
                        <span className="badge warn">{e.status}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
