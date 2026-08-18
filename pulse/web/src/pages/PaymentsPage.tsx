import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, fmtWhen, money, type Invoice, type Member, type Payment } from '../lib/api';
import {
  buildWhatsAppShareHref,
  canOfferPrint,
  invoiceShareMessage,
  openInvoiceReceipt,
} from '../lib/invoiceShare';

export function PaymentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [openInvoices, setOpenInvoices] = useState<Invoice[]>([]);
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ memberId: '', invoiceId: '', amount: '', method: 'card' });
  const [issue, setIssue] = useState({
    memberId: '',
    description: 'Membership fee',
    unitPrice: '59',
    promoCode: '',
  });
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(
    searchParams.get('invoice'),
  );

  async function load() {
    const [p, m, i] = await Promise.all([
      api<Payment[]>('/api/payments'),
      api<Member[]>('/api/members'),
      api<Invoice[]>('/api/invoices'),
    ]);
    setPayments(p);
    setMembers(m);
    setAllInvoices(i);
    setOpenInvoices(i.filter((x) => x.status === 'open'));
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    const q = searchParams.get('invoice');
    if (q) setExpandedInvoiceId(q);
  }, [searchParams]);

  const invoiceById = useMemo(() => {
    const map = new Map<string, Invoice>();
    for (const inv of allInvoices) map.set(inv.id, inv);
    for (const p of payments) {
      if (p.invoice?.id) map.set(p.invoice.id, p.invoice);
    }
    return map;
  }, [allInvoices, payments]);

  async function submitPayment(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const created = await api<Payment>('/api/payments', {
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
      if (created.invoiceId) {
        setExpandedInvoiceId(created.invoiceId);
        setSearchParams({ invoice: created.invoiceId });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function submitInvoice(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api('/api/invoices', {
        method: 'POST',
        body: JSON.stringify({
          memberId: issue.memberId,
          promoCode: issue.promoCode || undefined,
          lines: [{ description: issue.description, qty: 1, unitPrice: Number(issue.unitPrice) }],
        }),
      });
      setIssue({ ...issue, promoCode: '' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  function resolveInvoice(p: Payment): Invoice | null {
    if (p.invoice) return p.invoice;
    if (p.invoiceId) return invoiceById.get(p.invoiceId) || null;
    return null;
  }

  return (
    <div className="stack reveal is-in">
      <div className="page-head">
        <div>
          <p className="eyebrow">CRM · Billing</p>
          <h1>Payments</h1>
          <p>Record payments, issue invoices, and share or print receipts from the ledger.</p>
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
                {payments.map((p) => {
                  const inv = resolveInvoice(p);
                  const open = expandedInvoiceId === (inv?.id || p.invoiceId);
                  return (
                    <tr key={p.id}>
                      <td>{fmtWhen(p.paidAt)}</td>
                      <td>
                        {p.member ? `${p.member.firstName} ${p.member.lastName}` : p.memberId}
                      </td>
                      <td>{money(p.amount)}</td>
                      <td>
                        <div className="ledger-method-row">
                          <span className="badge ok">{p.method}</span>
                          {inv ? (
                            <button
                              type="button"
                              className={`btn btn-ghost btn-compact${open ? ' is-hover' : ''}`}
                              onClick={() => {
                                const next = open ? null : inv.id;
                                setExpandedInvoiceId(next);
                                if (next) setSearchParams({ invoice: next });
                                else setSearchParams({});
                              }}
                            >
                              Invoice
                            </button>
                          ) : null}
                        </div>
                        {inv && open ? (
                          <div className="ledger-invoice-actions">
                            <span className="muted mono" style={{ fontSize: '0.75rem' }}>
                              {inv.number}
                            </span>
                            <button
                              type="button"
                              className="btn btn-ghost btn-compact"
                              onClick={() =>
                                openInvoiceReceipt(inv, { member: p.member, payment: p })
                              }
                            >
                              PDF
                            </button>
                            <a
                              className="btn btn-ghost btn-compact"
                              href={buildWhatsAppShareHref(
                                invoiceShareMessage(inv, p.member),
                                p.member?.phone,
                              )}
                              target="_blank"
                              rel="noreferrer"
                            >
                              WhatsApp
                            </a>
                            {canOfferPrint() ? (
                              <button
                                type="button"
                                className="btn btn-ghost btn-compact"
                                onClick={() =>
                                  openInvoiceReceipt(inv, {
                                    member: p.member,
                                    payment: p,
                                    autoprint: true,
                                  })
                                }
                              >
                                Print
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <div className="stack">
          <section className="panel">
            <div className="panel-head">
              <h2>Record payment</h2>
            </div>
            <form className="panel-body form-grid" onSubmit={submitPayment}>
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
                    const inv = openInvoices.find((i) => i.id === e.target.value);
                    setForm({
                      ...form,
                      invoiceId: e.target.value,
                      amount: inv ? String(inv.total) : form.amount,
                      memberId: inv?.memberId || form.memberId,
                    });
                  }}
                >
                  <option value="">None — create receipt invoice</option>
                  {openInvoices.map((i) => (
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
                  <select
                    value={form.method}
                    onChange={(e) => setForm({ ...form, method: e.target.value })}
                  >
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

          <section className="panel">
            <div className="panel-head">
              <h2>Issue invoice</h2>
            </div>
            <form className="panel-body form-grid" onSubmit={submitInvoice}>
              <label className="field">
                <span>Member</span>
                <select
                  required
                  value={issue.memberId}
                  onChange={(e) => setIssue({ ...issue, memberId: e.target.value })}
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
                  value={issue.description}
                  onChange={(e) => setIssue({ ...issue, description: e.target.value })}
                />
              </label>
              <div className="form-grid two">
                <label className="field">
                  <span>Unit price</span>
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={issue.unitPrice}
                    onChange={(e) => setIssue({ ...issue, unitPrice: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Promo code</span>
                  <input
                    value={issue.promoCode}
                    onChange={(e) => setIssue({ ...issue, promoCode: e.target.value })}
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
    </div>
  );
}
