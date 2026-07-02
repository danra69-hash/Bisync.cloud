import { useState } from 'react';
import { CompaniesTab } from './CompaniesTab';
import { HrConfigTabBar } from './HrConfigTabBar';
import { LocationsConfigTab } from './LocationsConfigTab';
import { SYSTEM_HR_CONFIG_TABS, type SystemHrConfigTabId } from './hrConfigTabs';
import { PAGE_SHELL_CLS } from '../layout/pageLayout';

type Props = {
  onOrgDataChanged?: () => void;
};

export function SystemConfigurationPage({ onOrgDataChanged }: Props) {
  const [tab, setTab] = useState<SystemHrConfigTabId>('companies');

  return (
    <div className={`${PAGE_SHELL_CLS} space-y-3`}>
      <div>
        <p className="text-xs font-sans text-muted-foreground uppercase tracking-widest mb-1">System Configuration</p>
        <h2 className="text-lg font-semibold">Platform Config</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Manage companies and locations. Employee, pay, org, and holiday settings live under Human Resources.
        </p>
      </div>

      <HrConfigTabBar tabs={SYSTEM_HR_CONFIG_TABS} active={tab} onChange={setTab} />

      {tab === 'companies' && <CompaniesTab onOrgDataChanged={onOrgDataChanged} />}
      {tab === 'locations' && <LocationsConfigTab onOrgDataChanged={onOrgDataChanged} />}
    </div>
  );
}
