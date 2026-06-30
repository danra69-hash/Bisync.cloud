import { useEffect, useMemo, useState } from 'react';
import { UserPlus, X } from 'lucide-react';
import { type Vendor } from '../../api';
import { getVendorCatalogProducts } from '../../data/vendorProductCatalog';
import { SIDE_PANEL_OVERLAY_CLS, SIDE_PANEL_SHELL_VENDOR_PRODUCTS_CLS } from '../layout/sidePanelShared';
import { VendorProductsList } from './VendorProductsList';

type Props = {
  vendor: Vendor;
  selectedCompanyId: number | null;
  onClose: () => void;
  onVendorUpdated: (vendor: Vendor) => void;
};

export function VendorProductsPanel({ vendor, selectedCompanyId, onClose, onVendorUpdated }: Props) {
  const [panelVendor, setPanelVendor] = useState(vendor);
  const [engageVendorRequest, setEngageVendorRequest] = useState<Vendor | null>(null);
  const [catalogRefresh, setCatalogRefresh] = useState(0);

  const products = useMemo(
    () => getVendorCatalogProducts(panelVendor.externalId),
    [panelVendor.externalId, catalogRefresh],
  );

  useEffect(() => {
    setPanelVendor(vendor);
  }, [vendor]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  function handleVendorUpdated(updated: Vendor) {
    setPanelVendor(updated);
    onVendorUpdated(updated);
  }

  return (
    <>
      <div className={SIDE_PANEL_OVERLAY_CLS} onClick={onClose} role="presentation" aria-hidden />

      <div className={SIDE_PANEL_SHELL_VENDOR_PRODUCTS_CLS} onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">Vendor Products</p>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              <h3 className="text-sm font-semibold text-foreground">{panelVendor.name}</h3>
              {panelVendor.engaged ? (
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#5A7A2A]/15 text-[#5A7A2A]">Engaged</span>
              ) : (
                <button
                  type="button"
                  onClick={() => setEngageVendorRequest(panelVendor)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-primary text-primary-foreground"
                >
                  <UserPlus size={11} />
                  Engage Vendor
                </button>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {panelVendor.externalId} · {panelVendor.products || '—'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors mt-0.5 shrink-0">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto px-5 py-4">
          <p className="text-[10px] text-muted-foreground mb-3">
            Tag vendor products to smart components for purchase and inventory tracking. Engage the vendor first if Tag prompts engagement.
          </p>

          <VendorProductsList
            products={products}
            vendors={[panelVendor]}
            selectedCompanyId={selectedCompanyId}
            onVendorUpdated={handleVendorUpdated}
            onProductUpdated={() => setCatalogRefresh(key => key + 1)}
            engageVendorRequest={engageVendorRequest}
            onEngageVendorRequestHandled={() => setEngageVendorRequest(null)}
          />
        </div>
      </div>
    </>
  );
}
