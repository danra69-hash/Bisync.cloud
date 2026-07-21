import { useMemo, useState } from 'react';
import { CompaniesTab } from './CompaniesTab';
import { AccessControlTab } from './AccessControlTab';
import { SystemAuditTrailTab } from './SystemAuditTrailTab';
import { HrConfigTabBar } from './HrConfigTabBar';
import { LocationsConfigTab } from './LocationsConfigTab';
import { SYSTEM_HR_CONFIG_TABS, type SystemHrConfigTabId } from './hrConfigTabs';
import { PAGE_SHELL_CLS } from '../layout/pageLayout';
import { useAppTranslation } from '../../i18n/useAppTranslation';

type Props = {
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
  onOrgDataChanged?: () => void;
};

export function SystemConfigurationPage({
  selectedCompanyId,
  selectedLocationIds: _selectedLocationIds,
  onOrgDataChanged,
}: Props) {
  const [tab, setTab] = useState<SystemHrConfigTabId>('companies');
  const { t, hrConfigTab } = useAppTranslation();
  const tabs = useMemo(
    () => SYSTEM_HR_CONFIG_TABS.map(item => ({ ...item, label: hrConfigTab(item.label) })),
    [hrConfigTab],
  );

  return (
    <div className={`${PAGE_SHELL_CLS} space-y-3`}>
      <div data-page-filters className="bg-background/95 backdrop-blur-sm space-y-3 pb-2 border-b border-border/60 -mx-0">
        <div>
          <p className="text-xs font-sans text-muted-foreground uppercase tracking-widest mb-1">{t('systemConfig.title')}</p>
          <h2 className="text-lg font-semibold">{t('systemConfig.platformConfig')}</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {t('systemConfig.description')}
          </p>
        </div>

        <HrConfigTabBar tabs={tabs} active={tab} onChange={setTab} />
      </div>

      {tab === 'companies' && <CompaniesTab onOrgDataChanged={onOrgDataChanged} />}
      {tab === 'locations' && (
        <LocationsConfigTab selectedCompanyId={selectedCompanyId} onOrgDataChanged={onOrgDataChanged} />
      )}
      {tab === 'accessControl' && <AccessControlTab />}
      {tab === 'auditTrail' && <SystemAuditTrailTab />}
    </div>
  );
}
