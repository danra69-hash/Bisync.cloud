import { useEffect, useMemo, useState } from 'react';
import { FilePlus2, X } from 'lucide-react';
import { inputCls } from '../../data/componentForm';
import {
  DELIVERY_ORDER_UNITS,
  formatDeliveryUnitDetailPath,
  hasSmallestDeliveryBreakdown,
  resolveDeliveryUnitLevels,
  type DeliveryUnitBreakdown,
  type VendorProductCatalogItem,
} from '../../data/vendorProductCatalog';
import {
  DETAIL_PANEL_OVERLAY_ELEVATED_CLS,
  DETAIL_PANEL_SHELL_ELEVATED_CLS,
  SIDE_PANEL_OVERLAY_CLS,
  SIDE_PANEL_SHELL_CLS,
} from '../layout/sidePanelShared';

type Props = {
  product: VendorProductCatalogItem;
  elevated?: boolean;
  onClose: () => void;
  onSave: (product: VendorProductCatalogItem) => void;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

function qtyInput(value: number, onChange: (n: number) => void) {
  return (
    <input
      type="number"
      min={1}
      step={1}
      value={value}
      onChange={e => onChange(Math.max(1, parseInt(e.target.value, 10) || 1))}
      className={`${inputCls} w-20 font-sans`}
    />
  );
}

function unitInput(value: string, options: string[], onChange: (unit: string) => void, listId: string) {
  return (
    <>
      <input
        list={listId}
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`${inputCls} w-28 font-sans`}
      />
      <datalist id={listId}>
        {options.map(u => (
          <option key={u} value={u} />
        ))}
      </datalist>
    </>
  );
}

export function VendorProductDetailPanel({ product, elevated = false, onClose, onSave }: Props) {
  const [productName, setProductName] = useState(product.productName);
  const [deliveryPrice, setDeliveryPrice] = useState(String(product.deliveryPrice));
  const [delivery, setDelivery] = useState<DeliveryUnitBreakdown>({ ...product.delivery });
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setProductName(product.productName);
    setDeliveryPrice(String(product.deliveryPrice));
    setDelivery({ ...product.delivery });
    setSaveError(null);
  }, [product]);

  const detailPath = useMemo(() => formatDeliveryUnitDetailPath(delivery), [delivery]);
  const levels = useMemo(() => resolveDeliveryUnitLevels(delivery), [delivery]);
  const hasPackLevel = delivery.packUnit !== delivery.orderUnit || delivery.packQty !== 1;
  const needsSecondLevel = hasSmallestDeliveryBreakdown(delivery);

  function patchDelivery(patch: Partial<DeliveryUnitBreakdown>) {
    setDelivery(prev => ({ ...prev, ...patch }));
  }

  function handleSave() {
    const name = productName.trim();
    const price = parseFloat(deliveryPrice);
    if (!name) {
      setSaveError('Vendor product name is required.');
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setSaveError('Enter a valid delivery price.');
      return;
    }
    setSaveError(null);
    onSave({
      ...product,
      productName: name,
      deliveryPrice: price,
      delivery: { ...delivery },
    });
  }

  function downloadTemplateCsv() {
    const header = ['Product Name', 'Group', 'Specification', 'Delivery Unit', 'Price'];
    const sample = [
      ['Baked Beans', 'Dry Goods', 'Baked beans in tomato sauce, 400g tins', 'Box/12tin/400gr', '42.00'],
      ['Olive Oil Extra Virgin', 'Dry Goods', 'Cold pressed olive oil, 5L tin', 'Tin/5ltr', '165.00'],
      ['Fresh Orange Juice', 'Beverages', 'Cold-pressed orange juice, 2L bottle', 'Bottle/2ltr', '18.00'],
    ];
    const csv = [header, ...sample]
      .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'vendor-product-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  const overlayCls = elevated ? DETAIL_PANEL_OVERLAY_ELEVATED_CLS : SIDE_PANEL_OVERLAY_CLS;
  const shellCls = elevated ? DETAIL_PANEL_SHELL_ELEVATED_CLS : `${SIDE_PANEL_SHELL_CLS} overflow-hidden`;

  return (
    <>
      <div className={overlayCls} onClick={onClose} role="presentation" aria-hidden />
      <div className={shellCls} onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <p className="text-xs font-sans text-muted-foreground uppercase tracking-widest">Vendor Product</p>
            <h3 className="text-sm font-semibold text-foreground mt-0.5 truncate">{product.productName}</h3>
            <p className="text-xs text-muted-foreground font-sans mt-0.5">{product.id} · {product.vendorName}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors shrink-0">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto px-5 py-5 space-y-6">
          <Field label="Vendor Product Name">
            <input
              value={productName}
              onChange={e => setProductName(e.target.value)}
              className={inputCls}
            />
          </Field>

          <div className="space-y-3">
            <Field label="Delivery Unit">
              <p className="text-sm font-sans font-medium text-foreground bg-muted/40 border border-border rounded-md px-3 py-2">
                {detailPath}
              </p>
            </Field>

            <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
              <p className="text-xs font-sans uppercase tracking-widest text-muted-foreground">Breakdown</p>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground w-16 shrink-0">Order</span>
                {qtyInput(delivery.orderQty, orderQty => patchDelivery({ orderQty }))}
                {unitInput(delivery.orderUnit, DELIVERY_ORDER_UNITS, orderUnit => patchDelivery({ orderUnit }), 'vp-order-units')}
              </div>

              {(hasPackLevel || levels.firstBreakdown) && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground w-16 shrink-0">Pack</span>
                  {qtyInput(delivery.packQty, packQty => patchDelivery({ packQty }))}
                  {unitInput(delivery.packUnit, DELIVERY_ORDER_UNITS, packUnit => patchDelivery({ packUnit }), 'vp-pack-units')}
                </div>
              )}

              {needsSecondLevel && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground w-16 shrink-0">Unit</span>
                  {qtyInput(delivery.unitQty, unitQty => patchDelivery({ unitQty }))}
                  {unitInput(delivery.unitUnit, DELIVERY_ORDER_UNITS, unitUnit => patchDelivery({ unitUnit }), 'vp-unit-units')}
                </div>
              )}

            </div>
          </div>

          <Field label="Delivery Price">
            <div className="relative max-w-[200px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={deliveryPrice}
                onChange={e => setDeliveryPrice(e.target.value)}
                className={`${inputCls} pl-7 font-sans`}
              />
            </div>
          </Field>
        </div>

        <div className="px-5 py-4 border-t border-border shrink-0 space-y-3">
          {saveError && <p className="text-xs text-red-500 text-right">{saveError}</p>}
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={downloadTemplateCsv}
              className="inline-flex items-center gap-1.5 text-xs font-sans text-muted-foreground border border-border rounded-md px-3 py-2 hover:text-foreground transition-colors"
            >
              <FilePlus2 size={12} />
              Download Template CSV
            </button>
            <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-sans text-muted-foreground border border-border rounded-md px-4 py-2 hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!productName.trim()}
              className="text-xs font-sans bg-primary text-primary-foreground rounded-md px-4 py-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              Save
            </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
