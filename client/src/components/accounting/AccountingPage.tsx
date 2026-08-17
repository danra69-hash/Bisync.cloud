import { useCallback, useEffect, useState } from 'react';
import { Calculator, RefreshCw } from 'lucide-react';
import { api, type AccountingJournalSummary, type AccountingLedgerStatus, type AccountingOutboxRow, type AccountingTrialBalance } from '../../api';
import { probeHrApi } from '../../modules/hr/api';
import { PayrollSection } from '../payroll/PayrollSection';
import { MillstoneLoader } from '../shared/MillstoneLoader';
import { HrConfigTabBar } from '../admin/HrConfigTabBar';
import { pageShellClass } from '../layout/pageLayout';

export const ACCOUNTING_TABS = [
  { id: 'payroll', label: 'Payroll' },
  { id: 'bridges', label: 'Ops → Finance' },
  { id: 'books', label: 'Books' },
] as const;

export type AccountingTabId = (typeof ACCOUNTING_TABS)[number]['id'];

function AccountingOfflinePanel({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="p-6">
      <div className="bg-card border border-border rounded-lg flex flex-col items-center text-center gap-4 p-10 max-w-lg mx-auto">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
          <Calculator size={22} className="text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold">Accounting API is not reachable</p>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            Payroll uses employee data from the Bisync API. Start the API, then retry.
          </p>
        </div>
        <div className="w-full text-left bg-muted/40 border border-border rounded-md px-4 py-3 space-y-2">
          <p className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Local setup</p>
          <code className="block text-[11px] font-sans text-foreground">dotnet run --project src/Bisync.Api</code>
          <p className="text-xs text-muted-foreground">API at http://localhost:5299</p>
        </div>
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 text-xs font-bold bg-primary text-primary-foreground px-4 py-2 rounded-md"
        >
          <RefreshCw size={12} /> Retry connection
        </button>
      </div>
    </div>
  );
}

function OpsFinanceBridgesPanel() {
  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h2 className="text-sm font-semibold">Operational sources for finance</h2>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          Live cost truth sits in RMS and payroll. When you process payroll or consolidate a purchase,
          Bisync enqueues Books events and posts sealed journals (Phase 0 foundations).
        </p>
      </div>

      <ul className="space-y-4 text-xs leading-relaxed">
        <li className="border-t border-border pt-3">
          <p className="font-semibold text-foreground">Payroll process → <span className="font-sans">hrm.payroll_posted</span></p>
          <p className="text-muted-foreground mt-1">
            Posts salaries / employer statutory / payables. Idempotent per company-year-month.
          </p>
          <p className="text-muted-foreground mt-1 font-sans">Path: Accounting → Payroll → Process</p>
        </li>
        <li className="border-t border-border pt-3">
          <p className="font-semibold text-foreground">Purchase consolidate → <span className="font-sans">ops.purchase_affirmed</span></p>
          <p className="text-muted-foreground mt-1">
            Affirms inventory cost: Dr Inventory / Cr AP from consolidated lines (excludes returnable deposits).
          </p>
          <p className="text-muted-foreground mt-1 font-sans">Path: Revenue Management → Orders → Receive / Consolidate</p>
        </li>
        <li className="border-t border-border pt-3">
          <p className="font-semibold text-foreground">Stock card, FIFO, COGS Audit</p>
          <p className="text-muted-foreground mt-1">
            Inventory subledger and period exports. Still the ops detail behind summarised GL posts.
          </p>
          <p className="text-muted-foreground mt-1 font-sans">Path: Revenue Management → Inventory / Reports</p>
        </li>
      </ul>
    </div>
  );
}

