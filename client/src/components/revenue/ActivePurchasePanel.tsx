import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { createPortal } from 'react-dom';
import { Check, Copy, PackageCheck, X } from 'lucide-react';
import { api, type PurchaseOrder, type PurchaseOrderLineWorkflowPayload } from '../../api';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';
import { orgRequiresHalalCertOnReceive } from '../../data/vendorPolicyRules';
import { useOrgVendorPolicy } from '../../hooks/useOrgVendorPolicy';
import { applyVendorProductPriceUpdates } from '../../data/vendorProductPrices';
import {
  canApprovePurchaseOrder,
  canReceivePurchaseOrder,
  parseUserAccess,
} from '../../data/userAccess';
import {
  DETAIL_PANEL_OVERLAY_ELEVATED_CLS,
  DETAIL_PANEL_SHELL_ELEVATED_CLS,
} from '../layout/sidePanelShared';
import {
  buildVendorOrderShareUrl,
  buildVendorOrderWhatsAppUrl,
  copyVendorOrderShareLink,
} from '../../data/vendorOrderShare';
import { isPurchaseOrderVendorAccepted, resolvePurchaseOrderStatusLabel } from '../../data/purchaseOrderStatus';

type Props = {
  order: PurchaseOrder;
  onClose: () => void;
  onUpdated: (order: PurchaseOrder) => void;
};

type EditableLine = {
  itemId: number;
  componentId: string;
  componentName: string;
  productName: string;
  /** Ordered qty (immutable on receive). */
  orderedQuantity: string;
  /** Received qty — defaults to ordered; user may adjust on receive/reconcile. */
  quantity: string;
  /** Ordered unit price (immutable on receive). */
  orderedUnitPrice: string;
  /** Received unit price — defaults to ordered; user may adjust on receive/reconcile. */
  unitPrice: string;
  taxAmount: string;
  issuedUnitPrice: number;
  componentUom: string;
  halalCertNo: string;
  productExpiryDate: string;
};

function buildEditableLines(order: PurchaseOrder, mode: 'approve' | 'receive' | 'reconcile' | 'view'): EditableLine[] {
  return order.items.map(item => {
    const issued = item.issuedUnitPrice ?? item.unitPrice;
    const orderedQty = item.quantity;
    const orderedPrice = item.unitPrice;
    // On receive/view/reconcile, quantity/unitPrice are the physical receipt values.
    const qty = mode === 'approve'
      ? orderedQty
      : (item.receivedQuantity ?? orderedQty);
    const price = mode === 'approve'
      ? orderedPrice
      : (item.receivedUnitPrice ?? orderedPrice);
    const tax = item.taxAmount ?? 0;

    return {
      itemId: item.id,
      componentId: item.componentId ?? '',
      componentName: item.componentName || item.name,
      productName: item.name,
      orderedQuantity: String(orderedQty),
      quantity: String(qty),
      orderedUnitPrice: String(orderedPrice),
      unitPrice: String(price),
      taxAmount: tax > 0 ? String(tax) : '',
      issuedUnitPrice: issued,
      componentUom: item.componentUom || item.unit,
      halalCertNo: item.halalCertNo ?? '',
      productExpiryDate: item.productExpiryDate?.trim() ?? '',
    };
  });
}

function linePayload(lines: EditableLine[]): PurchaseOrderLineWorkflowPayload[] {
  return lines.map(line => ({
    itemId: line.itemId,
    quantity: parseFloat(line.quantity) || 0,
    unitPrice: parseFloat(line.unitPrice) || 0,
    componentUom: line.componentUom,
    taxAmount: parseFloat(line.taxAmount) || 0,
    halalCertNo: line.halalCertNo.trim() || undefined,
    productExpiryDate: line.productExpiryDate.trim() || undefined,
  }));
}

