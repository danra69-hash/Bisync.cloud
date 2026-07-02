import { createPortal } from 'react-dom';
import { Package, X } from 'lucide-react';
import {
  applyVendorProductOverrides,
  formatDeliveryUnitPath,
  type VendorProductCatalogItem,
} from '../../data/vendorProductCatalog';
import { formatRm, resolveTaggedProductsForComponent } from '../../data/createOrder';
import type { ingredientToRow } from './smartIngredientShared';

type ComponentRow = ReturnType<typeof ingredientToRow>;

type Props = {
  component: ComponentRow;
  locationIds: string[];
  vendorExternalId: string;
  addedLineKeys: Set<string>;
  onClose: () => void;
  onSelect: (product: VendorProductCatalogItem) => void;
};

export function OrderTemplateVendorProductPickerModal({
  component,
  locationIds,
  vendorExternalId,
  addedLineKeys,
  onClose,
  onSelect,
}: Props) {
  const catalog = applyVendorProductOverrides();
  const taggedProducts = resolveTaggedProductsForComponent(component, catalog, {
    locationIds,
    vendorExternalId: vendorExternalId || undefined,
  }).sort((a, b) => a.vendorName.localeCompare(b.vendorName) || a.productName.localeCompare(b.productName));

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-2xl rounded-lg border border-border bg-card shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Package size={16} className="text-primary" />
              <h3 className="text-sm font-semibold">Choose vendor product</h3>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {component.name} ({component.componentId})
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Select a tagged vendor product to add to this template.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-muted text-muted-foreground"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[24rem] overflow-y-auto divide-y divide-border">
          {taggedProducts.length === 0 ? (
            <p className="px-5 py-10 text-xs text-muted-foreground text-center">
              {vendorExternalId
                ? 'No tagged vendor products for this component and vendor at the selected locations.'
                : 'No vendor products are tagged to this component at the selected locations.'}
            </p>
          ) : (
            taggedProducts.map(product => {
              const lineKey = `${component.componentId}::${product.id}`;
              const added = addedLineKeys.has(lineKey);
              return (
                <button
                  key={product.id}
                  type="button"
                  disabled={added}
                  onClick={() => onSelect(product)}
                  className={`w-full text-left px-5 py-4 text-xs transition-colors ${
                    added ? 'bg-muted/30 text-muted-foreground cursor-default' : 'hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{product.productName}</p>
                      <p className="text-muted-foreground truncate">{product.vendorName}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Delivery unit: {formatDeliveryUnitPath(product.delivery)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-sans font-medium">{formatRm(product.deliveryPrice)}</p>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">
                        {added ? 'Added' : 'Select'}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
