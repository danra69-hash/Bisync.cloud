import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Tag, X } from 'lucide-react';
import { api, type ComponentTagSuggestion } from '../../api';
import {
  fromApiUom,
  resolveDetailConfigForRow,
  type ComponentRow,
} from '../../data/componentForm';
import {
  applyVendorProductOverrides,
  resolveComponentUomQty,
  type VendorProductCatalogItem,
} from '../../data/vendorProductCatalog';
import {
  buildComponentRowWithVendorProductTag,
  isVendorProductTagReady,
} from '../../data/vendorProductTagging';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';
import { MillstoneLoader } from '../shared/MillstoneLoader';
import { mergeSavedRow, rowToIngredient } from './smartIngredientShared';

type Props = {
  row: ComponentRow;
  selectedCompanyId: number;
  selectedLocationIds: string[];
  companyLocationIds: string[];
  onClose: () => void;
  onTagged: (updated: ComponentRow) => void;
};

function findCatalogProduct(id: string): VendorProductCatalogItem | undefined {
  return applyVendorProductOverrides().find(p => p.id === id);
}

export function ComponentTagSuggestionModal({
  row,
  selectedCompanyId,
  selectedLocationIds,
  companyLocationIds,
  onClose,
  onTagged,
}: Props) {
  const { rm } = useCountryFormatters();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<ComponentTagSuggestion[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void api.componentTagSuggestions(selectedCompanyId, row.name, selectedLocationIds)
      .then(res => {
        if (!cancelled) setSuggestions(Array.isArray(res.suggestions) ? res.suggestions : []);
      })
      .catch(e => {
        if (!cancelled) {
          setSuggestions([]);
          setError(e instanceof Error ? e.message : 'Failed to load tag suggestions.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedCompanyId, row.name, selectedLocationIds]);

  const engaged = useMemo(
    () => suggestions.filter(s => s.vendorEngaged && !s.alreadyTagged),
    [suggestions],
  );
  const untact = useMemo(
    () => suggestions.filter(s => !s.vendorEngaged && !s.alreadyTagged),
    [suggestions],
  );
  const already = useMemo(
    () => suggestions.filter(s => s.alreadyTagged),
    [suggestions],
  );

  async function tagProduct(suggestion: ComponentTagSuggestion) {
    const product = findCatalogProduct(suggestion.vendorProductId);
    if (!product) {
      setActionError('Vendor product is not in the local catalog.');
      return;
    }
    if (!row.id) {
      setActionError('Save the component before tagging.');
      return;
    }

    const detail = resolveDetailConfigForRow(row);
    const recipeUnit = fromApiUom(row.recipeUOM);
    const componentUom = recipeUnit;
    const resolved = resolveComponentUomQty(
      product.delivery,
      recipeUnit,
      detail.altRecipeUnits,
      componentUom,
    );
    const principalQty = resolved.qty != null ? String(resolved.qty) : '';
    const productLocationIds = selectedLocationIds.length > 0
      ? selectedLocationIds
      : companyLocationIds;

    const ready = isVendorProductTagReady(product, {
      recipeUnit,
      altRecipeUnits: detail.altRecipeUnits,
      componentUom,
      principalQty,
      productLocationIds,
      companyLocationCount: companyLocationIds.length,
    });
    if (!ready.ready) {
      setActionError(ready.reason || 'Unable to tag this product yet.');
      return;
    }

    setBusyId(suggestion.vendorProductId);
    setActionError(null);
    try {
      const tagged = buildComponentRowWithVendorProductTag(row, product, {
        recipeUnit,
        inventoryUnit: recipeUnit,
        componentUom,
        principalQty,
        yieldLossPct: '0',
        productLocationIds,
      });
      const saved = await api.updateIngredient(
        row.id,
        rowToIngredient(tagged, { companyId: selectedCompanyId }),
      );
      onTagged(mergeSavedRow(saved, tagged));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to tag vendor product.');
    } finally {
      setBusyId(null);
    }
  }

  if (typeof document === 'undefined') return null;

  function Section({
    title,
    hint,
    rows,
  }: {
    title: string;
    hint: string;
    rows: ComponentTagSuggestion[];
  }) {
    if (rows.length === 0) return null;
    return (
      <div className="space-y-2">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
          <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>
        </div>
        <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden">
          {rows.map(s => (
            <li key={`${s.vendorProductId}-${s.vendorExternalId}`} className="px-3 py-2.5 bg-card flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{s.productName}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {s.vendorName}
                  {s.group ? ` · ${s.group}` : ''}
                </p>
                <p className="text-[11px] font-sans tabular-nums text-muted-foreground mt-0.5">
                  {Math.round(s.probability)}% match
                  {s.deliveryPrice != null && s.deliveryPrice > 0 ? ` · ${rm(s.deliveryPrice)}` : ''}
                </p>
              </div>
              {s.alreadyTagged ? (
                <span className="text-[11px] text-muted-foreground shrink-0 pt-1">Tagged</span>
              ) : (
                <button
                  type="button"
                  disabled={busyId === s.vendorProductId}
                  onClick={() => void tagProduct(s)}
                  className="shrink-0 px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
                >
                  {busyId === s.vendorProductId ? 'Tagging…' : 'Tag'}
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/40"
      onClick={busyId ? undefined : onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-xl bg-card border border-border rounded-xl shadow-xl max-h-[var(--app-modal-max-h)] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Tag suggestions"
      >
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0 flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Tag size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-sans text-muted-foreground uppercase tracking-widest">Tag suggestion</p>
              <h3 className="text-sm font-semibold mt-0.5 truncate">{row.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Vendor products tagged to this component name across the platform (≥50%).
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={Boolean(busyId)} className="p-1 rounded-md hover:bg-muted disabled:opacity-50">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
          {loading ? <MillstoneLoader label="Loading suggestions…" /> : null}
          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          ) : null}
          {actionError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {actionError}
            </div>
          ) : null}

          {!loading && !error && suggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No tag suggestions at 50%+ probability for this component name yet.
            </p>
          ) : null}

          {!loading ? (
            <>
              <Section
                title="Engaged vendors"
                hint="Approved for ordering at your company / locations."
                rows={engaged}
              />
              <Section
                title="Untact vendors"
                hint="Not yet engaged — still available to tag from the catalog."
                rows={untact}
              />
              <Section
                title="Already tagged"
                hint="Suggestions already linked to this component."
                rows={already}
              />
            </>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
