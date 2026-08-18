import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import {
  api,
  type AccountingAccount,
  type AccountingCashFlow,
  type AccountingGeneralLedger,
  type AccountingJournalDetail,
  type AccountingJournalSummary,
  type AccountingLedgerStatus,
  type AccountingPeriod,
  type AccountingStatements,
  type AccountingTrialBalance,
} from '../../api';
import { MillstoneLoader } from '../shared/MillstoneLoader';
import {
  BankPanel,
  BudgetsPanel,
  FixedAssetsPanel,
  OpenItemsPanel,
  RevRecPanel,
  ScalePanel,
} from './AccountingBooksPanels';
import { FxRateEntryModal } from './FxRateEntryModal';
import { loadJsPDF } from '../../data/loadJsPdf';

type BooksTab =
  | 'overview'
  | 'coa'
  | 'journals'
  | 'ar'
  | 'ap'
  | 'bank'
  | 'assets'
  | 'revrec'
  | 'budgets'
  | 'scale'
  | 'reports'
  | 'periods';

const BOOKS_TABS: { id: BooksTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'coa', label: 'Chart of Accounts' },
  { id: 'journals', label: 'Journals' },
  { id: 'ar', label: 'AR' },
  { id: 'ap', label: 'AP' },
  { id: 'bank', label: 'Bank' },
  { id: 'assets', label: 'Assets' },
  { id: 'revrec', label: 'RevRec' },
  { id: 'budgets', label: 'Budgets' },
  { id: 'scale', label: 'Scale' },
  { id: 'reports', label: 'Reports' },
  { id: 'periods', label: 'Periods' },
];

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

