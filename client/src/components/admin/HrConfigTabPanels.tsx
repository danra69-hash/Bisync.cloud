import { DivisionsDepartmentsTab } from './DivisionsDepartmentsTab';
import { EmployeeTab } from './EmployeeTab';
import { LevelEntitlementTab } from './LevelEntitlementTab';
import { PayStructureTab } from './PayStructureTab';
import { PhSettingTab } from './PhSettingTab';
import type { HrEmployeeConfigTabId } from './hrConfigTabs';

type Props = {
  tab: HrEmployeeConfigTabId;
  onDataChanged?: () => void;
};

export function HrConfigTabPanels({ tab, onDataChanged }: Props) {
  switch (tab) {
    case 'employee':
      return <EmployeeTab onDataChanged={onDataChanged} />;
    case 'ph':
      return <PhSettingTab />;
    case 'levels':
      return <LevelEntitlementTab onDataChanged={onDataChanged} />;
    case 'pay':
      return <PayStructureTab />;
    case 'org':
      return <DivisionsDepartmentsTab onDataChanged={onDataChanged} />;
  }
}
