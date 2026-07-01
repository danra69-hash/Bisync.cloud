import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, PackageCheck, X } from 'lucide-react';
import { api, type PurchaseOrder, type PurchaseOrderLineWorkflowPayload } from '../../api';
import { useCurrentUser } from '../../context/CurrentUserContext';
import { formatRm } from '../../data/createOrder';
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
  quantity: string;
  unitPrice: string;
  issuedUnitPrice: number;
  componentUom: string;
};

function buildEditableLines(order: PurchaseOrder, mode: 'approve' | 'receive' | 'reconcile' | 'view'): EditableLine[] {
  return order.items.map(item => {
    const issued = item.issuedUnitPrice ?? item.unitPrice;
    const qty = mode === 'reconcile'
      ? (item.receivedQuantity ?? item.quantity)
      : item.quantity;
    const price = mode === 'reconcile'
      ? (item.receivedUnitPrice ?? item.unitPrice)
      : item.unitPrice;

    return {
      itemId: item.id,
      componentId: item.componentId ?? '',
      componentName: item.componentName || item.name,
      productName: item.name,
      quantity: String(qty),
      unitPrice: String(price),
      issuedUnitPrice: issued,
      componentUom: item.componentUom || item.unit,
    };
  });
}

function linePayload(lines: EditableLine[]): PurchaseOrderLineWorkflowPayload[] {
  return lines.map(line => ({
    itemId: line.itemId,
    quantity: parseFloat(line.quantity) || 0,
    unitPrice: parseFloat(line.unitPrice) || 0,
    componentUom: line.componentUom,
  }));
}

export function ActivePurchasePanel({ order, onClose, onUpdated }: Props) {
  const { currentUser } = useCurrentUser();
  const access = useMemo(
    () => (currentUser ? parseUserAccess(currentUser.accessJson) : null),
    [currentUser],
  );

  const mode: 'approve' | 'receive' | 'reconcile' | 'view' = order.canApprove
    ? 'approve'
    : order.canReceive
      ? 'receive'
      : order.canReconcile
        ? 'reconcile'
        : 'view';

  const [lines, setLines] = useState(() => buildEditableLines(order, mode));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLines(buildEditableLines(order, mode));
    setError(null);
  }, [order, mode]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, saving]);

  const canApprove = Boolean(access && canApprovePurchaseOrder(access) && order.canApprove);
  const canReceive = Boolean(access && canReceivePurchaseOrder(access) && order.canReceive);
  const canReconcile = Boolean(access && (canReceivePurchaseOrder(access) || canApprovePurchaseOrder(access)) && order.canReconcile);
  const readOnly = mode === 'view' || (mode === 'approve' && !canApprove) || (mode === 'receive' && !canReceive) || (mode === 'reconcile' && !canReconcile);

  const total = useMemo(
    () => lines.reduce((sum, line) => sum + (parseFloat(line.quantity) || 0) * (parseFloat(line.unitPrice) || 0), 0),
    [lines],
  );

  function updateLine(itemId: number, patch: Partial<EditableLine>) {
    setLines(prev => prev.map(line => (line.itemId === itemId ? { ...line, ...patch } : line)));
  }

  async function handleApprove() {
    if (!currentUser || !canApprove) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.approvePurchaseOrder(order.id, currentUser.fullName);
      onUpdated(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to approve purchase request.');
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
    setSaving(true);
    setError(null);
    try {
      const updated = await api.receivePurchaseOrder(order.id, { items: payload });
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
              {order.documentType === 'PR' ? 'Purchase Request' : 'Purchase Order'}
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
              <p className="mt-0.5">{order.status}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Vendor acceptance</p>
              <p className="mt-0.5">
                {order.vendorAcceptedAt
                  ? `Accepted by ${order.vendorAcceptedBy || order.vendorName}`
                  : 'Pending'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Total</p>
              <p className="font-sans font-medium mt-0.5">{formatRm(total)}</p>
            </div>
          </div>

          <div className="border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-2 border-b border-border bg-muted/30">
              <p className="text-xs font-semibold">Line items</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[720px]">
                <thead>
                  <tr className="border-b border-border">
                    {['Component', 'Product', 'Qty', 'UOM', mode === 'reconcile' ? 'Issued price' : null, 'Unit price', 'Line total'].filter(Boolean).map(h => (
                      <th key={h} className="text-left px-3 py-2 text-muted-foreground font-normal uppercase text-[10px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lines.map(line => {
                    const qty = parseFloat(line.quantity) || 0;
                    const price = parseFloat(line.unitPrice) || 0;
                    return (
                      <tr key={line.itemId} className="border-b border-border last:border-0">
                        <td className="px-3 py-2">
                          <p className="font-medium">{line.componentName}</p>
                          <p className="text-[10px] font-sans text-muted-foreground">{line.componentId || '—'}</p>
                        </td>
                        <td className="px-3 py-2">{line.productName}</td>
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
                          <td className="px-3 py-2 font-sans text-muted-foreground">{formatRm(line.issuedUnitPrice)}</td>
                        )}
                        <td className="px-3 py-2">
                          {readOnly ? (
                            <span className="font-sans">{formatRm(price)}</span>
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
                        <td className="px-3 py-2 font-sans">{formatRm(qty * price)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

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
          {mode === 'approve' && (
            <button
              type="button"
              onClick={() => void handleApprove()}
              disabled={saving || !canApprove}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
            >
              <Check size={14} />
              {saving ? 'Approving…' : 'Approve & convert to PO'}
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
