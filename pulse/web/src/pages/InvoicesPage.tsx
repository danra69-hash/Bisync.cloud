import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api, fmtWhen, money, type Invoice, type Member } from '../lib/api';

export function InvoicesPage() {
  const [rows, setRows] = useState<Invoice[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    memberId: '',
    description: 'Membership fee',
    unitPrice: '59',
    promoCode: '',
  });

  async function load() {
    const [inv, mem] = await Promise.all([
      api<Invoice[]>('/api/invoices'),
      api<Member[]>('/api/members'),
    ]);
    setRows(inv);
    setMembers(mem);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api('/api/invoices', {
        method: 'POST',
        body: JSON.stringify({
          memberId: form.memberId,
          promoCode: form.promoCode || undefined,
          lines: [{ description: form.description, qty: 1, unitPrice: Number(form.unitPrice) }],
        }),
      });
      setForm({ ...form, promoCode: '' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <div className="stack reveal is-in">
      <div className="page-head">
        <div>
          <p className="eyebrow">CRM · Billing</p>
          <h1>Invoices</h1>
          <p>Issue membership invoices with optional promotion codes.</p>
        </div>
      </div>
      {error ? <div className="error-banner">{error}</div> : null}

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head">
            <h2>Issued</h2>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Member</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Due</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((i) => (
                  <tr key={i.id}>
                    <td className="mono">{i.number}</td>
                    <td>
                      {i.member ? `${i.member.firstName} ${i.member.lastName}` : i.memberId}
                      {i.promoCode ? (
                        <div className="muted" style={{ fontSize: '0.78rem' }}>
                          Promo {i.promoCode}
                        </div>
                      ) : null}
                    </td>
                    <td>{money(i.total)}</td>
                    <td>
                      <span className={`badge ${i.status === 'paid' ? 'ok' : 'warn'}`}>{i.status}</span>
                    </td>
                    <td>{fmtWhen(i.dueAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Create invoice</h2>
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
                    {m.firstName} {m.lastName} — {m.plan}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Description</span>
              <input
                required
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </label>
            <div className="form-grid two">
              <label className="field">
                <span>Unit price</span>
                <input
                  required
                  type="number"
                  step="0.01"
                  value={form.unitPrice}
                  onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Promo code</span>
                <input
                  value={form.promoCode}
                  onChange={(e) => setForm({ ...form, promoCode: e.target.value })}
                  placeholder="SUMMER26"
                />
              </label>
            </div>
            <button type="submit" className="btn btn-primary">
              Issue invoice
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
