import { useCallback, useEffect, useState } from 'react';
import { api, type Company } from '../../api';
import { HrConfigTabBar } from '../admin/HrConfigTabBar';
import { IncomeTaxPanel } from './IncomeTaxPanel';
import { PayrollEmployeeDirectoryPanel } from './PayrollEmployeeDirectoryPanel';
import { ProcessPayrollPanel } from './ProcessPayrollPanel';
import { PayrollPinGate } from './PayrollPinGate';
import { PAYROLL_TABS, type PayrollTabId } from './payrollTabs';

type Props = {
  defaultTab?: PayrollTabId;
  /** When true, omits page chrome for embedding inside HR or future Accounting shell */
  embedded?: boolean;
  /** Company from the app header — payroll filters use this instead of a local dropdown */
  selectedCompanyId?: number | null;
};

export function PayrollSection({ defaultTab = 'directory', embedded = false, selectedCompanyId = null }: Props) {
  const [activeTab, setActiveTab] = useState<PayrollTabId>(defaultTab);
  const [companies, setCompanies] = useState<Company[]>([]);

  const loadCompanies = useCallback(async () => {
    const companyList = await api.companies().catch(() => [] as Company[]);
    const active = companyList.filter(c => c.active);
    setCompanies(active.length > 0 ? active : companyList);
  }, []);

  useEffect(() => {
    void loadCompanies();
  }, [loadCompanies]);

  const selectedCompany = companies.find(c => c.id === selectedCompanyId);

  return (
    <PayrollPinGate embedded={embedded}>
      <div className={embedded ? 'space-y-6' : 'p-6 space-y-6'}>
        {!embedded && (
          <div>
            <h1 className="text-lg font-semibold">Payroll</h1>
            <p className="text-xs text-muted-foreground mt-1">Employee payroll directory and processing</p>
          </div>
        )}

        <HrConfigTabBar tabs={PAYROLL_TABS} active={activeTab} onChange={setActiveTab} />

        {activeTab === 'directory' && (
          <PayrollEmployeeDirectoryPanel
            selectedCompanyId={selectedCompanyId}
            companyCountryCode={selectedCompany?.countryCode}
          />
        )}

        {activeTab === 'process' && (
          <ProcessPayrollPanel
            selectedCompanyId={selectedCompanyId}
            countryCode={selectedCompany?.countryCode}
          />
        )}

        {activeTab === 'income-tax' && (
          <IncomeTaxPanel
            selectedCompanyId={selectedCompanyId}
            countryCode={selectedCompany?.countryCode}
          />
        )}
      </div>
    </PayrollPinGate>
  );
}