export function ActivePurchasePanel({ order, onClose, onUpdated }: Props) {
  const { rm } = useCountryFormatters();
  const { currentUser } = useCurrentUser();
  const orgPolicyTags = useOrgVendorPolicy(order.companyId, order.locationExternalIds ?? []);
  const requiresHalalCert = orgRequiresHalalCertOnReceive(orgPolicyTags);
  const access = useMemo(
    () => (currentUser ? parseUserAccess(currentUser.accessJson) : null),
    [currentUser],
  );

  const isPendingApproval = order.status === 'Pending Approval' || order.canApprove === true;
  const isPurchaseRequest = order.documentType === 'PR' || isPendingApproval;
  const showVendorShareLink = !isPurchaseRequest;
  const approvalBlockedByServer = isPendingApproval && order.canApprove === false;

  const mode: 'approve' | 'receive' | 'reconcile' | 'view' = isPendingApproval
    ? 'approve'
    : order.canReceive
      ? 'receive'
      : order.canReconcile
        ? 'reconcile'
        : 'view';

  const vendorShareActionsLocked =
    mode === 'reconcile'
    || order.status === 'Received'
    || order.status === 'Reconciled'
    || Boolean(order.receivedAt)
    || Boolean(order.reconciledAt);
  const [lines, setLines] = useState(() => buildEditableLines(order, mode));
  const [vendorDoNumber, setVendorDoNumber] = useState(order.vendorDoNumber?.trim() ?? '');
  const [vendorInvoiceNumber, setVendorInvoiceNumber] = useState(order.vendorInvoiceNumber?.trim() ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareToken, setShareToken] = useState(order.vendorShareToken?.trim() ?? '');
  const [shareLinkCopied, setShareLinkCopied] = useState(false);

  useEffect(() => {
    setLines(buildEditableLines(order, mode));
    setVendorDoNumber(order.vendorDoNumber?.trim() ?? '');
    setVendorInvoiceNumber(order.vendorInvoiceNumber?.trim() ?? '');
    setError(null);
    setShareToken(order.vendorShareToken?.trim() ?? '');
    setShareLinkCopied(false);
  }, [order, mode]);

  useEffect(() => {
    if (!showVendorShareLink) {
      setShareToken('');
      return;
    }

    const existing = order.vendorShareToken?.trim() ?? '';
    if (existing) {
      setShareToken(existing);
      return;
    }

    let cancelled = false;
    void api.purchaseOrder(order.id)
      .then(updated => {
        if (cancelled) return;
        const token = updated.vendorShareToken?.trim() ?? '';
        setShareToken(token);
        if (token) onUpdated(updated);
      })
      .catch(() => {
        if (!cancelled) setShareToken('');
      });

    return () => { cancelled = true; };
  }, [order.id, order.vendorShareToken, onUpdated, showVendorShareLink]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, saving]);

  const canApprove = Boolean(access && canApprovePurchaseOrder(access) && isPendingApproval && !approvalBlockedByServer);
  const canReceive = Boolean(access && canReceivePurchaseOrder(access) && order.canReceive);
  const canReconcile = Boolean(access && (canReceivePurchaseOrder(access) || canApprovePurchaseOrder(access)) && order.canReconcile);
  const readOnly = mode === 'view' || (mode === 'approve' && !canApprove) || (mode === 'receive' && !canReceive) || (mode === 'reconcile' && !canReconcile);

  const totals = useMemo(() => {
    let subtotal = 0;
    let taxTotal = 0;
    for (const line of lines) {
      const qty = parseFloat(line.quantity) || 0;
      const price = parseFloat(line.unitPrice) || 0;
      const tax = parseFloat(line.taxAmount) || 0;
      subtotal += qty * price;
      taxTotal += tax;
    }
    return { subtotal, taxTotal, total: subtotal + taxTotal };
  }, [lines]);

  const showTaxColumn = !isPurchaseRequest && (mode === 'receive' || mode === 'reconcile' || mode === 'view');
  // Halal cert is optional — show when org is under a halal policy (or value already stored).
  const showHalalCertColumn = (requiresHalalCert || lines.some(line => line.halalCertNo.trim()))
    && (mode === 'receive' || mode === 'reconcile' || mode === 'view');
  const showExpiryColumn = mode === 'receive' || mode === 'reconcile' || mode === 'view';
  const showReceiveDocs = mode === 'receive' || mode === 'reconcile' || mode === 'view';
  /** Receive / reconcile / view: ordered vs received qty & price + variances. */
  const showOrderedReceivedColumns = mode === 'receive' || mode === 'reconcile' || mode === 'view';
  const canEditReceived = (mode === 'receive' || mode === 'reconcile') && !readOnly;
  const lineHeaders = [
    'Component',
    'Product',
    showOrderedReceivedColumns ? 'QTY Ordered' : 'Qty',
    showOrderedReceivedColumns ? 'QTY Received' : null,
    'UOM',
    mode === 'reconcile' ? 'Issued price' : null,
    showOrderedReceivedColumns ? 'Unit Price Ordered' : 'Unit price',
    showOrderedReceivedColumns ? 'Unit Price Received' : null,
    showOrderedReceivedColumns ? 'QTY Variance' : null,
    showOrderedReceivedColumns ? 'Unit Price Variance' : null,
    showTaxColumn ? 'Tax' : null,
    showHalalCertColumn ? 'Halal cert no.' : null,
    showExpiryColumn ? 'Expiry date' : null,
    'Line total',
  ].filter(Boolean) as string[];
  const lineColSpan = lineHeaders.length;


  const scrollRootRef = useRef<HTMLDivElement>(null);
  const {
    visibleItems: pagedLines,
    hasMore,
    sentinelRef,
    totalCount,
    visibleCount, nextPageSize, loadMore } = useInfiniteScrollSlice(lines, { scrollRootRef });

  function updateLine(itemId: number, patch: Partial<EditableLine>) {
    setLines(prev => prev.map(line => (line.itemId === itemId ? { ...line, ...patch } : line)));
  }

  async function handleCopyShareLink() {
    if (!shareToken || vendorShareActionsLocked) return;
    setError(null);
    try {
      await copyVendorOrderShareLink(shareToken);
      setShareLinkCopied(true);
      window.setTimeout(() => setShareLinkCopied(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to copy vendor link.');
    }
  }

  async function handleApprove() {
    if (!currentUser || !canApprove) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.approvePurchaseOrder(order.id, currentUser.fullName);
      onUpdated(updated);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to approve purchase request.';
      setError(
        approvalBlockedByServer || message.includes('Only pending purchase requests')
          ? 'Approval is blocked by an outdated API. Restart the API (dotnet run in src/Bisync.Api) or use the deployed site.'
          : message,
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleReceive() {
    if (!canReceive) return;
    const payload = linePayload(lines);
    if (payload.some(line => line.quantity <= 0)) {
      setError('Each line must have a quantity greater than zero.');
      return;
    }
    const doNumber = vendorDoNumber.trim();
    const invoiceNumber = vendorInvoiceNumber.trim();
    if (!doNumber && !invoiceNumber) {
      setError('Enter a Vendor DO number and/or Vendor Invoice number for the documents received.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await api.receivePurchaseOrder(order.id, {
        items: payload,
        vendorDoNumber: doNumber || undefined,
        vendorInvoiceNumber: invoiceNumber || undefined,
      });
      onUpdated(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to receive purchase order.');
    } finally {
      setSaving(false);
    }
  }

  async function handleReconcile() {
    if (!canReconcile) return;
    const payload = linePayload(lines);
    if (payload.some(line => line.quantity <= 0)) {
      setError('Each line must have a quantity greater than zero.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await api.reconcilePurchaseOrder(order.id, { items: payload });
      if (result.updatedVendorProductPrices.length > 0) {
        applyVendorProductPriceUpdates(result.updatedVendorProductPrices);
      }
      onUpdated(result.order);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reconcile purchase order.');
    } finally {
      setSaving(false);
    }
  }

  const title = mode === 'approve'
    ? 'Approve purchase request'
    : mode === 'receive'
      ? 'Receive purchase order'
      : mode === 'reconcile'
        ? 'Reconcile purchase order'
        : 'Purchase details';

  const subtitle = mode === 'approve'
    ? 'Approve to convert this PR into an open purchase order.'
    : mode === 'receive'
      ? 'Confirm quantities and prices received from the vendor before posting to stock.'
      : mode === 'reconcile'
        ? 'Final review — stock will be created in inventory after reconciliation.'
        : 'This purchase has no pending workflow action.';

  return createPortal(
    <>
      <div className={DETAIL_PANEL_OVERLAY_ELEVATED_CLS} onClick={() => !saving && onClose()} />
      <aside className={DETAIL_PANEL_SHELL_ELEVATED_CLS}>
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-sans uppercase tracking-widest text-muted-foreground">
              {isPurchaseRequest ? 'Purchase Request' : 'Purchase Order'}
            </p>
            <h2 className="text-base font-semibold mt-1">{title}</h2>
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="p-2 rounded-md hover:bg-muted text-muted-foreground"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <p className="text-muted-foreground">Number</p>
              <p className="font-sans font-medium mt-0.5">{order.poNumber}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Vendor</p>
              <p className="font-medium mt-0.5">{order.vendorName}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Ordered</p>
              <p className="font-sans mt-0.5">{order.orderDate}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Delivery</p>
              <p className="font-sans mt-0.5">{order.deliveryDate}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Initiated by</p>
              <p className="mt-0.5">{order.initiatedBy || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Approved by</p>
              <p className="mt-0.5">{order.approvedBy || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Status</p>
              <p className="mt-0.5">{resolvePurchaseOrderStatusLabel(order)}</p>
            </div>
            {showVendorShareLink && (
              <div>
                <p className="text-muted-foreground">Vendor acceptance</p>
                <p className="mt-0.5">
                  {isPurchaseOrderVendorAccepted(order)
                    ? `Accepted by ${order.vendorAcceptedBy || order.vendorName}`
                    : 'Pending'}
                </p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground">Total</p>
              <p className="font-sans font-medium mt-0.5">{rm(totals.total)}</p>
              {totals.taxTotal > 0 && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Subtotal {rm(totals.subtotal)} + Tax {rm(totals.taxTotal)}
                </p>
              )}
            </div>
          </div>

          {showVendorShareLink && (
            <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground">Vendor PDF link</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Send this PDF link to the vendor. They can open the portal from the PDF page to accept the order.
                  </p>
                  {shareToken ? (
                    <a
                      href={buildVendorOrderShareUrl(shareToken)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-sans text-primary mt-2 break-all hover:underline block"
                    >
                      {buildVendorOrderShareUrl(shareToken)}
                    </a>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-2">Generating share link…</p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => void handleCopyShareLink()}
                    disabled={!shareToken || vendorShareActionsLocked}
                    title={vendorShareActionsLocked ? 'Vendor link disabled after goods are received' : undefined}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-muted disabled:opacity-50 disabled:pointer-events-none disabled:hover:bg-transparent"
                  >
                    <Copy size={12} />
                    {shareLinkCopied ? 'Copied!' : 'Copy link'}
                  </button>
                  {shareToken ? (
                    vendorShareActionsLocked ? (
                      <span
                        aria-disabled="true"
                        title="Vendor link disabled after goods are received"
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-[#25D366]/70 text-white text-xs font-medium opacity-50 pointer-events-none cursor-not-allowed"
                      >
                        WhatsApp
                      </span>
                    ) : (
                      <a
                        href={buildVendorOrderWhatsAppUrl(shareToken, order.poNumber, order.vendorName)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-[#25D366] text-white text-xs font-medium hover:bg-[#1ebe57]"
                      >
                        WhatsApp
                      </a>
                    )
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {showReceiveDocs && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border border-border bg-muted/10 p-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-sans uppercase tracking-wider text-muted-foreground">
                  Vendor DO number
                </label>
                {mode === 'receive' && !readOnly ? (
                  <input
                    type="text"
                    value={vendorDoNumber}
                    onChange={e => setVendorDoNumber(e.target.value)}
                    placeholder="Delivery order no. (if received)"
                    className="rounded border border-border bg-background px-2 py-1.5 text-xs"
                  />
                ) : (
                  <p className="text-xs font-medium text-foreground">{vendorDoNumber || '—'}</p>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-sans uppercase tracking-wider text-muted-foreground">
                  Vendor Invoice number
                </label>
                {mode === 'receive' && !readOnly ? (
                  <input
                    type="text"
                    value={vendorInvoiceNumber}
                    onChange={e => setVendorInvoiceNumber(e.target.value)}
                    placeholder="Invoice no. (if received)"
                    className="rounded border border-border bg-background px-2 py-1.5 text-xs"
                  />
                ) : (
                  <p className="text-xs font-medium text-foreground">{vendorInvoiceNumber || '—'}</p>
                )}
              </div>
              {mode === 'receive' && !readOnly ? (
                <p className="sm:col-span-2 text-[10px] text-muted-foreground">
                  Enter at least one of Vendor DO number or Vendor Invoice number (or both), matching the document(s) received.
                </p>
              ) : null}
            </div>
          )}

          <div className="border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-2 border-b border-border bg-muted/30">
              <p className="text-xs font-semibold">Line items</p>
            </div>
            <TableScrollContainer ref={scrollRootRef} className="max-h-[calc(100vh-12rem)] overflow-y-auto">
              <table className="w-full table-fixed text-xs">
                <thead>
                  <tr className="border-b border-border">
                    {lineHeaders.map(h => (
                      <th key={h} className="text-left px-3 py-2 text-muted-foreground font-normal uppercase text-[10px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedLines.map(line => {
                    const orderedQty = parseFloat(line.orderedQuantity) || 0;
                    const qty = parseFloat(line.quantity) || 0;
                    const orderedPrice = parseFloat(line.orderedUnitPrice) || 0;
                    const price = parseFloat(line.unitPrice) || 0;
                    const tax = parseFloat(line.taxAmount) || 0;
                    const qtyVariance = qty - orderedQty;
                    const priceVariance = price - orderedPrice;
                    const lineTotal = qty * price + tax;
                    return (
                      <tr key={line.itemId} className="border-b border-border last:border-0">
                        <td className="px-3 py-2">
                          <p className="font-medium">{line.componentName}</p>
                          <p className="text-[10px] font-sans text-muted-foreground">{line.componentId || '—'}</p>
                        </td>
                        <td className="px-3 py-2">{line.productName}</td>
                        {showOrderedReceivedColumns ? (
                          <>
                            <td className="px-3 py-2">
                              <span className="font-sans text-muted-foreground">{line.orderedQuantity}</span>
                            </td>
                            <td className="px-3 py-2">
                              {canEditReceived ? (
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={line.quantity}
                                  onChange={e => updateLine(line.itemId, { quantity: e.target.value })}
                                  className="w-20 rounded border border-border bg-background px-2 py-1 font-sans"
                                />
                              ) : (
                                <span className="font-sans">{line.quantity}</span>
                              )}
                            </td>
                          </>
                        ) : (
                          <td className="px-3 py-2">
                            {readOnly ? (
                              <span className="font-sans">{line.quantity}</span>
                            ) : (
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={line.quantity}
                                onChange={e => updateLine(line.itemId, { quantity: e.target.value })}
                                className="w-20 rounded border border-border bg-background px-2 py-1 font-sans"
                              />
                            )}
                          </td>
                        )}
                        <td className="px-3 py-2">
                          {readOnly ? (
                            <span>{line.componentUom}</span>
                          ) : (
                            <input
                              type="text"
                              value={line.componentUom}
                              onChange={e => updateLine(line.itemId, { componentUom: e.target.value })}
                              className="w-16 rounded border border-border bg-background px-2 py-1"
                            />
                          )}
                        </td>
                        {mode === 'reconcile' && (
                          <td className="px-3 py-2 font-sans text-muted-foreground">{rm(line.issuedUnitPrice)}</td>
                        )}
                        {showOrderedReceivedColumns ? (
                          <>
                            <td className="px-3 py-2">
                              <span className="font-sans text-muted-foreground">{rm(orderedPrice)}</span>
                            </td>
                            <td className="px-3 py-2">
                              {canEditReceived ? (
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={line.unitPrice}
                                  onChange={e => updateLine(line.itemId, { unitPrice: e.target.value })}
                                  className="w-24 rounded border border-border bg-background px-2 py-1 font-sans"
                                />
                              ) : (
                                <span className="font-sans">{rm(price)}</span>
                              )}
                            </td>
                            <td className="px-3 py-2 font-sans">
                              <span className={qtyVariance !== 0 ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}>
                                {qtyVariance === 0 ? '0' : (qtyVariance > 0 ? `+${qtyVariance}` : String(qtyVariance))}
                              </span>
                            </td>
                            <td className="px-3 py-2 font-sans">
                              <span className={priceVariance !== 0 ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}>
                                {priceVariance === 0 ? rm(0) : `${priceVariance > 0 ? '+' : ''}${rm(priceVariance)}`}
                              </span>
                            </td>
                          </>
                        ) : (
                          <td className="px-3 py-2">
                            {readOnly ? (
                              <span className="font-sans">{rm(price)}</span>
                            ) : (
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={line.unitPrice}
                                onChange={e => updateLine(line.itemId, { unitPrice: e.target.value })}
                                className="w-24 rounded border border-border bg-background px-2 py-1 font-sans"
                              />
                            )}
                          </td>
                        )}
                        {showTaxColumn && (
                          <td className="px-3 py-2">
                            {mode === 'receive' && !readOnly ? (
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={line.taxAmount}
                                onChange={e => updateLine(line.itemId, { taxAmount: e.target.value })}
                                placeholder="0.00"
                                className="w-20 rounded border border-border bg-background px-2 py-1 font-sans"
                              />
                            ) : (
                              <span className="font-sans">{tax > 0 ? rm(tax) : '—'}</span>
                            )}
                          </td>
                        )}
                        {showHalalCertColumn && (
                          <td className="px-3 py-2">
                            {readOnly || mode !== 'receive' ? (
                              <span>{line.halalCertNo || '—'}</span>
                            ) : (
                              <input
                                type="text"
                                value={line.halalCertNo}
                                onChange={e => updateLine(line.itemId, { halalCertNo: e.target.value })}
                                placeholder="Optional"
                                className="w-32 rounded border border-border bg-background px-2 py-1"
                              />
                            )}
                          </td>
                        )}
                        {showExpiryColumn && (
                          <td className="px-3 py-2">
                            {readOnly || mode !== 'receive' ? (
                              <span className="font-sans">{line.productExpiryDate || '—'}</span>
                            ) : (
                              <input
                                type="date"
                                value={line.productExpiryDate}
                                onChange={e => updateLine(line.itemId, { productExpiryDate: e.target.value })}
                                className="w-36 rounded border border-border bg-background px-2 py-1 font-sans"
                              />
                            )}
                          </td>
                        )}
                        <td className="px-3 py-2 font-sans">{rm(lineTotal)}</td>
                      </tr>
                    );
                  })}
                  <InfiniteScrollTableSentinel colSpan={lineColSpan} hasMore={hasMore} onLoadMore={loadMore} nextPageSize={nextPageSize} sentinelRef={sentinelRef} totalCount={totalCount} visibleCount={visibleCount} />
                </tbody>
              </table>
            </TableScrollContainer>
          </div>

          {requiresHalalCert && mode === 'receive' && (
            <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              Halal policy is active for this order&apos;s company/location. Halal certificate number is optional — enter it when available.
            </div>
          )}

          {approvalBlockedByServer && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
              This purchase request shows Pending Approval, but the API cannot approve it yet. Restart your local API with the latest code.
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-400">
              {error}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-md border border-border text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            Close
          </button>
          {isPendingApproval && (
            <button
              type="button"
              onClick={() => void handleApprove()}
              disabled={saving || !canApprove}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
            >
              <Check size={14} />
              {saving ? 'Approving…' : 'Approve'}
            </button>
          )}
          {mode === 'receive' && (
            <button
              type="button"
              onClick={() => void handleReceive()}
              disabled={saving || !canReceive}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
            >
              <PackageCheck size={14} />
              {saving ? 'Receiving…' : 'Confirm receive'}
            </button>
          )}
          {mode === 'reconcile' && (
            <button
              type="button"
              onClick={() => void handleReconcile()}
              disabled={saving || !canReconcile}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
            >
              <Check size={14} />
              {saving ? 'Reconciling…' : 'Confirm reconcile & add to inventory'}
            </button>
          )}
        </div>
      </aside>
    </>,
    document.body,
  );
}
