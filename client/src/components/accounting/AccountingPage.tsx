import { useCallback, useEffect, useState } from 'react';
import { Calculator, RefreshCw } from 'lucide-react';
import { probeHrApi } from '../../modules/hr/api';
import { PayrollSection } from '../payroll/PayrollSection';
import { MillstoneLoader } from '../shared/MillstoneLoader';
import { HrConfigTabBar } from '../admin/HrConfigTabBar';
import { pageShellClass } from '../layout/pageLayout';
import { AccountingWorkspace } from './AccountingWorkspace';

export const ACCOUNTING_TABS = [
  { id: 'books', label: 'Books' },
  { id: 'payroll', label: 'Payroll' },
  { id: 'bridges', label: 'Ops → Finance' },
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
            Books and payroll use the Bisync API. Start the API, then retry.
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
          These ops flows auto-post into Books when you complete them. Use Books → Journals to review
          the sealed entries.
        </p>
      </div>
      <ul className="space-y-4 text-xs leading-relaxed">
        <li className="border-t border-border pt-3">
          <p className="font-semibold text-foreground">Payroll process → PAYROLL journal</p>
          <p className="text-muted-foreground mt-1">
            Salaries, employer statutory, and payables. Accounting → Payroll → Process.
          </p>
        </li>
        <li className="border-t border-border pt-3">
          <p className="font-semibold text-foreground">Purchase consolidate → PURCH journal</p>
          <p className="text-muted-foreground mt-1">
            Dr Inventory / Cr AP from affirmed lines. Revenue Management → Orders → Consolidate.
          </p>
        </li>
        <li className="border-t border-border pt-3">
          <p className="font-semibold text-foreground">Stock card / FIFO / COGS Audit</p>
          <p className="text-muted-foreground mt-1">
            Quantity and cost layers behind summarised GL posts — still the ops detail for finance handoff.
          </p>
        </li>
      </ul>
    </div>
  );
}

export function AccountingPage({ selectedCompanyId = null }: { selectedCompanyId?: number | null }) {
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [tab, setTab] = useState<AccountingTabId>('books');

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
          Company books — chart of accounts, journals, reports, periods — plus payroll and ops bridges.
        </p>
      </div>

      <HrConfigTabBar tabs={ACCOUNTING_TABS} active={tab} onChange={setTab} />

      {tab === 'books' && <AccountingWorkspace companyId={selectedCompanyId} />}
      {tab === 'payroll' && <PayrollSection embedded selectedCompanyId={selectedCompanyId} />}
      {tab === 'bridges' && <OpsFinanceBridgesPanel />}
    </div>
  );
}
