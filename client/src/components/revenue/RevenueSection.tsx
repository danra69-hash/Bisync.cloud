import { useEffect, useState } from 'react';
import { RevMgmtBar } from './RevMgmtBar';
import { POSBar } from './POSBar';
import { ModuleContent } from './ModuleContent';
import { SmartIngredientPage } from './SmartIngredientPage';
import { ComponentConfigPage } from './ComponentConfigPage';
import { CustomerListPage } from './CustomerListPage';
import { SalesModulePage } from './SalesModulePage';
import { ActiveSalesOrderPage } from './ActiveSalesOrderPage';
import { VendorListPage } from './VendorListPage';
import { ComparePricePage } from './ComparePricePage';
import { OrderPage } from './OrderPage';
import { CashPurchasePage } from './CashPurchasePage';
import { OrderTemplatePage } from './OrderTemplatePage';
import { ProductsSection } from './ProductsSection';
import { ProductionSection } from './ProductionSection';
import { StockCardPage } from './StockCardPage';
import { InventoryPage } from './InventoryPage';
import { WastagePage } from './WastagePage';
import { TransferPage } from './TransferPage';
import { CogsAuditPage } from './CogsAuditPage';
import { RevMgmtLandingPage } from './RevMgmtLandingPage';
import { RevMgmtPageHeader } from './RevMgmtPageHeader';
import { RevMgmtTitleProvider, useRevMgmtTitleContext } from './RevMgmtTitleContext';
import { useAppTranslation } from '../../i18n/useAppTranslation';
import { setComponentCatalogCompanyId } from '../../data/componentCatalogConfig';
import { ensureRevMgmtConfig } from '../../data/revMgmtConfigStore';
import { refreshVendorProductCatalog } from '../../data/vendorProductCatalog';
import { isB2bProductNavLabel, isSupplySideNavLabel } from '../../data/revenueManagement';
import { useOrgBusinessCapabilities } from '../../hooks/useOrgSupplyCapability';

type Props = {
  section: 'Revenue Management' | 'Point-of-Sales';
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
};

