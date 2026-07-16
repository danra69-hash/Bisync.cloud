import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, ExternalLink, ShoppingBag, X } from 'lucide-react';
import { api, type B2bCustomer, type B2bSalesOrder, type Company, type LocationConfig } from '../../api';
import { buildSalesOrderPdfData, type SalesOrderCartLine } from '../../data/buildSalesOrderPdfData';
import { getPurchaseDocumentLabels } from '../../data/purchaseOrderSignatories';
import {
  buildSalesOrderShareUrl,
  buildSalesOrderWhatsAppUrl,
  copySalesOrderShareLink,
} from '../../data/salesOrderShare';
import {
  canIssueSalesOrderWithoutApproval,
  parseUserAccess,
} from '../../data/userAccess';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { PurchaseOrderPdfPreview } from './PurchaseOrderPdfPreview';
import { MillstoneLoader } from '../shared/MillstoneLoader';

type Props = {
  companyId: number;
  customer: B2bCustomer;
  lines: SalesOrderCartLine[];
  locationExternalId: string;
  lockPeriodDays: number;
  onClose: () => void;
  onSubmitted: (order: B2bSalesOrder, issued: boolean) => void;
};

type Step = 'review' | 'success';

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-MY', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function SalesOrderCartModal({
  companyId,
  customer,
  lines,
  locationExternalId,
  lockPeriodDays,
  onClose,
  onSubmitted,
}: Props) {
  const { rm } = useCountryFormatters();
  const { currentUser, loading: userLoading } = useCurrentUser();
  const [company, setCompany] = useState<Company | null>(null);
  const [locations, setLocations] = useState<LocationConfig[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('review');
  const [createdOrder, setCreatedOrder] = useState<B2bSalesOrder | null>(null);
  const [issued, setIssued] = useState(false);
  const [issueWarning, setIssueWarning] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const access = useMemo(
    () => (currentUser ? parseUserAccess(currentUser.accessJson) : null),
    [currentUser],
  );
  const canIssue = Boolean(access && canIssueSalesOrderWithoutApproval(access));
  const labels = getPurchaseDocumentLabels('sales_order');
  const initiatedBy = currentUser?.fullName?.trim() || 'Unknown User';
  const approvedBy = canIssue ? initiatedBy : 'Pending';

  const productionLocation = useMemo(
    () => locations.find(l => l.externalId === locationExternalId) ?? null,
    [locations, locationExternalId],
  );

  const grandTotal = useMemo(
    () => lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0),
    [lines],
  );

  const previewPdf = useMemo(() => {
    if (!company) return null;
    return buildSalesOrderPdfData({
      soNumber: createdOrder?.orderNumber ?? 'SO-DRAFT',
      company,
      customer,
      productionLocation,
      lines,
      orderDateLabel: formatDisplayDate(new Date()),
      deliveryDateLabel: '—',
      initiatedBy,
      approvedBy,
    });
  }, [company, createdOrder, customer, productionLocation, lines, initiatedBy, approvedBy]);

  useEffect(() => {
    Promise.all([api.companies(), api.locationsConfig()])
      .then(([companies, locs]) => {
        setCompany(companies.find(c => c.id === companyId) ?? null);
        setLocations(locs.filter(l => l.companyId === companyId));
      })
      .catch(() => {
        setCompany(null);
        setLocations([]);
      });
  }, [companyId]);

  async function handleSubmit() {
    setError(null);
    setIssueWarning(null);
    if (lines.length === 0) {
      setError('Add at least one product with quantity.');
      return;
    }
    if (!locationExternalId) {
      setError('Select a production location.');
      return;
    }

    setSaving(true);
    try {
      let order = await api.createB2bSalesOrder({
        companyId,
        customerExternalId: customer.externalId,
        customerName: customer.companyName,
        source: 'sales_order',
        lockPeriodDays,
        lines: lines.map(line => ({
          productId: line.productId,
          productAliasId: line.productAliasId,
          locationExternalId: line.locationExternalId || locationExternalId,
          quantityOrdered: line.quantity,
          uom: line.deliveryUom,
          rrp: line.unitPrice,
        })),
      });

      let didIssue = false;
      if (canIssue) {
        try {
          order = await api.issueB2bSalesOrder(order.id);
          didIssue = order.status === 'issued';
        } catch (err) {
          setIssueWarning(err instanceof Error ? err.message : 'Could not issue sales order automatically.');
        }
      }

      if (!order.shareToken?.trim()) {
        try {
          order = await api.ensureB2bSalesOrderShareToken(order.id);
        } catch {
          // Share buttons stay disabled if token missing.
        }
      }

      setCreatedOrder(order);
      setIssued(didIssue);
      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.errorCreate);
    } finally {
      setSaving(false);
    }
  }

  function handleDone() {
    if (createdOrder) onSubmitted(createdOrder, issued);
    onClose();
  }

  async function handleCopy() {
    const token = createdOrder?.shareToken?.trim();
    if (!token) return;
    try {
      await copySalesOrderShareLink(token);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Failed to copy link.');
    }
  }

  if (typeof document === 'undefined') return null;

  const shareToken = createdOrder?.shareToken?.trim() ?? '';
  const showShare = step === 'success' && canIssue && Boolean(shareToken);

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/40"
      onClick={saving ? undefined : onClose}
      role="presentation"
    >
      <div
        className={`w-full bg-card border border-border rounded-xl shadow-xl max-h-[92vh] flex flex-col overflow-hidden ${
          step === 'success' ? 'max-w-5xl' : 'max-w-3xl'
        }`}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Sales order cart"
      >
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0 flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-700/10 text-emerald-700 flex items-center justify-center shrink-0">
              <ShoppingBag size={18} />
            </div>
            <div>
              <p className="text-xs font-sans text-muted-foreground uppercase tracking-widest">Shopping Cart</p>
              <h3 className="text-sm font-semibold text-foreground mt-0.5">
                {step === 'success' ? labels.successTitle : labels.confirmTitle}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {step === 'success'
                  ? (createdOrder
                    ? `${createdOrder.orderNumber} · ${issued ? 'Issued' : 'Pending approval'}`
                    : labels.savedMessage)
                  : `${lines.length} product${lines.length !== 1 ? 's' : ''} · ${customer.companyName}`}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="p-1 rounded-md hover:bg-muted transition-colors shrink-0 disabled:opacity-50">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
          ) : null}
          {issueWarning ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{issueWarning}</p>
          ) : null}

          {step === 'review' ? (
            <>
              <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-sans uppercase tracking-wider text-muted-foreground">Initiated by</p>
                  <p className="mt-1.5 text-xs font-medium text-foreground">
                    {userLoading ? <MillstoneLoader size="xs" layout="inline" label="" /> : initiatedBy}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-sans uppercase tracking-wider text-muted-foreground">Approved by</p>
                  <p className="mt-1.5 text-xs font-medium text-foreground">
                    {userLoading ? <MillstoneLoader size="xs" layout="inline" label="" /> : approvedBy}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {canIssue
                      ? 'You can issue sales orders without approval'
                      : 'No issue permission — order will go to Sales Order for approval'}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/30">
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 text-left font-semibold">Product</th>
                      <th className="px-3 py-2 text-left font-semibold">Delivery UOM</th>
                      <th className="px-3 py-2 text-right font-semibold">QTY</th>
                      <th className="px-3 py-2 text-right font-semibold">Unit Price</th>
                      <th className="px-3 py-2 text-right font-semibold">Sub-total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map(line => (
                      <tr key={line.key} className="border-b border-border/60">
                        <td className="px-3 py-2 font-medium">{line.productName}</td>
                        <td className="px-3 py-2 text-muted-foreground">{line.deliveryUom}</td>
                        <td className="px-3 py-2 text-right">{line.quantity}</td>
                        <td className="px-3 py-2 text-right">{rm(line.unitPrice)}</td>
                        <td className="px-3 py-2 text-right font-semibold">{rm(line.quantity * line.unitPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/20">
                      <td colSpan={4} className="px-3 py-2 text-right font-semibold">Total</td>
                      <td className="px-3 py-2 text-right font-bold">{rm(grandTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {previewPdf ? (
                <PurchaseOrderPdfPreview pdf={previewPdf} className="min-h-[420px] h-[55vh]" />
              ) : null}
            </>
          ) : (
            <>
              <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  {canIssue
                    ? (issued
                      ? 'Sales order issued. Share the customer link below.'
                      : 'Sales order saved. Share is available; issue may still need stock or a follow-up.')
                    : 'Sales order placed in Sales Order for approval.'}
                </p>
                {createdOrder && shareToken ? (
                  <p className="text-xs text-muted-foreground mt-1 truncate" title={buildSalesOrderShareUrl(shareToken)}>
                    {buildSalesOrderShareUrl(shareToken)}
                  </p>
                ) : null}
              </div>

              {previewPdf ? (
                <PurchaseOrderPdfPreview pdf={previewPdf} className="min-h-[420px] h-[55vh]" />
              ) : null}
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border flex flex-wrap justify-end gap-2 shrink-0">
          {step === 'review' ? (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-3 py-1.5 rounded-md text-xs font-bold border border-border hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={saving || userLoading}
                className="px-3 py-1.5 rounded-md text-xs font-bold bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                {saving ? labels.submittingButton : labels.submitButton}
              </button>
            </>
          ) : (
            <>
              {showShare ? (
                <>
                  <button
                    type="button"
                    onClick={() => void handleCopy()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border border-border hover:bg-muted"
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    {copied ? 'Copied' : 'Copy link'}
                  </button>
                  <a
                    href={buildSalesOrderWhatsAppUrl(
                      shareToken,
                      createdOrder?.orderNumber ?? '',
                      customer.companyName,
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-[#25D366] text-white hover:bg-[#1ebe57]"
                  >
                    <ExternalLink size={12} />
                    WhatsApp
                  </a>
                </>
              ) : null}
              <button
                type="button"
                onClick={handleDone}
                className="px-3 py-1.5 rounded-md text-xs font-bold bg-primary text-primary-foreground"
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
