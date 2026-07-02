import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Paperclip, Plus, X } from 'lucide-react';
import { api, type CashPurchase, type Vendor } from '../../api';
import {
  componentMatchesLocations,
  formatRm,
  resolveLowestEngagedTaggedVendorPrice,
  unitPriceInPrincipalUom,
} from '../../data/createOrder';
import { refreshVendorProductPricesFromApi } from '../../data/vendorProductPrices';
import { fromApiUom } from '../../data/componentForm';
import { ingredientToRow } from './smartIngredientShared';
import { pageShellClass } from '../layout/pageLayout';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { InfiniteScrollDivSentinel } from '../shared/infiniteScroll';

type Props = {
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
};

function toDateInputValue(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isCurrentMonth(datePurchased: string) {
  const [year, month] = datePurchased.split('-').map(Number);
  const now = new Date();
  return year === now.getFullYear() && month === now.getMonth() + 1;
}

function formatPurchaseDate(datePurchased: string) {
  const [year, month, day] = datePurchased.split('-').map(Number);
  if (!year || !month || !day) return datePurchased;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
}

function unitPriceForPurchase(purchase: CashPurchase) {
  if (!purchase.quantity) return 0;
  return purchase.deliveryPrice / purchase.quantity;
}

type PurchasePriceReference = {
  unitPrice: number;
  uom: string;
  label: string;
  source: 'prior' | 'vendor';
};

function resolvePurchasePriceReference(
  component: ReturnType<typeof ingredientToRow> | undefined,
  previousPurchase: CashPurchase | undefined,
  vendorReference: ReturnType<typeof resolveLowestEngagedTaggedVendorPrice>,
): PurchasePriceReference | null {
  if (!component) return null;
  const principalUom = fromApiUom(component.recipeUOM);

  if (previousPurchase) {
    const priorUnitPrice = unitPriceInPrincipalUom(
      previousPurchase.deliveryPrice,
      previousPurchase.quantity,
      previousPurchase.componentUom,
      component,
    );
    if (priorUnitPrice !== null) {
      return {
        unitPrice: priorUnitPrice,
        uom: principalUom,
        label: 'Last purchase',
        source: 'prior',
      };
    }
  }

  if (vendorReference) {
    return {
      unitPrice: vendorReference.unitPrice,
      uom: vendorReference.principalUom,
      label: `Vendor (${vendorReference.vendorName})`,
      source: 'vendor',
    };
  }

  return null;
}

function filterCashPurchasesByOrg(
  purchases: CashPurchase[],
  companyId: number | null,
  selectedLocationIds: string[],
) {
  if (!companyId || selectedLocationIds.length === 0) return [];
  const selected = new Set(selectedLocationIds);
  return purchases.filter(purchase => {
    if (purchase.companyId != null && purchase.companyId !== companyId) return false;
    const purchaseLocs = purchase.locationExternalIds ?? [];
    if (purchaseLocs.length === 0) return true;
    return purchaseLocs.some(loc => selected.has(loc));
  });
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error('Failed to read receipt file.'));
    reader.readAsDataURL(file);
  });
}

const fieldCls =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary';
const labelCls = 'text-xs font-medium text-foreground';

