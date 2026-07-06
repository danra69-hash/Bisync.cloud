import { useState } from 'react';
import { RevMgmtBar } from './RevMgmtBar';
import { POSBar } from './POSBar';
import { ModuleContent } from './ModuleContent';
import { SmartIngredientPage } from './SmartIngredientPage';
import { ComponentConfigPage } from './ComponentConfigPage';
import { VendorListPage } from './VendorListPage';
import { ComparePricePage } from './ComparePricePage';
import { OrderPage } from './OrderPage';
import { CashPurchasePage } from './CashPurchasePage';
import { OrderTemplatePage } from './OrderTemplatePage';
import { ProductsSection } from './ProductsSection';
import { ProductManagementPage } from './ProductManagementPage';
import { StockCardPage } from './StockCardPage';
import { InventoryPage } from './InventoryPage';
import { RevMgmtLandingPage } from './RevMgmtLandingPage';
import { RevMgmtPageHeader } from './RevMgmtPageHeader';
import { RevMgmtTitleProvider, useRevMgmtTitleContext } from './RevMgmtTitleContext';

type Props = {
  section: 'Revenue Management' | 'Point-of-Sales';
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
};

function renderRevMgmtContent(
  selectedItem: string | null,
  selectedCompanyId: number | null,
  selectedLocationIds: string[],
) {
  if (!selectedItem) {
    return <RevMgmtLandingPage selectedCompanyId={selectedCompanyId} selectedLocationIds={selectedLocationIds} />;
  }

  const [section, subtitle, label] = selectedItem.split('||');

  switch (label) {
    case 'Smart Component':
      return <SmartIngredientPage selectedCompanyId={selectedCompanyId} />;
    case 'Component Config':
      return <ComponentConfigPage selectedCompanyId={selectedCompanyId} />;
    case 'Vendor List & Products':
      return <VendorListPage selectedCompanyId={selectedCompanyId} />;
    case 'Compare Price':
      return <ComparePricePage selectedCompanyId={selectedCompanyId} />;
    case 'My Order':
      return (
        <OrderPage
          selectedCompanyId={selectedCompanyId}
          selectedLocationIds={selectedLocationIds}
        />
      );
    case 'Cash Purchase':
      return (
        <CashPurchasePage
          selectedCompanyId={selectedCompanyId}
          selectedLocationIds={selectedLocationIds}
        />
      );
    case 'Order Template':
      return (
        <OrderTemplatePage
          selectedCompanyId={selectedCompanyId}
          selectedLocationIds={selectedLocationIds}
        />
      );
    case 'Products':
      return (
        <ProductsSection
          selectedCompanyId={selectedCompanyId}
          selectedLocationIds={selectedLocationIds}
        />
      );
    case 'Product Management':
      return (
        <ProductManagementPage
          selectedCompanyId={selectedCompanyId}
          selectedLocationIds={selectedLocationIds}
        />
      );
    case 'Stock Card':
      return (
        <StockCardPage
          selectedCompanyId={selectedCompanyId}
          selectedLocationIds={selectedLocationIds}
        />
      );
    case 'Inventory':
      return (
        <InventoryPage
          selectedCompanyId={selectedCompanyId}
          selectedLocationIds={selectedLocationIds}
        />
      );
    default:
      return <ModuleContent section={subtitle ? `${section} · ${subtitle}` : section} label={label} />;
  }
}

export function RevenueSection({ section, selectedCompanyId, selectedLocationIds }: Props) {
  const [revItem, setRevItem] = useState<string | null>(null);
  const [posItem, setPosItem] = useState<string | null>(null);

  if (section === 'Point-of-Sales') {
    return (
      <>
        <POSBar selectedItem={posItem} onSelectItem={setPosItem} />
        {posItem ? (
          <ModuleContent section="Point-of-Sales" label={posItem} />
        ) : (
          <div className="p-2 sm:p-3 w-full min-w-0">
            <p className="text-sm text-muted-foreground">Select a POS module from the navigation bar above.</p>
          </div>
        )}
      </>
    );
  }

  return (
    <RevMgmtTitleProvider revItem={revItem}>
      <RevMgmtBar selectedItem={revItem} onSelectItem={setRevItem} />
      {revItem && <RevMgmtPageTitle revItem={revItem} />}
      {renderRevMgmtContent(revItem, selectedCompanyId, selectedLocationIds)}
    </RevMgmtTitleProvider>
  );
}

function RevMgmtPageTitle({ revItem }: { revItem: string }) {
  const ctx = useRevMgmtTitleContext();
  const [section, , label] = revItem.split('||');
  const displayLabel = ctx?.pageLabelOverride ?? label;
  return <RevMgmtPageHeader section={section} label={displayLabel} />;
}
