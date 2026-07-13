import { useEffect, useState } from 'react';
import { pageShellClass } from '../layout/pageLayout';
import { ProductManagementPage } from './ProductManagementPage';
import { SalesDataPage } from './SalesDataPage';
import { B2bActiveOrderPage } from './B2bActiveOrderPage';
import { useRevMgmtPageLabel } from './RevMgmtTitleContext';

export type ProductionTab = 'b2bProduct' | 'activeOrder' | 'salesData' | 'subProduct';

type Props = {
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
  initialTab?: ProductionTab;
};

const TAB_ITEMS: { id: ProductionTab; label: string }[] = [
  { id: 'b2bProduct', label: 'B2B Product' },
  { id: 'activeOrder', label: 'Active Order' },
  { id: 'salesData', label: 'Sales Data' },
  { id: 'subProduct', label: 'Sub-Product' },
];

export function ProductionSection({
  selectedCompanyId,
  selectedLocationIds,
  initialTab = 'b2bProduct',
}: Props) {
  const [tab, setTab] = useState<ProductionTab>(initialTab);
  const activeLabel = TAB_ITEMS.find(item => item.id === tab)?.label ?? 'B2B Product';
  useRevMgmtPageLabel(activeLabel);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  return (
    <div className={pageShellClass({ spacing: 'default' })}>
      <div className="flex gap-1 border-b border-border">
        {TAB_ITEMS.map(item => (
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

      {tab === 'b2bProduct' ? (
        <ProductManagementPage
          embedded
          viewMode="b2b"
          selectedCompanyId={selectedCompanyId}
          selectedLocationIds={selectedLocationIds}
        />
      ) : tab === 'activeOrder' ? (
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