function renderRevMgmtContent(
  selectedItem: string | null,
  selectedCompanyId: number | null,
  selectedLocationIds: string[],
  onSelectItem?: (id: string | null) => void,
  hasSupplyCapability = true,
  hasB2bProductCapability = true,
) {
  if (!selectedItem) {
    return (
      <RevMgmtLandingPage
        selectedCompanyId={selectedCompanyId}
        selectedLocationIds={selectedLocationIds}
        onOpenTransfer={() => onSelectItem?.('Operation||Inventory||Transfer')}
      />
    );
  }

  const [section, subtitle, label] = selectedItem.split('||');

  if ((!hasSupplyCapability && isSupplySideNavLabel(label))
    || (!hasB2bProductCapability && isB2bProductNavLabel(label))) {
    return (
      <div className="p-2 sm:p-3 w-full min-w-0">
        <p className="text-sm text-muted-foreground">
          {isB2bProductNavLabel(label)
            ? 'B2B products are available for Central Kitchen / Warehouse and Manufacturer.'
            : 'Active Sales is available for Central Kitchen / Warehouse, Distributor, and Manufacturer.'}
        </p>
      </div>
    );
  }

  switch (label) {
    case 'Smart Component':
      return (
        <SmartIngredientPage
          selectedCompanyId={selectedCompanyId}
          selectedLocationIds={selectedLocationIds}
        />
      );
    case 'Component Config':
      return (
        <ComponentConfigPage
          selectedCompanyId={selectedCompanyId}
          selectedLocationIds={selectedLocationIds}
        />
      );
    case 'Sales Order':
    case 'Active Sales Order':
      return (
        <ActiveSalesOrderPage
          selectedCompanyId={selectedCompanyId}
          selectedLocationIds={selectedLocationIds}
        />
      );
    case 'Customer List':
      return (
        <CustomerListPage
          selectedCompanyId={selectedCompanyId}
          selectedLocationIds={selectedLocationIds}
        />
      );
    case 'Sales Module':
      return (
        <SalesModulePage
          selectedCompanyId={selectedCompanyId}
          selectedLocationIds={selectedLocationIds}
        />
      );
    case 'Vendor List & Products':
      return <VendorListPage selectedCompanyId={selectedCompanyId} selectedLocationIds={selectedLocationIds} />;
    case 'Compare Price':
      return <ComparePricePage selectedCompanyId={selectedCompanyId} selectedLocationIds={selectedLocationIds} />;
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
    case 'Production':
      return (
        <ProductionSection
          selectedCompanyId={selectedCompanyId}
          selectedLocationIds={selectedLocationIds}
        />
      );
    case 'B2B Product':
    case 'Product Management':
      return (
        <ProductionSection
          selectedCompanyId={selectedCompanyId}
          selectedLocationIds={selectedLocationIds}
          initialTab="b2bProduct"
        />
      );
    case 'Sales Data':
      return (
        <ProductionSection
          selectedCompanyId={selectedCompanyId}
          selectedLocationIds={selectedLocationIds}
          initialTab="salesData"
        />
      );
    case 'Sub-Product':
      return (
        <ProductionSection
          selectedCompanyId={selectedCompanyId}
          selectedLocationIds={selectedLocationIds}
          initialTab="subProduct"
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
    case 'Wastage':
      return (
        <WastagePage
          selectedCompanyId={selectedCompanyId}
          selectedLocationIds={selectedLocationIds}
        />
      );
    case 'Transfer':
      return (
        <TransferPage
          selectedCompanyId={selectedCompanyId}
          selectedLocationIds={selectedLocationIds}
        />
      );
    case 'COGS Audit':
      return (
        <CogsAuditPage
          selectedCompanyId={selectedCompanyId}
          selectedLocationIds={selectedLocationIds}
        />
      );
    default:
      return <ModuleContent section={subtitle ? `${section} · ${subtitle}` : section} label={label} />;
  }
}

export function RevenueSection({ section, selectedCompanyId, selectedLocationIds }: Props) {
  const { t } = useAppTranslation();
  const [revItem, setRevItem] = useState<string | null>(null);
  const [posItem, setPosItem] = useState<string | null>(null);
  const { hasSupplyCapability, hasB2bProductCapability } = useOrgBusinessCapabilities(
    selectedCompanyId,
    selectedLocationIds,
  );

  useEffect(() => {
    void refreshVendorProductCatalog();
  }, []);

  useEffect(() => {
    setComponentCatalogCompanyId(selectedCompanyId);
    if (!selectedCompanyId) return;
    void ensureRevMgmtConfig(selectedCompanyId);
  }, [selectedCompanyId]);

  useEffect(() => {
    if (!revItem) return;
    const label = revItem.split('||')[2];
    if ((!hasSupplyCapability && isSupplySideNavLabel(label))
      || (!hasB2bProductCapability && isB2bProductNavLabel(label))) {
      setRevItem(null);
    }
  }, [revItem, hasSupplyCapability, hasB2bProductCapability]);

  if (section === 'Point-of-Sales') {
    return (
      <>
        <POSBar selectedItem={posItem} onSelectItem={setPosItem} />
        {posItem ? (
          <ModuleContent section="Point-of-Sales" label={posItem} />
        ) : (
          <div className="p-2 sm:p-3 w-full min-w-0">
            <p className="text-sm text-muted-foreground">{t('pos.selectModule')}</p>
          </div>
        )}
      </>
    );
  }

  return (
    <RevMgmtTitleProvider revItem={revItem}>
      <div data-module-bar className="bg-background border-b border-border shadow-sm">
        <RevMgmtBar
          selectedItem={revItem}
          onSelectItem={setRevItem}
          hasSupplyCapability={hasSupplyCapability}
          hasB2bProductCapability={hasB2bProductCapability}
        />
        {revItem && <RevMgmtPageTitle revItem={revItem} />}
      </div>
      {renderRevMgmtContent(
        revItem,
        selectedCompanyId,
        selectedLocationIds,
        setRevItem,
        hasSupplyCapability,
        hasB2bProductCapability,
      )}
    </RevMgmtTitleProvider>
  );
}

function RevMgmtPageTitle({ revItem }: { revItem: string }) {
  const ctx = useRevMgmtTitleContext();
  const [section, , label] = revItem.split('||');
  const displayLabel = ctx?.pageLabelOverride ?? label;
  return <RevMgmtPageHeader section={section} label={displayLabel} />;
}
