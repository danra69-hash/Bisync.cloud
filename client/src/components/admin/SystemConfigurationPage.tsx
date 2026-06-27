import { useState } from 'react';
import { CompaniesTab } from './CompaniesTab';
import { HrConfigTabBar } from './HrConfigTabBar';
import { LocationsConfigTab } from './LocationsConfigTab';
import { SYSTEM_HR_CONFIG_TABS, type SystemHrConfigTabId } from './hrConfigTabs';

type Props = {
  onOrgDataChanged?: () => void;
};

export function SystemConfigurationPage({ onOrgDataChanged }: Props) {
  const [tab, setTab] = useState<SystemHrConfigTabId>('companies');

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1">System Configuration</p>
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
