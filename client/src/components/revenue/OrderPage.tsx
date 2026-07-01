import { useEffect, useState } from 'react';
import { HrConfigTabBar } from '../admin/HrConfigTabBar';
import { ActivePurchasePage } from './ActivePurchasePage';
import { CreateOrderPage } from './CreateOrderPage';

const ORDER_TABS = [
  { id: 'create', label: 'Create Order' },
  { id: 'active', label: 'Active Purchase' },
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

  return (
    <div className="p-6 space-y-4">
      <div>
        <p className="text-xs font-sans text-muted-foreground uppercase tracking-widest mb-1">Operation · Order</p>
        <h2 className="text-lg font-semibold">Order</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Create purchase requests and manage approval, receiving, and reconciliation.
        </p>
      </div>

      <HrConfigTabBar tabs={ORDER_TABS} active={tab} onChange={setTab} />

      {tab === 'create' ? (
        <CreateOrderPage
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
