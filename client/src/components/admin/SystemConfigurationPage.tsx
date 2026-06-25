import { useState } from 'react';
import { CompaniesTab } from './CompaniesTab';
import { LocationsConfigTab } from './LocationsConfigTab';
import { UsersTab } from './UsersTab';

const TABS = [
  { id: 'companies' as const, label: 'Companies' },
  { id: 'locations' as const, label: 'Locations' },
  { id: 'users' as const, label: 'Users' },
];

type TabId = (typeof TABS)[number]['id'];

type Props = {
  onOrgDataChanged?: () => void;
};

export function SystemConfigurationPage({ onOrgDataChanged }: Props) {
  const [tab, setTab] = useState<TabId>('companies');

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1">System Configuration</p>
        <h2 className="text-lg font-semibold">Admin Settings</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Manage companies, locations, and users. Locations inherit country settings from their parent company.
        </p>
      </div>

      <div className="flex gap-0 border-b border-border">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
              tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'companies' && <CompaniesTab onOrgDataChanged={onOrgDataChanged} />}
      {tab === 'locations' && <LocationsConfigTab onOrgDataChanged={onOrgDataChanged} />}
      {tab === 'users' && <UsersTab />}
    </div>
  );
}
