import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, X } from 'lucide-react';
import { api, type Product } from '../../api';
import { configLocationToDropdown } from '../../utils/orgFilters';
import {
  SIDE_PANEL_OVERLAY_CLS,
  SIDE_PANEL_SHELL_PRODUCT_DETAIL_CLS,
} from '../layout/sidePanelShared';
import { ProductReadOnlyView } from './ProductReadOnlyView';

type Props = {
  product: Product;
  companyId: number | null;
  onClose: () => void;
  onEdit?: () => void;
  onUpdated?: (product: Product) => void;
};

export function ProductDetailPanel({ product, companyId, onClose, onEdit, onUpdated }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rrpDraft, setRrpDraft] = useState(product.rrp > 0 ? String(product.rrp) : '');
  const [locationIds, setLocationIds] = useState<string[]>(product.locationExternalIds ?? []);
  const [locations, setLocations] = useState<{ externalId: string; name: string }[]>([]);

  useEffect(() => {
    setRrpDraft(product.rrp > 0 ? String(product.rrp) : '');
    setLocationIds(product.locationExternalIds ?? []);
  }, [product]);

  useEffect(() => {
    if (!companyId) {
      setLocations([]);
      return;
    }
    api.locationsConfig()
      .then(rows => setLocations(
        rows
          .filter(loc => loc.companyId === companyId)
          .map(configLocationToDropdown),
      ))
      .catch(() => setLocations([]));
  }, [companyId]);

  async function patchProduct(payload: Parameters<typeof api.patchProduct>[1]) {
    setSaving(true);
    setError(null);
    try {
      const updated = await api.patchProduct(product.id, payload);
      onUpdated?.(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update product.');
    } finally {
      setSaving(false);
    }
  }

  async function saveRrp() {
    const next = rrpDraft.trim() === '' ? 0 : parseFloat(rrpDraft);
    if (!Number.isFinite(next) || next < 0) {
      setRrpDraft(product.rrp > 0 ? String(product.rrp) : '');
      return;
    }
    if (next === product.rrp) return;
    await patchProduct({ rrp: next });
  }

  async function toggleLocation(externalId: string) {
    const next = locationIds.includes(externalId)
      ? locationIds.filter(id => id !== externalId)
      : [...locationIds, externalId];
    setLocationIds(next);
    await patchProduct({ locationExternalIds: next });
  }

  return createPortal(
    <>
      <div className={SIDE_PANEL_OVERLAY_CLS} onClick={() => !saving && onClose()} />
      <aside className={SIDE_PANEL_SHELL_PRODUCT_DETAIL_CLS}>
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <p className="text-xs font-sans uppercase tracking-widest text-muted-foreground">Product</p>
            <h2 className="text-base font-semibold mt-1 truncate">{product.name}</h2>
            <p className="text-[11px] text-muted-foreground mt-1 font-mono">{product.productId}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onEdit ? (
              <button
                type="button"
                onClick={onEdit}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-semibold hover:bg-muted/50 disabled:opacity-50"
              >
                <Pencil size={12} />
                Edit
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="p-2 rounded-md hover:bg-muted text-muted-foreground disabled:opacity-50"
              aria-label="Close product detail"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error ? (
            <p className="text-xs text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2 mb-4">
              {error}
            </p>
          ) : null}

          <ProductReadOnlyView
            product={product}
            locations={locations}
            locationIds={locationIds}
            saving={saving}
            rrpDraft={rrpDraft}
            onRrpChange={setRrpDraft}
            onRrpBlur={() => void saveRrp()}
            onToggleLocation={externalId => void toggleLocation(externalId)}
          />
        </div>
      </aside>
    </>,
    document.body,
  );
}
