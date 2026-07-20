import { useEffect, useMemo, useState } from 'react';
import { pageShellClass } from '../layout/pageLayout';
import { ProductManagementPage } from './ProductManagementPage';
import { SalesDataPage } from './SalesDataPage';
import { B2bActiveOrderPage } from './B2bActiveOrderPage';
import { useRevMgmtPageLabel } from './RevMgmtTitleContext';
import { useOrgBusinessCapabilities } from '../../hooks/useOrgSupplyCapability';

export type ProductionTab = 'b2bProduct' | 'activeOrder' | 'salesData' | 'subProduct';

type Props = {
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
  initialTab?: ProductionTab;
};

type TabDef = {
  id: ProductionTab;
  label: string;
  /** Active Sales capability (CK / warehouse / distributor / manufacturer). */
  requiresSupply?: boolean;
  /** B2B product capability (CK / warehouse / manufacturer only). */
  requiresB2bProduct?: boolean;
};

const ALL_TAB_ITEMS: TabDef[] = [
  { id: 'b2bProduct', label: 'B2B Product', requiresB2bProduct: true },
  { id: 'activeOrder', label: 'Active Order', requiresSupply: true },
  { id: 'salesData', label: 'Sales Data' },
  { id: 'subProduct', label: 'Sub-Product' },
];

export function ProductionSection({
  selectedCompanyId,
  selectedLocationIds,
  initialTab = 'b2bProduct',
}: Props) {
  const { hasSupplyCapability, hasB2bProductCapability } = useOrgBusinessCapabilities(
    selectedCompanyId,
    selectedLocationIds,
  );

  const tabItems = useMemo(
    () => ALL_TAB_ITEMS.filter(item => {
      if (item.requiresB2bProduct && !hasB2bProductCapability) return false;
      if (item.requiresSupply && !hasSupplyCapability) return false;
      return true;
    }),
    [hasSupplyCapability, hasB2bProductCapability],
  );

  const resolvedInitial = useMemo((): ProductionTab => {
    if (initialTab === 'b2bProduct' && !hasB2bProductCapability) {
      return hasSupplyCapability ? 'activeOrder' : 'subProduct';
    }
    if (initialTab === 'activeOrder' && !hasSupplyCapability) {
      return hasB2bProductCapability ? 'b2bProduct' : 'subProduct';
    }
    return initialTab;
  }, [initialTab, hasSupplyCapability, hasB2bProductCapability]);

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

      {tab === 'b2bProduct' && hasB2bProductCapability ? (
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
