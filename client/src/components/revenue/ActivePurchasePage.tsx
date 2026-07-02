import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { pageShellClass } from '../layout/pageLayout';
import { RefreshCw } from 'lucide-react';
import { api, type PurchaseOrder } from '../../api';
import { formatRm } from '../../data/createOrder';
import { refreshVendorProductPricesFromApi } from '../../data/vendorProductPrices';
import { ActivePurchasePanel } from './ActivePurchasePanel';

type Props = {
  selectedCompanyId: number | null;
  selectedLocationIds?: string[];
  embedded?: boolean;
};

const thCls =
  'text-left px-3 py-2.5 text-xs font-sans uppercase tracking-wider text-muted-foreground font-normal border-r border-border last:border-r-0 truncate';
const tdCls = 'px-3 py-2.5 align-middle border-r border-b border-border last:border-r-0 text-xs';

function orderTotal(order: PurchaseOrder): number {
  return order.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

function statusBadge(status: string, documentType: string, vendorAcceptedAt?: string | null) {
  if (vendorAcceptedAt) {
    return <span className="text-[10px] font-sans px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">Vendor Accepted</span>;
  }
  const label = documentType === 'PR' ? `PR · ${status}` : status;
  const normalized = status.toLowerCase();
  let cls = 'bg-muted text-muted-foreground';
  if (normalized.includes('pending')) cls = 'bg-amber-500/15 text-amber-700 dark:text-amber-400';
  else if (normalized === 'open' || normalized === 'confirmed' || normalized === 'in transit') cls = 'bg-primary/15 text-primary';
  else if (normalized === 'received') cls = 'bg-blue-500/15 text-blue-700 dark:text-blue-400';
  return <span className={`text-[10px] font-sans px-1.5 py-0.5 rounded ${cls}`}>{label}</span>;
}

function nextActionLabel(order: PurchaseOrder): string {
  if (order.canApprove) return 'Approve';
  if (order.canReceive) return 'Receive';
  if (order.canReconcile) return 'Reconcile';
  return 'View';
}

export function ActivePurchasePage({ selectedCompanyId, embedded = false }: Props) {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await refreshVendorProductPricesFromApi();
      const data = await api.activePurchaseOrders(selectedCompanyId ?? undefined);
      setOrders(data);
    } catch (e) {
      setOrders([]);
      setError(e instanceof Error ? e.message : 'Failed to load active purchases.');
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const selectedOrder = useMemo(
    () => orders.find(o => o.id === selectedOrderId) ?? null,
    [orders, selectedOrderId],
  );

  const purchaseRequests = useMemo(
    () => orders.filter(o => o.documentType === 'PR' || o.status === 'Pending Approval'),
    [orders],
  );
  const purchaseOrders = useMemo(
    () => orders.filter(o => !(o.documentType === 'PR' || o.status === 'Pending Approval')),
    [orders],
  );

  const scrollRootRef = useRef<HTMLDivElement>(null);
  const {
    visibleItems: pagedOrders,
    hasMore,
    sentinelRef,
    totalCount,
    visibleCount,
  } = useInfiniteScrollSlice(orders, { scrollRootRef });

  function handleOrderUpdated(updated: PurchaseOrder) {
    setOrders(prev => {
      if (updated.status === 'Reconciled') {
        return prev.filter(o => o.id !== updated.id);
      }
      const exists = prev.some(o => o.id === updated.id);
      if (!exists) return [updated, ...prev];
      return prev.map(o => (o.id === updated.id ? updated : o));
    });
    setSelectedOrderId(updated.status === 'Reconciled' ? null : updated.id);
  }

  return (
    <div className={pageShellClass({ embedded })}>
      <div className="flex items-start justify-end gap-4">
        <button
          type="button"
          onClick={() => void loadOrders()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-muted disabled:opacity-50 shrink-0"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {!selectedCompanyId && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          Select a company in the header to scope active purchases.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Open items</p>
          <p className="text-2xl font-semibold mt-1">{orders.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Purchase requests</p>
          <p className="text-2xl font-semibold mt-1">{purchaseRequests.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Purchase orders</p>
          <p className="text-2xl font-semibold mt-1">{purchaseOrders.length}</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">Unreconciled purchases</h2>
        </div>
        <TableScrollContainer ref={scrollRootRef} className="max-h-[calc(100vh-12rem)] overflow-y-auto">
          <table className="w-full table-fixed">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {['Type', 'Number', 'Vendor', 'Ordered', 'Delivery', 'Items', 'Total', 'Status', 'Action'].map(h => (
                  <th key={h} className={thCls}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && orders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No active purchase requests or orders. Create one from My Order.
                  </td>
                </tr>
              ) : (
                pagedOrders.map(order => (
                  <tr
                    key={order.id}
                    className="hover:bg-muted/20 cursor-pointer"
                    onClick={() => setSelectedOrderId(order.id)}
                  >
                    <td className={tdCls}>{order.documentType === 'PR' ? 'PR' : 'PO'}</td>
                    <td className={`${tdCls} font-sans text-primary`}>{order.poNumber}</td>
                    <td className={tdCls}>{order.vendorName}</td>
                    <td className={`${tdCls} font-sans text-muted-foreground`}>{order.orderDate}</td>
                    <td className={`${tdCls} font-sans text-muted-foreground`}>{order.deliveryDate}</td>
                    <td className={tdCls}>{order.items.length}</td>
                    <td className={`${tdCls} font-sans`}>{formatRm(orderTotal(order))}</td>
                    <td className={tdCls}>{statusBadge(order.status, order.documentType, order.vendorAcceptedAt)}</td>
                    <td className={tdCls}>
                      <span className="text-xs font-medium text-primary">{nextActionLabel(order)}</span>
                    </td>
                  </tr>
                ))
              )}
              <InfiniteScrollTableSentinel colSpan={9} hasMore={hasMore} sentinelRef={sentinelRef} totalCount={totalCount} visibleCount={visibleCount} />
            </tbody>
          </table>
        </TableScrollContainer>
      </div>

      {selectedOrder && (
        <ActivePurchasePanel
          order={selectedOrder}
          onClose={() => setSelectedOrderId(null)}
          onUpdated={handleOrderUpdated}
        />
      )}
    </div>
  );
}
