import { useEffect, useMemo, useState } from 'react';
import { pageShellClass } from '../layout/pageLayout';
import { HrConfigTabBar } from '../admin/HrConfigTabBar';
import { ActivePurchasePage } from './ActivePurchasePage';
import { B2bActiveOrderPage } from './B2bActiveOrderPage';
import { CreateOrderPage } from './CreateOrderPage';
import { useRevMgmtPageLabel } from './RevMgmtTitleContext';
import { useOrgSupplyCapability } from '../../hooks/useOrgSupplyCapability';

const ORDER_TABS = [
  { id: 'create', label: 'My Order' },
  { id: 'active', label: 'Active Purchase' },
  { id: 'active-sales', label: 'Active Sales' },
] as const;

export type OrderTabId = (typeof ORDER_TABS)[number]['id'];

type Props = {
  initialTab?: OrderTabId;
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
};

export function OrderPage({ initialTab = 'create', selectedCompanyId, selectedLocationIds }: Props) {
  const hasSupplyCapability = useOrgSupplyCapability(selectedCompanyId, selectedLocationIds);
  const visibleTabs = useMemo(
    () => (hasSupplyCapability
      ? ORDER_TABS
      : ORDER_TABS.filter(tab => tab.id !== 'active-sales')),
    [hasSupplyCapability],
  );

  const resolvedInitial = useMemo((): OrderTabId => {
    if (initialTab === 'active-sales' && !hasSupplyCapability) return 'create';
    return initialTab;
  }, [initialTab, hasSupplyCapability]);

  const [tab, setTab] = useState<OrderTabId>(resolvedInitial);

  useEffect(() => {
    setTab(resolvedInitial);
  }, [resolvedInitial]);

  useEffect(() => {
    if (tab === 'active-sales' && !hasSupplyCapability) {
      setTab('create');
    }
  }, [tab, hasSupplyCapability]);

  const activeTabLabel = visibleTabs.find(t => t.id === tab)?.label ?? 'My Order';
  useRevMgmtPageLabel(activeTabLabel);

  return (
    <div className={pageShellClass()}>
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
        <HrConfigTabBar tabs={visibleTabs} active={tab} onChange={setTab} />
      </div>

      {tab === 'create' ? (
        <CreateOrderPage
          embedded
          selectedCompanyId={selectedCompanyId}
          selectedLocationIds={selectedLocationIds}
        />
      ) : tab === 'active-sales' && hasSupplyCapability ? (
        <B2bActiveOrderPage
          embedded
          selectedCompanyId={selectedCompanyId}
          selectedLocationIds={selectedLocationIds}
        />
      ) : (
        <ActivePurchasePage
          embedded
          selectedCompanyId={selectedCompanyId}
          selectedLocationIds={selectedLocationIds}
        />
      )}
    </div>
  );
}