export function AccountingWorkspace({ companyId }: { companyId: number | null }) {
  const [tab, setTab] = useState<BooksTab>('overview');
  const [status, setStatus] = useState<AccountingLedgerStatus | null>(null);
  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [journals, setJournals] = useState<AccountingJournalSummary[]>([]);
  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
  const [tb, setTb] = useState<AccountingTrialBalance | null>(null);
  const [statements, setStatements] = useState<AccountingStatements | null>(null);
  const [cashFlow, setCashFlow] = useState<AccountingCashFlow | null>(null);
  const [gl, setGl] = useState<AccountingGeneralLedger | null>(null);
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
      setCashFlow(null);
      setGl(null);
      setError('Select a company in the header to use Accounting Books.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Load COA independently so a journals/periods failure cannot blank the chart list.
      let ac: AccountingAccount[] = [];
      try {
        ac = await api.accountingAccounts(companyId);
        setAccounts(Array.isArray(ac) ? ac : []);
      } catch (e) {
        setAccounts([]);
        setError(e instanceof Error ? e.message : 'Failed to load chart of accounts');
      }

      const [st, j, p] = await Promise.all([
        api.accountingStatus(companyId),
        api.accountingJournals(companyId, 80),
        api.accountingPeriods(companyId),
      ]);
      setStatus(st);
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
        const [trial, stmt, cf, ledger] = await Promise.all([
          api.accountingTrialBalance(companyId, current),
          api.accountingStatements(companyId, current),
          api.accountingCashFlow(companyId, current),
          api.accountingGeneralLedger(companyId, { periodId: current, take: 200 }),
        ]);
        setTb(trial);
        setStatements(stmt);
        setCashFlow(cf);
        setGl(ledger);
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
      const [trial, stmt, cf, ledger] = await Promise.all([
        api.accountingTrialBalance(companyId, id),
        api.accountingStatements(companyId, id),
        api.accountingCashFlow(companyId, id),
        api.accountingGeneralLedger(companyId, { periodId: id, take: 200 }),
      ]);
      setTb(trial);
      setStatements(stmt);
      setCashFlow(cf);
      setGl(ledger);
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
            Chart of accounts, journals, FX, AR/AP, bank, reports, and periods.
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
      {tab === 'ar' && (
        <OpenItemsPanel
          companyId={companyId}
          subledger="ar"
          functionalCurrency={status?.functionalCurrency ?? status?.currency ?? 'MYR'}
          onError={setError}
          onPosted={() => void load()}
        />
      )}
      {tab === 'ap' && (
        <OpenItemsPanel
          companyId={companyId}
          subledger="ap"
          functionalCurrency={status?.functionalCurrency ?? status?.currency ?? 'MYR'}
          onError={setError}
          onPosted={() => void load()}
        />
      )}
      {tab === 'bank' && (
        <BankPanel
          companyId={companyId}
          functionalCurrency={status?.functionalCurrency ?? status?.currency ?? 'MYR'}
          onError={setError}
        />
      )}
      {tab === 'assets' && (
        <FixedAssetsPanel
          companyId={companyId}
          functionalCurrency={status?.functionalCurrency ?? status?.currency ?? 'MYR'}
          onError={setError}
        />
      )}
      {tab === 'revrec' && (
        <RevRecPanel
          companyId={companyId}
          functionalCurrency={status?.functionalCurrency ?? status?.currency ?? 'MYR'}
          onError={setError}
        />
      )}
      {tab === 'budgets' && (
        <BudgetsPanel
          companyId={companyId}
          accounts={accounts}
          functionalCurrency={status?.functionalCurrency ?? status?.currency ?? 'MYR'}
          onError={setError}
        />
      )}
      {tab === 'scale' && (
        <ScalePanel companyId={companyId} periodId={periodId} onError={setError} />
      )}
      {tab === 'reports' && (
        <ReportsPanel
          companyId={companyId}
          periodId={periodId}
          tb={tb}
          statements={statements}
          cashFlow={cashFlow}
          gl={gl}
          onError={setError}
        />
      )}
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
  accounts: accountsProp,
  onChanged,
  onError,
}: {
  companyId: number;
  accounts: AccountingAccount[];
  onChanged: () => void;
  onError: (msg: string | null) => void;
}) {
  const [rows, setRows] = useState<AccountingAccount[]>(accountsProp);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState('expense');
  const [normalBalance, setNormalBalance] = useState('D');
  const [busy, setBusy] = useState(false);
  const [loadingList, setLoadingList] = useState(false);

  const refreshList = async () => {
    setLoadingList(true);
    try {
      const list = await api.accountingAccounts(companyId);
      setRows(Array.isArray(list) ? list : []);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to load chart of accounts');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (accountsProp.length > 0) setRows(accountsProp);
  }, [accountsProp]);

  useEffect(() => {
    void refreshList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const create = async () => {
    setBusy(true);
    onError(null);
    try {
      await api.accountingCreateAccount(companyId, { code, name, accountType, normalBalance });
      setCode('');
      setName('');
      await refreshList();
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
      await refreshList();
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Update failed');
    }
  };

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <p className="text-xs font-semibold">
          Chart of accounts
          <span className="font-normal text-muted-foreground">
            {' '}· {rows.length} account{rows.length === 1 ? '' : 's'}
            {loadingList ? ' · refreshing…' : ''}
          </span>
        </p>
        <button
          type="button"
          onClick={() => void refreshList()}
          className="text-xs font-semibold border border-border px-3 py-1.5 rounded-md hover:bg-muted/40"
        >
          Refresh list
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs items-end">
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

      <div className="overflow-x-auto border border-border rounded-md">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-left text-muted-foreground border-b border-border bg-muted/30">
              <th className="py-2 px-2 font-sans">Code</th>
              <th className="py-2 px-2">Name</th>
              <th className="py-2 px-2 font-sans">Type</th>
              <th className="py-2 px-2 font-sans">Bal</th>
              <th className="py-2 px-2 font-sans">Active</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loadingList ? (
              <tr>
                <td colSpan={5} className="py-6 px-2 text-muted-foreground">
                  No accounts yet. Refresh to seed the hospitality default chart, or add an account above.
                </td>
              </tr>
            ) : (
              rows.map(a => (
                <tr key={a.id} className="border-b border-border/60">
                  <td className="py-1.5 px-2 font-sans">{a.code}</td>
                  <td className="py-1.5 px-2">{a.name}</td>
                  <td className="py-1.5 px-2 font-sans">{a.accountType}</td>
                  <td className="py-1.5 px-2 font-sans">{a.normalBalance}</td>
                  <td className="py-1.5 px-2">
                    <button type="button" className="underline text-muted-foreground hover:text-foreground" onClick={() => void toggleActive(a)}>
                      {a.active ? 'Yes' : 'No'}
                    </button>
                  </td>
                </tr>
              ))
            )}
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
  const [fxRateDate, setFxRateDate] = useState(todayIso());
  const [fxModalOpen, setFxModalOpen] = useState(false);
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
    setFxRateDate(todayIso());
    setFxModalOpen(false);
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
        fxRateDate: foreign ? fxRateDate || effectiveDate : undefined,
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
      setFxRateDate(effectiveDate);
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
                if (next === functionalCurrency) {
                  setFxRate('');
                  setFxModalOpen(false);
                } else {
                  setFxRateDate(effectiveDate);
                  setFxModalOpen(true);
                }
              }}
            >
              {currencyOptions.map(c => (
                <option key={c} value={c}>
                  {c}{c === functionalCurrency ? ' (home)' : ''}
                </option>
              ))}
            </select>
          </label>
          <div className="space-y-1">
            <span className="text-muted-foreground">Conversion rate</span>
            {foreign ? (
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                {rateOk ? (
                  <span className="font-sans text-[11px]">
                    {rateNum} {functionalCurrency} / 1 {currency}
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
                  {rateOk ? 'Adjust rate' : 'Enter rate'}
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground pt-1.5">Not needed — home currency.</p>
            )}
          </div>
          <label className="space-y-1 sm:col-span-2 lg:col-span-1">
            <span className="text-muted-foreground">Narration</span>
            <input className="w-full border border-border rounded-md px-2 py-1.5 bg-background" value={narration} onChange={e => setNarration(e.target.value)} placeholder="Journal description" />
          </label>
        </div>
        {foreign && (
          <p className="text-[11px] text-muted-foreground">
            Line amounts are in {currency}. Books store functional amounts in {functionalCurrency}
            {rateOk ? ` at ${rateNum} (${fxRateDate})` : ''}. Remittance later can use a different rate.
          </p>
        )}
        <FxRateEntryModal
          open={fxModalOpen && foreign}
          foreignCurrency={currency}
          functionalCurrency={functionalCurrency}
          defaultRateDate={fxRateDate || effectiveDate}
          initialRate={fxRate}
          title={`FX rate for journal · ${currency}`}
          confirmLabel="Use rate"
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
  companyId,
  periodId,
  tb,
  statements,
  cashFlow,
  gl,
  onError,
}: {
  companyId: number;
  periodId?: number;
  tb: AccountingTrialBalance | null;
  statements: AccountingStatements | null;
  cashFlow: AccountingCashFlow | null;
  gl: AccountingGeneralLedger | null;
  onError: (msg: string | null) => void;
}) {
  const [saving, setSaving] = useState(false);

  const downloadPdfPack = async () => {
    try {
      const jsPDF = await loadJsPDF();
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      let y = 48;
      const line = (text: string, size = 10) => {
        if (y > 760) {
          doc.addPage();
          y = 48;
        }
        doc.setFontSize(size);
        doc.text(text, 40, y);
        y += size + 6;
      };
      line('Bisync Books — period pack', 14);
      line(`Company ${companyId} · period ${periodId ?? '—'}`);
      line(`Generated ${new Date().toISOString()}`);
      y += 8;
      line('Trial balance', 12);
      if (tb) {
        line(`Balanced: ${tb.balanced ? 'yes' : 'no'} · Dr ${money(tb.totalDr)} / Cr ${money(tb.totalCr)}`);
        tb.rows.slice(0, 40).forEach(r => {
          line(`${r.accountCode} ${r.accountName}  PDr ${money(r.periodDr)}  PCr ${money(r.periodCr)}`);
        });
      } else line('No TB loaded');
      y += 8;
      line('Profit & loss', 12);
      if (statements) {
        line(`Net income ${money(statements.profitAndLoss.netIncome)}`);
        statements.profitAndLoss.rows.slice(0, 30).forEach(r => line(`${r.code} ${r.name}  ${money(r.amount)}`));
      }
      y += 8;
      line('Cash flow (indirect)', 12);
      if (cashFlow) {
        line(`Operating ${money(cashFlow.operating.netCashFromOperating)}`);
        line(`Investing ${money(cashFlow.investing.netCashFromInvesting)}`);
        line(`Financing ${money(cashFlow.financing.netCashFromFinancing)}`);
        line(`Net change ${money(cashFlow.netChangeInCash)}`);
      }
      y += 8;
      line('GL enquiry (first lines)', 12);
      (gl?.rows ?? []).slice(0, 25).forEach(l => {
        line(`${l.effectiveDate} ${l.accountCode} ${l.direction} ${money(l.funcAmount ?? l.amount)} ${l.narration || ''}`);
      });
      doc.save(`books-pack-c${companyId}-p${periodId ?? 'x'}.pdf`);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'PDF pack failed');
    }
  };

  const saveRecipe = async () => {
    setSaving(true);
    try {
      await api.accountingSaveReport(companyId, {
        name: `Period pack ${periodId ?? ''}`,
        kind: 'trial_balance',
        filtersJson: JSON.stringify({ periodId }),
      });
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Save report failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void downloadPdfPack()}
          className="text-xs font-bold bg-primary text-primary-foreground px-3 py-1.5 rounded-md"
        >
          Download PDF pack
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void saveRecipe()}
          className="text-xs font-semibold border border-border px-3 py-1.5 rounded-md disabled:opacity-50"
        >
          Save report recipe
        </button>
      </div>
      <div className="border-t border-border pt-3 space-y-2">
        <p className="text-xs font-semibold">
          Trial balance
          {tb ? (
            <span className="font-normal text-muted-foreground">
              {' '}· {tb.currency ?? ''} · {tb.basis === 'closing-balance' ? 'closing balances' : 'period'} · {tb.balanced ? 'balanced' : 'out of balance'} · Dr {money(tb.totalDr)} / Cr {money(tb.totalCr)}
            </span>
          ) : null}
        </p>
        {tb && tb.rows.length > 0 ? (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="py-1 pr-2 font-sans">Code</th>
                <th className="py-1 pr-2">Account</th>
                <th className="py-1 pr-2 text-right font-sans">Opening Dr</th>
                <th className="py-1 pr-2 text-right font-sans">Opening Cr</th>
                <th className="py-1 pr-2 text-right font-sans">Period Dr</th>
                <th className="py-1 pr-2 text-right font-sans">Period Cr</th>
                <th className="py-1 pr-2 text-right font-sans">Closing Dr</th>
                <th className="py-1 text-right font-sans">Closing Cr</th>
              </tr>
            </thead>
            <tbody>
              {tb.rows.map(r => (
                <tr key={r.accountCode} className="border-b border-border/60">
                  <td className="py-1 pr-2 font-sans">{r.accountCode}</td>
                  <td className="py-1 pr-2">{r.accountName}</td>
                  <td className="py-1 pr-2 text-right font-sans">{money(r.openingDr ?? 0)}</td>
                  <td className="py-1 pr-2 text-right font-sans">{money(r.openingCr ?? 0)}</td>
                  <td className="py-1 pr-2 text-right font-sans">{money(r.periodDr)}</td>
                  <td className="py-1 pr-2 text-right font-sans">{money(r.periodCr)}</td>
                  <td className="py-1 pr-2 text-right font-sans">{money(r.closingDr ?? (r.closing > 0 ? r.closing : 0))}</td>
                  <td className="py-1 text-right font-sans">{money(r.closingCr ?? (r.closing < 0 ? -r.closing : 0))}</td>
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

      {cashFlow && (
        <div className="border-t border-border pt-3 space-y-2">
          <p className="text-xs font-semibold">
            Cash flow (indirect)
            <span className="font-normal text-muted-foreground">
              {' '}· {cashFlow.currency} · net change {money(cashFlow.netChangeInCash)}
            </span>
          </p>
          <ul className="text-xs space-y-1">
            <li className="flex justify-between gap-4 border-b border-border/40 py-1">
              <span>Net income</span>
              <span className="font-sans">{money(cashFlow.operating.netIncome)}</span>
            </li>
            <li className="flex justify-between gap-4 border-b border-border/40 py-1">
              <span>+ Depreciation</span>
              <span className="font-sans">{money(cashFlow.operating.depreciationAddBack)}</span>
            </li>
            <li className="flex justify-between gap-4 border-b border-border/40 py-1">
              <span>Δ Receivables / inventory / payables / tax</span>
              <span className="font-sans">
                {money(
                  cashFlow.operating.changeInReceivables
                  + cashFlow.operating.changeInInventory
                  + cashFlow.operating.changeInPayables
                  + cashFlow.operating.changeInTaxPayable,
                )}
              </span>
            </li>
            <li className="flex justify-between gap-4 border-b border-border/40 py-1 font-medium">
              <span>Operating</span>
              <span className="font-sans">{money(cashFlow.operating.netCashFromOperating)}</span>
            </li>
            <li className="flex justify-between gap-4 border-b border-border/40 py-1">
              <span>Investing</span>
              <span className="font-sans">{money(cashFlow.investing.netCashFromInvesting)}</span>
            </li>
            <li className="flex justify-between gap-4 border-b border-border/40 py-1">
              <span>Financing</span>
              <span className="font-sans">{money(cashFlow.financing.netCashFromFinancing)}</span>
            </li>
          </ul>
          <p className="text-[11px] text-muted-foreground">{cashFlow.note}</p>
        </div>
      )}

      {gl && (
        <div className="border-t border-border pt-3 space-y-2">
          <p className="text-xs font-semibold">
            General ledger
            <span className="font-normal text-muted-foreground">
              {' '}· {gl.from} → {gl.to} · {gl.count} line{gl.count === 1 ? '' : 's'}
            </span>
          </p>
          {gl.rows.length > 0 ? (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-1 pr-2">Date</th>
                  <th className="py-1 pr-2 font-sans">Doc</th>
                  <th className="py-1 pr-2 font-sans">Acct</th>
                  <th className="py-1 pr-2">Narration</th>
                  <th className="py-1 pr-2 text-right font-sans">Dr/Cr</th>
                  <th className="py-1 text-right font-sans">Running</th>
                </tr>
              </thead>
              <tbody>
                {gl.rows.map(r => (
                  <tr key={r.id} className="border-b border-border/60">
                    <td className="py-1 pr-2 font-sans">{r.effectiveDate}</td>
                    <td className="py-1 pr-2 font-sans">{r.docNumber ?? r.journalId}</td>
                    <td className="py-1 pr-2 font-sans">{r.accountCode}</td>
                    <td className="py-1 pr-2 truncate max-w-[14rem]">{r.narration || r.accountName}</td>
                    <td className="py-1 pr-2 text-right font-sans">
                      {r.direction} {money(r.funcAmount)}
                    </td>
                    <td className="py-1 text-right font-sans">{money(r.runningBalance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-xs text-muted-foreground">No posted lines in this period.</p>
          )}
        </div>
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
