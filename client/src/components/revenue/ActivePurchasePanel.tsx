import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { InfiniteScrollDivSentinel, InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { ColGroup } from '../shared/SortableTableHead';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { createPortal } from 'react-dom';
import { Check, Copy, PackageCheck, Pencil, Plus, Trash2, X } from 'lucide-react';
import { api, type PurchaseOrder, type PurchaseOrderLineWorkflowPayload } from '../../api';
import { formatDeliveryUnitPath } from '../../data/vendorProductCatalog';
import {
  ReceiveAddProductModal,
  type ReceiveAddProductSelection,
} from './ReceiveAddProductModal';
import { ReceiveLineDetailModal } from './ReceiveLineDetailModal';
import { PreCommittedProgressSummary } from './PreCommittedProgressSummary';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { orgRequiresHalalCertOnReceive } from '../../data/vendorPolicyRules';
import { useOrgVendorPolicy } from '../../hooks/useOrgVendorPolicy';
import { applyVendorProductPriceUpdates } from '../../data/vendorProductPrices';
import {
  canAmendReceivedPurchaseOrder,
  canAmendReconciledPurchaseOrder,
  canApprovePurchaseOrder,
  canConsolidatePurchaseOrder,
  canReceivePurchaseOrder,
  parseUserAccess,
} from '../../data/userAccess';
import { useShouldHidePrices } from '../../hooks/useShouldHidePrices';
import { formatPriceOrHidden } from '../../data/priceVisibility';
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
import {
  qtyPriceWidthCls,
  receiveQtyPriceWidthCls,
  sanitizeReceiveQtyPriceInput,
} from '../layout/formControls';

type Props = {
  order: PurchaseOrder;
  onClose: () => void;
  onUpdated: (order: PurchaseOrder) => void;
  /**
   * Team mobile actor (employee display name). When set, workflow actions follow
   * server canApprove/canReceive/canReconcile flags without requiring an AppUser
   * RMS permission matrix (standalone /TEAM has no platform login).
   */
  teamActorName?: string;
};

type EditableLine = {
  /** Stable React key (PO item id or extra-* for unordered receive lines). */
  clientKey: string;
  itemId: number;
  /** True when added at receive (freebie / CN replacement — not on original order). */
  isExtra: boolean;
  componentId: string;
  componentName: string;
  productName: string;
  vendorProductId: string;
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
  /** Inventory / component UOM — kept for stock posting payload. */
  componentUom: string;
  /** Delivery pack path shown on PO / receive (e.g. 1box/12tin/400gr). */
  deliveryPackage: string;
  halalCertNo: string;
  productExpiryDate: string;
  /** Optional temperature °C at receive/consolidate. */
  receivedTemperature: string;
  /** Extra lines may link a confirmed credit note (exact vendor product). */
  linkedCreditNoteId: number | null;
  deliveredQuantity: number;
  remainingQuantity: number;
};

function buildEditableLines(
  order: PurchaseOrder,
  mode: 'approve' | 'receive' | 'reconcile' | 'view',
  amending = false,
): EditableLine[] {
  const partial = Boolean(order.allowPartialDelivery);
  const amendReconciled = amending && order.status === 'Reconciled';
  return order.items.map(item => {
    const issued = item.issuedUnitPrice ?? item.unitPrice;
    const orderedQty = item.quantity;
    const orderedPrice = item.unitPrice;
    const delivered = item.deliveredQuantity ?? 0;
    const remaining = item.remainingQuantity ?? Math.max(0, orderedQty - delivered);
    // On receive for partial POs, default shipment qty to remaining undelivered.
    // Otherwise use last received qty or full ordered.
    const qty = mode === 'approve'
      ? orderedQty
      : mode === 'receive' && partial && !amending
        ? remaining
        : amendReconciled
          ? (item.reconciledQuantity ?? item.receivedQuantity ?? orderedQty)
          : (item.receivedQuantity ?? (partial ? remaining : orderedQty));
    const price = mode === 'approve'
      ? orderedPrice
      : amendReconciled
        ? (item.reconciledUnitPrice ?? item.receivedUnitPrice ?? orderedPrice)
        : (item.receivedUnitPrice ?? orderedPrice);
    const tax = item.taxAmount ?? 0;

    return {
      clientKey: `po-item-${item.id}`,
      itemId: item.id,
      isExtra: false,
      componentId: item.componentId ?? '',
      componentName: item.componentName || item.name,
      productName: item.name,
      vendorProductId: item.vendorProductId ?? '',
      orderedQuantity: String(orderedQty),
      quantity: String(qty),
      orderedUnitPrice: String(orderedPrice),
      unitPrice: String(price),
      taxAmount: tax > 0 ? String(tax) : '',
      issuedUnitPrice: issued,
      componentUom: item.componentUom || item.unit,
      deliveryPackage: (item.deliveryPackage || item.unit || '').trim(),
      halalCertNo: item.halalCertNo ?? '',
      productExpiryDate: item.productExpiryDate?.trim() ?? '',
      receivedTemperature: item.receivedTemperature != null && Number.isFinite(item.receivedTemperature)
        ? String(item.receivedTemperature)
        : '',
      linkedCreditNoteId: null,
      deliveredQuantity: delivered,
      remainingQuantity: remaining,
    };
  });
}

function linePayload(lines: EditableLine[]): PurchaseOrderLineWorkflowPayload[] {
  return lines.map(line => {
    const tempRaw = line.receivedTemperature.trim();
    const temp = tempRaw === '' ? null : Number(tempRaw);
    const base: PurchaseOrderLineWorkflowPayload = {
      itemId: line.isExtra ? 0 : line.itemId,
      quantity: parseFloat(line.quantity) || 0,
      unitPrice: parseFloat(line.unitPrice) || 0,
      componentUom: line.componentUom,
      taxAmount: parseFloat(line.taxAmount) || 0,
      halalCertNo: line.halalCertNo.trim() || undefined,
      productExpiryDate: line.productExpiryDate.trim() || undefined,
      receivedTemperature: temp != null && Number.isFinite(temp) ? temp : null,
    };
    if (line.isExtra) {
      return {
        ...base,
        vendorProductId: line.vendorProductId,
        componentId: line.componentId,
        componentName: line.componentName,
        name: line.productName,
        unit: line.deliveryPackage,
        deliveryPackage: line.deliveryPackage,
        linkedCreditNoteId: line.linkedCreditNoteId ?? undefined,
      };
    }
    return base;
  });
}

export function ActivePurchasePanel({ order, onClose, onUpdated, teamActorName }: Props) {
  const { rm } = useCountryFormatters();
  const { currentUser } = useCurrentUser();
  /** Stack line items as cards below Tailwind `sm` (640px) — wide PO tables do not fit phones. */
  const isCompactLines = useMediaQuery('(max-width: 639px)');
  const orgPolicyTags = useOrgVendorPolicy(order.companyId, order.locationExternalIds ?? []);
  const requiresHalalCert = orgRequiresHalalCertOnReceive(orgPolicyTags);
  const access = useMemo(
    () => (currentUser ? parseUserAccess(currentUser.accessJson) : null),
    [currentUser],
  );
  const teamWorkflow = Boolean(teamActorName?.trim());
  const hidePrices = useShouldHidePrices();
  const money = (value: number) => formatPriceOrHidden(hidePrices, () => rm(value));

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
    || order.status === 'Partially Delivered'
    || order.status === 'Reconciled'
    || Boolean(order.receivedAt)
    || Boolean(order.reconciledAt)
    || Boolean(order.finalDeliveryCompletedAt);
  const rmsReceiveOk = Boolean(access && canReceivePurchaseOrder(access));
  const rmsApproveOk = Boolean(access && canApprovePurchaseOrder(access));
  const rmsConsolidateOk = Boolean(access && canConsolidatePurchaseOrder(access));
  const rmsAmendReceivedOk = Boolean(access && canAmendReceivedPurchaseOrder(access));
  const rmsAmendReconciledOk = Boolean(access && canAmendReconciledPurchaseOrder(access));
  const canFinalizeDelivery = Boolean(
    (teamWorkflow || rmsReceiveOk || rmsApproveOk) && order.canFinalizeDelivery,
  );
  const showPartialDeliveryColumns = Boolean(order.allowPartialDelivery)
    && (
      mode === 'receive'
      || mode === 'reconcile'
      || mode === 'view'
      || order.status === 'Partially Delivered'
      || order.items.some(i => (i.deliveredQuantity ?? 0) > 0)
    );
  const [amending, setAmending] = useState(false);
  const [lines, setLines] = useState(() => buildEditableLines(order, mode, false));
  const [vendorDoNumber, setVendorDoNumber] = useState(order.vendorDoNumber?.trim() ?? '');
  const [vendorInvoiceNumber, setVendorInvoiceNumber] = useState(order.vendorInvoiceNumber?.trim() ?? '');
  const [productQualityRating, setProductQualityRating] = useState(order.productQualityRating?.trim() ?? '');
  const [productQualityComment, setProductQualityComment] = useState(order.productQualityComment?.trim() ?? '');
  const [hygieneRating, setHygieneRating] = useState(order.hygieneRating?.trim() ?? '');
  const [hygieneComment, setHygieneComment] = useState(order.hygieneComment?.trim() ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareToken, setShareToken] = useState(order.vendorShareToken?.trim() ?? '');
  const [shareLinkCopied, setShareLinkCopied] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [detailLineKey, setDetailLineKey] = useState<string | null>(null);
  const panelScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAmending(false);
    setLines(buildEditableLines(order, mode, false));
    setVendorDoNumber(order.vendorDoNumber?.trim() ?? '');
    setVendorInvoiceNumber(order.vendorInvoiceNumber?.trim() ?? '');
    setProductQualityRating(order.productQualityRating?.trim() ?? '');
    setProductQualityComment(order.productQualityComment?.trim() ?? '');
    setHygieneRating(order.hygieneRating?.trim() ?? '');
    setHygieneComment(order.hygieneComment?.trim() ?? '');
    setError(null);
    setShareToken(order.vendorShareToken?.trim() ?? '');
    setShareLinkCopied(false);
    setShowAddProduct(false);
    setDetailLineKey(null);
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

  const canApprove = Boolean(
    (teamWorkflow || rmsApproveOk) && isPendingApproval && !approvalBlockedByServer,
  );
  const canReceive = Boolean((teamWorkflow || rmsReceiveOk) && order.canReceive);
  const canReconcile = Boolean(
    (teamWorkflow || rmsConsolidateOk) && order.canReconcile,
  );
  const canAmendReceived = Boolean(
    (teamWorkflow || rmsAmendReceivedOk)
    && (order.canAmendReceived || order.status === 'Received' || order.status === 'Partially Delivered'),
  );
  const canAmendReconciled = Boolean(
    (teamWorkflow || rmsAmendReconciledOk)
    && (order.canAmendReconciled || order.status === 'Reconciled'),
  );
  const canStartAmend = !amending && (
    (canAmendReceived && (order.status === 'Received' || order.status === 'Partially Delivered')
      && (mode === 'view' || mode === 'reconcile'))
    || (canAmendReconciled && order.status === 'Reconciled' && (mode === 'view' || mode === 'reconcile'))
  );
  const amendPhase: 'received' | 'reconciled' | null = amending
    ? (order.status === 'Reconciled' ? 'reconciled' : 'received')
    : null;
  const readOnly = amending
    ? false
    : mode === 'view'
      || (mode === 'approve' && !canApprove)
      || (mode === 'receive' && !canReceive)
      || (mode === 'reconcile' && !canReconcile);
  // When Received opens in reconcile mode, keep consolidate editable unless user chose Amend.
  const canEditReceived = amending
    || ((mode === 'receive' || mode === 'reconcile') && !readOnly);
  const canEditVendorRating = canEditReceived;
  const canEditReceiveDocs = amending || (mode === 'receive' && !readOnly);
  const canEditTaxHalal = amending || (mode === 'receive' && !readOnly);

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

  const showCommitmentColumns = Boolean(order.isPreCommitted);
  const showTaxColumn = !showCommitmentColumns && !isPurchaseRequest
    && (mode === 'receive' || mode === 'reconcile' || mode === 'view' || amending);
  // Halal cert is optional — show when org is under a halal policy (or value already stored).
  const showHalalCertColumn = !showCommitmentColumns
    && (requiresHalalCert || lines.some(line => line.halalCertNo.trim()))
    && (mode === 'receive' || mode === 'reconcile' || mode === 'view' || amending);
  /** Expiry / temp live in Add Detail popup (not as table columns). */
  const showLineDetailColumn = !showCommitmentColumns
    && (mode === 'receive' || mode === 'reconcile' || mode === 'view' || amending);
  const showReceiveDocs = !showCommitmentColumns && (mode === 'receive' || mode === 'reconcile' || mode === 'view' || amending);
  const showVendorRatingInputs = !showCommitmentColumns && (mode === 'receive' || mode === 'reconcile' || mode === 'view' || amending);
  /** Receive / reconcile / view: ordered vs received qty & price + variances. */
  const showOrderedReceivedColumns = !showCommitmentColumns
    && (mode === 'receive' || mode === 'reconcile' || mode === 'view' || amending);

  const lineHeaders = [
    'Component',
    'Product',
    showCommitmentColumns ? 'Committed' : (showOrderedReceivedColumns ? 'QTY Ordered' : 'Qty'),
    showCommitmentColumns ? 'Issued (drawn)' : (showPartialDeliveryColumns ? 'Delivered' : null),
    showCommitmentColumns ? 'Received & consolidated' : null,
    showCommitmentColumns ? 'Remaining to order' : (showPartialDeliveryColumns ? 'Remaining' : null),
    showOrderedReceivedColumns
      ? (showPartialDeliveryColumns ? 'QTY This shipment' : 'QTY Received')
      : null,
    'Delivery Unit',
    !hidePrices && mode === 'reconcile' ? 'Issued price' : null,
    !hidePrices ? (showOrderedReceivedColumns || showCommitmentColumns ? 'Unit Price' : 'Unit price') : null,
    !hidePrices && showOrderedReceivedColumns ? 'Unit Price Received' : null,
    showOrderedReceivedColumns ? 'QTY Variance' : null,
    !hidePrices && showOrderedReceivedColumns ? 'Unit Price Variance' : null,
    !hidePrices && showTaxColumn ? 'Tax' : null,
    showHalalCertColumn ? 'Halal cert no.' : null,
    !hidePrices ? 'Line total' : null,
    showLineDetailColumn ? 'Detail' : null,
  ].filter(Boolean) as string[];
  const lineColSpan = lineHeaders.length;
  const lineColWidths = lineHeaders.map(header => {
    switch (header) {
      case 'Component':
        return '14%';
      case 'Product':
        return '14%';
      case 'Delivery Unit':
        return '8%';
      case 'Halal cert no.':
        return '9%';
      case 'Detail':
        return '7%';
      case 'Line total':
        return '8%';
      case 'Tax':
        return '5%';
      case 'Received & consolidated':
        return '9%';
      case 'Remaining to order':
        return '8%';
      case 'QTY Received':
      case 'QTY This shipment':
        return '5%';
      case 'Unit Price Received':
        return '5%';
      case 'Unit Price Variance':
        return '7%';
      default:
        return '7%';
    }
  });


  const scrollRootRef = useRef<HTMLDivElement>(null);
  const {
    visibleItems: pagedLines,
    hasMore,
    sentinelRef,
    totalCount,
    visibleCount, nextPageSize, loadMore } = useInfiniteScrollSlice(lines, { scrollRootRef });

  function updateLine(clientKey: string, patch: Partial<EditableLine>) {
    setLines(prev => prev.map(line => (line.clientKey === clientKey ? { ...line, ...patch } : line)));
  }

  function removeExtraLine(clientKey: string) {
    setLines(prev => prev.filter(line => line.clientKey !== clientKey));
  }

  /** Extras already on this receive sheet (ordered PO lines may be re-added). */
  const addedExtraLineKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const line of lines) {
      if (line.isExtra && line.componentId && line.vendorProductId) {
        keys.add(`${line.componentId}::${line.vendorProductId}`);
      }
    }
    return keys;
  }, [lines]);

  const reservedCreditNoteIds = useMemo(() => {
    const ids = new Set<number>();
    for (const line of lines) {
      if (line.linkedCreditNoteId != null && line.linkedCreditNoteId > 0) {
        ids.add(line.linkedCreditNoteId);
      }
    }
    return ids;
  }, [lines]);

  function handleAddReceiveProduct(selection: ReceiveAddProductSelection) {
    const deliveryPackage = formatDeliveryUnitPath(selection.product.delivery);
    setLines(prev => [
      ...prev,
      {
        clientKey: `extra-${Date.now()}-${selection.product.id}`,
        itemId: 0,
        isExtra: true,
        componentId: selection.componentId,
        componentName: selection.componentName,
        productName: selection.product.productName,
        vendorProductId: selection.product.id,
        orderedQuantity: '0',
        quantity: '1',
        orderedUnitPrice: '0',
        // Freebies / CN replacements default to zero cost; user may override.
        unitPrice: '0',
        taxAmount: '',
        issuedUnitPrice: 0,
        componentUom: selection.componentUom,
        deliveryPackage,
        halalCertNo: '',
        productExpiryDate: '',
        receivedTemperature: '',
        linkedCreditNoteId: null,
        deliveredQuantity: 0,
        remainingQuantity: Number.POSITIVE_INFINITY,
      },
    ]);
    setShowAddProduct(false);
    setError(null);
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
    const approvedBy = (currentUser?.fullName?.trim() || teamActorName?.trim() || '');
    if (!approvedBy || !canApprove) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.approvePurchaseOrder(order.id, approvedBy);
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
    if (payload.some(line => line.quantity < 0)) {
      setError('Received quantity cannot be negative. Use 0 for out of stock.');
      return;
    }
    if (order.allowPartialDelivery) {
      const over = lines.find(line =>
        !line.isExtra && (parseFloat(line.quantity) || 0) > line.remainingQuantity + 0.0001);
      if (over) {
        setError(`Received qty for "${over.productName}" cannot exceed remaining ${over.remainingQuantity}.`);
        return;
      }
    }
    const extras = lines.filter(line => line.isExtra);
    for (const extra of extras) {
      if ((parseFloat(extra.quantity) || 0) <= 0) {
        setError(`Enter a receive quantity for added product "${extra.productName}".`);
        return;
      }
      if (!extra.vendorProductId.trim() || !extra.componentId.trim()) {
        setError(`Added product "${extra.productName}" is missing Vendor Product ID or component.`);
        return;
      }
    }
    const linkedCnIds = extras
      .map(line => line.linkedCreditNoteId)
      .filter((id): id is number => id != null && id > 0);
    if (new Set(linkedCnIds).size !== linkedCnIds.length) {
      setError('Each credit note can only be linked on one receive line.');
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
        productQualityRating: productQualityRating || '',
        productQualityComment: productQualityComment.trim() || undefined,
        hygieneRating: hygieneRating || '',
        hygieneComment: hygieneComment.trim() || undefined,
      });
      onUpdated(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to receive purchase order.');
    } finally {
      setSaving(false);
    }
  }

  async function handleReconcile() {
    if (!canReconcile || amending) return;
    const payload = linePayload(lines);
    if (payload.some(line => line.quantity < 0)) {
      setError('Reconciled quantity cannot be negative. Use 0 for out of stock.');
      return;
    }
    if (order.allowPartialDelivery) {
      const over = lines.find(line =>
        !line.isExtra && (parseFloat(line.quantity) || 0) > line.remainingQuantity + 0.0001);
      if (over) {
        setError(`Shipment qty for "${over.productName}" cannot exceed remaining ${over.remainingQuantity}.`);
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      const result = await api.reconcilePurchaseOrder(order.id, {
        items: payload,
        productQualityRating: productQualityRating || '',
        productQualityComment: productQualityComment.trim() || undefined,
        hygieneRating: hygieneRating || '',
        hygieneComment: hygieneComment.trim() || undefined,
      });
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

  function startAmend() {
    if (!canStartAmend) return;
    setError(null);
    setAmending(true);
    setLines(buildEditableLines(order, mode, true));
  }

  function cancelAmend() {
    if (saving) return;
    setAmending(false);
    setError(null);
    setLines(buildEditableLines(order, mode, false));
    setVendorDoNumber(order.vendorDoNumber?.trim() ?? '');
    setVendorInvoiceNumber(order.vendorInvoiceNumber?.trim() ?? '');
    setProductQualityRating(order.productQualityRating?.trim() ?? '');
    setProductQualityComment(order.productQualityComment?.trim() ?? '');
    setHygieneRating(order.hygieneRating?.trim() ?? '');
    setHygieneComment(order.hygieneComment?.trim() ?? '');
  }

  async function handleAmend() {
    if (!amending || !amendPhase) return;
    if (amendPhase === 'received' && !canAmendReceived) return;
    if (amendPhase === 'reconciled' && !canAmendReconciled) return;
    const payload = linePayload(lines.filter(line => !line.isExtra));
    if (payload.length === 0) {
      setError('At least one line is required to save the correction.');
      return;
    }
    if (payload.some(line => line.quantity < 0)) {
      setError('Amended quantity cannot be negative. Use 0 for out of stock.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await api.amendPurchaseOrder(order.id, {
        items: payload,
        phase: amendPhase,
        vendorDoNumber: vendorDoNumber.trim() || undefined,
        vendorInvoiceNumber: vendorInvoiceNumber.trim() || undefined,
        productQualityRating: productQualityRating || '',
        productQualityComment: productQualityComment.trim() || undefined,
        hygieneRating: hygieneRating || '',
        hygieneComment: hygieneComment.trim() || undefined,
      });
      if (result.updatedVendorProductPrices && result.updatedVendorProductPrices.length > 0) {
        applyVendorProductPriceUpdates(result.updatedVendorProductPrices);
      }
      setAmending(false);
      onUpdated(result.order);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save purchase order correction.');
    } finally {
      setSaving(false);
    }
  }

  async function handleFinalizeDelivery() {
    if (!canFinalizeDelivery) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.finalizePurchaseOrderDelivery(order.id);
      onUpdated(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to finalize delivery.');
    } finally {
      setSaving(false);
    }
  }

  const title = amending
    ? (amendPhase === 'reconciled' ? 'Edit reconciled purchase order' : 'Edit received purchase order')
    : order.isPreCommitted
      ? 'Pre-committed PO'
      : mode === 'approve'
        ? 'Approve purchase request'
        : mode === 'receive'
          ? (order.status === 'Partially Delivered' ? 'Receive next shipment' : 'Receive purchase order')
          : mode === 'reconcile'
            ? (order.allowPartialDelivery ? 'Consolidate shipment' : 'Reconcile purchase order')
            : 'Purchase details';

  const subtitle = amending
    ? 'Correct quantities, prices, or documents. Status stays the same; stock cards update to match.'
    : order.isPreCommitted
      ? 'View commitment dates, special price, and remaining quantity available for drawdown.'
      : mode === 'approve'
        ? 'Approve to convert this PR into an open purchase order.'
        : mode === 'receive'
          ? (order.allowPartialDelivery
            ? 'Enter qty for this shipment (defaults to remaining). Confirm receive posts stock in Principal Component Units (PCU) at 4dp; any UOM rounding residual vs the PO line amount is shown on the Stock Card. PO stays Partially Delivered until Final delivery completed.'
            : 'Confirm quantities and prices received — stock posts in PCU at 4dp (document PO amount stays authority; UOM rounding residual appears on the Stock Card inbound).')
          : mode === 'reconcile'
            ? (order.allowPartialDelivery
              ? 'Accounting affirmation for this shipment — clears received remarks on the stock card. PO stays Partially Delivered until Final delivery completed.'
              : 'Accounting affirmation — clears received remarks; stock was already posted at receive.')
            : order.canFinalizeDelivery
              ? 'Shipments are received into stock and consolidated for Accounting. Click Final delivery completed to close this PO (delivery rating uses final qty/price vs issued).'
              : 'This purchase has no pending workflow action.';

  return createPortal(
    <>
      <div
        className={DETAIL_PANEL_OVERLAY_ELEVATED_CLS}
        onClick={() => !saving && !showAddProduct && !detailLineKey && onClose()}
      />
      <aside
        className={`${DETAIL_PANEL_SHELL_ELEVATED_CLS} max-sm:inset-x-0 max-sm:left-0 max-sm:right-0 max-sm:w-full max-sm:max-w-none`}
      >
        <div className="px-5 max-sm:px-3 py-4 border-b border-border flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-sans uppercase tracking-widest text-muted-foreground">
              {isPurchaseRequest ? 'Purchase Request' : 'Purchase Order'}
            </p>
            <h2 className="text-base font-semibold mt-1 break-words">{title}</h2>
            <p className="text-xs text-muted-foreground mt-1 max-sm:leading-snug">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="p-2 rounded-md hover:bg-muted text-muted-foreground shrink-0"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div ref={panelScrollRef} className="flex-1 overflow-y-auto px-5 max-sm:px-3 py-4 space-y-4">
          {order.isPreCommitted ? (
            <div className="space-y-3">
              <PreCommittedProgressSummary order={order} />
              <div className="rounded-lg border border-teal-500/30 bg-teal-500/10 px-3 py-2 text-xs text-teal-800 dark:text-teal-300">
                <p className="font-semibold">Pre-committed PO</p>
                <p className="mt-0.5 leading-relaxed">
                  Company-level blanket. Issue regular POs to draw down; delivery unit and price follow this
                  commitment. Stock posts when each drawdown PO is received; consolidation affirms it for Accounting.
                </p>
              </div>
            </div>
          ) : null}
          {order.allowPartialDelivery || order.status === 'Partially Delivered' ? (
            <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs text-orange-800 dark:text-orange-300">
              <p className="font-semibold">Partial delivery enabled for this vendor</p>
              <p className="mt-0.5 leading-relaxed">
                Delivered vs remaining is listed per line. Receive posts stock for ops; consolidate affirms
                for Accounting. Use Final delivery completed to close the PO. Delivery rating is scored only
                after final close if qty or price differs from the issued PO.
              </p>
            </div>
          ) : null}
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
              <p className="text-muted-foreground">{order.isPreCommitted ? 'Commitment' : 'Delivery'}</p>
              <p className="font-sans mt-0.5">
                {order.isPreCommitted
                  ? `${order.commitmentStartDate ?? '—'} → ${order.commitmentEndDate ?? '—'}`
                  : order.deliveryDate}
              </p>
            </div>
            {order.isPreCommitted ? (
              <div className="sm:col-span-2">
                <p className="text-muted-foreground">Drawdown locations</p>
                <p className="mt-0.5 leading-relaxed">
                  {(order.drawdownLocationExternalIds ?? order.locationExternalIds)?.length
                    ? (order.drawdownLocationExternalIds ?? order.locationExternalIds)!.join(', ')
                    : '—'}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Company-level commitment — only these outlets may draw down remaining quantity.
                </p>
              </div>
            ) : (
              <div className="sm:col-span-2">
                <p className="text-muted-foreground">Delivery location</p>
                {order.deliveryLocation ? (
                  <>
                    <p className="font-medium mt-0.5">{order.deliveryLocation.name}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                      {[
                        order.deliveryLocation.addressLine1,
                        order.deliveryLocation.addressLine2,
                        [
                          order.deliveryLocation.city,
                          order.deliveryLocation.stateProvince,
                          order.deliveryLocation.postcode,
                        ].filter(Boolean).join(', '),
                      ].filter(Boolean).join(' · ')}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mt-0.5 leading-relaxed">
                      {(order.locationExternalIds?.length)
                        ? order.locationExternalIds.join(', ')
                        : '—'}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Outlet location (no alternate delivery location selected)
                    </p>
                  </>
                )}
              </div>
            )}
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
              <p className="font-sans font-medium mt-0.5">{money(totals.total)}</p>
              {!hidePrices && totals.taxTotal > 0 && (
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
                {canEditReceiveDocs ? (
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
                {canEditReceiveDocs ? (
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
              {canEditReceiveDocs ? (
                <p className="sm:col-span-2 text-[10px] text-muted-foreground">
                  Enter at least one of Vendor DO number or Vendor Invoice number (or both), matching the document(s) received.
                </p>
              ) : null}
            </div>
          )}

          <div className="border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-2 border-b border-border bg-muted/30 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold">Line items</p>
                {mode === 'receive' && !readOnly && !amending ? (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Add freebies or credit-note replacements that were not on the original order.
                  </p>
                ) : null}
              </div>
              {mode === 'receive' && !readOnly && !amending ? (
                <button
                  type="button"
                  onClick={() => setShowAddProduct(true)}
                  disabled={saving || !(order.vendorExternalId || order.vendorName)}
                  className="inline-flex items-center gap-1 shrink-0 px-2.5 py-1.5 rounded-md border border-border bg-background text-[11px] font-semibold hover:bg-muted disabled:opacity-50"
                  title={
                    order.vendorExternalId || order.vendorName
                      ? 'Add unordered vendor product (freebie / CN replacement)'
                      : 'PO has no vendor'
                  }
                >
                  <Plus size={12} />
                  Add product
                </button>
              ) : null}
            </div>
            {isCompactLines ? (
              <div
                ref={scrollRootRef}
                className="max-h-[min(55vh,28rem)] overflow-y-auto divide-y divide-border"
              >
                {pagedLines.map(line => {
                  const orderedQty = parseFloat(line.orderedQuantity) || 0;
                  const qty = parseFloat(line.quantity) || 0;
                  const orderedPrice = parseFloat(line.orderedUnitPrice) || 0;
                  const price = parseFloat(line.unitPrice) || 0;
                  const tax = parseFloat(line.taxAmount) || 0;
                  const qtyVariance = qty - orderedQty;
                  const priceVariance = price - orderedPrice;
                  const lineTotal = qty * price + tax;
                  const poItem = order.items.find(i => i.id === line.itemId);
                  const hasDetail = Boolean(
                    line.productExpiryDate.trim()
                    || line.receivedTemperature.trim()
                    || (line.linkedCreditNoteId != null && line.linkedCreditNoteId > 0),
                  );
                  const detailLabel = canEditReceived
                    ? (hasDetail ? 'Edit Detail' : 'Add Detail')
                    : (hasDetail ? 'View Detail' : 'Detail');
                  return (
                    <article key={line.clientKey} className="px-3 py-3 space-y-2.5 bg-background">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-snug break-words">{line.productName}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 break-words">
                          {line.componentName}
                          {line.componentId ? ` · ${line.componentId}` : ''}
                        </p>
                        <p className="text-[10px] font-sans text-muted-foreground mt-0.5">
                          Vendor Product ID: {line.vendorProductId || '—'}
                        </p>
                        {line.isExtra ? (
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="text-[10px] uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                              {line.linkedCreditNoteId
                                ? `Not ordered · CN #${line.linkedCreditNoteId} replacement`
                                : 'Not ordered · freebie / replacement'}
                            </span>
                            {canEditReceived ? (
                              <button
                                type="button"
                                onClick={() => removeExtraLine(line.clientKey)}
                                className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-destructive"
                                title="Remove added product"
                              >
                                <Trash2 size={10} />
                                Remove
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      <p className="text-[11px] text-muted-foreground">
                        <span className="uppercase tracking-wide text-[10px]">Delivery unit</span>
                        {' · '}
                        <span className="text-foreground" title={line.deliveryPackage || undefined}>
                          {line.deliveryPackage || '—'}
                        </span>
                      </p>

                      {showCommitmentColumns ? (
                        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Committed</p>
                            <p className="font-sans tabular-nums mt-0.5">{line.orderedQuantity}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Issued (drawn)</p>
                            <p className="font-sans tabular-nums mt-0.5 text-muted-foreground">
                              {poItem?.drawnQuantity ?? 0}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Received &amp; consolidated</p>
                            <p className="font-sans tabular-nums mt-0.5">{poItem?.consolidatedQuantity ?? 0}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Remaining to order</p>
                            <p className="font-sans tabular-nums mt-0.5">
                              {poItem?.remainingCommitmentQuantity
                                ?? poItem?.remainingQuantity
                                ?? line.remainingQuantity}
                            </p>
                          </div>
                        </div>
                      ) : showOrderedReceivedColumns ? (
                        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">QTY Ordered</p>
                            <p className="font-sans tabular-nums mt-0.5 text-muted-foreground">{line.orderedQuantity}</p>
                          </div>
                          {showPartialDeliveryColumns ? (
                            <>
                              <div>
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Delivered</p>
                                <p className="font-sans tabular-nums mt-0.5 text-muted-foreground">{line.deliveredQuantity}</p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Remaining</p>
                                <p className="font-sans tabular-nums mt-0.5">{line.remainingQuantity}</p>
                              </div>
                            </>
                          ) : null}
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                              {showPartialDeliveryColumns ? 'QTY This shipment' : 'QTY Received'}
                            </p>
                            {canEditReceived ? (
                              <input
                                type="text"
                                inputMode="decimal"
                                value={line.quantity}
                                onChange={e => updateLine(line.clientKey, {
                                  quantity: sanitizeReceiveQtyPriceInput(e.target.value),
                                })}
                                className="mt-0.5 w-full max-w-[8rem] rounded border border-border bg-background px-2 py-1.5 font-sans text-xs"
                                title="Up to 5 digits and 2 decimals"
                              />
                            ) : (
                              <p className="font-sans tabular-nums mt-0.5">{line.quantity}</p>
                            )}
                          </div>
                          {!hidePrices ? (
                            <>
                              <div>
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Unit Price</p>
                                <p className="font-sans tabular-nums mt-0.5 text-muted-foreground">{rm(orderedPrice)}</p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Unit Price Received</p>
                                {canEditReceived ? (
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={line.unitPrice}
                                    onChange={e => updateLine(line.clientKey, {
                                      unitPrice: sanitizeReceiveQtyPriceInput(e.target.value),
                                    })}
                                    className="mt-0.5 w-full max-w-[8rem] rounded border border-border bg-background px-2 py-1.5 font-sans text-xs"
                                    title="Up to 5 digits and 2 decimals"
                                  />
                                ) : (
                                  <p className="font-sans tabular-nums mt-0.5">{rm(price)}</p>
                                )}
                              </div>
                            </>
                          ) : null}
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">QTY Variance</p>
                            <p className={`font-sans tabular-nums mt-0.5 ${qtyVariance !== 0 ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}`}>
                              {qtyVariance === 0 ? '0' : (qtyVariance > 0 ? `+${qtyVariance}` : String(qtyVariance))}
                            </p>
                          </div>
                          {!hidePrices ? (
                            <div>
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Unit Price Variance</p>
                              <p className={`font-sans tabular-nums mt-0.5 ${priceVariance !== 0 ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}`}>
                                {priceVariance === 0 ? rm(0) : `${priceVariance > 0 ? '+' : ''}${rm(priceVariance)}`}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Qty</p>
                            {readOnly ? (
                              <p className="font-sans tabular-nums mt-0.5">{line.quantity}</p>
                            ) : (
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={line.quantity}
                                onChange={e => updateLine(line.clientKey, { quantity: e.target.value })}
                                className="mt-0.5 w-full max-w-[8rem] rounded border border-border bg-background px-2 py-1.5 font-sans text-xs"
                              />
                            )}
                          </div>
                          {!hidePrices ? (
                            <div>
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Unit price</p>
                              {readOnly ? (
                                <p className="font-sans tabular-nums mt-0.5">{rm(price)}</p>
                              ) : (
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={line.unitPrice}
                                  onChange={e => updateLine(line.clientKey, { unitPrice: e.target.value })}
                                  className="mt-0.5 w-full max-w-[8rem] rounded border border-border bg-background px-2 py-1.5 font-sans text-xs"
                                />
                              )}
                            </div>
                          ) : null}
                        </div>
                      )}

                      {!hidePrices && mode === 'reconcile' ? (
                        <p className="text-[11px] text-muted-foreground">
                          Issued price · <span className="font-sans text-foreground">{rm(line.issuedUnitPrice)}</span>
                        </p>
                      ) : null}

                      <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                        {!hidePrices && showTaxColumn ? (
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Tax</p>
                            {canEditTaxHalal ? (
                              <input
                                type="text"
                                inputMode="decimal"
                                value={line.taxAmount}
                                onChange={e => updateLine(line.clientKey, {
                                  taxAmount: sanitizeReceiveQtyPriceInput(e.target.value),
                                })}
                                placeholder="0.00"
                                className="mt-0.5 w-full max-w-[8rem] rounded border border-border bg-background px-2 py-1.5 font-sans text-xs"
                                title="Up to 5 digits and 2 decimals"
                              />
                            ) : (
                              <p className="font-sans tabular-nums mt-0.5">{tax > 0 ? rm(tax) : '—'}</p>
                            )}
                          </div>
                        ) : null}
                        {!hidePrices ? (
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Line total</p>
                            <p className="font-sans tabular-nums mt-0.5 font-medium">{rm(lineTotal)}</p>
                          </div>
                        ) : null}
                        {showHalalCertColumn ? (
                          <div className="col-span-2">
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Halal cert no.</p>
                            {canEditTaxHalal ? (
                              <input
                                type="text"
                                value={line.halalCertNo}
                                onChange={e => updateLine(line.clientKey, { halalCertNo: e.target.value })}
                                placeholder="Optional"
                                className="mt-0.5 w-full rounded border border-border bg-background px-2 py-1.5 text-xs"
                              />
                            ) : (
                              <p className="mt-0.5 break-words">{line.halalCertNo || '—'}</p>
                            )}
                          </div>
                        ) : null}
                      </div>

                      {showLineDetailColumn ? (
                        <button
                          type="button"
                          onClick={() => setDetailLineKey(line.clientKey)}
                          className={`inline-flex w-full items-center justify-center px-2 py-2 rounded-md border text-[11px] font-semibold ${
                            hasDetail
                              ? 'border-primary/40 text-primary bg-primary/5 hover:bg-primary/10'
                              : 'border-border text-foreground hover:bg-muted/50'
                          }`}
                          title={hasDetail
                            ? [
                                line.productExpiryDate.trim()
                                  ? `Expiry: ${line.productExpiryDate}`
                                  : null,
                                line.receivedTemperature.trim()
                                  ? `Temp: ${line.receivedTemperature}°C`
                                  : null,
                                line.linkedCreditNoteId
                                  ? `Credit note #${line.linkedCreditNoteId}`
                                  : null,
                              ].filter(Boolean).join(' · ')
                            : 'Add expiry, temperature, or credit note'}
                        >
                          {detailLabel}
                        </button>
                      ) : null}
                    </article>
                  );
                })}
                <InfiniteScrollDivSentinel
                  hasMore={hasMore}
                  onLoadMore={loadMore}
                  nextPageSize={nextPageSize}
                  sentinelRef={sentinelRef}
                  totalCount={totalCount}
                  visibleCount={visibleCount}
                />
              </div>
            ) : (
              <TableScrollContainer ref={scrollRootRef} className="max-h-[min(42vh,24rem)] overflow-y-auto">
                <table className="w-full text-xs">
                  <ColGroup widths={lineColWidths} />
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
                        <tr key={line.clientKey} className="border-b border-border last:border-0">
                          <td className="px-3 py-2">
                            <p className="font-medium">{line.componentName}</p>
                            <p className="text-[10px] font-sans text-muted-foreground">{line.componentId || '—'}</p>
                          </td>
                          <td className="px-3 py-2">
                            <p className="font-medium">{line.productName}</p>
                            <p className="text-[10px] font-sans text-muted-foreground">
                              Vendor Product ID: {line.vendorProductId || '—'}
                            </p>
                            {line.isExtra ? (
                              <div className="mt-1 flex items-center gap-2">
                                <span className="text-[10px] uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                                  Not ordered · freebie / replacement
                                </span>
                                {canEditReceived ? (
                                  <button
                                    type="button"
                                    onClick={() => removeExtraLine(line.clientKey)}
                                    className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-destructive"
                                    title="Remove added product"
                                  >
                                    <Trash2 size={10} />
                                    Remove
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                          </td>
                          {showCommitmentColumns ? (
                            <>
                              <td className="px-3 py-2 font-sans tabular-nums">{line.orderedQuantity}</td>
                              <td className="px-3 py-2 font-sans tabular-nums text-muted-foreground">
                                {order.items.find(i => i.id === line.itemId)?.drawnQuantity ?? 0}
                              </td>
                              <td className="px-3 py-2 font-sans tabular-nums">
                                {order.items.find(i => i.id === line.itemId)?.consolidatedQuantity ?? 0}
                              </td>
                              <td className="px-3 py-2 font-sans tabular-nums">
                                {order.items.find(i => i.id === line.itemId)?.remainingCommitmentQuantity
                                  ?? order.items.find(i => i.id === line.itemId)?.remainingQuantity
                                  ?? line.remainingQuantity}
                              </td>
                            </>
                          ) : showOrderedReceivedColumns ? (
                            <>
                              <td className="px-3 py-2">
                                <span className="font-sans text-muted-foreground">{line.orderedQuantity}</span>
                              </td>
                              {showPartialDeliveryColumns ? (
                                <>
                                  <td className="px-3 py-2 font-sans tabular-nums text-muted-foreground">
                                    {line.deliveredQuantity}
                                  </td>
                                  <td className="px-3 py-2 font-sans tabular-nums">
                                    {line.remainingQuantity}
                                  </td>
                                </>
                              ) : null}
                              <td className="px-3 py-2">
                                {canEditReceived ? (
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={line.quantity}
                                    onChange={e => updateLine(line.clientKey, {
                                      quantity: sanitizeReceiveQtyPriceInput(e.target.value),
                                    })}
                                    className={`${receiveQtyPriceWidthCls} rounded border border-border bg-background px-1.5 py-1 font-sans text-xs`}
                                    title="Up to 5 digits and 2 decimals"
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
                                  onChange={e => updateLine(line.clientKey, { quantity: e.target.value })}
                                  className={`${qtyPriceWidthCls} rounded border border-border bg-background px-2 py-1 font-sans`}
                                />
                              )}
                            </td>
                          )}
                          <td className="px-3 py-2">
                            <span className="text-xs" title={line.deliveryPackage || undefined}>
                              {line.deliveryPackage || '—'}
                            </span>
                          </td>
                          {!hidePrices && mode === 'reconcile' && (
                            <td className="px-3 py-2 font-sans text-muted-foreground">{rm(line.issuedUnitPrice)}</td>
                          )}
                          {showOrderedReceivedColumns ? (
                            <>
                              {!hidePrices && (
                                <td className="px-3 py-2">
                                  <span className="font-sans text-muted-foreground">{rm(orderedPrice)}</span>
                                </td>
                              )}
                              {!hidePrices && (
                                <td className="px-3 py-2">
                                  {canEditReceived ? (
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={line.unitPrice}
                                      onChange={e => updateLine(line.clientKey, {
                                        unitPrice: sanitizeReceiveQtyPriceInput(e.target.value),
                                      })}
                                      className={`${receiveQtyPriceWidthCls} rounded border border-border bg-background px-1.5 py-1 font-sans text-xs`}
                                      title="Up to 5 digits and 2 decimals"
                                    />
                                  ) : (
                                    <span className="font-sans">{rm(price)}</span>
                                  )}
                                </td>
                              )}
                              <td className="px-3 py-2 font-sans">
                                <span className={qtyVariance !== 0 ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}>
                                  {qtyVariance === 0 ? '0' : (qtyVariance > 0 ? `+${qtyVariance}` : String(qtyVariance))}
                                </span>
                              </td>
                              {!hidePrices && (
                                <td className="px-3 py-2 font-sans">
                                  <span className={priceVariance !== 0 ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}>
                                    {priceVariance === 0 ? rm(0) : `${priceVariance > 0 ? '+' : ''}${rm(priceVariance)}`}
                                  </span>
                                </td>
                              )}
                            </>
                          ) : (
                            !hidePrices ? (
                              <td className="px-3 py-2">
                                {readOnly ? (
                                  <span className="font-sans">{rm(price)}</span>
                                ) : (
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={line.unitPrice}
                                    onChange={e => updateLine(line.clientKey, { unitPrice: e.target.value })}
                                    className={`${qtyPriceWidthCls} rounded border border-border bg-background px-2 py-1 font-sans`}
                                  />
                                )}
                              </td>
                            ) : null
                          )}
                          {!hidePrices && showTaxColumn && (
                            <td className="px-3 py-2">
                              {canEditTaxHalal ? (
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={line.taxAmount}
                                  onChange={e => updateLine(line.clientKey, {
                                    taxAmount: sanitizeReceiveQtyPriceInput(e.target.value),
                                  })}
                                  placeholder="0.00"
                                  className={`${receiveQtyPriceWidthCls} rounded border border-border bg-background px-1.5 py-1 font-sans text-xs`}
                                  title="Up to 5 digits and 2 decimals"
                                />
                              ) : (
                                <span className="font-sans">{tax > 0 ? rm(tax) : '—'}</span>
                              )}
                            </td>
                          )}
                          {showHalalCertColumn && (
                            <td className="px-3 py-2">
                              {canEditTaxHalal ? (
                                <input
                                  type="text"
                                  value={line.halalCertNo}
                                  onChange={e => updateLine(line.clientKey, { halalCertNo: e.target.value })}
                                  placeholder="Optional"
                                  className="w-32 rounded border border-border bg-background px-2 py-1"
                                />
                              ) : (
                                <span>{line.halalCertNo || '—'}</span>
                              )}
                            </td>
                          )}
                          {!hidePrices && (
                            <td className="px-3 py-2 font-sans">{rm(lineTotal)}</td>
                          )}
                          {showLineDetailColumn && (
                            <td className="px-3 py-2">
                              {(() => {
                                const hasDetail = Boolean(
                                  line.productExpiryDate.trim()
                                  || line.receivedTemperature.trim()
                                  || (line.linkedCreditNoteId != null && line.linkedCreditNoteId > 0),
                                );
                                const label = canEditReceived
                                  ? (hasDetail ? 'Edit Detail' : 'Add Detail')
                                  : (hasDetail ? 'View Detail' : 'Detail');
                                return (
                                  <button
                                    type="button"
                                    onClick={() => setDetailLineKey(line.clientKey)}
                                    className={`inline-flex items-center justify-center px-2 py-1 rounded-md border text-[11px] font-semibold whitespace-nowrap ${
                                      hasDetail
                                        ? 'border-primary/40 text-primary bg-primary/5 hover:bg-primary/10'
                                        : 'border-border text-foreground hover:bg-muted/50'
                                    }`}
                                    title={hasDetail
                                      ? [
                                          line.productExpiryDate.trim()
                                            ? `Expiry: ${line.productExpiryDate}`
                                            : null,
                                          line.receivedTemperature.trim()
                                            ? `Temp: ${line.receivedTemperature}°C`
                                            : null,
                                          line.linkedCreditNoteId
                                            ? `Credit note #${line.linkedCreditNoteId}`
                                            : null,
                                        ].filter(Boolean).join(' · ')
                                      : 'Add expiry, temperature, or credit note'}
                                  >
                                    {label}
                                  </button>
                                );
                              })()}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                    <InfiniteScrollTableSentinel colSpan={lineColSpan} hasMore={hasMore} onLoadMore={loadMore} nextPageSize={nextPageSize} sentinelRef={sentinelRef} totalCount={totalCount} visibleCount={visibleCount} />
                  </tbody>
                </table>
              </TableScrollContainer>
            )}
          </div>

          {showVendorRatingInputs && (
            <div className="rounded-lg border border-border bg-muted/10 p-4 space-y-3">
              <div>
                <p className="text-xs font-semibold text-foreground flex items-center gap-2">
                  <PackageCheck size={14} className="text-muted-foreground" />
                  Vendor rating (optional)
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Optionally record product quality and hygiene when receiving. You can add or change these at consolidate.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-[10px] font-sans uppercase tracking-wider text-muted-foreground">
                    Product quality
                  </p>
                  {canEditVendorRating ? (
                    <>
                      <div className="flex flex-wrap gap-1.5">
                        {([
                          ['satisfied', 'Satisfied', '100%'],
                          ['acceptable', 'Acceptable', '80%'],
                          ['poor', 'Poor', '50%'],
                        ] as const).map(([id, label, score]) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => {
                              setProductQualityRating(prev => (prev === id ? '' : id));
                              setError(null);
                            }}
                            className={`px-3 py-1.5 rounded-md text-xs border ${
                              productQualityRating === id
                                ? 'border-primary bg-primary/10 text-foreground font-medium'
                                : 'border-border text-muted-foreground hover:border-primary/40'
                            }`}
                          >
                            {label} ({score})
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={productQualityComment}
                        onChange={e => setProductQualityComment(e.target.value)}
                        rows={2}
                        maxLength={2000}
                        placeholder="Comment on product quality (optional)"
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs resize-y min-h-[2.5rem]"
                      />
                    </>
                  ) : (
                    <>
                      <p className="text-xs font-medium capitalize">{productQualityRating || '—'}</p>
                      {productQualityComment ? (
                        <p className="text-[11px] text-muted-foreground whitespace-pre-wrap">{productQualityComment}</p>
                      ) : null}
                    </>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-sans uppercase tracking-wider text-muted-foreground">
                    Hygiene &amp; cleanliness
                  </p>
                  {canEditVendorRating ? (
                    <>
                      <div className="flex flex-wrap gap-1.5">
                        {([
                          ['satisfied', 'Satisfied', '100%'],
                          ['acceptable', 'Acceptable', '80%'],
                          ['poor', 'Poor', '50%'],
                        ] as const).map(([id, label, score]) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => {
                              setHygieneRating(prev => (prev === id ? '' : id));
                              setError(null);
                            }}
                            className={`px-3 py-1.5 rounded-md text-xs border ${
                              hygieneRating === id
                                ? 'border-primary bg-primary/10 text-foreground font-medium'
                                : 'border-border text-muted-foreground hover:border-primary/40'
                            }`}
                          >
                            {label} ({score})
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={hygieneComment}
                        onChange={e => setHygieneComment(e.target.value)}
                        rows={2}
                        maxLength={2000}
                        placeholder="Comment on hygiene & cleanliness (optional)"
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs resize-y min-h-[2.5rem]"
                      />
                    </>
                  ) : (
                    <>
                      <p className="text-xs font-medium capitalize">{hygieneRating || '—'}</p>
                      {hygieneComment ? (
                        <p className="text-[11px] text-muted-foreground whitespace-pre-wrap">{hygieneComment}</p>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Optional: enter product temperature (°C) on each line under Temp °C.
              </p>
            </div>
          )}

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

        <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-2 flex-wrap">
          {amending ? (
            <button
              type="button"
              onClick={cancelAmend}
              disabled={saving}
              className="px-4 py-2 rounded-md border border-border text-xs font-medium hover:bg-muted disabled:opacity-50"
            >
              Cancel edit
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-md border border-border text-xs font-medium hover:bg-muted disabled:opacity-50"
            >
              Close
            </button>
          )}
          {canStartAmend && (
            <button
              type="button"
              onClick={startAmend}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-border text-xs font-semibold hover:bg-muted disabled:opacity-50"
              title="Correct quantities, prices, or documents without changing status"
            >
              <Pencil size={14} />
              Edit
            </button>
          )}
          {amending && (
            <button
              type="button"
              onClick={() => void handleAmend()}
              disabled={saving || !amendPhase}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
            >
              <Check size={14} />
              {saving ? 'Saving…' : 'Save correction'}
            </button>
          )}
          {isPendingApproval && !amending && (
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
          {mode === 'receive' && !amending && (
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
          {mode === 'reconcile' && !amending && (
            <button
              type="button"
              onClick={() => void handleReconcile()}
              disabled={saving || !canReconcile}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
            >
              <Check size={14} />
              {saving
                ? 'Reconciling…'
                : order.allowPartialDelivery
                  ? 'Confirm consolidate shipment'
                  : 'Confirm consolidate'}
            </button>
          )}
          {canFinalizeDelivery && !amending && (
            <button
              type="button"
              onClick={() => void handleFinalizeDelivery()}
              disabled={saving || !canFinalizeDelivery}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-primary text-primary bg-primary/5 text-xs font-semibold hover:bg-primary/10 disabled:opacity-50"
            >
              <Check size={14} />
              {saving ? 'Finalizing…' : 'Final delivery completed'}
            </button>
          )}
        </div>
      </aside>
      {showAddProduct ? (
        <ReceiveAddProductModal
          companyId={order.companyId ?? null}
          vendorExternalId={order.vendorExternalId ?? ''}
          vendorName={order.vendorName}
          locationIds={order.locationExternalIds ?? []}
          addedExtraLineKeys={addedExtraLineKeys}
          onClose={() => setShowAddProduct(false)}
          onSelect={handleAddReceiveProduct}
        />
      ) : null}
      {detailLineKey ? (() => {
        const detailLine = lines.find(line => line.clientKey === detailLineKey);
        if (!detailLine) return null;
        const reservedOthers = new Set(
          [...reservedCreditNoteIds].filter(id => id !== detailLine.linkedCreditNoteId),
        );
        return (
          <ReceiveLineDetailModal
            productName={detailLine.productName}
            componentName={detailLine.componentName}
            vendorProductId={detailLine.vendorProductId}
            companyId={order.companyId ?? null}
            locationIds={order.locationExternalIds ?? []}
            allowCreditNoteLink={detailLine.isExtra}
            productExpiryDate={detailLine.productExpiryDate}
            receivedTemperature={detailLine.receivedTemperature}
            linkedCreditNoteId={detailLine.linkedCreditNoteId}
            reservedCreditNoteIds={reservedOthers}
            readOnly={!canEditReceived}
            onClose={() => setDetailLineKey(null)}
            onSave={next => {
              // CN cancel revalues zero-cost replacement receipts — keep linked lines at 0.
              const patch = next.linkedCreditNoteId != null && next.linkedCreditNoteId > 0
                ? { ...next, unitPrice: '0' }
                : next;
              updateLine(detailLine.clientKey, patch);
            }}
          />
        );
      })() : null}
    </>,
    document.body,
  );
}
