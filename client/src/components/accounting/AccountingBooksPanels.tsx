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
  return new Date().toISOString().slice(0, 10);
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
          <p>E-invoice: {pack.sst.eInvoicing}</p>
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
            <li key={t.code} className="font-sans">
              {t.code} · {t.name} · {t.ratePercent}% · {t.recoverability}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="font-semibold mb-1">Account roles</p>
        <ul className="space-y-1 max-h-48 overflow-auto">
          {pack.accountRoles.map(r => (
            <li key={r.roleCode} className="font-sans">
              {r.roleCode} → {r.mapped ? `acct#${r.accountId}` : 'unmapped'} {r.notes ? `· ${r.notes}` : ''}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="font-semibold mb-1">SLA rule sets</p>
        <ul className="space-y-1">
          {pack.slaRuleSets.map(s => (
            <li key={s.id} className="font-sans">
              {s.eventType} · {s.name} · v{s.version} · {s.lineCount} lines · {s.status}
            </li>
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
        Store conversion rates as <strong>{functionalCurrency} per 1 foreign unit</strong>. Journals can use a stored rate or an ad-hoc rate at post.
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
          <input className="w-full border border-border rounded-md px-2 py-1.5 bg-background font-sans" inputMode="decimal" value={rate} onChange={e => setRate(e.target.value)} placeholder="4.70" />
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
            {r.rateDate} · 1 {r.fromCurrency} = {r.rate} {r.toCurrency} · {r.rateType}/{r.source}
          </li>
        ))}
        {rows.length === 0 && <li className="text-muted-foreground">No FX rates yet.</li>}
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
  const [name, setName] = useState('');
  const [gross, setGross] = useState('');
  const [tax, setTax] = useState('0');
  const [taxCode, setTaxCode] = useState(subledger === 'ar' ? 'SST-6' : 'SST-6');
  const [currency, setCurrency] = useState(functionalCurrency);
  const [issueDate, setIssueDate] = useState(todayIso());
  const [dueDate, setDueDate] = useState(todayIso());
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [list, age] = await Promise.all([
        api.accountingOpenItems(companyId, subledger),
        api.accountingAging(companyId, subledger),
      ]);
      setItems(list);
      setAging(age);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to load open items');
    }
  };

  useEffect(() => {
    setCurrency(functionalCurrency);
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
        kind: subledger === 'ar' ? 'invoice' : 'bill',
        counterpartyName: name.trim(),
        issueDate,
        dueDate,
        gross: g,
        currency,
        taxCode,
        taxAmount: t,
        narration: `${subledger.toUpperCase()} ${name.trim()}`,
        postJournal: true,
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

  return (
    <div className="space-y-4 max-w-5xl border-t border-border pt-3 text-xs">
      <p className="text-muted-foreground">
        {subledger === 'ar' ? 'Accounts receivable' : 'Accounts payable'} · Malaysia SLA posts sealed journals (SST non-recoverable on AP).
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-2">
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
        <div className="flex items-end sm:col-span-2">
          <button type="button" disabled={busy} onClick={() => void create()} className="text-xs font-bold bg-primary text-primary-foreground px-3 py-1.5 rounded-md disabled:opacity-50">
            Post {subledger === 'ar' ? 'invoice' : 'bill'}
          </button>
        </div>
      </div>

      {aging && (
        <p className="font-sans text-muted-foreground">
          Aging as of {aging.asOf}: current {money(aging.buckets.current ?? 0)} · 1–30 {money(aging.buckets['1-30'] ?? 0)} · 31–60 {money(aging.buckets['31-60'] ?? 0)} · 61–90 {money(aging.buckets['61-90'] ?? 0)} · 90+ {money(aging.buckets['90+'] ?? 0)}
        </p>
      )}

      <table className="w-full border-collapse">
        <thead>
          <tr className="text-left text-muted-foreground border-b border-border">
            <th className="py-1 pr-2">Doc</th>
            <th className="py-1 pr-2">Party</th>
            <th className="py-1 pr-2 text-right">Open</th>
            <th className="py-1 pr-2">Due</th>
            <th className="py-1">Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map(i => (
            <tr key={i.id} className="border-b border-border/60">
              <td className="py-1 pr-2 font-sans">{i.internalDocumentNo}</td>
              <td className="py-1 pr-2">{i.counterpartyName}</td>
              <td className="py-1 pr-2 text-right font-sans">{money(i.open)} {i.currency}</td>
              <td className="py-1 pr-2 font-sans">{i.dueDate}</td>
              <td className="py-1 font-sans">{i.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.length === 0 && <p className="text-muted-foreground">No open items yet.</p>}
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
  const [narrative, setNarrative] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setRows(await api.accountingBankStatements(companyId));
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to load bank statements');
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
        statementDate: todayIso(),
        currency: functionalCurrency,
        source: 'manual',
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

  return (
    <div className="space-y-4 max-w-3xl border-t border-border pt-3 text-xs">
      <p className="text-muted-foreground">
        Bank statement shell for Malaysia (DuitNow / FPX / file). Matching engine (1:1 / N:M) lands next; capture lines now.
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
      <button type="button" disabled={busy} onClick={() => void create()} className="text-xs font-bold bg-primary text-primary-foreground px-3 py-1.5 rounded-md disabled:opacity-50">
        Add statement line
      </button>
      <ul className="space-y-1">
        {rows.map(r => (
          <li key={r.id} className="font-sans border-b border-border/50 py-1">
            {r.statementDate} · {r.accountLabel} · {r.lineCount} line(s) · {r.status} · {r.source}
          </li>
        ))}
        {rows.length === 0 && <li className="text-muted-foreground">No statements yet.</li>}
      </ul>
    </div>
  );
}
