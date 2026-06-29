import { useState } from 'react';
import { RevMgmtBar } from './RevMgmtBar';
import { POSBar } from './POSBar';
import { ModuleContent } from './ModuleContent';
import { SmartIngredientPage } from './SmartIngredientPage';
import { ComponentConfigPage } from './ComponentConfigPage';
import { VendorListPage } from './VendorListPage';
import { ComparePricePage } from './ComparePricePage';

type Props = { section: 'Revenue Management' | 'Point-of-Sales'; selectedCompanyId: number | null };

function renderRevMgmtContent(selectedItem: string | null, selectedCompanyId: number | null) {
  if (!selectedItem) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Select a module from the navigation bar above.</p>
      </div>
    );
  }

  const [section, subtitle, label] = selectedItem.split('||');

  switch (label) {
    case 'Smart Component':
      return <SmartIngredientPage selectedCompanyId={selectedCompanyId} />;
    case 'Component Config':
      return <ComponentConfigPage />;
    case 'Vendor List':
      return <VendorListPage />;
    case 'Compare Price':
      return <ComparePricePage />;
    default:
      return <ModuleContent section={subtitle ? `${section} · ${subtitle}` : section} label={label} />;
  }
}

export function RevenueSection({ section, selectedCompanyId }: Props) {
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
      {renderRevMgmtContent(revItem, selectedCompanyId)}
    </>
  );
}
