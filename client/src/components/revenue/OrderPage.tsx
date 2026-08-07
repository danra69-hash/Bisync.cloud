import { useEffect, useMemo, useState } from 'react';
import { pageShellClass } from '../layout/pageLayout';
import { HrConfigTabBar } from '../admin/HrConfigTabBar';
import { ActivePurchasePage } from './ActivePurchasePage';
import { ActiveRequisitionPage } from './ActiveRequisitionPage';
import { B2bActiveOrderPage } from './B2bActiveOrderPage';
import { CreateOrderPage } from './CreateOrderPage';
import { PreCommittedPoPage } from './PreCommittedPoPage';
import { useRevMgmtPageLabel } from './RevMgmtTitleContext';
import { useOrgSupplyCapability } from '../../hooks/useOrgSupplyCapability';
import type { CreateOrderPrefillItem } from '../../data/createOrderPrefill';

const ORDER_TABS = [
  { id: 'active', label: 'Active Purchase' },
  { id: 'requisition', label: 'Active Requisition' },
  { id: 'create', label: 'My Order' },
  { id: 'pre-committed', label: 'Pre-committed PO' },
  { id: 'active-sales', label: 'Active Sales' },
] as const;

export type OrderTabId = (typeof ORDER_TABS)[number]['id'];

type Props = {
  initialTab?: OrderTabId;
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
  initialPrefillItems?: CreateOrderPrefillItem[];
};

export function OrderPage({
  initialTab = 'active',
  selectedCompanyId,
  selectedLocationIds,
  initialPrefillItems,
}: Props) {
  const hasSupplyCapability = useOrgSupplyCapability(selectedCompanyId, selectedLocationIds);
  const visibleTabs = useMemo(
    () => (hasSupplyCapability
      ? ORDER_TABS
      : ORDER_TABS.filter(tab => tab.id !== 'active-sales')),
    [hasSupplyCapability],
  );

  const resolvedInitial = useMemo((): OrderTabId => {
    if (initialPrefillItems && initialPrefillItems.length > 0) return 'create';
    if (initialTab === 'active-sales' && !hasSupplyCapability) return 'active';
    return initialTab;
  }, [initialTab, hasSupplyCapability, initialPrefillItems]);

  const [tab, setTab] = useState<OrderTabId>(resolvedInitial);

  useEffect(() => {
    setTab(resolvedInitial);
  }, [resolvedInitial]);

  useEffect(() => {
    if (tab === 'active-sales' && !hasSupplyCapability) {
      setTab('active');
    }
  }, [tab, hasSupplyCapability]);

  const activeTabLabel = visibleTabs.find(t => t.id === tab)?.label ?? 'Active Purchase';
  useRevMgmtPageLabel(activeTabLabel);

  return (
    <div className={pageShellClass()}>
      <div data-page-filters className="bg-background/95 backdrop-blur-sm border-b border-border/60">
        <HrConfigTabBar tabs={visibleTabs} active={tab} onChange={setTab} />
      </div>

      {tab === 'create' ? (
        <CreateOrderPage
          embedded
          selectedCompanyId={selectedCompanyId}
          selectedLocationIds={selectedLocationIds}
          initialPrefillItems={initialPrefillItems}
          onOpenPreCommitted={() => setTab('pre-committed')}
          onOpenActiveRequisition={() => setTab('requisition')}
        />
      ) : tab === 'pre-committed' ? (
        <PreCommittedPoPage
          embedded
          selectedCompanyId={selectedCompanyId}
          selectedLocationIds={selectedLocationIds}
        />
      ) : tab === 'requisition' ? (
        <ActiveRequisitionPage
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
