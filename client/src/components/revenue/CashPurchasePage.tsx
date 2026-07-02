import { useEffect, useMemo, useState } from 'react';
import { Check, Paperclip, X } from 'lucide-react';
import { api } from '../../api';
import { componentMatchesLocations, formatRm } from '../../data/createOrder';
import { ingredientToRow } from './smartIngredientShared';

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

  const [components, setComponents] = useState<ReturnType<typeof ingredientToRow>[]>([]);

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
      return;
    }
    setComponentUom(prev => {
      if (prev && uomOptions.includes(prev)) return prev;
      return selectedComponent.inventoryUOM || selectedComponent.recipeUOM || '';
    });
    if (!deliveryUnit) {
      setDeliveryUnit(selectedComponent.inventoryUOM || selectedComponent.recipeUOM || '');
    }
  }, [selectedComponent, uomOptions, deliveryUnit]);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save cash purchase.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      <div>
        <p className="text-xs font-sans text-muted-foreground uppercase tracking-widest mb-1">Operation · Order</p>
        <h2 className="text-lg font-semibold">Cash Purchase</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Record a direct store purchase and add quantity and cost to inventory.
        </p>
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
  );
}
