import { useEffect, useState } from 'react';
import {
  api,
  type AccountingAging,
  type AccountingBankStatement,
  type AccountingFxRate,
  type AccountingOpenItem,
  type AccountingPackStatus,
} from '../../api';

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
          <p>E-invoice: {pack.sst.eInvoicing} (stub queue on AR approve; live MyInvois later)</p>
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

export function FxRatesPanel({
  companyId,
  functionalCurrency,
  onError,
}: {
  companyId: number;
  functionalCurrency: string;
  onError: (msg: string | null) => void;
}) {
  const [rows, setRows] = useState<AccountingFxRate[]>([]);
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [rate, setRate] = useState('');
  const [rateDate, setRateDate] = useState(todayIso());
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setRows(await api.accountingFxRates(companyId));
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to load FX rates');
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const save = async () => {
    const n = Number(rate);
    if (!(n > 0)) {
      onError(`Enter ${functionalCurrency} per 1 ${fromCurrency}`);
      return;
    }
    setBusy(true);
    onError(null);
    try {
      await api.accountingUpsertFxRate(companyId, {
        fromCurrency,
        toCurrency: functionalCurrency,
        rateDate,
        rate: n,
        rateType: 'manual',
        source: 'accounting-ui',
      });
      setRate('');
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Save FX rate failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl border-t border-border pt-3 text-xs">
      <p className="text-muted-foreground">
        Store conversion rates as <strong>{functionalCurrency} per 1 foreign unit</strong>.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <label className="space-y-1">
          <span className="text-muted-foreground">From</span>
          <select className="w-full border border-border rounded-md px-2 py-1.5 bg-background font-sans" value={fromCurrency} onChange={e => setFromCurrency(e.target.value)}>
            {['USD', 'SGD', 'EUR', 'GBP', 'AUD', 'THB', 'IDR', 'JPY', 'CNY'].filter(c => c !== functionalCurrency).map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-muted-foreground">Rate ({functionalCurrency}/1)</span>
          <input className="w-full border border-border rounded-md px-2 py-1.5 bg-background font-sans" inputMode="decimal" value={rate} onChange={e => setRate(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-muted-foreground">Date</span>
          <input type="date" className="w-full border border-border rounded-md px-2 py-1.5 bg-background font-sans" value={rateDate} onChange={e => setRateDate(e.target.value)} />
        </label>
        <div className="flex items-end">
          <button type="button" disabled={busy} onClick={() => void save()} className="w-full text-xs font-bold bg-primary text-primary-foreground px-3 py-1.5 rounded-md disabled:opacity-50">
            Save rate
          </button>
        </div>
      </div>
      <ul className="space-y-1">
        {rows.map(r => (
          <li key={r.id} className="font-sans border-b border-border/50 py-1">
            {r.rateDate} · 1 {r.fromCurrency} = {r.rate} {r.toCurrency} · {r.rateType}
          </li>
        ))}
      </ul>
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
  const [recon, setRecon] = useState<{
    glControl: number;
    subledgerOpen: number;
    drift: number;
    reconciled: boolean;
    controlAccount: string;
    note?: string;
  } | null>(null);
  const [apps, setApps] = useState<Array<{ id: number; appliedFromId: number; appliedToId: number; amount: number; reversalOfId: number | null }>>([]);
  const [name, setName] = useState('');
  const [gross, setGross] = useState('');
  const [tax, setTax] = useState('0');
  const [taxCode, setTaxCode] = useState('SST-6');
  const [currency, setCurrency] = useState(functionalCurrency);
  const [issueDate, setIssueDate] = useState(todayIso());
  const [dueDate, setDueDate] = useState(todayIso());
  const [kind, setKind] = useState(subledger === 'ar' ? 'invoice' : 'bill');
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [applyAmt, setApplyAmt] = useState('');
  const [busy, setBusy] = useState(false);

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
      });
      setName('');
      setGross('');
      setTax('0');
      await load();
      onPosted();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Create open item failed');
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    const amount = Number(applyAmt);
    if (!(Number(fromId) > 0) || !(Number(toId) > 0) || !(amount > 0)) {
      onError('Select payment/doc ids and amount to apply.');
      return;
    }
    setBusy(true);
    try {
      await api.accountingApplyOpenItems(companyId, {
        fromId: Number(fromId),
        toId: Number(toId),
        amount,
        effectiveDate: todayIso(),
      });
      setApplyAmt('');
      await load();
      onPosted();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Apply failed');
    } finally {
      setBusy(false);
    }
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
          <select className="w-full border border-border rounded-md px-2 py-1.5 bg-background font-sans" value={currency} onChange={e => setCurrency(e.target.value)}>
            {[functionalCurrency, 'USD', 'SGD', 'EUR'].filter((c, i, a) => a.indexOf(c) === i).map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-muted-foreground">Issue</span>
          <input type="date" className="w-full border border-border rounded-md px-2 py-1.5 bg-background font-sans" value={issueDate} onChange={e => setIssueDate(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-muted-foreground">Due</span>
          <input type="date" className="w-full border border-border rounded-md px-2 py-1.5 bg-background font-sans" value={dueDate} onChange={e => setDueDate(e.target.value)} />
        </label>
        <div className="flex items-end">
          <button type="button" disabled={busy} onClick={() => void create()} className="text-xs font-bold bg-primary text-primary-foreground px-3 py-1.5 rounded-md disabled:opacity-50">
            Create {kind}
          </button>
        </div>
      </div>

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
          <div className="flex items-end">
            <button type="button" disabled={busy} onClick={() => void apply()} className="text-xs font-bold border border-border px-3 py-1.5 rounded-md disabled:opacity-50">
              Apply
            </button>
          </div>
        </div>
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
        <div className="border-t border-border pt-3 space-y-2">
          <p className="font-semibold">Aging detail</p>
          <p className="font-sans text-muted-foreground">
            Buckets: current {money(aging.buckets.current ?? 0)} · 1–30 {money(aging.buckets['1-30'] ?? 0)} · 31–60 {money(aging.buckets['31-60'] ?? 0)} · 61–90 {money(aging.buckets['61-90'] ?? 0)} · 90+ {money(aging.buckets['90+'] ?? 0)}
          </p>
          {aging.rows && aging.rows.length > 0 && (
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="text-muted-foreground border-b border-border text-left">
                  <th className="py-1 pr-2">Doc</th>
                  <th className="py-1 pr-2">Party</th>
                  <th className="py-1 pr-2">Due</th>
                  <th className="py-1 pr-2 text-right">Open</th>
                  <th className="py-1 pr-2">Bucket</th>
                  <th className="py-1">Days</th>
                </tr>
              </thead>
              <tbody>
                {aging.rows.slice(0, 40).map(r => (
                  <tr key={r.id} className="border-b border-border/60">
                    <td className="py-1 pr-2 font-sans">#{r.id} {r.internalDocumentNo}</td>
                    <td className="py-1 pr-2">{r.counterpartyName}</td>
                    <td className="py-1 pr-2 font-sans">{r.dueDate}</td>
                    <td className="py-1 pr-2 text-right font-sans">{money(r.open)}</td>
                    <td className="py-1 pr-2 font-sans">{r.bucket}</td>
                    <td className="py-1 font-sans">{r.daysPastDue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {recon && (
        <div className="border-t border-border pt-3 space-y-2 text-[11px]">
          <p className="font-semibold">Control reconciliation worksheet</p>
          <p className="font-sans text-muted-foreground">
            Control {recon.controlAccount}: GL {money(recon.glControl)} · subledger {money(recon.subledgerOpen)} · drift {money(recon.drift)}
            {recon.reconciled ? ' · tied' : ' · out of balance'}
          </p>
          <p className="text-muted-foreground">{recon.note}</p>
          <ul className="space-y-0.5 max-h-40 overflow-auto">
            {items.filter(i => i.open > 0 && (i.kind === 'invoice' || i.kind === 'bill')).map(i => (
              <li key={i.id} className="font-sans flex justify-between gap-2 border-b border-border/40 py-0.5">
                <span>#{i.id} {i.internalDocumentNo} · {i.counterpartyName}</span>
                <span>{money(i.open)} {i.currency}</span>
              </li>
            ))}
          </ul>
        </div>
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
  const [csvText, setCsvText] = useState('');
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
        Capture statement lines, then match 1:1 / N:M to open items. Match posts cash and reduces the invoice open balance. Auto-match uses exact amount once. CSV import: date,narrative,amount.
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
      <label className="block space-y-1">
        <span className="text-muted-foreground">Import CSV (date,narrative,amount)</span>
        <textarea
          className="w-full border border-border rounded-md px-2 py-1.5 bg-background font-sans min-h-[72px]"
          placeholder={"2026-08-01,DuitNow vendor pay,-1200.00\n2026-08-02,Customer receipt,850.50"}
          value={csvText}
          onChange={e => setCsvText(e.target.value)}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !csvText.trim()}
          className="text-xs font-bold border border-border px-3 py-1.5 rounded-md disabled:opacity-50"
          onClick={() => {
            void (async () => {
              setBusy(true);
              onError(null);
              try {
                await api.accountingImportBankCsv(companyId, {
                  csvText,
                  currency: functionalCurrency,
                  opening: 0,
                });
                setCsvText('');
                await load();
              } catch (e) {
                onError(e instanceof Error ? e.message : 'CSV import failed');
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          Import CSV statement
        </button>
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

export function BudgetsPanel({
  companyId,
  accounts,
  functionalCurrency,
  onError,
}: {
  companyId: number;
  accounts: Array<{ code: string; name: string }>;
  functionalCurrency: string;
  onError: (msg: string | null) => void;
}) {
  const [rows, setRows] = useState<Array<{
    id: number;
    name: string;
    fiscalYear: number;
    currency: string;
    status: string;
    lineCount: number;
  }>>([]);
  const [name, setName] = useState('Annual budget');
  const [year, setYear] = useState(new Date().getFullYear());
  const [accountCode, setAccountCode] = useState('');
  const [periodNo, setPeriodNo] = useState(1);
  const [amount, setAmount] = useState('');
  const [vs, setVs] = useState<{
    name: string;
    rows: Array<{ accountCode: string; accountName: string; budget: number; actual: number; variance: number }>;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setRows(await api.accountingBudgets(companyId));
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to load budgets');
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const save = async () => {
    const n = Number(amount);
    if (!accountCode.trim() || !(n > 0)) {
      onError('Account code and amount required');
      return;
    }
    setBusy(true);
    onError(null);
    try {
      await api.accountingUpsertBudget(companyId, {
        name,
        fiscalYear: year,
        currency: functionalCurrency,
        lines: [{ accountCode: accountCode.trim(), periodNo, amount: n }],
      });
      setAmount('');
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Budget save failed');
    } finally {
      setBusy(false);
    }
  };

  const openVs = async (id: number) => {
    try {
      const r = await api.accountingBudgetVsActual(companyId, id);
      setVs({ name: r.name, rows: r.rows });
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Budget vs actual failed');
    }
  };

  return (
    <div className="space-y-4 max-w-4xl border-t border-border pt-3 text-xs">
      <p className="font-semibold">Budgets</p>
      <p className="text-muted-foreground">Upsert a named fiscal-year budget; compare to period actuals.</p>
      <div className="flex flex-wrap gap-2 items-end">
        <label className="space-y-1">
          <span className="text-muted-foreground">Name</span>
          <input className="block border border-border rounded-md bg-background px-2 py-1" value={name} onChange={e => setName(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-muted-foreground">Year</span>
          <input type="number" className="block border border-border rounded-md bg-background px-2 py-1 w-24 font-sans" value={year} onChange={e => setYear(Number(e.target.value))} />
        </label>
        <label className="space-y-1">
          <span className="text-muted-foreground">Account</span>
          <select className="block border border-border rounded-md bg-background px-2 py-1 font-sans" value={accountCode} onChange={e => setAccountCode(e.target.value)}>
            <option value="">Select…</option>
            {accounts.map(a => (
              <option key={a.code} value={a.code}>{a.code} · {a.name}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-muted-foreground">Period</span>
          <input type="number" min={1} max={12} className="block border border-border rounded-md bg-background px-2 py-1 w-16 font-sans" value={periodNo} onChange={e => setPeriodNo(Number(e.target.value))} />
        </label>
        <label className="space-y-1">
          <span className="text-muted-foreground">Amount</span>
          <input className="block border border-border rounded-md bg-background px-2 py-1 w-28 font-sans" value={amount} onChange={e => setAmount(e.target.value)} />
        </label>
        <button type="button" disabled={busy} onClick={() => void save()} className="text-xs font-bold bg-primary text-primary-foreground px-3 py-1.5 rounded-md disabled:opacity-50">
          Save budget line
        </button>
      </div>
      <ul className="space-y-2">
        {rows.map(r => (
          <li key={r.id} className="flex flex-wrap gap-2 justify-between border-b border-border/60 pb-2">
            <span className="font-sans">{r.name} · FY{r.fiscalYear} · {r.currency} · {r.lineCount} lines · {r.status}</span>
            <button type="button" className="underline text-muted-foreground" onClick={() => void openVs(r.id)}>Vs actual</button>
          </li>
        ))}
      </ul>
      {vs && (
        <div className="space-y-2">
          <p className="font-semibold">{vs.name} — budget vs actual</p>
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-muted-foreground border-b border-border text-left">
                <th className="py-1 pr-2">Account</th>
                <th className="py-1 pr-2 text-right">Budget</th>
                <th className="py-1 pr-2 text-right">Actual</th>
                <th className="py-1 text-right">Variance</th>
              </tr>
            </thead>
            <tbody>
              {vs.rows.map(r => (
                <tr key={r.accountCode} className="border-b border-border/60">
                  <td className="py-1 pr-2">{r.accountCode} · {r.accountName}</td>
                  <td className="py-1 pr-2 text-right font-sans">{money(r.budget)}</td>
                  <td className="py-1 pr-2 text-right font-sans">{money(r.actual)}</td>
                  <td className="py-1 text-right font-sans">{money(r.variance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function ScalePanel({
  companyId,
  periodId,
  onError,
}: {
  companyId: number;
  periodId?: number;
  onError: (msg: string | null) => void;
}) {
  const [groups, setGroups] = useState<Array<{
    id: number;
    name: string;
    status: string;
    members: Array<{ memberCompanyId: number; ownershipPercent: number }>;
  }>>([]);
  const [pnl, setPnl] = useState<Array<{ locationExternalId: string; income: number; expense: number; net: number }> | null>(null);
  const [groupName, setGroupName] = useState('Group');
  const [memberId, setMemberId] = useState('');
  const [coaCsv, setCoaCsv] = useState('code,name,type,normal\n1500,Take-on Asset,asset,D\n3000,Take-on Equity,equity,C');
  const [journalCsv, setJournalCsv] = useState('effectiveDate,accountCode,direction,amount,narration,locationExternalId\n');
  const [einvoice, setEinvoice] = useState<Array<{
    id: number;
    provider: string;
    documentType: string;
    sourceDocKey: string;
    status: string;
    externalUin: string | null;
  }>>([]);
  const [returns, setReturns] = useState<Array<{
    id: number;
    returnType: string;
    periodStart: string;
    periodEnd: string;
    status: string;
    transmissionStatus: string;
  }>>([]);
  const [msg, setMsg] = useState('');

  const load = async () => {
    try {
      const [g, e, r] = await Promise.all([
        api.accountingConsolGroups(companyId),
        api.accountingEinvoiceList(companyId),
        api.accountingListReturns(companyId),
      ]);
      setGroups(g);
      setEinvoice(e);
      setReturns(r);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to load scale data');
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const saveGroup = async () => {
    const mid = Number(memberId);
    if (!(mid > 0)) {
      onError('Member company id required');
      return;
    }
    try {
      await api.accountingUpsertConsolGroup(companyId, {
        name: groupName,
        members: [{ memberCompanyId: mid, ownershipPercent: 100 }],
      });
      setMsg('Consolidation group saved');
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Consol group failed');
    }
  };

  const loadPnl = async () => {
    if (!periodId) {
      onError('Select a period on Overview/Reports first');
      return;
    }
    try {
      const r = await api.accountingPnlByLocation(companyId, periodId);
      setPnl(r.rows);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'P&L by location failed');
    }
  };

  const importCoa = async () => {
    try {
      const r = await api.accountingTakeOnCoa(companyId, coaCsv);
      setMsg(`COA take-on: created ${r.created}, skipped ${r.skipped}`);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'COA import failed');
    }
  };

  const importJournals = async () => {
    try {
      const r = await api.accountingTakeOnJournals(companyId, journalCsv);
      setMsg(`Journal take-on: posted ${r.journalsPosted}`);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Journal import failed');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl border-t border-border pt-3 text-xs">
      <div>
        <p className="font-semibold">Scale &amp; compliance</p>
        <p className="text-muted-foreground mt-1">
          Consolidation groups, location P&amp;L, QBO/Xero CSV take-on, MyInvois stub queue, SST export.
          Stub e-invoice is not live LHDN transmission.
        </p>
        {msg && <p className="text-muted-foreground mt-1 font-sans">{msg}</p>}
      </div>

      <div className="space-y-2">
        <p className="font-semibold">Consolidation group</p>
        <div className="flex flex-wrap gap-2 items-end">
          <input className="border border-border rounded-md bg-background px-2 py-1" value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Group name" />
          <input className="border border-border rounded-md bg-background px-2 py-1 w-32 font-sans" value={memberId} onChange={e => setMemberId(e.target.value)} placeholder="Member company id" />
          <button type="button" onClick={() => void saveGroup()} className="font-bold bg-primary text-primary-foreground px-3 py-1.5 rounded-md">Save group</button>
        </div>
        <ul className="space-y-1">
          {groups.map(g => (
            <li key={g.id} className="font-sans">
              {g.name} · {g.status} · members: {g.members.map(m => `${m.memberCompanyId}@${m.ownershipPercent}%`).join(', ') || 'none'}
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        <p className="font-semibold">P&amp;L by location</p>
        <button type="button" className="underline text-muted-foreground" onClick={() => void loadPnl()}>Load for selected period</button>
        {pnl && (
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-muted-foreground border-b border-border text-left">
                <th className="py-1 pr-2">Location</th>
                <th className="py-1 pr-2 text-right">Income</th>
                <th className="py-1 pr-2 text-right">Expense</th>
                <th className="py-1 text-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {pnl.map(r => (
                <tr key={r.locationExternalId} className="border-b border-border/60">
                  <td className="py-1 pr-2 font-sans">{r.locationExternalId}</td>
                  <td className="py-1 pr-2 text-right font-sans">{money(r.income)}</td>
                  <td className="py-1 pr-2 text-right font-sans">{money(r.expense)}</td>
                  <td className="py-1 text-right font-sans">{money(r.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="space-y-2">
        <p className="font-semibold">Take-on (COA CSV)</p>
        <textarea className="w-full min-h-[80px] border border-border rounded-md bg-background px-2 py-1 font-sans text-[11px]" value={coaCsv} onChange={e => setCoaCsv(e.target.value)} />
        <button type="button" className="underline text-muted-foreground" onClick={() => void importCoa()}>Import COA</button>
      </div>

      <div className="space-y-2">
        <p className="font-semibold">Take-on (journals CSV)</p>
        <textarea className="w-full min-h-[80px] border border-border rounded-md bg-background px-2 py-1 font-sans text-[11px]" value={journalCsv} onChange={e => setJournalCsv(e.target.value)} />
        <button type="button" className="underline text-muted-foreground" onClick={() => void importJournals()}>Import journals</button>
      </div>

      <div className="space-y-2">
        <p className="font-semibold">E-invoice transmissions (MyInvois stub)</p>
        <ul className="space-y-1">
          {einvoice.length === 0 && <li className="text-muted-foreground">None yet — approve an AR invoice to queue stub transmission.</li>}
          {einvoice.map(t => (
            <li key={t.id} className="font-sans">
              #{t.id} · {t.provider} · {t.documentType} · {t.sourceDocKey} · {t.status}
              {t.externalUin ? ` · UIN ${t.externalUin}` : ''}
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        <p className="font-semibold">Statutory returns / SST-02 export</p>
        <ul className="space-y-1">
          {returns.length === 0 && <li className="text-muted-foreground">Compute SST-02 from Malaysia tab first.</li>}
          {returns.map(r => (
            <li key={r.id} className="flex flex-wrap gap-2 justify-between border-b border-border/40 py-1">
              <span className="font-sans">
                #{r.id} · {r.returnType} · {r.periodStart}→{r.periodEnd} · {r.status} · {r.transmissionStatus}
              </span>
              <button
                type="button"
                className="underline text-muted-foreground"
                onClick={() => {
                  void api.accountingExportReturnCsv(companyId, r.id)
                    .then(csv => {
                      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `sst-02-${r.id}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                    })
                    .catch(e => onError(e instanceof Error ? e.message : 'Export failed'));
                }}
              >
                Download CSV
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