export function CashPurchasePage({ selectedCompanyId, selectedLocationIds }: Props) {
  const orgReady = Boolean(selectedCompanyId) && selectedLocationIds.length > 0;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [datePurchased, setDatePurchased] = useState(() => toDateInputValue(new Date()));
  const [storeName, setStoreName] = useState('');
  const [componentId, setComponentId] = useState('');
  const [storeProductName, setStoreProductName] = useState('');
  const [deliveryUnit, setDeliveryUnit] = useState('');
  const [deliveryPrice, setDeliveryPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [componentUom, setComponentUom] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const lastComponentIdRef = useRef('');

  const [components, setComponents] = useState<ReturnType<typeof ingredientToRow>[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [cashPurchases, setCashPurchases] = useState<CashPurchase[]>([]);
  const [vendorPricesTick, setVendorPricesTick] = useState(0);

  const loadHistory = useCallback(() => {
    if (!selectedCompanyId) {
      setCashPurchases([]);
      return;
    }
    setHistoryLoading(true);
    Promise.all([
      api.cashPurchases(selectedCompanyId),
      refreshVendorProductPricesFromApi(),
    ])
      .then(([purchases]) => {
        setCashPurchases(purchases);
        setVendorPricesTick(tick => tick + 1);
      })
      .catch(() => setCashPurchases([]))
      .finally(() => setHistoryLoading(false));
  }, [selectedCompanyId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory, selectedLocationIds]);

  const monthHistory = useMemo(() => {
    const scoped = filterCashPurchasesByOrg(cashPurchases, selectedCompanyId, selectedLocationIds)
      .filter(purchase => isCurrentMonth(purchase.datePurchased))
      .sort((a, b) => b.datePurchased.localeCompare(a.datePurchased) || b.id - a.id);
    const monthTotal = scoped.reduce((sum, purchase) => sum + purchase.deliveryPrice, 0);
    return { rows: scoped, monthTotal };
  }, [cashPurchases, selectedCompanyId, selectedLocationIds]);

  const historyScrollRef = useRef<HTMLDivElement>(null);
  const {
    visibleItems: pagedHistoryRows,
    hasMore: historyHasMore,
    sentinelRef: historySentinelRef,
    totalCount: historyTotalCount,
    visibleCount: historyVisibleCount,
  } = useInfiniteScrollSlice(monthHistory.rows, { scrollRootRef: historyScrollRef });

  const previousPriceByPurchaseId = useMemo(() => {
    const scoped = filterCashPurchasesByOrg(cashPurchases, selectedCompanyId, selectedLocationIds)
      .sort((a, b) => a.datePurchased.localeCompare(b.datePurchased) || a.id - b.id);
    const lastByVendorAndComponent = new Map<string, CashPurchase>();
    const previousById = new Map<number, CashPurchase>();

    for (const purchase of scoped) {
      const key = `${purchase.storeName.toLowerCase()}::${purchase.componentId.toLowerCase()}::${purchase.componentUom.toLowerCase()}`;
      const previous = lastByVendorAndComponent.get(key);
      if (previous) previousById.set(purchase.id, previous);
      lastByVendorAndComponent.set(key, purchase);
    }

    return previousById;
  }, [cashPurchases, selectedCompanyId, selectedLocationIds]);

  const monthLabel = useMemo(
    () => new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    [],
  );

  const vendorReferenceByComponentId = useMemo(() => {
    const map = new Map<string, ReturnType<typeof resolveLowestEngagedTaggedVendorPrice>>();
    if (!orgReady) return map;

    for (const component of components) {
      if (!component.active) continue;
      const reference = resolveLowestEngagedTaggedVendorPrice(
        component,
        selectedLocationIds,
        vendors,
      );
      if (reference) map.set(component.componentId, reference);
    }

    return map;
  }, [components, orgReady, selectedLocationIds, vendors, vendorPricesTick]);

  useEffect(() => {
    if (!selectedCompanyId) {
      setVendors([]);
      return;
    }
    api.vendors()
      .then(setVendors)
      .catch(() => setVendors([]));
  }, [selectedCompanyId]);

  useEffect(() => {
    if (!orgReady) {
      setComponents([]);
      return;
    }
    setLoading(true);
    api.ingredients()
      .then(data => setComponents(data.map(ingredientToRow)))
      .catch(() => setComponents([]))
      .finally(() => setLoading(false));
  }, [orgReady, selectedCompanyId, selectedLocationIds]);

  const availableComponents = useMemo(
    () => components
      .filter(c => c.active && componentMatchesLocations(c, selectedLocationIds))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [components, selectedLocationIds],
  );

  const selectedComponent = useMemo(
    () => availableComponents.find(c => c.componentId === componentId) ?? null,
    [availableComponents, componentId],
  );

  const uomOptions = useMemo(() => {
    if (!selectedComponent) return [];
    const options = [selectedComponent.inventoryUOM, selectedComponent.recipeUOM]
      .map(u => u.trim())
      .filter(Boolean);
    return [...new Set(options)];
  }, [selectedComponent]);

  useEffect(() => {
    if (!selectedComponent) {
      setComponentUom('');
      setDeliveryUnit('');
      lastComponentIdRef.current = '';
      return;
    }

    setComponentUom(prev => {
      if (prev && uomOptions.includes(prev)) return prev;
      return selectedComponent.inventoryUOM || selectedComponent.recipeUOM || '';
    });

    if (lastComponentIdRef.current !== selectedComponent.componentId) {
      setDeliveryUnit(selectedComponent.inventoryUOM || selectedComponent.recipeUOM || '');
      lastComponentIdRef.current = selectedComponent.componentId;
    }
  }, [selectedComponent, uomOptions]);

  const lineTotal = useMemo(() => {
    const price = parseFloat(deliveryPrice) || 0;
    return price;
  }, [deliveryPrice]);

  function resetForm() {
    setDatePurchased(toDateInputValue(new Date()));
    setStoreName('');
    setComponentId('');
    setStoreProductName('');
    setDeliveryUnit('');
    setDeliveryPrice('');
    setQuantity('');
    setComponentUom('');
    setReceiptNumber('');
    setReceiptFile(null);
    setError(null);
    setSuccess(null);
    lastComponentIdRef.current = '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgReady || !selectedCompanyId) {
      setError('Select a company and at least one location in the header.');
      return;
    }
    if (!selectedComponent) {
      setError('Select a component.');
      return;
    }

    const qty = parseFloat(quantity);
    const price = parseFloat(deliveryPrice);
    if (!storeName.trim()) {
      setError('Store name is required.');
      return;
    }
    if (!storeProductName.trim()) {
      setError('Store product name is required.');
      return;
    }
    if (!deliveryUnit.trim()) {
      setError('Delivery unit is required.');
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('Quantity must be greater than zero.');
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setError('Delivery price is required.');
      return;
    }
    if (!componentUom.trim()) {
      setError('Component UOM is required.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      let receiptFileBase64: string | undefined;
      if (receiptFile) {
        receiptFileBase64 = await readFileAsBase64(receiptFile);
      }

      const result = await api.createCashPurchase({
        datePurchased,
        storeName: storeName.trim(),
        componentId: selectedComponent.componentId,
        componentName: selectedComponent.name,
        storeProductName: storeProductName.trim(),
        deliveryUnit: deliveryUnit.trim(),
        deliveryPrice: price,
        quantity: qty,
        componentUom: componentUom.trim(),
        receiptNumber: receiptNumber.trim() || undefined,
        receiptFileName: receiptFile?.name,
        receiptFileBase64,
        companyId: selectedCompanyId,
        locationExternalIds: selectedLocationIds,
      });

      setSuccess(
        `Added ${result.inventoryPurchase.quantity} ${result.inventoryPurchase.uom} of ${result.inventoryPurchase.componentName} to inventory (${formatRm(result.inventoryPurchase.unitPrice)} per ${result.inventoryPurchase.uom}).`,
      );
      resetForm();
      loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save cash purchase.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={pageShellClass()}>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_26rem] gap-4 items-stretch">
        <div className="space-y-4 min-h-0">
          <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Create a new cash purchase entry</p>
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-md border border-border bg-card text-xs font-semibold hover:bg-muted"
            >
              <Plus size={14} />
              New
            </button>
          </div>

          {!orgReady ? (
            <p className="text-xs text-muted-foreground border border-dashed border-border rounded-lg px-4 py-10 text-center">
              Select a company and at least one location in the header to record a cash purchase.
            </p>
          ) : loading ? (
            <p className="text-xs text-muted-foreground">Loading components…</p>
          ) : (
            <form onSubmit={e => void handleSubmit(e)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={labelCls} htmlFor="cash-date">Date purchased</label>
              <input
                id="cash-date"
                type="date"
                value={datePurchased}
                onChange={e => setDatePurchased(e.target.value)}
                className={fieldCls}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className={labelCls} htmlFor="cash-receipt">Receipt number</label>
              <input
                id="cash-receipt"
                type="text"
                value={receiptNumber}
                onChange={e => setReceiptNumber(e.target.value)}
                placeholder="Optional"
                className={fieldCls}
              />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 space-y-1.5">
            <label className={labelCls} htmlFor="cash-store">Store name</label>
            <input
              id="cash-store"
              type="text"
              value={storeName}
              onChange={e => setStoreName(e.target.value)}
              placeholder="e.g. Village Grocer, Tesco, local market"
              className={fieldCls}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className={labelCls} htmlFor="cash-component">Component</label>
            <select
              id="cash-component"
              value={componentId}
              onChange={e => setComponentId(e.target.value)}
              className={fieldCls}
              required
            >
              <option value="">Select component…</option>
              {availableComponents.map(component => (
                <option key={component.componentId} value={component.componentId}>
                  {component.name} ({component.componentId})
                </option>
              ))}
            </select>
            {availableComponents.length === 0 && (
              <p className="text-[10px] text-muted-foreground">No active components for the selected locations.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className={labelCls} htmlFor="cash-product">Store product name</label>
            <input
              id="cash-product"
              type="text"
              value={storeProductName}
              onChange={e => setStoreProductName(e.target.value)}
              placeholder="Product name as shown on receipt or shelf"
              className={fieldCls}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={labelCls} htmlFor="cash-delivery-unit">Delivery unit</label>
              <input
                id="cash-delivery-unit"
                type="text"
                value={deliveryUnit}
                onChange={e => setDeliveryUnit(e.target.value)}
                placeholder="e.g. Tub/kg, bag, bottle"
                className={fieldCls}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className={labelCls} htmlFor="cash-delivery-price">Delivery price (RM)</label>
              <input
                id="cash-delivery-price"
                type="number"
                min="0"
                step="0.01"
                value={deliveryPrice}
                onChange={e => setDeliveryPrice(e.target.value)}
                placeholder="0.00"
                className={fieldCls}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className={labelCls} htmlFor="cash-qty">Qty</label>
              <input
                id="cash-qty"
                type="number"
                min="0"
                step="any"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                placeholder="0"
                className={fieldCls}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className={labelCls} htmlFor="cash-uom">Component UOM</label>
              {uomOptions.length > 0 ? (
                <select
                  id="cash-uom"
                  value={componentUom}
                  onChange={e => setComponentUom(e.target.value)}
                  className={fieldCls}
                  required
                >
                  {uomOptions.map(uom => (
                    <option key={uom} value={uom}>{uom}</option>
                  ))}
                </select>
              ) : (
                <input
                  id="cash-uom"
                  type="text"
                  value={componentUom}
                  onChange={e => setComponentUom(e.target.value)}
                  placeholder="Inventory UOM"
                  className={fieldCls}
                  required
                />
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border px-4 py-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className={labelCls}>Attach receipt</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Select an image or PDF from your computer</p>
              </div>
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-muted cursor-pointer">
                <Paperclip size={12} />
                Choose file
                <input
                  type="file"
                  accept="image/*,.pdf,application/pdf"
                  className="hidden"
                  onChange={e => setReceiptFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
            {receiptFile && (
              <div className="flex items-center justify-between gap-2 text-xs bg-muted/40 rounded-md px-3 py-2">
                <span className="truncate">{receiptFile.name}</span>
                <button
                  type="button"
                  onClick={() => setReceiptFile(null)}
                  className="p-1 rounded hover:bg-muted text-muted-foreground"
                  aria-label="Remove receipt"
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Line total: <span className="font-sans font-medium text-foreground">{formatRm(lineTotal)}</span>
            </p>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
            >
              <Check size={14} />
              {saving ? 'Saving…' : 'Add to inventory'}
            </button>
          </div>

          {success && (
            <div className="rounded-lg border border-[#5A7A2A]/30 bg-[#5A7A2A]/10 px-3 py-2 text-xs text-[#5A7A2A]">
              {success}
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-400">
              {error}
            </div>
          )}
            </form>
          )}
        </div>

        <aside className="rounded-lg border border-border bg-card overflow-hidden flex flex-col min-h-[28rem] lg:min-h-0 lg:h-full">
          <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-center justify-between gap-2 shrink-0">
            <p className="text-sm font-semibold">Purchase history (This month)</p>
            <span className="text-[10px] font-sans text-muted-foreground">{monthLabel}</span>
          </div>
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between gap-3 text-xs shrink-0">
            <span className="text-muted-foreground">
              {monthHistory.rows.length} purchase{monthHistory.rows.length === 1 ? '' : 's'}
            </span>
            <span className="font-sans font-medium">{formatRm(monthHistory.monthTotal)}</span>
          </div>
          <div className="flex-1 min-h-0 flex flex-col">
            <div ref={historyScrollRef} className="flex-1 min-h-0 overflow-y-auto divide-y divide-border">
              {!orgReady ? (
                <div className="h-full min-h-[12rem] flex items-center justify-center px-4 py-6">
                  <p className="text-xs text-muted-foreground text-center">
                    Select company and locations to view history.
                  </p>
                </div>
              ) : historyLoading ? (
                <div className="h-full min-h-[12rem] flex items-center justify-center px-4 py-6">
                  <p className="text-xs text-muted-foreground text-center">Loading history…</p>
                </div>
              ) : monthHistory.rows.length === 0 ? (
                <div className="h-full min-h-[12rem] flex items-center justify-center px-4 py-6">
                  <p className="text-xs text-muted-foreground text-center">
                    No cash purchases recorded this month.
                  </p>
                </div>
              ) : (
                <>
                {pagedHistoryRows.map(purchase => {
                  const component = components.find(row => row.componentId === purchase.componentId);
                  const previous = previousPriceByPurchaseId.get(purchase.id);
                  const vendorReference = component
                    ? vendorReferenceByComponentId.get(component.componentId) ?? null
                    : null;
                  const reference = resolvePurchasePriceReference(
                    component,
                    previous,
                    vendorReference,
                  );
                  const currentUnitPrice = component
                    ? unitPriceInPrincipalUom(
                      purchase.deliveryPrice,
                      purchase.quantity,
                      purchase.componentUom,
                      component,
                    )
                    : unitPriceForPurchase(purchase);
                  const principalUom = component
                    ? fromApiUom(component.recipeUOM)
                    : purchase.componentUom;
                  const delta = reference && currentUnitPrice !== null
                    ? currentUnitPrice - reference.unitPrice
                    : 0;
                  const isUp = delta > 0.0001;
                  const isDown = delta < -0.0001;

                  return (
                    <div key={purchase.id} className="px-4 py-3 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{purchase.componentName}</p>
                          <p className="text-muted-foreground truncate">{purchase.storeName}</p>
                          {purchase.storeProductName && (
                            <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                              {purchase.storeProductName}
                            </p>
                          )}
                        </div>
                        <span className="font-sans font-medium shrink-0">{formatRm(purchase.deliveryPrice)}</span>
                      </div>
                      <p className="text-muted-foreground mt-1">
                        {formatPurchaseDate(purchase.datePurchased)} · {purchase.quantity} {purchase.componentUom}
                      </p>
                      <div className="mt-2 rounded-md border border-border bg-muted/20 px-2.5 py-2 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-muted-foreground">
                          {currentUnitPrice !== null
                            ? `Unit: ${formatRm(currentUnitPrice)} / ${principalUom}`
                            : `Unit: ${formatRm(unitPriceForPurchase(purchase))} / ${purchase.componentUom}`}
                        </span>
                        {reference ? (
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                              isUp ? 'text-red-600 dark:text-red-400' : isDown ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'
                            }`}
                          >
                            {isUp && <ArrowUp size={12} />}
                            {isDown && <ArrowDown size={12} />}
                            {!isUp && !isDown && '→'}
                            {reference.label}: {formatRm(reference.unitPrice)}
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">No price benchmark</span>
                        )}
                      </div>
                    </div>
                  );
                })}
                <InfiniteScrollDivSentinel
                  hasMore={historyHasMore}
                  sentinelRef={historySentinelRef}
                  totalCount={historyTotalCount}
                  visibleCount={historyVisibleCount}
                />
                </>
              )}
            </div>

          </div>
        </aside>
      </div>
    </div>
  );
}
