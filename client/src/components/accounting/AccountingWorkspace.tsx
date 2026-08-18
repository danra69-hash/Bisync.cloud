import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import {
  api,
  type AccountingAccount,
  type AccountingJournalDetail,
  type AccountingJournalSummary,
  type AccountingLedgerStatus,
  type AccountingPeriod,
  type AccountingStatements,
  type AccountingTrialBalance,
} from '../../api';
import { MillstoneLoader } from '../shared/MillstoneLoader';

type BooksTab = 'overview' | 'coa' | 'journals' | 'reports' | 'periods';

const BOOKS_TABS: { id: BooksTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'coa', label: 'Chart of Accounts' },
  { id: 'journals', label: 'Journals' },
  { id: 'reports', label: 'Reports' },
  { id: 'periods', label: 'Periods' },
];

function money(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function AccountingWorkspace({ companyId }: { companyId: number | null }) {
  const [tab, setTab] = useState<BooksTab>('overview');
  const [status, setStatus] = useState<AccountingLedgerStatus | null>(null);
  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [journals, setJournals] = useState<AccountingJournalSummary[]>([]);
  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
  const [tb, setTb] = useState<AccountingTrialBalance | null>(null);
  const [statements, setStatements] = useState<AccountingStatements | null>(null);
  const [periodId, setPeriodId] = useState<number | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<AccountingJournalDetail | null>(null);

  const load = useCallback(async () => {
    if (!companyId) {
      setStatus(null);
      setAccounts([]);
      setJournals([]);
      setPeriods([]);
      setTb(null);
      setStatements(null);
      setError('Select a company in the header to use Accounting Books.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [st, ac, j, p] = await Promise.all([
        api.accountingStatus(companyId),
        api.accountingAccounts(companyId),
        api.accountingJournals(companyId, 80),
        api.accountingPeriods(companyId),
      ]);
      setStatus(st);
      setAccounts(ac);
      setJournals(j);
      setPeriods(p);
      const current =
        periodId
        ?? p.find(x => {
          const t = todayIso();
          return x.startDate <= t && x.endDate >= t;
        })?.id
        ?? p[0]?.id;
      if (current) {
        setPeriodId(current);
        const [trial, stmt] = await Promise.all([
          api.accountingTrialBalance(companyId, current),
          api.accountingStatements(companyId, current),
        ]);
        setTb(trial);
        setStatements(stmt);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load Accounting');
    } finally {
      setLoading(false);
    }
  }, [companyId, periodId]);

  useEffect(() => {
    void load();
    // Only re-bootstrap when company changes; period changes handled by onPeriodChange
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const onPeriodChange = async (id: number) => {
    if (!companyId) return;
    setPeriodId(id);
    setLoading(true);
    try {
      const [trial, stmt] = await Promise.all([
        api.accountingTrialBalance(companyId, id),
        api.accountingStatements(companyId, id),
      ]);
      setTb(trial);
      setStatements(stmt);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load period reports');
    } finally {
      setLoading(false);
    }
  };

  if (!companyId) {
    return <p className="text-xs text-muted-foreground">Select a company in the header to open Books.</p>;
  }

  if (loading && !status) {
    return <MillstoneLoader layout="block" size="md" label="Loading Books…" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Books</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Chart of accounts, sealed journals, trial balance, P&amp;L and balance sheet.
            {status ? ` · Functional ${status.functionalCurrency ?? status.currency}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 text-xs font-semibold border border-border px-3 py-1.5 rounded-md hover:bg-muted/40"
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex flex-wrap gap-0 border-b border-border">
        {BOOKS_TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-xs font-semibold border-b-2 transition-colors -mb-px whitespace-nowrap ${
              tab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {periods.length > 0 && (tab === 'reports' || tab === 'overview') && (
        <label className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Period</span>
          <select
            className="border border-border rounded-md bg-background px-2 py-1 font-sans"
            value={periodId ?? ''}
            onChange={e => void onPeriodChange(Number(e.target.value))}
          >
            {periods.map(p => (
              <option key={p.id} value={p.id}>
                {p.year}-{String(p.periodNo).padStart(2, '0')} ({p.status})
              </option>
            ))}
          </select>
        </label>
      )}

      {tab === 'overview' && (
        <OverviewPanel status={status} tb={tb} statements={statements} journals={journals} />
      )}
      {tab === 'coa' && (
        <ChartOfAccountsPanel
          companyId={companyId}
          accounts={accounts}
          onChanged={() => void load()}
          onError={setError}
        />
      )}
      {tab === 'journals' && (
        <JournalsPanel
          companyId={companyId}
          accounts={accounts.filter(a => a.active)}
          journals={journals}
          detail={detail}
          functionalCurrency={status?.functionalCurrency ?? status?.currency ?? 'MYR'}
          currencies={status?.currencies ?? [status?.currency ?? 'MYR']}
          onSelect={async id => {
            try {
              setDetail(await api.accountingJournal(companyId, id));
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Failed to load journal');
            }
          }}
          onChanged={() => {
            setDetail(null);
            void load();
          }}
          onError={setError}
        />
      )}
      {tab === 'reports' && <ReportsPanel tb={tb} statements={statements} />}
      {tab === 'periods' && (
        <PeriodsPanel
          companyId={companyId}
          periods={periods}
          onChanged={() => void load()}
          onError={setError}
        />
      )}
    </div>
  );
}

function OverviewPanel({
  status,
  tb,
  statements,
  journals,
}: {
  status: AccountingLedgerStatus | null;
  tb: AccountingTrialBalance | null;
  statements: AccountingStatements | null;
  journals: AccountingJournalSummary[];
}) {
  return (
    <div className="space-y-5 max-w-5xl">
      {status && (
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs border-t border-border pt-3">
          <div>
            <dt className="text-muted-foreground">Accounts</dt>
            <dd className="font-semibold font-sans mt-0.5">{status.accounts}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Posted journals</dt>
            <dd className="font-semibold font-sans mt-0.5">{status.postedJournals}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Open periods</dt>
            <dd className="font-semibold font-sans mt-0.5">{status.openPeriods}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Net income (period)</dt>
            <dd className="font-semibold font-sans mt-0.5">
              {statements ? money(statements.profitAndLoss.netIncome) : '—'}
            </dd>
          </div>
        </dl>
      )}
      <div className="border-t border-border pt-3 text-xs space-y-1">
        <p className="font-semibold">Live bridges</p>
        <p className="text-muted-foreground">Payroll process → PAYROLL journal · PO consolidate → PURCH (Inventory/AP)</p>
        <p className="text-muted-foreground">
          Trial balance {tb?.balanced ? 'balanced' : 'out of balance'}
          {tb ? ` · Dr ${money(tb.totalDr)} / Cr ${money(tb.totalCr)}` : ''}
        </p>
      </div>
      <div className="border-t border-border pt-3 space-y-2">
        <p className="text-xs font-semibold">Recent journals</p>
        {journals.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No journals yet. Post a manual entry, process payroll, or consolidate a purchase.
          </p>
        ) : (
          <ul className="text-xs space-y-1.5">
            {journals.slice(0, 8).map(j => (
              <li key={j.id} className="font-sans text-muted-foreground">
                <span className="text-foreground font-semibold">{j.docNumber ?? `#${j.id}`}</span>
                {' · '}{j.journalType} · {j.narration || j.sourceModule}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ChartOfAccountsPanel({
  companyId,
  accounts,
  onChanged,
  onError,
}: {
  companyId: number;
  accounts: AccountingAccount[];
  onChanged: () => void;
  onError: (msg: string | null) => void;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState('expense');
  const [normalBalance, setNormalBalance] = useState('D');
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    onError(null);
    try {
      await api.accountingCreateAccount(companyId, { code, name, accountType, normalBalance });
      setCode('');
      setName('');
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Create account failed');
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (a: AccountingAccount) => {
    try {
      await api.accountingUpdateAccount(companyId, a.id, { active: !a.active });
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Update failed');
    }
  };

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs items-end border-t border-border pt-3">
        <label className="space-y-1">
          <span className="text-muted-foreground">Code</span>
          <input className="w-full border border-border rounded-md px-2 py-1.5 bg-background font-sans" value={code} onChange={e => setCode(e.target.value)} placeholder="6000" />
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="text-muted-foreground">Name</span>
          <input className="w-full border border-border rounded-md px-2 py-1.5 bg-background" value={name} onChange={e => setName(e.target.value)} placeholder="New account" />
        </label>
        <label className="space-y-1">
          <span className="text-muted-foreground">Type</span>
          <select className="w-full border border-border rounded-md px-2 py-1.5 bg-background" value={accountType} onChange={e => {
            const t = e.target.value;
            setAccountType(t);
            setNormalBalance(t === 'asset' || t === 'expense' ? 'D' : 'C');
          }}>
            {['asset', 'liability', 'equity', 'income', 'expense'].map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={busy || !code.trim() || !name.trim()}
          onClick={() => void create()}
          className="text-xs font-bold bg-primary text-primary-foreground px-3 py-1.5 rounded-md disabled:opacity-50"
        >
          Add account
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-left text-muted-foreground border-b border-border">
              <th className="py-1 pr-2 font-sans">Code</th>
              <th className="py-1 pr-2">Name</th>
              <th className="py-1 pr-2 font-sans">Type</th>
              <th className="py-1 pr-2 font-sans">Bal</th>
              <th className="py-1 font-sans">Active</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map(a => (
              <tr key={a.id} className="border-b border-border/60">
                <td className="py-1 pr-2 font-sans">{a.code}</td>
                <td className="py-1 pr-2">{a.name}</td>
                <td className="py-1 pr-2 font-sans">{a.accountType}</td>
                <td className="py-1 pr-2 font-sans">{a.normalBalance}</td>
                <td className="py-1">
                  <button type="button" className="underline text-muted-foreground hover:text-foreground" onClick={() => void toggleActive(a)}>
                    {a.active ? 'Yes' : 'No'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type DraftLine = { accountCode: string; direction: 'D' | 'C'; amount: string; narration: string };

function JournalsPanel({
  companyId,
  accounts,
  journals,
  detail,
  functionalCurrency,
  currencies,
  onSelect,
  onChanged,
  onError,
}: {
  companyId: number;
  accounts: AccountingAccount[];
  journals: AccountingJournalSummary[];
  detail: AccountingJournalDetail | null;
  functionalCurrency: string;
  currencies: string[];
  onSelect: (id: number) => void;
  onChanged: () => void;
  onError: (msg: string | null) => void;
}) {
  const currencyOptions = currencies.includes(functionalCurrency)
    ? currencies
    : [functionalCurrency, ...currencies];
  const [currency, setCurrency] = useState(functionalCurrency);
  const [fxRate, setFxRate] = useState('');
  const [narration, setNarration] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(todayIso());
  const [lines, setLines] = useState<DraftLine[]>([
    { accountCode: accounts[0]?.code ?? '5100', direction: 'D', amount: '', narration: '' },
    { accountCode: accounts.find(a => a.code === '1000')?.code ?? accounts[0]?.code ?? '1000', direction: 'C', amount: '', narration: '' },
  ]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCurrency(functionalCurrency);
    setFxRate('');
  }, [functionalCurrency]);

  const foreign = currency !== functionalCurrency;
  const rateNum = Number(fxRate);
  const rateOk = !foreign || (Number.isFinite(rateNum) && rateNum > 0);
  const debit = lines.filter(l => l.direction === 'D').reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const credit = lines.filter(l => l.direction === 'C').reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const balanced = Math.abs(debit - credit) < 0.005 && debit > 0;
  const funcDebit = foreign && rateOk ? debit * rateNum : debit;
  const funcCredit = foreign && rateOk ? credit * rateNum : credit;

  const post = async () => {
    if (!balanced) {
      onError('Journal must balance (debits = credits) with amounts > 0.');
      return;
    }
    if (foreign && !rateOk) {
      onError(`Enter a conversion rate (${functionalCurrency} per 1 ${currency}).`);
      return;
    }
    setBusy(true);
    onError(null);
    try {
      await api.accountingPostJournal(companyId, {
        effectiveDate,
        documentDate: effectiveDate,
        narration,
        journalType: 'GEN',
        docSeries: 'GEN',
        currency,
        fxRate: foreign ? rateNum : undefined,
        fxRateDate: foreign ? effectiveDate : undefined,
        lines: lines
          .filter(l => Number(l.amount) > 0)
          .map(l => ({
            accountCode: l.accountCode,
            direction: l.direction,
            amount: Number(l.amount),
            narration: l.narration,
          })),
      });
      setNarration('');
      setFxRate('');
      setCurrency(functionalCurrency);
      setLines(lines.map(l => ({ ...l, amount: '', narration: '' })));
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Post journal failed');
    } finally {
      setBusy(false);
    }
  };

  const reverse = async (id: number) => {
    try {
      await api.accountingReverseJournal(companyId, id);
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Reverse failed');
    }
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="border-t border-border pt-3 space-y-3">
        <p className="text-xs font-semibold">New journal entry</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
          <label className="space-y-1">
            <span className="text-muted-foreground">Effective date</span>
            <input type="date" className="w-full border border-border rounded-md px-2 py-1.5 bg-background font-sans" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="text-muted-foreground">Currency</span>
            <select
              className="w-full border border-border rounded-md px-2 py-1.5 bg-background font-sans"
              value={currency}
              onChange={e => {
                const next = e.target.value;
                setCurrency(next);
                if (next === functionalCurrency) setFxRate('');
              }}
            >
              {currencyOptions.map(c => (
                <option key={c} value={c}>
                  {c}{c === functionalCurrency ? ' (functional)' : ''}
                </option>
              ))}
            </select>
          </label>
          {foreign ? (
            <label className="space-y-1">
              <span className="text-muted-foreground">Conversion rate ({functionalCurrency} / 1 {currency})</span>
              <input
                className="w-full border border-border rounded-md px-2 py-1.5 bg-background font-sans"
                inputMode="decimal"
                placeholder="e.g. 4.70"
                value={fxRate}
                onChange={e => setFxRate(e.target.value)}
              />
            </label>
          ) : (
            <div className="space-y-1">
              <span className="text-muted-foreground">Conversion rate</span>
              <p className="text-[11px] text-muted-foreground pt-1.5">Not needed — same as functional.</p>
            </div>
          )}
          <label className="space-y-1 sm:col-span-2 lg:col-span-1">
            <span className="text-muted-foreground">Narration</span>
            <input className="w-full border border-border rounded-md px-2 py-1.5 bg-background" value={narration} onChange={e => setNarration(e.target.value)} placeholder="Journal description" />
          </label>
        </div>
        {foreign && (
          <p className="text-[11px] text-muted-foreground">
            Line amounts are in {currency}. Books will store functional amounts in {functionalCurrency}
            {rateOk ? ` at rate ${rateNum}` : ''}.
          </p>
        )}
        <div className="space-y-2">
          {lines.map((line, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-1.5 text-xs items-center">
              <select
                className="col-span-4 border border-border rounded-md px-1.5 py-1 bg-background font-sans"
                value={line.accountCode}
                onChange={e => {
                  const next = [...lines];
                  next[idx] = { ...line, accountCode: e.target.value };
                  setLines(next);
                }}
              >
                {accounts.map(a => (
                  <option key={a.id} value={a.code}>{a.code} · {a.name}</option>
                ))}
              </select>
              <select
                className="col-span-2 border border-border rounded-md px-1.5 py-1 bg-background font-sans"
                value={line.direction}
                onChange={e => {
                  const next = [...lines];
                  next[idx] = { ...line, direction: e.target.value as 'D' | 'C' };
                  setLines(next);
                }}
              >
                <option value="D">Debit</option>
                <option value="C">Credit</option>
              </select>
              <input
                className="col-span-2 border border-border rounded-md px-1.5 py-1 bg-background font-sans text-right"
                inputMode="decimal"
                placeholder={`0.00 ${currency}`}
                value={line.amount}
                onChange={e => {
                  const next = [...lines];
                  next[idx] = { ...line, amount: e.target.value };
                  setLines(next);
                }}
              />
              <input
                className="col-span-3 border border-border rounded-md px-1.5 py-1 bg-background"
                placeholder="Line note"
                value={line.narration}
                onChange={e => {
                  const next = [...lines];
                  next[idx] = { ...line, narration: e.target.value };
                  setLines(next);
                }}
              />
              <button
                type="button"
                className="col-span-1 text-muted-foreground hover:text-foreground"
                disabled={lines.length <= 2}
                onClick={() => setLines(lines.filter((_, i) => i !== idx))}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <button type="button" className="underline text-muted-foreground" onClick={() => setLines([...lines, { accountCode: accounts[0]?.code ?? '', direction: 'D', amount: '', narration: '' }])}>
            + Line
          </button>
          <span className="font-sans text-muted-foreground">
            Dr {money(debit)} {currency} · Cr {money(credit)} {currency} · {balanced ? 'balanced' : 'unbalanced'}
            {foreign && rateOk ? ` → ${money(funcDebit)} / ${money(funcCredit)} ${functionalCurrency}` : ''}
          </span>
          <button
            type="button"
            disabled={busy || !balanced || !rateOk}
            onClick={() => void post()}
            className="ml-auto text-xs font-bold bg-primary text-primary-foreground px-3 py-1.5 rounded-md disabled:opacity-50"
          >
            Post journal
          </button>
        </div>
      </div>

      <div className="border-t border-border pt-3 space-y-2">
        <p className="text-xs font-semibold">Posted journals</p>
        <ul className="text-xs space-y-2">
          {journals.map(j => (
            <li key={j.id} className="border-b border-border/60 pb-2 flex flex-wrap gap-2 justify-between">
              <button type="button" className="text-left" onClick={() => onSelect(j.id)}>
                <span className="font-sans font-semibold">{j.docNumber ?? `#${j.id}`}</span>
                <span className="text-muted-foreground"> · {j.journalType} · {j.narration || j.sourceModule} · {j.lineCount} lines</span>
              </button>
              {!j.reversesJournalId && (
                <button type="button" className="text-muted-foreground underline" onClick={() => void reverse(j.id)}>
                  Reverse
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {detail && (
        <div className="border-t border-border pt-3 space-y-2 text-xs">
          <p className="font-semibold font-sans">{detail.docNumber} detail</p>
          {detail.lines[0]?.fxRate != null && (
            <p className="text-muted-foreground">
              FX {detail.lines[0].fxRate} {detail.lines[0].funcCurrency} / 1 {detail.lines[0].currency}
              {detail.lines[0].fxRateDate ? ` · ${detail.lines[0].fxRateDate}` : ''}
              {detail.lines[0].fxRateType ? ` · ${detail.lines[0].fxRateType}` : ''}
            </p>
          )}
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-muted-foreground border-b border-border text-left">
                <th className="py-1 pr-2">Account</th>
                <th className="py-1 pr-2">Dir</th>
                <th className="py-1 pr-2 text-right">Txn</th>
                <th className="py-1 text-right">Functional</th>
              </tr>
            </thead>
            <tbody>
              {detail.lines.map(l => (
                <tr key={l.lineNo} className="border-b border-border/60">
                  <td className="py-1 pr-2">{l.accountCode} · {l.accountName}</td>
                  <td className="py-1 pr-2 font-sans">{l.direction}</td>
                  <td className="py-1 pr-2 text-right font-sans">{money(l.amount)} {l.currency}</td>
                  <td className="py-1 text-right font-sans">
                    {money(l.funcAmount ?? l.amount)} {l.funcCurrency ?? l.currency}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ReportsPanel({
  tb,
  statements,
}: {
  tb: AccountingTrialBalance | null;
  statements: AccountingStatements | null;
}) {
  return (
    <div className="space-y-6 max-w-5xl">
      <div className="border-t border-border pt-3 space-y-2">
        <p className="text-xs font-semibold">
          Trial balance
          {tb ? (
            <span className="font-normal text-muted-foreground">
              {' '}· {tb.currency ?? ''} · {tb.balanced ? 'balanced' : 'out of balance'} · Dr {money(tb.totalDr)} / Cr {money(tb.totalCr)}
            </span>
          ) : null}
        </p>
        {tb && tb.rows.length > 0 ? (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="py-1 pr-2 font-sans">Code</th>
                <th className="py-1 pr-2">Account</th>
                <th className="py-1 pr-2 text-right font-sans">Dr</th>
                <th className="py-1 text-right font-sans">Cr</th>
              </tr>
            </thead>
            <tbody>
              {tb.rows.map(r => (
                <tr key={r.accountCode} className="border-b border-border/60">
                  <td className="py-1 pr-2 font-sans">{r.accountCode}</td>
                  <td className="py-1 pr-2">{r.accountName}</td>
                  <td className="py-1 pr-2 text-right font-sans">{money(r.periodDr)}</td>
                  <td className="py-1 text-right font-sans">{money(r.periodCr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-xs text-muted-foreground">No movement in this period yet.</p>
        )}
      </div>

      {statements && (
        <>
          <div className="border-t border-border pt-3 space-y-2">
            <p className="text-xs font-semibold">
              Profit &amp; loss
              <span className="font-normal text-muted-foreground">
                {' '}· Net {money(statements.profitAndLoss.netIncome)}
              </span>
            </p>
            <ul className="text-xs space-y-1">
              {statements.profitAndLoss.rows.map(r => (
                <li key={r.code} className="flex justify-between gap-4 border-b border-border/40 py-1">
                  <span>{r.code} · {r.name}</span>
                  <span className="font-sans">{money(r.amount)}</span>
                </li>
              ))}
            </ul>
            {statements.profitAndLoss.rows.length === 0 && (
              <p className="text-xs text-muted-foreground">No income/expense movement this period.</p>
            )}
          </div>
          <div className="border-t border-border pt-3 space-y-2">
            <p className="text-xs font-semibold">
              Balance sheet
              <span className="font-normal text-muted-foreground">
                {' '}· {statements.balanceSheet.balanced ? 'equation holds' : 'check plug'} · Assets {money(statements.balanceSheet.assets)}
              </span>
            </p>
            <ul className="text-xs space-y-1">
              {statements.balanceSheet.rows.map(r => (
                <li key={r.code} className="flex justify-between gap-4 border-b border-border/40 py-1">
                  <span>{r.code} · {r.name} <span className="text-muted-foreground">({r.accountType})</span></span>
                  <span className="font-sans">{money(r.amount)}</span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-muted-foreground">{statements.balanceSheet.note}</p>
          </div>
        </>
      )}
    </div>
  );
}

function PeriodsPanel({
  companyId,
  periods,
  onChanged,
  onError,
}: {
  companyId: number;
  periods: AccountingPeriod[];
  onChanged: () => void;
  onError: (msg: string | null) => void;
}) {
  const softClose = async (id: number) => {
    try {
      await api.accountingSoftClosePeriod(companyId, id);
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Soft close failed');
    }
  };
  const reopen = async (id: number) => {
    try {
      await api.accountingReopenPeriod(companyId, id);
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Reopen failed');
    }
  };

  return (
    <div className="space-y-3 max-w-3xl border-t border-border pt-3">
      <p className="text-xs text-muted-foreground">
        Soft-close blocks new posts into the period. Reopen restores posting (hard-close not used yet).
      </p>
      <ul className="text-xs space-y-2">
        {periods.map(p => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
            <span className="font-sans">
              {p.year}-{String(p.periodNo).padStart(2, '0')} · {p.startDate} → {p.endDate} · <strong>{p.status}</strong>
            </span>
            <span className="flex gap-3">
              {p.status === 'open' && (
                <button type="button" className="underline text-muted-foreground" onClick={() => void softClose(p.id)}>Soft close</button>
              )}
              {p.status === 'closed' && (
                <button type="button" className="underline text-muted-foreground" onClick={() => void reopen(p.id)}>Reopen</button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
