import type { ReactNode } from 'react';
import { HrConfigTabBar } from './HrConfigTabBar';
import { HrConfigTabPanels } from './HrConfigTabPanels';
import { HR_EMPLOYEE_CONFIG_TABS, type HrEmployeeConfigTabId } from './hrConfigTabs';

type Props = {
  tab: HrEmployeeConfigTabId;
  onTabChange: (tab: HrEmployeeConfigTabId) => void;
  onDataChanged?: () => void;
  header?: ReactNode;
};

export function HrEmployeeConfigSection({
  tab,
  onTabChange,
  onDataChanged,
  header,
}: Props) {
  return (
    <div className="space-y-6">
      {header}
      <HrConfigTabBar tabs={HR_EMPLOYEE_CONFIG_TABS} active={tab} onChange={onTabChange} />
      <HrConfigTabPanels tab={tab} onDataChanged={onDataChanged} />
    </div>
  );
}
