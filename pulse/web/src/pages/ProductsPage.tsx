import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api, getCompanyId, fmtWhen, money, type Promotion } from '../lib/api';

interface ProductSummary {
  id: string;
  name: string;
  planCode: string;
  price: number;
  billingInterval: string;
  description: string;
  active: boolean;
  memberCounts: { active: number; lead: number; total: number };
  promotions: Promotion[];
  activePromotionCount: number;
}

interface ProductsResponse {
  subscriptions: ProductSummary[];
  promotions: Promotion[];
  summary: {
    productCount: number;
    activeProductCount: number;
    promotionCount: number;
    livePromotionCount: number;
  };
}

export function ProductsPage() {
  const [data, setData] = useState<ProductsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: '',
    planCode: '',
    price: '',
    billingInterval: 'month',
    description: '',
  });
  const companyId = getCompanyId();

  async function load() {
    setData(await api<ProductsResponse>('/api/products'));
  }

  useEffect(() => {
    setError(null);
    setData(null);
    load().catch((e) => setError(e.message));
  }, [companyId]);

  async function create(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api('/api/products', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          planCode: form.planCode || form.name,
          price: Number(form.price) || 0,
          billingInterval: form.billingInterval,
          description: form.description,
        }),
      });
      setForm({ name: '', planCode: '', price: '', billingInterval: 'month', description: '' });
      setCreating(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  const summary = data?.summary;
  const rows = data?.subscriptions ?? [];

  return (
    <div className="stack reveal is-in">
      <div className="page-head" style={{ alignItems: 'flex-end' }}>
        <div>
          <p className="eyebrow">Catalog</p>
          <h1>Product</h1>
          <p>Subscription plans for this company, with linked promotions and member uptake.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setCreating((v) => !v)}>
          {creating ? 'Cancel' : 'Create new'}
        </button>
      </div>
      {error ? <div className="error-banner">{error}</div> : null}
      {!error && !data ? <p className="mono muted">Loading products…</p> : null}

      {summary ? (
        <div className="stat-grid">
          <div className="stat">
            <div className="eyebrow">Subscriptions</div>
            <div className="value">{summary.activeProductCount}</div>
            <div className="muted">{summary.productCount} total</div>
          </div>
          <div className="stat">
            <div className="eyebrow">Promotions</div>
            <div className="value">{summary.livePromotionCount}</div>
            <div className="muted">{summary.promotionCount} scheduled / ended</div>
          </div>
        </div>
      ) : null}

      {creating ? (
        <section className="panel">
          <div className="panel-head">
            <h2>Create subscription product</h2>
          </div>
          <form className="panel-body form-grid" onSubmit={create}>
            <p className="muted" style={{ margin: 0 }}>
              Placeholder form — more product details can be added later.
            </p>
            <div className="form-grid two">
              <label className="field">
                <span>Name</span>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Gold membership"
                />
              </label>
              <label className="field">
                <span>Plan code</span>
                <input
                  value={form.planCode}
                  onChange={(e) => setForm({ ...form, planCode: e.target.value })}
                  placeholder="Gold"
                />
              </label>
            </div>
            <div className="form-grid two">
              <label className="field">
                <span>Price</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="89"
                />
              </label>
              <label className="field">
                <span>Billing</span>
                <select
                  value={form.billingInterval}
                  onChange={(e) => setForm({ ...form, billingInterval: e.target.value })}
                >
                  <option value="day">Day</option>
                  <option value="month">Month</option>
                  <option value="year">Year</option>
                </select>
              </label>
            </div>
            <label className="field">
              <span>Notes (optional)</span>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Details coming later…"
              />
            </label>
            <button type="submit" className="btn btn-primary">
              Save draft product
            </button>
          </form>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-head">
          <h2>Subscription summary</h2>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Price</th>
                <th>Members</th>
                <th>Promotions</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="empty">No subscription products yet. Use Create new.</div>
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.name}</strong>
                      <div className="muted" style={{ fontSize: '0.8rem' }}>
                        {row.planCode}
                        {row.description ? ` · ${row.description}` : ''}
                      </div>
                    </td>
                    <td className="mono">
                      {money(row.price)}
                      <span className="muted"> / {row.billingInterval}</span>
                    </td>
                    <td>
                      {row.memberCounts.active} active
                      <div className="muted" style={{ fontSize: '0.8rem' }}>
                        {row.memberCounts.lead} leads · {row.memberCounts.total} total
                      </div>
                    </td>
                    <td>
                      {row.promotions.length === 0 ? (
                        <span className="muted">None</span>
                      ) : (
                        <div className="stack" style={{ gap: '0.25rem' }}>
                          {row.promotions.slice(0, 3).map((p) => (
                            <div key={p.id}>
                              <span className={`badge ${p.currentlyActive ? 'ok' : 'accent'}`}>
                                {p.code}
                              </span>{' '}
                              <span className="muted" style={{ fontSize: '0.78rem' }}>
                                {p.discountType === 'percent'
                                  ? `${p.discountValue}%`
                                  : money(p.discountValue)}
                                {p.currentlyActive
                                  ? ' live'
                                  : ` · ${fmtWhen(p.startsAt)}–${fmtWhen(p.endsAt)}`}
                              </span>
                            </div>
                          ))}
                          {row.promotions.length > 3 ? (
                            <span className="muted">+{row.promotions.length - 3} more</span>
                          ) : null}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${row.active ? 'ok' : 'warn'}`}>
                        {row.active ? 'active' : 'inactive'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
