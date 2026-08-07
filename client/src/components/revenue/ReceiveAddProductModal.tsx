import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Package, Search, X } from 'lucide-react';
import { api } from '../../api';
import {
  applyVendorProductOverrides,
  formatDeliveryUnitPath,
  type VendorProductCatalogItem,
} from '../../data/vendorProductCatalog';
import { resolveTaggedProductsForComponent } from '../../data/createOrder';
import { fromApiUom, resolveDetailConfigForRow } from '../../data/componentForm';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';
import { MillstoneLoader } from '../shared/MillstoneLoader';
import { ingredientToRow } from './smartIngredientShared';

export type ReceiveAddProductSelection = {
  product: VendorProductCatalogItem;
  componentId: string;
  componentName: string;
  componentUom: string;
};

type Props = {
  companyId: number | null;
  vendorExternalId: string;
  vendorName: string;
  locationIds: string[];
  /** Keys already on the receive sheet: `${componentId}::${vendorProductId}`. */
  addedLineKeys: Set<string>;
  onClose: () => void;
  onSelect: (selection: ReceiveAddProductSelection) => void;
};

type Option = ReceiveAddProductSelection & { lineKey: string };

export function ReceiveAddProductModal({
  companyId,
  vendorExternalId,
  vendorName,
  locationIds,
  addedLineKeys,
  onClose,
  onSelect,
}: Props) {
  const { rm } = useCountryFormatters();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<Option[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const ingredients = await api.ingredients(
          companyId ?? undefined,
          locationIds.length > 0 ? locationIds : undefined,
        );
        if (cancelled) return;
        const catalog = applyVendorProductOverrides();
        const rows = ingredients.map(ingredientToRow);
        const next: Option[] = [];
        for (const component of rows) {
          const tagged = resolveTaggedProductsForComponent(component, catalog, {
            vendorExternalId: vendorExternalId || undefined,
            locationIds,
          });
          const detail = resolveDetailConfigForRow(component);
          for (const product of tagged) {
            const componentUom = detail.vendorProductComponentUom[product.id]
              || fromApiUom(component.recipeUOM)
              || component.inventoryUOM
              || '';
            next.push({
              lineKey: `${component.componentId}::${product.id}`,
              product,
              componentId: component.componentId,
              componentName: component.name,
              componentUom,
            });
          }
        }
        next.sort((a, b) =>
          a.product.productName.localeCompare(b.product.productName)
          || a.componentName.localeCompare(b.componentName),
        );
        setOptions(next);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load vendor products.');
          setOptions([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [companyId, vendorExternalId, locationIds.join('|')]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(opt => {
      const hay = [
        opt.product.id,
        opt.product.productName,
        opt.componentId,
        opt.componentName,
        formatDeliveryUnitPath(opt.product.delivery),
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [options, search]);

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-2xl rounded-lg border border-border bg-card shadow-xl overflow-hidden flex flex-col max-h-[min(90vh,36rem)]">
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Package size={16} className="text-primary" />
              <h3 className="text-sm font-semibold">Add product to receive</h3>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Freebies or credit-note replacements from {vendorName || 'this vendor'} that were not on the original order.
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Only tagged vendor products for this vendor at the PO locations are listed. Unit price defaults to 0.
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

        <div className="px-5 py-3 border-b border-border shrink-0">
          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search Vendor Product ID, name, or component…"
              className="w-full pl-8 pr-3 py-2 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-border">
          {loading ? (
            <div className="px-5 py-10">
              <MillstoneLoader size="sm" layout="block" label="Loading vendor products…" />
            </div>
          ) : error ? (
            <p className="px-5 py-10 text-xs text-red-600 text-center">{error}</p>
          ) : filtered.length === 0 ? (
            <p className="px-5 py-10 text-xs text-muted-foreground text-center">
              {vendorExternalId
                ? 'No tagged vendor products for this vendor at the PO locations.'
                : 'This PO has no vendor id — cannot list catalog products.'}
            </p>
          ) : (
            filtered.map(opt => {
              const added = addedLineKeys.has(opt.lineKey);
              return (
                <button
                  key={opt.lineKey}
                  type="button"
                  disabled={added}
                  onClick={() => onSelect(opt)}
                  className={`w-full text-left px-5 py-4 text-xs transition-colors ${
                    added ? 'bg-muted/30 text-muted-foreground cursor-default' : 'hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{opt.product.productName}</p>
                      <p className="text-[10px] font-sans text-muted-foreground mt-0.5">
                        Vendor Product ID: {opt.product.id}
                      </p>
                      <p className="text-muted-foreground truncate mt-1">
                        {opt.componentName} ({opt.componentId})
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Delivery unit: {formatDeliveryUnitPath(opt.product.delivery)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-sans font-medium">{rm(opt.product.deliveryPrice)}</p>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">
                        {added ? 'Added' : 'Add · freebie 0'}
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
