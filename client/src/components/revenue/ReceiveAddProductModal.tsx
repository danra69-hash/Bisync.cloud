import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Package, Search, X } from 'lucide-react';
import { api } from '../../api';
import {
  applyVendorProductOverrides,
  formatDeliveryUnitPath,
  refreshVendorProductCatalog,
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
  /**
   * Keys for products already added as unordered extras this receive:
   * `${componentId}::${vendorProductId}`. Ordered PO lines are allowed again
   * so a CN replacement can use a product already on the PO.
   */
  addedExtraLineKeys: Set<string>;
  onClose: () => void;
  onSelect: (selection: ReceiveAddProductSelection) => void;
};

type Option = ReceiveAddProductSelection & { lineKey: string };

function vendorMatches(
  product: VendorProductCatalogItem,
  vendorExternalId: string,
  vendorName: string,
): boolean {
  const id = vendorExternalId.trim().toLowerCase();
  if (id && product.vendorExternalId.trim().toLowerCase() === id) return true;
  const name = vendorName.trim().toLowerCase();
  if (name && product.vendorName.trim().toLowerCase() === name) return true;
  return false;
}

export function ReceiveAddProductModal({
  companyId,
  vendorExternalId,
  vendorName,
  locationIds,
  addedExtraLineKeys,
  onClose,
  onSelect,
}: Props) {
  const { deliveryPrice } = useCountryFormatters();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<Option[]>([]);
  const [resolvedVendorId, setResolvedVendorId] = useState(vendorExternalId.trim());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        let vendorId = vendorExternalId.trim();
        if (!vendorId && vendorName.trim()) {
          try {
            const vendors = await api.vendors();
            const match = vendors.find(
              v => v.name.trim().toLowerCase() === vendorName.trim().toLowerCase(),
            );
            if (match?.externalId) vendorId = match.externalId.trim();
          } catch {
            // Catalog can still filter by vendor name.
          }
        }
        if (!cancelled) setResolvedVendorId(vendorId);

        const [ingredients] = await Promise.all([
          api.ingredients(
            companyId ?? undefined,
            locationIds.length > 0 ? locationIds : undefined,
          ),
          refreshVendorProductCatalog(),
        ]);
        if (cancelled) return;

        const catalog = applyVendorProductOverrides().filter(p =>
          vendorMatches(p, vendorId, vendorName),
        );
        const rows = ingredients.map(ingredientToRow);
        const next: Option[] = [];
        const pushTagged = (scopeLocationIds: string[]) => {
          for (const component of rows) {
            const tagged = resolveTaggedProductsForComponent(component, catalog, {
              vendorExternalId: vendorId || undefined,
              locationIds: scopeLocationIds.length > 0 ? scopeLocationIds : undefined,
            }).filter(p => vendorMatches(p, vendorId, vendorName));
            const detail = resolveDetailConfigForRow(component);
            for (const product of tagged) {
              const lineKey = `${component.componentId}::${product.id}`;
              if (next.some(o => o.lineKey === lineKey)) continue;
              const componentUom = detail.vendorProductComponentUom[product.id]
                || fromApiUom(component.recipeUOM)
                || component.inventoryUOM
                || '';
              next.push({
                lineKey,
                product,
                componentId: component.componentId,
                componentName: component.name,
                componentUom,
              });
            }
          }
        };

        // Prefer location-scoped tags; if none, fall back to any tag for this vendor.
        pushTagged(locationIds);
        if (next.length === 0) pushTagged([]);

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
  }, [companyId, vendorExternalId, vendorName, locationIds.join('|')]);

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

  const hasVendorIdentity = Boolean(resolvedVendorId || vendorName.trim());

  return createPortal(
    // Above elevated receive panel (z-132/133) so the picker is visible and clickable.
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-2xl rounded-lg border border-border bg-card shadow-xl overflow-hidden flex flex-col max-h-[min(90vh,36rem)]"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Add product to receive"
      >
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Package size={16} className="text-primary" />
              <h3 className="text-sm font-semibold">Add product to receive</h3>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Freebies or credit-note replacements from {vendorName || 'this vendor'}.
              Products already on this PO can be added again as replacements.
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Only tagged vendor products for this vendor are listed. Unit price defaults to 0.
              Link a matching credit note under Add Detail.
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
              autoFocus
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
              {!hasVendorIdentity
                ? 'This PO has no vendor — cannot list catalog products.'
                : 'No tagged vendor products for this vendor. Tag a vendor product to a smart component first, then retry.'}
            </p>
          ) : (
            filtered.map(opt => {
              const alreadyExtra = addedExtraLineKeys.has(opt.lineKey);
              return (
                <button
                  key={opt.lineKey}
                  type="button"
                  onClick={() => onSelect(opt)}
                  className="w-full text-left px-5 py-4 text-xs transition-colors hover:bg-muted/40"
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
                      <p className="font-sans font-medium">{deliveryPrice(opt.product.deliveryPrice)}</p>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">
                        {alreadyExtra ? 'Add again · freebie 0' : 'Add · freebie 0'}
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
