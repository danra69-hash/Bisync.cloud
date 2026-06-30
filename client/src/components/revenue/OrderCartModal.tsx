import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ShoppingBag, X } from 'lucide-react';
import { api, type Company, type LocationConfig } from '../../api';
import {
  formatRm,
  groupCartByVendor,
  type OrderCartItem,
  type OrderCartVendorGroup,
} from '../../data/createOrder';
import { downloadCombinedPurchaseOrderPdfs, downloadPurchaseOrderPdf, type PurchaseOrderPdfData } from '../../data/generatePurchaseOrderPdf';

type Props = {
  items: OrderCartItem[];
  selectedCompanyId: number;
  selectedLocationIds: string[];
  onClose: () => void;
  onConfirmed: (clearedLineKeys: string[]) => void;
};

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-MY', { year: 'numeric', month: 'short', day: 'numeric' });
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function defaultDeliveryDateValue(): string {
  const date = new Date();
  date.setDate(date.getDate() + 3);
  return toDateInputValue(date);
}

function parseDateInputValue(value: string): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

export function OrderCartModal({
  items,
  selectedCompanyId,
  selectedLocationIds,
  onClose,
  onConfirmed,
}: Props) {
  const [company, setCompany] = useState<Company | null>(null);
  const [locations, setLocations] = useState<LocationConfig[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deliveryDateValue, setDeliveryDateValue] = useState(defaultDeliveryDateValue);
  const [confirmedPdfs, setConfirmedPdfs] = useState<PurchaseOrderPdfData[]>([]);

  const minDeliveryDate = useMemo(() => toDateInputValue(new Date()), []);

  const groups = useMemo(() => groupCartByVendor(items), [items]);
  const grandTotal = useMemo(
    () => groups.reduce((sum, group) => sum + group.subtotal, 0),
    [groups],
  );

  const locationNames = useMemo(
    () => locations
      .filter(loc => selectedLocationIds.includes(loc.externalId))
      .map(loc => loc.name),
    [locations, selectedLocationIds],
  );

  useEffect(() => {
    Promise.all([api.companies(), api.locationsConfig()])
      .then(([companies, configLocations]) => {
        setCompany(companies.find(c => c.id === selectedCompanyId) ?? null);
        setLocations(configLocations.filter(l => l.companyId === selectedCompanyId));
      })
      .catch(() => {
        setCompany(null);
        setLocations([]);
      });
  }, [selectedCompanyId]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, saving]);

  async function handleConfirm() {
    if (groups.length === 0) return;

    const deliveryDate = parseDateInputValue(deliveryDateValue);
    if (!deliveryDate) {
      setError('Select a valid preferred delivery date.');
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (deliveryDate < today) {
      setError('Preferred delivery date cannot be in the past.');
      return;
    }

    setSaving(true);
    setError(null);

    const orderDate = new Date();
    const orderDateStr = toDateInputValue(orderDate);
    const deliveryDateStr = deliveryDateValue;

    try {
      const created = await api.createPurchaseOrders(
        groups.map(group => ({
          vendorName: group.vendorName,
          orderDate: orderDateStr,
          deliveryDate: deliveryDateStr,
          status: 'Pending',
          items: group.items.map(item => ({
            name: item.productName,
            quantity: item.quantity,
            unitPrice: item.deliveryPrice,
            unit: item.deliveryUnitLabel,
            deliveryPackage: item.deliveryUnitLabel,
          })),
        })),
      );

      if (!Array.isArray(created) || created.length === 0) {
        throw new Error('Purchase orders were not created.');
      }

      const pdfPayloads: PurchaseOrderPdfData[] = created.map(po => {
        const group = groups.find(g => g.vendorName === po.vendorName);
        if (!group) {
          throw new Error(`Could not match created PO to vendor: ${po.vendorName}`);
        }
        return {
          poNumber: po.poNumber,
          vendorName: po.vendorName,
          companyName: company?.name ?? 'Company',
          locationNames,
          orderDate: formatDisplayDate(orderDate),
          deliveryDate: formatDisplayDate(deliveryDate),
          items: group.items.map(item => ({
            name: item.productName,
            quantity: item.quantity,
            unit: item.deliveryUnitLabel,
            deliveryPackage: item.deliveryUnitLabel,
            unitPrice: item.deliveryPrice,
            lineTotal: item.lineTotal,
          })),
          subtotal: group.subtotal,
        };
      });

      try {
        if (navigator.userActivation?.isActive) {
          downloadCombinedPurchaseOrderPdfs(pdfPayloads);
          onConfirmed(items.map(item => item.lineKey));
          onClose();
        } else {
          setConfirmedPdfs(pdfPayloads);
          onConfirmed(items.map(item => item.lineKey));
          setError(null);
        }
      } catch (pdfErr) {
        console.error('PDF download failed:', pdfErr);
        setConfirmedPdfs(pdfPayloads);
        onConfirmed(items.map(item => item.lineKey));
        setError('POs were created. Use the download buttons below for PDFs.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create purchase orders.');
    } finally {
      setSaving(false);
    }
  }

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/40"
      onClick={saving ? undefined : onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-3xl bg-card border border-border rounded-xl shadow-xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Order cart"
      >
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0 flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <ShoppingBag size={18} />
            </div>
            <div>
              <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">My Carte</p>
              <h3 className="text-sm font-semibold text-foreground mt-0.5">Confirm Purchase Orders</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {groups.length} vendor{groups.length !== 1 ? 's' : ''} · {items.length} item{items.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="p-1 rounded-md hover:bg-muted transition-colors shrink-0 disabled:opacity-50">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
          <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
            <label htmlFor="preferred-delivery-date" className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              <Calendar size={13} />
              Preferred Delivery Date
            </label>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <input
                id="preferred-delivery-date"
                type="date"
                value={deliveryDateValue}
                min={minDeliveryDate}
                onChange={e => {
                  setDeliveryDateValue(e.target.value);
                  setError(null);
                }}
                disabled={saving}
                className="px-3 py-2 text-xs rounded-md border border-border bg-card focus:outline-none focus:ring-1 focus:ring-primary font-mono disabled:opacity-50"
              />
              {parseDateInputValue(deliveryDateValue) && (
                <p className="text-[10px] text-muted-foreground">
                  Deliver on {formatDisplayDate(parseDateInputValue(deliveryDateValue)!)}
                </p>
              )}
            </div>
          </div>

          {confirmedPdfs.length > 0 && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 space-y-2">
              <p className="text-[10px] font-mono uppercase tracking-wider text-primary">Purchase orders created</p>
              <p className="text-[10px] text-muted-foreground">
                {confirmedPdfs.length === 1
                  ? 'Click below to download your purchase order PDF.'
                  : 'Click below to download each PO PDF, or download all in one combined file.'}
              </p>
              <div className="flex flex-wrap gap-2">
                {confirmedPdfs.map(pdf => (
                  <button
                    key={pdf.poNumber}
                    type="button"
                    onClick={() => downloadPurchaseOrderPdf(pdf)}
                    className="text-[10px] font-mono px-2.5 py-1.5 rounded border border-primary/40 text-primary hover:bg-primary/10"
                  >
                    Download {pdf.poNumber}
                  </button>
                ))}
                {confirmedPdfs.length > 1 && (
                  <button
                    type="button"
                    onClick={() => downloadCombinedPurchaseOrderPdfs(confirmedPdfs)}
                    className="text-[10px] font-mono px-2.5 py-1.5 rounded bg-primary text-primary-foreground"
                  >
                    Download all PDFs
                  </button>
                )}
              </div>
            </div>
          )}

          {groups.map(group => (
            <VendorGroupCard key={group.vendorExternalId} group={group} />
          ))}
        </div>

        <div className="px-5 py-4 border-t border-border shrink-0 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-mono text-muted-foreground uppercase text-[10px] tracking-wider">Grand Total</span>
            <span className="font-mono font-semibold text-foreground">{formatRm(grandTotal)}</span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Confirming will create {groups.length} purchase order{groups.length !== 1 ? 's' : ''} and download a PDF for each vendor.
          </p>
          {error && <p className="text-[10px] text-red-500 text-right">{error}</p>}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="text-xs font-mono text-muted-foreground border border-border rounded-md px-4 py-2 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={saving || groups.length === 0 || !deliveryDateValue || confirmedPdfs.length > 0}
              className="text-xs font-mono bg-primary text-primary-foreground rounded-md px-4 py-2 disabled:opacity-50"
            >
              {saving ? 'Creating POs…' : confirmedPdfs.length > 0 ? 'POs Created' : 'Confirm & Download PDFs'}
            </button>
            {confirmedPdfs.length > 0 && (
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-mono border border-border rounded-md px-4 py-2"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function VendorGroupCard({ group }: { group: OrderCartVendorGroup }) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-foreground">{group.vendorName}</p>
          <p className="text-[10px] text-muted-foreground font-mono">{group.vendorExternalId}</p>
        </div>
        <p className="text-xs font-mono font-semibold text-foreground">{formatRm(group.subtotal)}</p>
      </div>
      <div className="divide-y divide-border">
        {group.items.map(item => (
          <div key={item.lineKey} className="px-4 py-3 flex items-start justify-between gap-4 text-xs">
            <div className="min-w-0">
              <p className="font-medium text-foreground">{item.productName}</p>
              <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                {item.componentName} · {item.componentId}
              </p>
              <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{item.deliveryUnitLabel}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-mono text-foreground">× {item.quantity}</p>
              <p className="font-mono text-muted-foreground mt-0.5">{formatRm(item.deliveryPrice)} ea</p>
              <p className="font-mono font-semibold text-foreground mt-1">{formatRm(item.lineTotal)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
