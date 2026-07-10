import { useEffect, useMemo, useState } from 'react';
import { FilePlus2, X } from 'lucide-react';
import { api } from '../../api';
import { inputCls } from '../../data/componentForm';
import {
  DELIVERY_ORDER_UNITS,
  DELIVERY_UNIT_LEVEL_LABELS,
  downloadVendorProductTemplateCsv,
  formatDeliveryUnitDetailPath,
  type DeliveryUnitBreakdown,
  type VendorProductCatalogItem,
} from '../../data/vendorProductCatalog';
import {
  DETAIL_PANEL_OVERLAY_ELEVATED_CLS,
  DETAIL_PANEL_SHELL_ELEVATED_CLS,
  SIDE_PANEL_OVERLAY_CLS,
  SIDE_PANEL_SHELL_CLS,
} from '../layout/sidePanelShared';

type CompanyLocationOption = {
  externalId: string;
  name: string;
};

type Props = {
  product: VendorProductCatalogItem;
  isNew?: boolean;
  selectedCompanyId?: number | null;
  selectedLocationIds?: string[];
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

export function VendorProductDetailPanel({
  product,
  isNew = false,
  selectedCompanyId = null,
  selectedLocationIds = [],
  elevated = false,
  onClose,
  onSave,
}: Props) {
  const [productName, setProductName] = useState(product.productName);
  const [group, setGroup] = useState(product.group);
  const [specification, setSpecification] = useState(product.specification);
  const [deliveryPrice, setDeliveryPrice] = useState(String(product.deliveryPrice));
  const [delivery, setDelivery] = useState<DeliveryUnitBreakdown>({ ...product.delivery });
  const [isPrivate, setIsPrivate] = useState(Boolean(product.isPrivate));
  const [privateLocationIds, setPrivateLocationIds] = useState<string[]>(product.privateLocationIds ?? []);
  const [companyLocations, setCompanyLocations] = useState<CompanyLocationOption[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setProductName(product.productName);
    setGroup(product.group);
    setSpecification(product.specification);
    setDeliveryPrice(String(product.deliveryPrice));
    setDelivery({ ...product.delivery });
    setIsPrivate(Boolean(product.isPrivate));
    setPrivateLocationIds(product.privateLocationIds ?? []);
    setSaveError(null);
  }, [product]);

  useEffect(() => {
    if (!selectedCompanyId) {
      setCompanyLocations([]);
      return;
    }
    api.locationsConfig()
      .then(locations => {
        setCompanyLocations(
          locations
            .filter(location => location.companyId === selectedCompanyId)
            .map(location => ({ externalId: location.externalId, name: location.name }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
      })
      .catch(() => setCompanyLocations([]));
  }, [selectedCompanyId]);

  const detailPath = useMemo(() => formatDeliveryUnitDetailPath(delivery), [delivery]);

  const scopedLocations = useMemo(() => {
    if (selectedLocationIds.length === 0) return companyLocations;
    return companyLocations.filter(location => selectedLocationIds.includes(location.externalId));
  }, [companyLocations, selectedLocationIds]);

  function patchDelivery(patch: Partial<DeliveryUnitBreakdown>) {
    setDelivery(prev => ({ ...prev, ...patch }));
  }

  function togglePrivateLocation(externalId: string) {
    setPrivateLocationIds(prev => (
      prev.includes(externalId)
        ? prev.filter(id => id !== externalId)
        : [...prev, externalId]
    ));
  }

  function handlePrivateChange(checked: boolean) {
    setIsPrivate(checked);
    if (checked && privateLocationIds.length === 0 && selectedLocationIds.length > 0) {
      setPrivateLocationIds([...selectedLocationIds]);
    }
  }

  function handleSave() {
    const name = productName.trim();
    const price = parseFloat(deliveryPrice);
    if (!name) {
      setSaveError('Vendor product name is required.');
      return;
    }
    if (!group.trim()) {
      setSaveError('Group is required.');
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setSaveError('Enter a valid delivery price.');
      return;
    }
    if (isPrivate && privateLocationIds.length === 0) {
      setSaveError('Assign at least one location for a private vendor product.');
      return;
    }
    if (!delivery.orderUnit.trim() || !(delivery.orderQty > 0)) {
      setSaveError('Order UOM and quantity are required for Delivery Unit.');
      return;
    }
    setSaveError(null);
    onSave({
      ...product,
      productName: name,
      group: group.trim(),
      specification: specification.trim(),
      deliveryPrice: price,
      delivery: { ...delivery },
      isPrivate,
      privateLocationIds: isPrivate ? [...privateLocationIds] : [],
    });
  }

  function downloadTemplateCsv() {
    downloadVendorProductTemplateCsv();
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
            <h3 className="text-sm font-semibold text-foreground mt-0.5 truncate">
              {isNew ? 'New Vendor Product' : product.productName}
            </h3>
            <p className="text-xs text-muted-foreground font-sans mt-0.5">
              {isNew ? product.vendorName : `${product.id} · ${product.vendorName}`}
            </p>
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
              placeholder="e.g. Wagyu Striploin A5"
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Group">
              <input
                value={group}
                onChange={e => setGroup(e.target.value)}
                className={inputCls}
                placeholder="e.g. Proteins"
              />
            </Field>
            <Field label="Product Specification">
              <input
                value={specification}
                onChange={e => setSpecification(e.target.value)}
                className={inputCls}
                placeholder="Optional specification"
              />
            </Field>
          </div>

          <div className="space-y-3">
            <Field label="Delivery Unit">
              <p className="text-sm font-sans font-medium text-foreground bg-muted/40 border border-border rounded-md px-3 py-2">
                {detailPath}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Define Order UOM (required). Add Primary and Secondary Packaging when the order breaks into smaller packs.
                Result must convert to your component Principal / Inventory UOM.
              </p>
            </Field>

            <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
              <p className="text-xs font-sans uppercase tracking-widest text-muted-foreground">Breakdown</p>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground w-36 shrink-0">{DELIVERY_UNIT_LEVEL_LABELS.order}</span>
                {qtyInput(delivery.orderQty, orderQty => patchDelivery({ orderQty }))}
                {unitInput(delivery.orderUnit, DELIVERY_ORDER_UNITS, orderUnit => patchDelivery({ orderUnit }), 'vp-order-units')}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground w-36 shrink-0">{DELIVERY_UNIT_LEVEL_LABELS.primary}</span>
                {qtyInput(delivery.packQty, packQty => patchDelivery({ packQty }))}
                {unitInput(delivery.packUnit, DELIVERY_ORDER_UNITS, packUnit => patchDelivery({ packUnit }), 'vp-pack-units')}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground w-36 shrink-0">{DELIVERY_UNIT_LEVEL_LABELS.secondary}</span>
                {qtyInput(delivery.unitQty, unitQty => patchDelivery({ unitQty }))}
                {unitInput(delivery.unitUnit, DELIVERY_ORDER_UNITS, unitUnit => patchDelivery({ unitUnit }), 'vp-unit-units')}
              </div>
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

          <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={e => handlePrivateChange(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
              />
              <span>
                <span className="text-sm font-medium text-foreground">Private</span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Only visible to assigned locations. Other companies or locations that engage this vendor will not see this product.
                </p>
              </span>
            </label>

            {isPrivate && (
              <div className="space-y-2 pt-1">
                <p className="text-xs font-sans uppercase tracking-wider text-muted-foreground">Assigned Locations</p>
                {scopedLocations.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Select a company and location in the header filter to assign visibility.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {scopedLocations.map(location => {
                      const checked = privateLocationIds.includes(location.externalId);
                      return (
                        <label
                          key={location.externalId}
                          className={`flex items-center gap-2.5 px-2 py-2 rounded-md cursor-pointer transition-colors ${checked ? 'bg-primary/10' : 'hover:bg-muted/50'}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePrivateLocation(location.externalId)}
                            className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                          />
                          <span className="text-xs text-foreground">{location.name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
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
                {isNew ? 'Add Product' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
