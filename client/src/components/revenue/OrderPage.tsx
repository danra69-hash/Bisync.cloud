import { useEffect, useState } from 'react';
import { pageShellClass } from '../layout/pageLayout';
import { HrConfigTabBar } from '../admin/HrConfigTabBar';
import { ActivePurchasePage } from './ActivePurchasePage';
import { B2bActiveOrderPage } from './B2bActiveOrderPage';
import { CreateOrderPage } from './CreateOrderPage';
import { useRevMgmtPageLabel } from './RevMgmtTitleContext';

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
  const [tab, setTab] = useState<OrderTabId>(initialTab);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const activeTabLabel = ORDER_TABS.find(t => t.id === tab)?.label ?? 'My Order';
  useRevMgmtPageLabel(activeTabLabel);

  return (
    <div className={pageShellClass()}>
      <HrConfigTabBar tabs={ORDER_TABS} active={tab} onChange={setTab} />

      {tab === 'create' ? (
        <CreateOrderPage
          embedded
          selectedCompanyId={selectedCompanyId}
          selectedLocationIds={selectedLocationIds}
        />
      ) : tab === 'active-sales' ? (
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
