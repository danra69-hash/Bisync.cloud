import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, Download, ExternalLink, ShoppingBag, X } from 'lucide-react';
import { api, type Company, type LocationConfig, type Vendor } from '../../api';
import {
  formatRm,
  groupCartByVendor,
  type OrderCartItem,
  type OrderCartVendorGroup,
} from '../../data/createOrder';
import { buildPurchaseOrderPdfData, findVendorForGroup } from '../../data/buildPurchaseOrderPdfData';
import { resolvePurchaseDocumentLabels, resolvePurchaseOrderSignatories } from '../../data/purchaseOrderSignatories';
import { useCurrentUser } from '../../context/CurrentUserContext';
import {
  downloadCombinedPurchaseOrderPdfs,
  downloadPurchaseOrderPdf,
  openPurchaseOrderPdfInTab,
  type PurchaseOrderPdfData,
} from '../../data/generatePurchaseOrderPdf';

type Props = {
  items: OrderCartItem[];
  selectedCompanyId: number;
  selectedLocationIds: string[];
  onClose: () => void;
  onConfirmed: (clearedLineKeys: string[]) => void;
};

type Step = 'review' | 'success';

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
  const { currentUser, loading: userLoading } = useCurrentUser();
  const [company, setCompany] = useState<Company | null>(null);
  const [locations, setLocations] = useState<LocationConfig[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [saving, setSaving] = useState(false);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deliveryDateValue, setDeliveryDateValue] = useState(defaultDeliveryDateValue);
  const [step, setStep] = useState<Step>('review');
  const [createdPdfs, setCreatedPdfs] = useState<PurchaseOrderPdfData[]>([]);

  const minDeliveryDate = useMemo(() => toDateInputValue(new Date()), []);

  const groups = useMemo(() => groupCartByVendor(items), [items]);
  const grandTotal = useMemo(
    () => groups.reduce((sum, group) => sum + group.subtotal, 0),
    [groups],
  );

  const signatories = useMemo(
    () => (currentUser ? resolvePurchaseOrderSignatories(currentUser) : null),
    [currentUser],
  );

  const documentLabels = useMemo(
    () => (currentUser ? resolvePurchaseDocumentLabels(currentUser) : null),
    [currentUser],
  );

  const deliveryLocations = useMemo(
    () => locations.filter(loc => selectedLocationIds.includes(loc.externalId)),
    [locations, selectedLocationIds],
  );

  useEffect(() => {
    Promise.all([api.companies(), api.locationsConfig(), api.vendors(true)])
      .then(([companies, configLocations, engagedVendors]) => {
        setCompany(companies.find(c => c.id === selectedCompanyId) ?? null);
        setLocations(configLocations.filter(l => l.companyId === selectedCompanyId));
        setVendors(engagedVendors);
      })
      .catch(() => {
        setCompany(null);
        setLocations([]);
        setVendors([]);
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

    if (!signatories) {
      setError('No logged-in user found. Open the sidebar to select your account.');
      return;
    }

    if (!company) {
      setError(`Company details are required to create ${documentLabels?.title.toLowerCase() ?? 'orders'}.`);
      return;
    }

    const orderStatus = signatories.canSelfApprove ? 'Pending' : 'Pending Approval';

    setSaving(true);
    setError(null);

    const orderDate = new Date();
    const orderDateStr = toDateInputValue(orderDate);
    const deliveryDateStr = deliveryDateValue;

    try {
      const created = await api.createPurchaseOrders({
        companyId: selectedCompanyId,
        locationExternalIds: selectedLocationIds,
        initiatedBy: signatories.initiatedBy,
        approvedBy: signatories.approvedBy,
        orders: groups.map(group => ({
          vendorName: group.vendorName,
          orderDate: orderDateStr,
          deliveryDate: deliveryDateStr,
          status: orderStatus,
          items: group.items.map(item => ({
            name: item.productName,
            quantity: item.quantity,
            unitPrice: item.deliveryPrice,
            unit: item.deliveryUnitLabel,
            deliveryPackage: item.deliveryUnitLabel,
          })),
        })),
      });

      if (!Array.isArray(created) || created.length === 0) {
        throw new Error(documentLabels?.errorCreate ?? 'Failed to save documents.');
      }

      const orderDateLabel = formatDisplayDate(orderDate);
      const deliveryDateLabel = formatDisplayDate(deliveryDate);

      const pdfPayloads: PurchaseOrderPdfData[] = created.map(po => {
        const group = groups.find(g => g.vendorName === po.vendorName);
        if (!group) {
          throw new Error(`Could not match created PO to vendor: ${po.vendorName}`);
        }
        return buildPurchaseOrderPdfData({
          poNumber: po.poNumber,
          group,
          company,
          deliveryLocations,
          vendor: findVendorForGroup(vendors, group),
          orderDateLabel,
          deliveryDateLabel,
          initiatedBy: signatories.initiatedBy,
          approvedBy: signatories.approvedBy,
          documentKind: signatories.documentKind,
        });
      });

      setCreatedPdfs(pdfPayloads);
      setStep('success');
      onConfirmed(items.map(item => item.lineKey));
    } catch (err) {
      setError(err instanceof Error ? err.message : (documentLabels?.errorCreate ?? 'Failed to save documents.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadSingle(pdf: PurchaseOrderPdfData) {
    setDownloadingKey(pdf.poNumber);
    setError(null);
    try {
      await downloadPurchaseOrderPdf(pdf);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate PDF.');
    } finally {
      setDownloadingKey(null);
    }
  }

  async function handleDownloadCombined() {
    setDownloadingKey('combined');
    setError(null);
    try {
      await downloadCombinedPurchaseOrderPdfs(createdPdfs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate combined PDF.');
    } finally {
      setDownloadingKey(null);
    }
  }

  async function handleOpenInTab(pdf: PurchaseOrderPdfData) {
    setDownloadingKey(`open-${pdf.poNumber}`);
    setError(null);
    try {
      await openPurchaseOrderPdfInTab(pdf);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open PDF.');
    } finally {
      setDownloadingKey(null);
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
              <p className="text-xs font-sans text-muted-foreground uppercase tracking-widest">My Carte</p>
              <h3 className="text-sm font-semibold text-foreground mt-0.5">
                {step === 'success'
                  ? (documentLabels?.successTitle ?? 'Documents Created')
                  : (documentLabels?.confirmTitle ?? 'Confirm Purchase Orders')}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {step === 'success'
                  ? (documentLabels?.successSubtitle(createdPdfs.length) ?? `${createdPdfs.length} saved`)
                  : `${groups.length} vendor${groups.length !== 1 ? 's' : ''} · ${items.length} item${items.length !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="p-1 rounded-md hover:bg-muted transition-colors shrink-0 disabled:opacity-50">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
          {step === 'review' ? (
            <>
              <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 space-y-3">
                <div>
                  <label htmlFor="preferred-delivery-date" className="flex items-center gap-2 text-xs font-sans uppercase tracking-wider text-muted-foreground">
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
                      className="px-3 py-2 text-xs rounded-md border border-border bg-card focus:outline-none focus:ring-1 focus:ring-primary font-sans disabled:opacity-50"
                    />
                    {parseDateInputValue(deliveryDateValue) && (
                      <p className="text-xs text-muted-foreground">
                        Deliver on {formatDisplayDate(parseDateInputValue(deliveryDateValue)!)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-border/60">
                  <div>
                    <p className="text-xs font-sans uppercase tracking-wider text-muted-foreground">
                      Initiated by
                    </p>
                    <p className="mt-1.5 text-xs font-medium text-foreground">
                      {userLoading ? 'Loading…' : signatories?.initiatedBy ?? '—'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Current logged-in user</p>
                  </div>
                  <div>
                    <p className="text-xs font-sans uppercase tracking-wider text-muted-foreground">
                      Approved by
                    </p>
                    <p className="mt-1.5 text-xs font-medium text-foreground">
                      {userLoading ? 'Loading…' : signatories?.approvedBy ?? '—'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {signatories?.canSelfApprove
                        ? 'You have Approve Order permission'
                        : 'Pending — requires Approve Order permission'}
                    </p>
                  </div>
                </div>
              </div>

              {groups.map(group => (
                <VendorGroupCard key={group.vendorExternalId} group={group} />
              ))}
            </>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
                <p className="text-xs font-semibold text-foreground">{documentLabels?.savedMessage ?? 'Documents saved'}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Click download for each vendor PDF. Your browser requires a click to save files.
                </p>
              </div>

              {createdPdfs.map(pdf => (
                <div key={pdf.poNumber} className="border border-border rounded-lg px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground">
                      {documentLabels?.numberLabel} {pdf.poNumber}
                    </p>
                    <p className="text-xs text-muted-foreground font-sans">{pdf.vendor.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Delivery {pdf.deliveryDate} · {formatRm(pdf.totalAmount)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => void handleOpenInTab(pdf)}
                      disabled={downloadingKey !== null}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-border text-xs font-sans hover:bg-muted disabled:opacity-50"
                      title="Open PDF in new tab"
                    >
                      <ExternalLink size={11} />
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDownloadSingle(pdf)}
                      disabled={downloadingKey !== null}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-primary text-primary-foreground text-xs font-sans disabled:opacity-50"
                    >
                      <Download size={11} />
                      {downloadingKey === pdf.poNumber ? 'Generating…' : 'Download PDF'}
                    </button>
                  </div>
                </div>
              ))}

              {createdPdfs.length > 1 && (
                <button
                  type="button"
                  onClick={() => void handleDownloadCombined()}
                  disabled={downloadingKey !== null}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md border border-primary text-primary text-xs font-sans hover:bg-primary/10 disabled:opacity-50"
                >
                  <Download size={13} />
                  {downloadingKey === 'combined'
                    ? `Generating combined PDF…`
                    : `Download all ${documentLabels?.title ?? 'documents'} in one PDF`}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border shrink-0 space-y-3">
          {step === 'review' && (
            <div className="flex items-center justify-between text-sm">
              <span className="font-sans text-muted-foreground uppercase text-xs tracking-wider">Grand Total</span>
              <span className="font-sans font-semibold text-foreground">{formatRm(grandTotal)}</span>
            </div>
          )}
          {error && <p className="text-xs text-red-500 text-right">{error}</p>}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="text-xs font-sans text-muted-foreground border border-border rounded-md px-4 py-2 disabled:opacity-50"
            >
              {step === 'success' ? 'Done' : 'Cancel'}
            </button>
            {step === 'review' && (
              <button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={saving || groups.length === 0 || !deliveryDateValue || userLoading || !signatories}
                className="text-xs font-sans bg-primary text-primary-foreground rounded-md px-4 py-2 disabled:opacity-50"
              >
                {saving
                  ? (documentLabels?.submittingButton ?? 'Saving…')
                  : (documentLabels?.submitButton ?? 'Confirm & Create POs')}
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
          <p className="text-xs text-muted-foreground font-sans">{group.vendorExternalId}</p>
        </div>
        <p className="text-xs font-sans font-semibold text-foreground">{formatRm(group.subtotal)}</p>
      </div>
      <div className="divide-y divide-border">
        {group.items.map(item => (
          <div key={item.lineKey} className="px-4 py-3 flex items-start justify-between gap-4 text-xs">
            <div className="min-w-0">
              <p className="font-medium text-foreground">{item.productName}</p>
              <p className="text-xs text-muted-foreground font-sans mt-0.5">
                {item.componentName} · {item.componentId}
              </p>
              <p className="text-xs text-muted-foreground font-sans mt-0.5">{item.deliveryUnitLabel}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-sans text-foreground">× {item.quantity}</p>
              <p className="font-sans text-muted-foreground mt-0.5">{formatRm(item.deliveryPrice)} ea</p>
              <p className="font-sans font-semibold text-foreground mt-1">{formatRm(item.lineTotal)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
