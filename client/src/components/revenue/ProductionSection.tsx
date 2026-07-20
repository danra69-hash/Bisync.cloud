import { useEffect, useMemo, useState } from 'react';
import { pageShellClass } from '../layout/pageLayout';
import { ProductManagementPage } from './ProductManagementPage';
import { SalesDataPage } from './SalesDataPage';
import { B2bActiveOrderPage } from './B2bActiveOrderPage';
import { useRevMgmtPageLabel } from './RevMgmtTitleContext';
import { useOrgSupplyCapability } from '../../hooks/useOrgSupplyCapability';

export type ProductionTab = 'b2bProduct' | 'activeOrder' | 'salesData' | 'subProduct';

type Props = {
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
  initialTab?: ProductionTab;
};

const ALL_TAB_ITEMS: { id: ProductionTab; label: string; supplyOnly?: boolean }[] = [
  { id: 'b2bProduct', label: 'B2B Product', supplyOnly: true },
  { id: 'activeOrder', label: 'Active Order', supplyOnly: true },
  { id: 'salesData', label: 'Sales Data' },
  { id: 'subProduct', label: 'Sub-Product' },
];

export function ProductionSection({
  selectedCompanyId,
  selectedLocationIds,
  initialTab = 'b2bProduct',
}: Props) {
  const hasSupplyCapability = useOrgSupplyCapability(selectedCompanyId, selectedLocationIds);
  const tabItems = useMemo(
    () => ALL_TAB_ITEMS.filter(item => hasSupplyCapability || !item.supplyOnly),
    [hasSupplyCapability],
  );

  const resolvedInitial = useMemo((): ProductionTab => {
    if (!hasSupplyCapability && (initialTab === 'b2bProduct' || initialTab === 'activeOrder')) {
      return 'subProduct';
    }
    return initialTab;
  }, [initialTab, hasSupplyCapability]);

  const [tab, setTab] = useState<ProductionTab>(resolvedInitial);
  const activeLabel = tabItems.find(item => item.id === tab)?.label
    ?? tabItems[0]?.label
    ?? 'Sub-Product';
  useRevMgmtPageLabel(activeLabel);

  useEffect(() => {
    setTab(resolvedInitial);
  }, [resolvedInitial]);

  useEffect(() => {
    if (!tabItems.some(item => item.id === tab) && tabItems[0]) {
      setTab(tabItems[0].id);
    }
  }, [tab, tabItems]);

  return (
    <div className={pageShellClass({ spacing: 'default' })}>
      <div className="flex gap-1 border-b border-border">
        {tabItems.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`px-3 py-1.5 text-xs font-semibold border-b-2 transition-colors -mb-px ${
              tab === item.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'b2bProduct' && hasSupplyCapability ? (
        <ProductManagementPage
          embedded
          viewMode="b2b"
          selectedCompanyId={selectedCompanyId}
          selectedLocationIds={selectedLocationIds}
        />
      ) : tab === 'activeOrder' && hasSupplyCapability ? (
        <B2bActiveOrderPage
          embedded
          selectedCompanyId={selectedCompanyId}
          selectedLocationIds={selectedLocationIds}
        />
      ) : tab === 'subProduct' ? (
        <ProductManagementPage
          embedded
          viewMode="sub-product"
          selectedCompanyId={selectedCompanyId}
          selectedLocationIds={selectedLocationIds}
        />
      ) : (
        <SalesDataPage
          embedded
          selectedCompanyId={selectedCompanyId}
          selectedLocationIds={selectedLocationIds}
        />
      )}
    </div>
  );
}
