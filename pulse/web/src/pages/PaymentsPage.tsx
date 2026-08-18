import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api, fmtWhen, money, type Invoice, type Member, type Payment } from '../lib/api';

export function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ memberId: '', invoiceId: '', amount: '', method: 'card' });

  async function load() {
    const [p, m, i] = await Promise.all([
      api<Payment[]>('/api/payments'),
      api<Member[]>('/api/members'),
      api<Invoice[]>('/api/invoices'),
    ]);
    setPayments(p);
    setMembers(m);
    setInvoices(i.filter((x) => x.status === 'open'));
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api('/api/payments', {
        method: 'POST',
        body: JSON.stringify({
          memberId: form.memberId,
          invoiceId: form.invoiceId || undefined,
          amount: Number(form.amount),
          method: form.method,
        }),
      });
      setForm({ memberId: '', invoiceId: '', amount: '', method: 'card' });
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
          <h1>Payments</h1>
          <p>Capture card / cash payments and close linked invoices.</p>
        </div>
      </div>
      {error ? <div className="error-banner">{error}</div> : null}

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head">
            <h2>Ledger</h2>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Member</th>
                  <th>Amount</th>
                  <th>Method</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>{fmtWhen(p.paidAt)}</td>
                    <td>
                      {p.member ? `${p.member.firstName} ${p.member.lastName}` : p.memberId}
                    </td>
                    <td>{money(p.amount)}</td>
                    <td>
                      <span className="badge ok">{p.method}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Record payment</h2>
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
                    {m.firstName} {m.lastName} ({m.memberCode})
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Open invoice (optional)</span>
              <select
                value={form.invoiceId}
                onChange={(e) => {
                  const inv = invoices.find((i) => i.id === e.target.value);
                  setForm({
                    ...form,
                    invoiceId: e.target.value,
                    amount: inv ? String(inv.total) : form.amount,
                    memberId: inv?.memberId || form.memberId,
                  });
                }}
              >
                <option value="">None</option>
                {invoices.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.number} — {money(i.total)}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-grid two">
              <label className="field">
                <span>Amount</span>
                <input
                  required
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Method</span>
                <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                  <option value="card">Card</option>
                  <option value="cash">Cash</option>
                  <option value="transfer">Transfer</option>
                </select>
              </label>
            </div>
            <button type="submit" className="btn btn-primary">
              Capture payment
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
