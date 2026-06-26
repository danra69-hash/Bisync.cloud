import { useCallback, useEffect, useState } from 'react';
import { api, type Company } from '../../api';
import { HrConfigTabBar } from '../admin/HrConfigTabBar';
import { PayrollEmployeeDirectoryPanel } from './PayrollEmployeeDirectoryPanel';
import { ProcessPayrollPanel } from './ProcessPayrollPanel';
import { PayrollPinGate } from './PayrollPinGate';
import { PAYROLL_TABS, type PayrollTabId } from './payrollTabs';

type Props = {
  defaultTab?: PayrollTabId;
  /** When true, omits page chrome for embedding inside HR or future Accounting shell */
  embedded?: boolean;
};

export function PayrollSection({ defaultTab = 'directory', embedded = false }: Props) {
  const [activeTab, setActiveTab] = useState<PayrollTabId>(defaultTab);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);

  const loadCompanies = useCallback(async () => {
    const companyList = await api.companies().catch(() => [] as Company[]);
    const active = companyList.filter(c => c.active);
    setCompanies(active.length > 0 ? active : companyList);
  }, []);

  useEffect(() => {
    void loadCompanies();
  }, [loadCompanies]);

  useEffect(() => {
    if (companies.length === 0) {
      setSelectedCompanyId(null);
      return;
    }
    setSelectedCompanyId(prev => (prev && companies.some(c => c.id === prev) ? prev : companies[0].id));
  }, [companies]);

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
            companies={companies}
            selectedCompanyId={selectedCompanyId}
            onCompanyChange={setSelectedCompanyId}
            companyCountryCode={selectedCompany?.countryCode}
          />
        )}

        {activeTab === 'process' && (
          <ProcessPayrollPanel
            companies={companies}
            selectedCompanyId={selectedCompanyId}
            onCompanyChange={setSelectedCompanyId}
            countryCode={selectedCompany?.countryCode}
          />
        )}
      </div>
    </PayrollPinGate>
  );
}