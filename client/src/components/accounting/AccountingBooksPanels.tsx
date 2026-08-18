import { useEffect, useState } from 'react';
import {
  api,
  type AccountingAging,
  type AccountingBankStatement,
  type AccountingOpenItem,
  type AccountingPackStatus,
} from '../../api';
import { FxRateEntryModal } from './FxRateEntryModal';

function money(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function MalaysiaPackPanel({
  companyId,
  onError,
}: {
  companyId: number;
  onError: (msg: string | null) => void;
}) {
  const [pack, setPack] = useState<AccountingPackStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [sst, setSst] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.accountingPack(companyId)
      .then(p => {
        if (!cancelled) setPack(p);
      })
      .catch(e => onError(e instanceof Error ? e.message : 'Failed to load pack'))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, onError]);

  const computeSst = async () => {
    try {
      const end = todayIso();
      const start = end.slice(0, 8) + '01';
      const r = await api.accountingSst02(companyId, start, end);
      setSst(`SST-02 draft #${r.id} · ${r.status} · transmission=${r.transmission}`);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'SST-02 compute failed');
    }
  };

  if (loading && !pack) return <p className="text-xs text-muted-foreground">Loading Malaysia pack…</p>;
  if (!pack) return null;

  return (
    <div className="space-y-4 max-w-4xl border-t border-border pt-3 text-xs">
      <div>
        <p className="font-semibold">Active pack: {pack.activePack.toUpperCase()} (Malaysia)</p>
        <p className="text-muted-foreground mt-1">{pack.note}</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <p className="font-semibold">SST</p>
          <p>Model: {pack.sst.model}</p>
          <p>Input credit: {pack.sst.inputCredit ? 'yes' : 'no'} · recoverability={pack.sst.recoverability}</p>
          <p>Filing: {pack.sst.filing}</p>
          <p>E-invoice: {pack.sst.eInvoicing} (transmission later)</p>
          <button type="button" className="underline text-muted-foreground" onClick={() => void computeSst()}>
            Compute SST-02 draft (this month)
          </button>
          {sst && <p className="font-sans text-muted-foreground">{sst}</p>}
        </div>
        <div className="space-y-1">
          <p className="font-semibold">Pack bindings</p>
          {pack.packs.map(p => (
            <p key={p.packId} className="font-sans">
              {p.packId} · <span className={p.status === 'active' ? 'text-primary font-semibold' : 'text-muted-foreground'}>{p.status}</span> · v{p.version}
            </p>
          ))}
        </div>
      </div>
      <div>
        <p className="font-semibold mb-1">Tax codes</p>
        <ul className="space-y-1">
          {pack.taxCodes.map(t => (
            <li key={t.code} className="font-sans">{t.code} · {t.name} · {t.ratePercent}% · {t.recoverability}</li>
          ))}
        </ul>
      </div>
      <div>
        <p className="font-semibold mb-1">SLA rule sets</p>
        <ul className="space-y-1">
          {pack.slaRuleSets.map(s => (
            <li key={s.id} className="font-sans">{s.eventType} · {s.name} · v{s.version} · {s.lineCount} lines</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function OpenItemsPanel({
  companyId,
  subledger,
  functionalCurrency,
  onError,
  onPosted,
}: {
  companyId: number;
  subledger: 'ar' | 'ap';
  functionalCurrency: string;
  onError: (msg: string | null) => void;
  onPosted: () => void;
}) {
  const [items, setItems] = useState<AccountingOpenItem[]>([]);
  const [aging, setAging] = useState<AccountingAging | null>(null);
  const [recon, setRecon] = useState<{ glControl: number; subledgerOpen: number; drift: number; reconciled: boolean; controlAccount: string } | null>(null);
  const [apps, setApps] = useState<Array<{ id: number; appliedFromId: number; appliedToId: number; amount: number; reversalOfId: number | null }>>([]);
  const [name, setName] = useState('');
  const [gross, setGross] = useState('');
  const [tax, setTax] = useState('0');
  const [taxCode, setTaxCode] = useState('SST-6');
  const [currency, setCurrency] = useState(functionalCurrency);
  const [fxRate, setFxRate] = useState('');
  const [fxRateDate, setFxRateDate] = useState(todayIso());
  const [fxModalOpen, setFxModalOpen] = useState(false);
  const [issueDate, setIssueDate] = useState(todayIso());
  const [dueDate, setDueDate] = useState(todayIso());
  const [kind, setKind] = useState(subledger === 'ar' ? 'invoice' : 'bill');
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [applyAmt, setApplyAmt] = useState('');
  const [applyDate, setApplyDate] = useState(todayIso());
  const [settlementFxRate, setSettlementFxRate] = useState('');
  const [settlementFxDate, setSettlementFxDate] = useState(todayIso());
  const [remitFxModalOpen, setRemitFxModalOpen] = useState(false);
  const [estimatedFxHint, setEstimatedFxHint] = useState('');
  const [busy, setBusy] = useState(false);

  const foreign = currency !== functionalCurrency;
  const rateNum = Number(fxRate);
  const rateOk = !foreign || (Number.isFinite(rateNum) && rateNum > 0);

  const load = async () => {
    try {
      const [list, age, applications, control] = await Promise.all([
        api.accountingOpenItems(companyId, subledger),
        api.accountingAging(companyId, subledger),
        api.accountingApplications(companyId),
        api.accountingControlReconciliation(companyId, subledger).catch(() => null),
      ]);
      setItems(list);
      setAging(age);
      setApps(applications.filter(a => !a.reversalOfId || a.amount < 0));
      setRecon(control);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to load open items');
    }
  };

  useEffect(() => {
    setCurrency(functionalCurrency);
    setFxRate('');
    setFxModalOpen(false);
    setKind(subledger === 'ar' ? 'invoice' : 'bill');
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, subledger, functionalCurrency]);

  const create = async () => {
    const g = Number(gross);
    const t = Number(tax) || 0;
    if (!name.trim() || !(g > 0)) {
      onError('Counterparty and gross amount required.');
      return;
    }
    if (foreign && !rateOk) {
      onError(`Enter a conversion rate (${functionalCurrency} per 1 ${currency}) for the issue date.`);
      setFxModalOpen(true);
      return;
    }
    setBusy(true);
    onError(null);
    try {
      await api.accountingCreateOpenItem(companyId, {
        subledger,
        kind,
        counterpartyName: name.trim(),
        issueDate,
        dueDate,
        gross: g,
        currency,
        taxCode,
        taxAmount: t,
        narration: `${subledger.toUpperCase()} ${name.trim()}`,
        postJournal: true,
        requireApApproval: subledger === 'ap',
        fxRate: foreign ? rateNum : undefined,
        fxRateDate: foreign ? fxRateDate || issueDate : undefined,
      });
      setName('');
      setGross('');
      setTax('0');
      setFxRate('');
      setCurrency(functionalCurrency);
      await load();
      onPosted();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Create open item failed');
    } finally {
      setBusy(false);
    }
  };

  const applySelected = async (opts?: { settlementFxRate?: number; settlementFxRateDate?: string }) => {
    const amount = Number(applyAmt);
    if (!(Number(fromId) > 0) || !(Number(toId) > 0) || !(amount > 0)) {
      onError('Select payment/doc ids and amount to apply.');
      return;
    }
    setBusy(true);
    onError(null);
    try {
      await api.accountingApplyOpenItems(companyId, {
        fromId: Number(fromId),
        toId: Number(toId),
        amount,
        effectiveDate: applyDate,
        settlementFxRate: opts?.settlementFxRate,
        settlementFxRateDate: opts?.settlementFxRateDate,
      });
      setApplyAmt('');
      setSettlementFxRate('');
      setRemitFxModalOpen(false);
      await load();
      onPosted();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Apply failed');
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    const from = items.find(i => i.id === Number(fromId));
    const to = items.find(i => i.id === Number(toId));
    const txnCurrency = from?.currency ?? to?.currency ?? functionalCurrency;
    if (txnCurrency !== functionalCurrency) {
      // Prefill with estimate (issue-day) rate when available; remittance rate is adjustable.
      try {
        const rates = await api.accountingFxRates(companyId, 80);
        const estimate = rates.find(
          r =>
            r.fromCurrency === txnCurrency
            && r.toCurrency === functionalCurrency
            && (r.rateType === 'estimate' || r.rateType === 'manual'),
        );
        const hint = estimate ? String(estimate.rate) : settlementFxRate;
        setEstimatedFxHint(hint);
        setSettlementFxRate(hint);
        setSettlementFxDate(applyDate);
        setRemitFxModalOpen(true);
        return;
      } catch {
        setEstimatedFxHint('');
        setSettlementFxDate(applyDate);
        setRemitFxModalOpen(true);
        return;
      }
    }
    await applySelected();
  };

  return (
    <div className="space-y-4 max-w-5xl border-t border-border pt-3 text-xs">
      <p className="text-muted-foreground">
        {subledger === 'ar' ? 'Accounts receivable' : 'Accounts payable (draft → submit → a different signed-in user must approve)'}.
        Create payments then apply to invoices/bills. Un-apply writes a reversing application row. Approver identity is the signed-in user, not a typed name.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <label className="space-y-1">
          <span className="text-muted-foreground">Kind</span>
          <select className="w-full border border-border rounded-md px-2 py-1.5 bg-background font-sans" value={kind} onChange={e => setKind(e.target.value)}>
            {subledger === 'ar'
              ? <>
                  <option value="invoice">invoice</option>
                  <option value="payment">payment (receipt)</option>
                  <option value="credit_note">credit_note</option>
                </>
              : <>
                  <option value="bill">bill</option>
                  <option value="payment">payment</option>
                  <option value="credit_note">credit_note</option>
                </>}
          </select>
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="text-muted-foreground">Counterparty</span>
          <input className="w-full border border-border rounded-md px-2 py-1.5 bg-background" value={name} onChange={e => setName(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-muted-foreground">Gross</span>
          <input className="w-full border border-border rounded-md px-2 py-1.5 bg-background font-sans" inputMode="decimal" value={gross} onChange={e => setGross(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-muted-foreground">Tax</span>
          <input className="w-full border border-border rounded-md px-2 py-1.5 bg-background font-sans" inputMode="decimal" value={tax} onChange={e => setTax(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-muted-foreground">Tax code</span>
          <select className="w-full border border-border rounded-md px-2 py-1.5 bg-background font-sans" value={taxCode} onChange={e => setTaxCode(e.target.value)}>
            {['SST-0', 'SST-5', 'SST-6', 'SST-8', 'SST-10', 'EXEMPT'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-muted-foreground">Currency</span>
          <select
            className="w-full border border-border rounded-md px-2 py-1.5 bg-background font-sans"
            value={currency}
            onChange={e => {
              const next = e.target.value;
              setCurrency(next);
              if (next === functionalCurrency) {
                setFxRate('');
                setFxModalOpen(false);
              } else {
                setFxRateDate(issueDate);
                setFxModalOpen(true);
              }
            }}
          >
            {[functionalCurrency, 'USD', 'SGD', 'EUR'].filter((c, i, a) => a.indexOf(c) === i).map(c => (
              <option key={c} value={c}>{c}{c === functionalCurrency ? ' (home)' : ''}</option>
            ))}
          </select>
        </label>
        <div className="space-y-1">
          <span className="text-muted-foreground">FX rate</span>
          {foreign ? (
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              {rateOk ? (
                <span className="font-sans text-[11px]">
                  {rateNum} {functionalCurrency}/1 {currency}
                  <span className="text-muted-foreground"> · {fxRateDate}</span>
                </span>
              ) : (
                <span className="text-[11px] text-destructive">Rate required</span>
              )}
              <button
                type="button"
                className="text-[11px] font-semibold underline text-muted-foreground hover:text-foreground"
                onClick={() => setFxModalOpen(true)}
              >
                {rateOk ? 'Adjust' : 'Enter'}
              </button>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground pt-1.5">Home currency</p>
          )}
        </div>
        <label className="space-y-1">
          <span className="text-muted-foreground">Issue</span>
          <input type="date" className="w-full border border-border rounded-md px-2 py-1.5 bg-background font-sans" value={issueDate} onChange={e => setIssueDate(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-muted-foreground">Due</span>
          <input type="date" className="w-full border border-border rounded-md px-2 py-1.5 bg-background font-sans" value={dueDate} onChange={e => setDueDate(e.target.value)} />
        </label>
        <div className="flex items-end">
          <button type="button" disabled={busy || (foreign && !rateOk)} onClick={() => void create()} className="text-xs font-bold bg-primary text-primary-foreground px-3 py-1.5 rounded-md disabled:opacity-50">
            Create {kind}
          </button>
        </div>
      </div>

      <FxRateEntryModal
        open={fxModalOpen && foreign}
        foreignCurrency={currency}
        functionalCurrency={functionalCurrency}
        defaultRateDate={fxRateDate || issueDate}
        initialRate={fxRate}
        title={`FX rate · ${kind} · ${currency}`}
        hint={`Manual rate for the day this ${kind} was issued (${functionalCurrency} per 1 ${currency}). Remittance can use a different rate later.`}
        confirmLabel="Use estimate"
        onConfirm={({ rate, rateDate }) => {
          setFxRate(String(rate));
          setFxRateDate(rateDate);
          setFxModalOpen(false);
        }}
        onCancel={() => {
          setFxModalOpen(false);
          if (!rateOk) {
            setCurrency(functionalCurrency);
            setFxRate('');
          }
        }}
      />

      <div className="border-t border-border pt-3 space-y-2">
        <p className="font-semibold">Apply payment / document</p>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <label className="space-y-1">
            <span className="text-muted-foreground">From id (payment)</span>
            <select className="w-full border border-border rounded-md px-2 py-1.5 bg-background font-sans" value={fromId} onChange={e => setFromId(e.target.value)}>
              <option value="">—</option>
              {items.filter(i => i.open > 0).map(i => (
                <option key={i.id} value={i.id}>#{i.id} {i.kind} {i.internalDocumentNo} ({money(i.open)})</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-muted-foreground">To id (invoice/bill)</span>
            <select className="w-full border border-border rounded-md px-2 py-1.5 bg-background font-sans" value={toId} onChange={e => setToId(e.target.value)}>
              <option value="">—</option>
              {items.filter(i => i.open > 0).map(i => (
                <option key={i.id} value={i.id}>#{i.id} {i.kind} {i.internalDocumentNo} ({money(i.open)})</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-muted-foreground">Amount</span>
            <input className="w-full border border-border rounded-md px-2 py-1.5 bg-background font-sans" inputMode="decimal" value={applyAmt} onChange={e => setApplyAmt(e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="text-muted-foreground">Remittance date</span>
            <input type="date" className="w-full border border-border rounded-md px-2 py-1.5 bg-background font-sans" value={applyDate} onChange={e => setApplyDate(e.target.value)} />
          </label>
          <div className="flex items-end sm:col-span-4">
            <button type="button" disabled={busy} onClick={() => void apply()} className="text-xs font-bold border border-border px-3 py-1.5 rounded-md disabled:opacity-50">
              Apply
            </button>
          </div>
        </div>
        <FxRateEntryModal
          open={remitFxModalOpen}
          foreignCurrency={(items.find(i => i.id === Number(fromId)) ?? items.find(i => i.id === Number(toId)))?.currency ?? currency}
          functionalCurrency={functionalCurrency}
          defaultRateDate={settlementFxDate || applyDate}
          initialRate={settlementFxRate || estimatedFxHint}
          title="Remittance FX rate"
          hint={`Rate on the day funds are remitted may differ from the PO/issue estimate. Adjust here (${functionalCurrency} per 1 foreign unit).`}
          confirmLabel="Apply with this rate"
          onConfirm={({ rate, rateDate }) => {
            setSettlementFxRate(String(rate));
            setSettlementFxDate(rateDate);
            void applySelected({ settlementFxRate: rate, settlementFxRateDate: rateDate });
          }}
          onCancel={() => setRemitFxModalOpen(false)}
        />
        <ul className="space-y-1 text-muted-foreground">
          {apps.slice(0, 12).map(a => (
            <li key={a.id} className="font-sans flex gap-2 items-center">
              <span>#{a.id}: {a.appliedFromId}→{a.appliedToId} · {money(Math.abs(a.amount))}{a.reversalOfId ? ' (reversal)' : ''}</span>
              {!a.reversalOfId && a.amount > 0 && (
                <button type="button" className="underline" onClick={() => void api.accountingUnapply(companyId, a.id).then(load).catch(e => onError(e instanceof Error ? e.message : 'Unapply failed'))}>
                  Un-apply
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {aging && (
        <p className="font-sans text-muted-foreground">
          Aging: current {money(aging.buckets.current ?? 0)} · 1–30 {money(aging.buckets['1-30'] ?? 0)} · 31–60 {money(aging.buckets['31-60'] ?? 0)} · 61–90 {money(aging.buckets['61-90'] ?? 0)} · 90+ {money(aging.buckets['90+'] ?? 0)}
        </p>
      )}
      {recon && (
        <p className="font-sans text-muted-foreground">
          Control {recon.controlAccount}: GL {money(recon.glControl)} · subledger {money(recon.subledgerOpen)} · drift {money(recon.drift)}
          {recon.reconciled ? ' · tied' : ' · out of balance'}
        </p>
      )}

      <table className="w-full border-collapse">
        <thead>
          <tr className="text-left text-muted-foreground border-b border-border">
            <th className="py-1 pr-2">Doc</th>
            <th className="py-1 pr-2">Party</th>
            <th className="py-1 pr-2 text-right">Open</th>
            <th className="py-1 pr-2">Approval</th>
            <th className="py-1">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map(i => (
            <tr key={i.id} className="border-b border-border/60">
              <td className="py-1 pr-2 font-sans">#{i.id} {i.internalDocumentNo}<div className="text-muted-foreground">{i.kind}</div></td>
              <td className="py-1 pr-2">{i.counterpartyName}</td>
              <td className="py-1 pr-2 text-right font-sans">{money(i.open)} {i.currency}</td>
              <td className="py-1 pr-2 font-sans">{i.approvalStatus ?? 'approved'}</td>
              <td className="py-1 space-x-2">
                {subledger === 'ap' && i.approvalStatus === 'draft' && (
                  <button type="button" className="underline" onClick={() => void api.accountingSubmitOpenItem(companyId, i.id).then(load).catch(e => onError(e instanceof Error ? e.message : 'Submit failed'))}>Submit</button>
                )}
                {subledger === 'ap' && i.approvalStatus === 'pending_approval' && (
                  <>
                    <button type="button" className="underline" onClick={() => void api.accountingApproveOpenItem(companyId, i.id).then(() => { void load(); onPosted(); }).catch(e => onError(e instanceof Error ? e.message : 'Approve failed'))}>Approve</button>
                    <button type="button" className="underline" onClick={() => void api.accountingRejectOpenItem(companyId, i.id, undefined, 'Rejected').then(load).catch(e => onError(e instanceof Error ? e.message : 'Reject failed'))}>Reject</button>
                  </>
                )}
                {i.status !== 'void' && i.open === i.gross && (
                  <button type="button" className="underline" onClick={() => void api.accountingVoidOpenItem(companyId, i.id).then(() => { void load(); onPosted(); }).catch(e => onError(e instanceof Error ? e.message : 'Void failed'))}>Void</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BankPanel({
  companyId,
  functionalCurrency,
  onError,
}: {
  companyId: number;
  functionalCurrency: string;
  onError: (msg: string | null) => void;
}) {
  const [rows, setRows] = useState<AccountingBankStatement[]>([]);
  const [queue, setQueue] = useState<Awaited<ReturnType<typeof api.accountingBankQueue>> | null>(null);
  const [narrative, setNarrative] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [selectedItem, setSelectedItem] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<Array<{ openItemId: number; internalDocumentNo: string; counterpartyName: string; score: number; rule: string; open: number }>>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [stmts, q] = await Promise.all([
        api.accountingBankStatements(companyId),
        api.accountingBankQueue(companyId),
      ]);
      setRows(stmts);
      setQueue(q);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to load bank');
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const create = async () => {
    const amt = Number(amount);
    if (!narrative.trim() || !Number.isFinite(amt) || amt === 0) {
      onError('Narrative and non-zero amount required.');
      return;
    }
    setBusy(true);
    onError(null);
    try {
      await api.accountingCreateBankStatement(companyId, {
        accountLabel: 'Operating account',
        bankAccountCode: '1000',
        statementDate: todayIso(),
        currency: functionalCurrency,
        source: 'manual',
        opening: 0,
        lines: [{ valueDate: todayIso(), narrative: narrative.trim(), amount: amt }],
      });
      setNarrative('');
      setAmount('');
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Create statement failed');
    } finally {
      setBusy(false);
    }
  };

  const matchSelected = async () => {
    if (!selectedLine || !selectedItem || !queue) return;
    const item = queue.openItems.find(i => i.id === selectedItem);
    const line = queue.unmatched.find(l => l.id === selectedLine);
    if (!item || !line) return;
    setBusy(true);
    try {
      await api.accountingBankMatch(companyId, {
        statementLineIds: [selectedLine],
        openItems: [{ openItemId: selectedItem, amount: Math.abs(line.amount) }],
        notes: 'manual UI match',
      });
      setSelectedLine(null);
      setSelectedItem(null);
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Match failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 max-w-5xl border-t border-border pt-3 text-xs">
      <p className="text-muted-foreground">
        Capture statement lines, then match 1:1 / N:M to open items. Match posts cash and reduces the invoice open balance. Auto-match uses exact amount once. No external bank feed yet.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <label className="space-y-1 sm:col-span-2">
          <span className="text-muted-foreground">Line narrative</span>
          <input className="w-full border border-border rounded-md px-2 py-1.5 bg-background" value={narrative} onChange={e => setNarrative(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-muted-foreground">Amount ({functionalCurrency})</span>
          <input className="w-full border border-border rounded-md px-2 py-1.5 bg-background font-sans" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => void create()} className="text-xs font-bold bg-primary text-primary-foreground px-3 py-1.5 rounded-md disabled:opacity-50">
          Add statement line
        </button>
        <button type="button" disabled={busy} onClick={() => void api.accountingBankAutoMatch(companyId).then(load).catch(e => onError(e instanceof Error ? e.message : 'Auto-match failed'))} className="text-xs font-bold border border-border px-3 py-1.5 rounded-md">
          Auto-match exact amounts
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <p className="font-semibold mb-1">Unmatched lines</p>
          <ul className="space-y-1 max-h-56 overflow-auto">
            {(queue?.unmatched ?? []).map(l => (
              <li key={l.id}>
                <button type="button" className={`w-full text-left font-sans border-b border-border/40 py-1 ${selectedLine === l.id ? 'text-primary font-semibold' : ''}`} onClick={() => {
                  setSelectedLine(l.id);
                  void api.accountingBankSuggest(companyId, l.id).then(s => {
                    setSuggestions(s.candidates ?? []);
                    const top = s.candidates?.[0];
                    if (top) setSelectedItem(top.openItemId);
                  }).catch(() => setSuggestions([]));
                }}>
                  #{l.id} {l.valueDate} · {money(l.amount)} · {l.narrative || '—'}
                </button>
              </li>
            ))}
          </ul>
          {suggestions.length > 0 && (
            <p className="text-muted-foreground mt-2">
              Suggested: {suggestions.slice(0, 3).map(s => `#${s.openItemId} ${s.internalDocumentNo} (${s.score})`).join(' · ')}
            </p>
          )}
        </div>
        <div>
          <p className="font-semibold mb-1">Open items</p>
          <ul className="space-y-1 max-h-56 overflow-auto">
            {(queue?.openItems ?? []).map(i => (
              <li key={i.id}>
                <button type="button" className={`w-full text-left font-sans border-b border-border/40 py-1 ${selectedItem === i.id ? 'text-primary font-semibold' : ''}`} onClick={() => setSelectedItem(i.id)}>
                  #{i.id} {i.internalDocumentNo} · {i.counterpartyName} · {money(i.open)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <button type="button" disabled={busy || !selectedLine || !selectedItem} onClick={() => void matchSelected()} className="text-xs font-bold border border-border px-3 py-1.5 rounded-md disabled:opacity-50">
        Match selected line ↔ item
      </button>

      <div>
        <p className="font-semibold mb-1">Active matches</p>
        <ul className="space-y-1">
          {(queue?.matches ?? []).map(m => (
            <li key={m.id} className="font-sans flex gap-2">
              <span>#{m.id} · {m.cardinality} · {m.notes || m.createdBy}</span>
              <button type="button" className="underline" onClick={() => void api.accountingBankUnmatch(companyId, m.id).then(load).catch(e => onError(e instanceof Error ? e.message : 'Unmatch failed'))}>Unmatch</button>
            </li>
          ))}
        </ul>
      </div>
      <ul className="text-muted-foreground">
        {rows.map(r => (
          <li key={r.id} className="font-sans flex gap-2 items-center">
            <span>{r.statementDate} · {r.lineCount} line(s) · {r.status}{r.opening != null ? ` · open ${money(r.opening)}` : ''}{r.closing != null ? ` · close ${money(r.closing)}` : ''}</span>
            {r.status === 'open' && (
              <button type="button" className="underline" onClick={() => void api.accountingFinaliseBankStatement(companyId, r.id).then(load).catch(e => onError(e instanceof Error ? e.message : 'Finalise failed'))}>
                Finalise
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FixedAssetsPanel({
  companyId,
  functionalCurrency,
  onError,
}: {
  companyId: number;
  functionalCurrency: string;
  onError: (msg: string | null) => void;
}) {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof api.accountingFixedAssets>>>([]);
  const [tag, setTag] = useState('');
  const [name, setName] = useState('');
  const [cost, setCost] = useState('');
  const [life, setLife] = useState('60');

  const load = async () => {
    try {
      setRows(await api.accountingFixedAssets(companyId));
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to load assets');
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  return (
    <div className="space-y-4 max-w-3xl border-t border-border pt-3 text-xs">
      <p className="text-muted-foreground">Multi-book fixed assets (IFRS + tax). Depreciation posts internally — no external tax authority connection.</p>
      <div className="grid sm:grid-cols-4 gap-2">
        <input className="border border-border rounded-md px-2 py-1.5 bg-background font-sans" placeholder="Tag" value={tag} onChange={e => setTag(e.target.value)} />
        <input className="border border-border rounded-md px-2 py-1.5 bg-background" placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
        <input className="border border-border rounded-md px-2 py-1.5 bg-background font-sans" placeholder="Cost" value={cost} onChange={e => setCost(e.target.value)} />
        <input className="border border-border rounded-md px-2 py-1.5 bg-background font-sans" placeholder="Life months" value={life} onChange={e => setLife(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          className="text-xs font-bold bg-primary text-primary-foreground px-3 py-1.5 rounded-md"
          onClick={() => void api.accountingCreateFixedAsset(companyId, {
            assetTag: tag,
            name,
            acquiredOn: todayIso(),
            cost: Number(cost),
            currency: functionalCurrency,
            lifeMonths: Number(life) || 60,
          }).then(() => { setTag(''); setName(''); setCost(''); return load(); }).catch(e => onError(e instanceof Error ? e.message : 'Create failed'))}
        >
          Add asset
        </button>
        <button
          type="button"
          className="text-xs font-bold border border-border px-3 py-1.5 rounded-md"
          onClick={() => {
            const d = new Date();
            void api.accountingDepreciate(companyId, d.getUTCFullYear(), d.getUTCMonth() + 1).then(() => load()).catch(e => onError(e instanceof Error ? e.message : 'Depreciate failed'));
          }}
        >
          Run depreciation (IFRS, current period)
        </button>
      </div>
      <ul className="space-y-1">
        {rows.map(a => (
          <li key={a.id} className="font-sans border-b border-border/50 py-1">
            {a.assetTag} · {a.name} · {money(a.cost)} {a.currency} · books: {a.books.map(b => b.bookId).join(', ')}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RevRecPanel({
  companyId,
  functionalCurrency,
  onError,
}: {
  companyId: number;
  functionalCurrency: string;
  onError: (msg: string | null) => void;
}) {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof api.accountingRevRec>>>([]);
  const [contractNo, setContractNo] = useState('');
  const [customer, setCustomer] = useState('');
  const [price, setPrice] = useState('');

  const load = async () => {
    try {
      setRows(await api.accountingRevRec(companyId));
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to load revrec');
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  return (
    <div className="space-y-4 max-w-3xl border-t border-border pt-3 text-xs">
      <p className="text-muted-foreground">Revenue recognition contracts / obligations (internal). No payment gateway connection.</p>
      <div className="grid sm:grid-cols-3 gap-2">
        <input className="border border-border rounded-md px-2 py-1.5 bg-background font-sans" placeholder="Contract no" value={contractNo} onChange={e => setContractNo(e.target.value)} />
        <input className="border border-border rounded-md px-2 py-1.5 bg-background" placeholder="Customer" value={customer} onChange={e => setCustomer(e.target.value)} />
        <input className="border border-border rounded-md px-2 py-1.5 bg-background font-sans" placeholder="Price" value={price} onChange={e => setPrice(e.target.value)} />
      </div>
      <button
        type="button"
        className="text-xs font-bold bg-primary text-primary-foreground px-3 py-1.5 rounded-md"
        onClick={() => void api.accountingCreateRevRec(companyId, {
          contractNo,
          customerName: customer,
          startDate: todayIso(),
          transactionPrice: Number(price),
          currency: functionalCurrency,
        }).then(() => { setContractNo(''); setCustomer(''); setPrice(''); return load(); }).catch(e => onError(e instanceof Error ? e.message : 'Create failed'))}
      >
        Create contract
      </button>
      <ul className="space-y-2">
        {rows.map(c => (
          <li key={c.id} className="border-b border-border/50 pb-2">
            <p className="font-sans font-semibold">{c.contractNo} · {c.customerName} · {money(c.transactionPrice)} {c.currency}</p>
            {c.obligations.map(o => (
              <div key={o.id} className="flex flex-wrap gap-2 items-center mt-1">
                <span className="font-sans">Obl #{o.id}: {money(o.recognised)} / {money(o.allocated)} recognised</span>
                <button
                  type="button"
                  className="underline"
                  onClick={() => void api.accountingRecogniseRevRec(companyId, o.id, Math.min(100, o.allocated - o.recognised) || 1).then(load).catch(e => onError(e instanceof Error ? e.message : 'Recognise failed'))}
                >
                  Recognise
                </button>
              </div>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}
