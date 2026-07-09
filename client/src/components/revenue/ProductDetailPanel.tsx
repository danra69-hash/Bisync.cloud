import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, X } from 'lucide-react';
import { api, type PatchProductPayload, type Product } from '../../api';
import { fromApiUom, type AltUnitEntry } from '../../data/componentForm';
import {
  loadYieldAltUnitsFromProduct,
  normalizedYieldAltUnitsFromEntries,
  normalizedYieldAltUnitsJson,
  parseYieldAltUnitsJson,
  refreshBatchAdditionalUoms,
} from '../../data/productBatchUom';
import { serializeProductParStockUom } from '../../data/productParStock';
import { configLocationToDropdown } from '../../utils/orgFilters';
import {
  SIDE_PANEL_OVERLAY_CLS,
  SIDE_PANEL_SHELL_PRODUCT_DETAIL_CLS,
} from '../layout/sidePanelShared';
import {
  createDefaultBatchAdditionalEntry,
} from './SubProductBatchUomSection';

const addBtnCls =
  'shrink-0 inline-flex items-center justify-center h-[34px] w-[34px] rounded-md border border-border bg-background hover:bg-muted/40 text-muted-foreground disabled:opacity-50';
import { ProductReadOnlyView } from './ProductReadOnlyView';
import { ProductionMethodModal } from './ProductionMethodModal';
import { productKeyFromParts } from '../../data/productProductionMethod';

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
  const [parStockDraft, setParStockDraft] = useState(
    (product.parStock ?? 0) > 0 ? String(product.parStock) : '',
  );
  const [yieldAltUnits, setYieldAltUnits] = useState<AltUnitEntry[]>([]);
  const initializedProductIdRef = useRef<number | null>(null);
  const [locationIds, setLocationIds] = useState<string[]>(product.locationExternalIds ?? []);
  const [locations, setLocations] = useState<{ externalId: string; name: string }[]>([]);
  const [productionMethodOpen, setProductionMethodOpen] = useState(false);

  useEffect(() => {
    setRrpDraft(product.rrp > 0 ? String(product.rrp) : '');
    setParStockDraft((product.parStock ?? 0) > 0 ? String(product.parStock) : '');
    setLocationIds(product.locationExternalIds ?? []);

    if (initializedProductIdRef.current !== product.id) {
      initializedProductIdRef.current = product.id;
      const initialBatchUom = product.isSubProduct
        ? (product.yieldUom ? fromApiUom(product.yieldUom) : '')
        : (product.b2bPackageUnit?.trim() || '');
      const initialBatchQty = product.isSubProduct ? product.yieldQuantity : 1;
      setYieldAltUnits(refreshBatchAdditionalUoms(
        loadYieldAltUnitsFromProduct(product.yieldAltUnitsJson, initialBatchUom),
        initialBatchQty,
        initialBatchUom,
      ));
    }
  }, [product]);

  useEffect(() => {
    const currentBatchUom = product.isSubProduct
      ? (product.yieldUom ? fromApiUom(product.yieldUom) : '')
      : (product.b2bPackageUnit?.trim() || '');
    const currentBatchQty = product.isSubProduct ? product.yieldQuantity : 1;
    setYieldAltUnits(prev => refreshBatchAdditionalUoms(prev, currentBatchQty, currentBatchUom));
  }, [product.id, product.isSubProduct, product.b2bEnabled, product.yieldQuantity, product.yieldUom, product.b2bPackageUnit]);

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

  const loadedYieldUom = product.yieldUom ? fromApiUom(product.yieldUom) : '';
  const batchUomForAdditional = product.isSubProduct
    ? loadedYieldUom
    : (product.b2bPackageUnit?.trim() || '');
  const batchQtyForAdditional = product.isSubProduct ? product.yieldQuantity : 1;
  const supportsBatchAdditionalUom = product.isSubProduct || product.b2bEnabled;

  const hasUnsavedChanges = useMemo(() => {
    const rrpNext = rrpDraft.trim() === '' ? 0 : parseFloat(rrpDraft);
    const parNext = parStockDraft.trim() === '' ? 0 : parseFloat(parStockDraft);
    const rrpChanged = Number.isFinite(rrpNext) && rrpNext >= 0 && rrpNext !== product.rrp;
    const parChanged = Number.isFinite(parNext) && parNext >= 0 && parNext !== (product.parStock ?? 0);
    const serverAlt = normalizedYieldAltUnitsJson(
      product.yieldAltUnitsJson,
      batchQtyForAdditional,
      batchUomForAdditional,
    );
    const nextAlt = normalizedYieldAltUnitsFromEntries(
      yieldAltUnits,
      batchQtyForAdditional,
      batchUomForAdditional,
    );
    const altChanged = supportsBatchAdditionalUom && nextAlt !== serverAlt;
    return rrpChanged || parChanged || altChanged;
  }, [rrpDraft, parStockDraft, yieldAltUnits, product, batchUomForAdditional, batchQtyForAdditional, supportsBatchAdditionalUom]);

  async function patchProduct(payload: PatchProductPayload): Promise<boolean> {
    setSaving(true);
    setError(null);
    try {
      const updated = await api.patchProduct(product.id, payload);
      if (payload.yieldAltUnitsJson !== undefined) {
        const updatedYieldUom = updated.yieldUom ? fromApiUom(updated.yieldUom) : '';
        const fromServer = loadYieldAltUnitsFromProduct(updated.yieldAltUnitsJson, updatedYieldUom);
        const fallback = parseYieldAltUnitsJson(payload.yieldAltUnitsJson).map(entry => ({
          ...entry,
          unit: fromApiUom(entry.unit) || entry.unit,
        }));
        const entries = fromServer.length > 0 ? fromServer : fallback;
        setYieldAltUnits(refreshBatchAdditionalUoms(
          entries,
          updated.yieldQuantity,
          updatedYieldUom,
        ));
        onUpdated?.({
          ...updated,
          yieldAltUnitsJson: updated.yieldAltUnitsJson || payload.yieldAltUnitsJson,
        });
      } else {
        onUpdated?.(updated);
      }
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update product.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveAll() {
    const payload: PatchProductPayload = {};
    const rrpNext = rrpDraft.trim() === '' ? 0 : parseFloat(rrpDraft);
    if (!Number.isFinite(rrpNext) || rrpNext < 0) {
      setError('RRP must be zero or greater.');
      return;
    }
    if (rrpNext !== product.rrp) {
      payload.rrp = rrpNext;
    }

    const parNext = parStockDraft.trim() === '' ? 0 : parseFloat(parStockDraft);
    if (!Number.isFinite(parNext) || parNext < 0) {
      setError('Par stock must be zero or greater.');
      return;
    }
    if (parNext !== (product.parStock ?? 0)) {
      const yieldUom = product.yieldUom
        ? serializeProductParStockUom(fromApiUom(product.yieldUom))
        : product.parStockUom;
      payload.parStock = parNext;
      payload.parStockUom = parNext > 0 ? yieldUom : '';
    }

    if (supportsBatchAdditionalUom) {
      const serverAlt = normalizedYieldAltUnitsJson(
        product.yieldAltUnitsJson,
        batchQtyForAdditional,
        batchUomForAdditional,
      );
      const nextAlt = normalizedYieldAltUnitsFromEntries(
        yieldAltUnits,
        batchQtyForAdditional,
        batchUomForAdditional,
      );
      if (nextAlt !== serverAlt) {
        payload.yieldAltUnitsJson = nextAlt;
      }
    }

    if (Object.keys(payload).length === 0) {
      setError('No changes to save.');
      return;
    }
    setError(null);
    const saved = await patchProduct(payload);
    if (saved) onClose();
  }

  function handleYieldAltUnitsChange(entries: AltUnitEntry[]) {
    setYieldAltUnits(entries);
  }

  function addBatchAdditionalUom() {
    const currentBatchUom = product.isSubProduct
      ? (product.yieldUom ? fromApiUom(product.yieldUom) : '')
      : (product.b2bPackageUnit?.trim() || '');
    const next = createDefaultBatchAdditionalEntry(
      yieldAltUnits,
      product.isSubProduct && product.yieldQuantity > 0 ? String(product.yieldQuantity) : '1',
      currentBatchUom,
    );
    if (next.length === yieldAltUnits.length) return;
    setYieldAltUnits(next);
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
            <button
              type="button"
              onClick={() => void saveAll()}
              disabled={saving || !hasUnsavedChanges}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
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
            parStockDraft={parStockDraft}
            onParStockChange={setParStockDraft}
            yieldAltUnits={yieldAltUnits}
            onYieldAltUnitsChange={handleYieldAltUnitsChange}
            onAddBatchAdditionalUom={supportsBatchAdditionalUom ? addBatchAdditionalUom : undefined}
            addBatchUomButtonCls={addBtnCls}
            onToggleLocation={externalId => void toggleLocation(externalId)}
            onOpenProductionMethod={() => setProductionMethodOpen(true)}
          />
        </div>
      </aside>

      {productionMethodOpen ? (
        <ProductionMethodModal
          category={product.category}
          group={product.group}
          productName={product.name}
          productKey={productKeyFromParts(product.id, product.productId)}
          components={product.items ?? []}
          yieldQuantity={product.yieldQuantity || 1}
          onClose={() => setProductionMethodOpen(false)}
        />
      ) : null}
    </>,
    document.body,
  );
}
