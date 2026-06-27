import { DivisionsDepartmentsTab } from './DivisionsDepartmentsTab';
import { LevelEntitlementTab } from './LevelEntitlementTab';
import { PayStructureTab } from './PayStructureTab';
import { PhSettingTab } from './PhSettingTab';
import type { HrConfigTabId } from './hrConfigTabs';

type Props = {
  tab: HrConfigTabId;
  onDataChanged?: () => void;
  selectedCompanyId?: number | null;
};

export function HrConfigTabPanels({ tab, onDataChanged, selectedCompanyId = null }: Props) {
  switch (tab) {
    case 'ph':
      return <PhSettingTab selectedCompanyId={selectedCompanyId} />;
    case 'levels':
      return <LevelEntitlementTab onDataChanged={onDataChanged} />;
    case 'pay':
      return <PayStructureTab />;
    case 'org':
      return <DivisionsDepartmentsTab onDataChanged={onDataChanged} />;
  }
}