function BooksPanel({ companyId }: { companyId: number | null }) {
  const [status, setStatus] = useState<AccountingLedgerStatus | null>(null);
  const [journals, setJournals] = useState<AccountingJournalSummary[]>([]);
  const [tb, setTb] = useState<AccountingTrialBalance | null>(null);
  const [outbox, setOutbox] = useState<AccountingOutboxRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) {
      setStatus(null);
      setJournals([]);
      setTb(null);
      setOutbox([]);
      setError('Select a company in the header to open Books.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [st, j, trial, ob] = await Promise.all([
        api.accountingStatus(companyId),
        api.accountingJournals(companyId),
        api.accountingTrialBalance(companyId),
        api.accountingOutbox(companyId),
      ]);
      setStatus(st);
      setJournals(j);
      setTb(trial);
      setOutbox(ob);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load Books');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!companyId) {
    return (
      <p className="text-xs text-muted-foreground">Select a company in the header to open Books.</p>
    );
  }

  if (loading && !status) {
    return <MillstoneLoader layout="block" size="md" label="Loading Books…" />;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Books (Phase 0)</h2>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Sealed journals on the company operational DB. Wired from payroll and purchase consolidate.
            Architecture: <span className="font-sans">docs/ACCOUNTING_ARCHITECTURE.md</span>
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

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {status && (
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs border-t border-border pt-3">
          <div>
            <dt className="text-muted-foreground">Currency</dt>
            <dd className="font-semibold font-sans mt-0.5">{status.currency}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Accounts</dt>
            <dd className="font-semibold font-sans mt-0.5">{status.accounts}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Posted journals</dt>
            <dd className="font-semibold font-sans mt-0.5">{status.postedJournals}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Outbox (pending)</dt>
            <dd className="font-semibold font-sans mt-0.5">{status.pendingOutbox}</dd>
          </div>
        </dl>
      )}

      {status?.bridges && (
        <div className="text-xs space-y-1 border-t border-border pt-3">
          <p className="font-semibold">Module bridges</p>
          {status.bridges.map(b => (
            <p key={b.eventType} className="text-muted-foreground font-sans">
              {b.module}: {b.eventType} ({b.status})
            </p>
          ))}
        </div>
      )}

      <div className="border-t border-border pt-3 space-y-2">
        <p className="text-xs font-semibold">
          Trial balance
          {tb ? (
            <span className="font-normal text-muted-foreground">
              {' '}· {tb.period.year}-{String(tb.period.periodNo).padStart(2, '0')} ·{' '}
              {tb.balanced ? 'balanced' : 'out of balance'}
            </span>
          ) : null}
        </p>
        {tb && tb.rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-1 pr-2 font-sans font-semibold">Code</th>
                  <th className="py-1 pr-2 font-sans font-semibold">Account</th>
                  <th className="py-1 pr-2 font-sans font-semibold text-right">Dr</th>
                  <th className="py-1 font-sans font-semibold text-right">Cr</th>
                </tr>
              </thead>
              <tbody>
                {tb.rows.map(r => (
                  <tr key={r.accountCode} className="border-b border-border/60">
                    <td className="py-1 pr-2 font-sans">{r.accountCode}</td>
                    <td className="py-1 pr-2">{r.accountName}</td>
                    <td className="py-1 pr-2 font-sans text-right">{r.periodDr.toFixed(2)}</td>
                    <td className="py-1 font-sans text-right">{r.periodCr.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No period movement yet. Process payroll or consolidate a purchase to post the first journals.
          </p>
        )}
      </div>

      <div className="border-t border-border pt-3 space-y-2">
        <p className="text-xs font-semibold">Recent journals</p>
        {journals.length === 0 ? (
          <p className="text-xs text-muted-foreground">No posted journals for this company.</p>
        ) : (
          <ul className="text-xs space-y-2">
            {journals.map(j => (
              <li key={j.id} className="border-b border-border/60 pb-2">
                <p className="font-sans font-semibold">
                  {j.docNumber ?? `#${j.id}`} · {j.journalType}
                </p>
                <p className="text-muted-foreground mt-0.5">
                  {j.narration} · {j.sourceModule}
                  {j.sourceDocKey ? ` · ${j.sourceDocKey}` : ''} · {j.lineCount} lines
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-border pt-3 space-y-2">
        <p className="text-xs font-semibold">Bridge outbox</p>
        {outbox.length === 0 ? (
          <p className="text-xs text-muted-foreground">No outbox events yet.</p>
        ) : (
          <ul className="text-xs space-y-1.5 font-sans text-muted-foreground">
            {outbox.slice(0, 12).map(m => (
              <li key={m.id}>
                {m.eventType} · {new Date(m.createdAt).toLocaleString()}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function AccountingPage({ selectedCompanyId = null }: { selectedCompanyId?: number | null }) {
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [tab, setTab] = useState<AccountingTabId>('payroll');

  const check = useCallback(async () => {
    setStatus('checking');
    setStatus((await probeHrApi()) ? 'online' : 'offline');
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  if (status === 'checking') {
    return <MillstoneLoader layout="block" size="lg" label="Loading Accounting…" className="flex-1" />;
  }

  if (status === 'offline') {
    return <AccountingOfflinePanel onRetry={check} />;
  }

  return (
    <div className={pageShellClass({ spacing: 'wide' })}>
      <div>
        <h1 className="text-lg font-semibold">Accounting</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Company-level payroll, ops→finance bridges, and Books (Phase 0 ledger).
        </p>
      </div>

      <HrConfigTabBar tabs={ACCOUNTING_TABS} active={tab} onChange={setTab} />

      {tab === 'payroll' && (
        <PayrollSection embedded selectedCompanyId={selectedCompanyId} />
      )}
      {tab === 'bridges' && <OpsFinanceBridgesPanel />}
      {tab === 'books' && <BooksPanel companyId={selectedCompanyId} />}
    </div>
  );
}
