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
import { RevMgmtLandingPage } from './RevMgmtLandingPage';

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
          <div className="p-6">
            <p className="text-sm text-muted-foreground">Select a POS module from the navigation bar above.</p>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <RevMgmtBar selectedItem={revItem} onSelectItem={setRevItem} />
      {renderRevMgmtContent(revItem, selectedCompanyId, selectedLocationIds)}
    </>
  );
}
