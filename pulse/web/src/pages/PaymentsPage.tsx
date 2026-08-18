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

type FormState = {
  memberId: string;
  invoiceId: string;
  description: string;
  amount: string;
  promoCode: string;
  method: string;
};

const EMPTY_FORM: FormState = {
  memberId: '',
  invoiceId: '',
  description: 'Membership fee',
  amount: '',
  promoCode: '',
  method: 'card',
};

export function PaymentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [openInvoices, setOpenInvoices] = useState<Invoice[]>([]);
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
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

  const payingExisting = Boolean(form.invoiceId);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      let invoiceId = form.invoiceId || undefined;
      let amount = Number(form.amount);

      if (!invoiceId) {
        if (!form.description.trim()) throw new Error('Description required');
        if (!(amount > 0)) throw new Error('Amount required');
        const issued = await api<Invoice>('/api/invoices', {
          method: 'POST',
          body: JSON.stringify({
            memberId: form.memberId,
            promoCode: form.promoCode || undefined,
            lines: [{ description: form.description.trim(), qty: 1, unitPrice: amount }],
          }),
        });
        invoiceId = issued.id;
        amount = issued.total;
      } else {
        const inv = openInvoices.find((i) => i.id === invoiceId);
        if (inv) amount = inv.total;
      }

      const created = await api<Payment>('/api/payments', {
        method: 'POST',
        body: JSON.stringify({
          memberId: form.memberId,
          invoiceId,
          amount,
          method: form.method,
          description: form.description.trim() || undefined,
        }),
      });

      setForm(EMPTY_FORM);
      await load();
      const openId = created.invoiceId || invoiceId;
      if (openId) {
        setExpandedInvoiceId(openId);
        setSearchParams({ invoice: openId });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
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
          <p>Capture payment and issue the invoice in one step — then share or print from the ledger.</p>
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

        <section className="panel">
          <div className="panel-head">
            <h2>Capture payment &amp; invoice</h2>
          </div>
          <form className="panel-body form-grid" onSubmit={(e) => void submit(e)}>
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
              <span>Pay existing open invoice (optional)</span>
              <select
                value={form.invoiceId}
                onChange={(e) => {
                  const inv = openInvoices.find((i) => i.id === e.target.value);
                  setForm({
                    ...form,
                    invoiceId: e.target.value,
                    amount: inv ? String(inv.total) : form.amount,
                    memberId: inv?.memberId || form.memberId,
                    description: inv?.lines?.[0]?.description || form.description,
                  });
                }}
              >
                <option value="">New invoice from this payment</option>
                {openInvoices.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.number} — {money(i.total)}
                  </option>
                ))}
              </select>
            </label>

            {!payingExisting ? (
              <>
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
                    <span>Promo code</span>
                    <input
                      value={form.promoCode}
                      onChange={(e) => setForm({ ...form, promoCode: e.target.value })}
                      placeholder="SUMMER26"
                    />
                  </label>
                </div>
              </>
            ) : (
              <label className="field">
                <span>Amount</span>
                <input required type="number" step="0.01" value={form.amount} readOnly />
              </label>
            )}

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

            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Capture payment & invoice'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
