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
  serializeYieldAltUnits,
} from '../../data/productBatchUom';
import { serializeProductParStockUom } from '../../data/productParStock';
import { configLocationToDropdown } from '../../utils/orgFilters';
import {
  MODAL_OVERLAY_CLS,
  MODAL_SHELL_CLS,
} from '../layout/sidePanelShared';
import { createOverlayCloseHandlers } from './modalOverlayClose';
import {
  createDefaultBatchAdditionalEntry,
} from './SubProductBatchUomSection';
import { clampSubProductAltUnits } from './SubProductBatchProduceFields';
import { ProductReadOnlyView } from './ProductReadOnlyView';
import { ProductionMethodModal } from './ProductionMethodModal';
import { ProductsPage } from './ProductsPage';
import { productKeyFromParts } from '../../data/productProductionMethod';

const addBtnCls =
  'shrink-0 inline-flex items-center justify-center h-[34px] w-[34px] rounded-md border border-border bg-background hover:bg-muted/40 text-muted-foreground disabled:opacity-50';

type Props = {
  product: Product;
  companyId: number | null;
  selectedLocationIds?: string[];
  onClose: () => void;
  onUpdated?: (product: Product) => void;
};

export function ProductDetailPanel({
  product,
  companyId,
  selectedLocationIds = [],
  onClose,
  onUpdated,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
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
    setIsEditing(false);
    setError(null);
  }, [product.id]);

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
      const loadedAlt = refreshBatchAdditionalUoms(
        loadYieldAltUnitsFromProduct(product.yieldAltUnitsJson, initialBatchUom),
        initialBatchQty,
        initialBatchUom,
      );
      setYieldAltUnits(product.isSubProduct ? clampSubProductAltUnits(loadedAlt) : loadedAlt);
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
    const nextEntries = product.isSubProduct ? clampSubProductAltUnits(yieldAltUnits) : yieldAltUnits;
    const nextAlt = product.isSubProduct
      ? serializeYieldAltUnits(nextEntries)
      : normalizedYieldAltUnitsFromEntries(
        nextEntries,
        batchQtyForAdditional,
        batchUomForAdditional,
      );
    const compareServer = product.isSubProduct
      ? serializeYieldAltUnits(clampSubProductAltUnits(
        loadYieldAltUnitsFromProduct(product.yieldAltUnitsJson, batchUomForAdditional),
      ))
      : serverAlt;
    const altChanged = supportsBatchAdditionalUom && nextAlt !== compareServer;
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
        const refreshed = refreshBatchAdditionalUoms(
          entries,
          updated.yieldQuantity,
          updatedYieldUom,
        );
        setYieldAltUnits(updated.isSubProduct ? clampSubProductAltUnits(refreshed) : refreshed);
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
      const nextEntries = product.isSubProduct ? clampSubProductAltUnits(yieldAltUnits) : yieldAltUnits;
      const nextAlt = product.isSubProduct
        ? serializeYieldAltUnits(nextEntries)
        : normalizedYieldAltUnitsFromEntries(
          nextEntries,
          batchQtyForAdditional,
          batchUomForAdditional,
        );
      const serverAlt = product.isSubProduct
        ? serializeYieldAltUnits(clampSubProductAltUnits(
          loadYieldAltUnitsFromProduct(product.yieldAltUnitsJson, batchUomForAdditional),
        ))
        : normalizedYieldAltUnitsJson(
          product.yieldAltUnitsJson,
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
    // Return to the list behind the popup; list state stays mounted/unreset.
    if (saved) onClose();
  }

  function handleYieldAltUnitsChange(entries: AltUnitEntry[]) {
    setYieldAltUnits(product.isSubProduct ? clampSubProductAltUnits(entries) : entries);
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

  function handleDialogClose() {
    if (saving) return;
    if (isEditing) {
      setIsEditing(false);
      return;
    }
    onClose();
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || saving) return;
      if (isEditing) {
        setIsEditing(false);
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isEditing, saving, onClose]);

  const overlayClose = createOverlayCloseHandlers(handleDialogClose);

  return createPortal(
    <>
      <div
        className={MODAL_OVERLAY_CLS}
        onPointerDown={overlayClose.onPointerDown}
        onClick={overlayClose.onClick}
        role="presentation"
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEditing ? `Edit product: ${product.name}` : `Product details: ${product.name}`}
        className={`${MODAL_SHELL_CLS} ${
          isEditing ? 'w-[min(98vw,1100px)]' : 'w-[min(96vw,920px)]'
        } max-h-[94vh] bg-card border border-border rounded-lg shadow-xl flex flex-col overflow-hidden`}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <p className="text-xs font-sans uppercase tracking-widest text-muted-foreground">
              {isEditing ? 'Edit product' : 'Product details'}
            </p>
            <h2 className="text-base font-semibold mt-1 truncate">{product.name}</h2>
            <p className="text-[11px] text-muted-foreground mt-1 font-mono">{product.productId}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => void saveAll()}
                  disabled={saving || !hasUnsavedChanges}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                {companyId ? (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-semibold hover:bg-muted/50 disabled:opacity-50"
                  >
                    <Pencil size={12} />
                    Edit
                  </button>
                ) : null}
              </>
            ) : null}
            <button
              type="button"
              onClick={handleDialogClose}
              disabled={saving}
              className="p-2 rounded-md hover:bg-muted text-muted-foreground disabled:opacity-50"
              aria-label={isEditing ? 'Cancel edit' : 'Close product detail'}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {isEditing && companyId ? (
            <ProductsPage
              embedded
              popupMode
              selectedCompanyId={companyId}
              selectedLocationIds={selectedLocationIds}
              editorRequest={{ mode: 'edit', id: product.id }}
              onClose={() => setIsEditing(false)}
              onSaved={saved => {
                onUpdated?.(saved);
                setIsEditing(false);
                onClose();
              }}
            />
          ) : (
            <>
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
                onAddBatchAdditionalUom={supportsBatchAdditionalUom && !product.isSubProduct ? addBatchAdditionalUom : undefined}
                addBatchUomButtonCls={addBtnCls}
                onToggleLocation={externalId => void toggleLocation(externalId)}
                onOpenProductionMethod={() => setProductionMethodOpen(true)}
              />
            </>
          )}
        </div>
      </div>

      {productionMethodOpen ? (
        <ProductionMethodModal
          category={product.category}
          group={product.group}
          productName={product.name}
          productKey={productKeyFromParts(product.id, product.productId)}
          productId={product.id}
          components={product.items ?? []}
          yieldQuantity={product.yieldQuantity || 1}
          onClose={() => setProductionMethodOpen(false)}
        />
      ) : null}
    </>,
    document.body,
  );
}
