import { HrConfigTabBar } from './HrConfigTabBar';
import { HrConfigTabPanels } from './HrConfigTabPanels';
import { HR_CONFIG_TABS, type HrConfigTabId } from './hrConfigTabs';

type Props = {
  tab: HrConfigTabId;
  onTabChange: (tab: HrConfigTabId) => void;
  onDataChanged?: () => void;
  selectedCompanyId?: number | null;
};

export function HrEmployeeConfigSection({
  tab,
  onTabChange,
  onDataChanged,
  selectedCompanyId = null,
}: Props) {
  return (
    <div className="space-y-6">
      <HrConfigTabBar tabs={HR_CONFIG_TABS} active={tab} onChange={onTabChange} />
      <HrConfigTabPanels tab={tab} onDataChanged={onDataChanged} selectedCompanyId={selectedCompanyId} />
    </div>
  );
}
