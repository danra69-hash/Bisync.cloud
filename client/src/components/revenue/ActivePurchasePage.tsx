import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { useTableSort } from '../../hooks/useTableSort';
import { sortTableRows, compareSortValues } from '../../utils/tableSort';
import { SortableTableHeaderRow, type SortableColumnDef } from '../shared/SortableTableHead';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { pageShellClass } from '../layout/pageLayout';
import { RefreshCw } from 'lucide-react';
import { api, type PurchaseOrder } from '../../api';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';
import { refreshVendorProductPricesFromApi } from '../../data/vendorProductPrices';
import { ActivePurchasePanel } from './ActivePurchasePanel';
import {
  purchaseOrderStatusBadgeClass,
  resolvePurchaseOrderStatusLabel,
} from '../../data/purchaseOrderStatus';
import { TableLoadingRow } from '../shared/MillstoneLoader';

type Props = {
  selectedCompanyId: number | null;
  selectedLocationIds?: string[];
  embedded?: boolean;
};

const tdCls = 'px-3 py-2.5 align-middle border-r border-b border-border last:border-r-0 text-xs';

type ActivePurchaseSortColumn =
  | 'type'
  | 'number'
  | 'vendor'
  | 'ordered'
  | 'delivery'
  | 'items'
  | 'total'
  | 'status'
  | 'action';

const ACTIVE_PURCHASE_TABLE_COLUMNS: SortableColumnDef<ActivePurchaseSortColumn>[] = [
  { key: 'type', label: 'Type' },
  { key: 'number', label: 'Number' },
  { key: 'vendor', label: 'Vendor' },
  { key: 'ordered', label: 'Ordered' },
  { key: 'delivery', label: 'Delivery' },
  { key: 'items', label: 'Items', align: 'right' },
  { key: 'total', label: 'Total', align: 'right' },
  { key: 'status', label: 'Status' },
  { key: 'action', label: 'Action', sortable: false },
];

function orderTotal(order: PurchaseOrder): number {
  return order.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

function statusBadge(order: PurchaseOrder) {
  const label = resolvePurchaseOrderStatusLabel(order);
  return (
    <span className={`text-[10px] font-sans px-1.5 py-0.5 rounded ${purchaseOrderStatusBadgeClass(label)}`}>
      {label}
    </span>
  );
}

function nextActionLabel(order: PurchaseOrder): string {
  if (order.canApprove) return 'Approve';
  if (order.canReceive) return 'Receive';
  if (order.canReconcile) return 'Reconcile';
  return 'View';
}

export function ActivePurchasePage({ selectedCompanyId, embedded = false }: Props) {
  const { rm } = useCountryFormatters();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const { sortColumn, sortDirection, toggleSort, resetSort } = useTableSort<ActivePurchaseSortColumn>();

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

  useEffect(() => {
    function handleVisibilityRefresh() {
      if (document.visibilityState === 'visible') {
        void loadOrders();
      }
    }

    window.addEventListener('focus', handleVisibilityRefresh);
    document.addEventListener('visibilitychange', handleVisibilityRefresh);
    return () => {
      window.removeEventListener('focus', handleVisibilityRefresh);
      document.removeEventListener('visibilitychange', handleVisibilityRefresh);
    };
  }, [loadOrders]);

  useEffect(() => {
    resetSort();
  }, [selectedCompanyId, resetSort]);

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

  const sortedOrders = useMemo(
    () =>
      sortTableRows(
        orders,
        sortColumn,
        sortDirection,
        {
          type: o => (o.documentType === 'PR' ? 'PR' : 'PO'),
          number: o => o.poNumber,
          vendor: o => o.vendorName,
          ordered: o => o.orderDate,
          delivery: o => o.deliveryDate,
          items: o => o.items.length,
          total: o => orderTotal(o),
          status: o => resolvePurchaseOrderStatusLabel(o),
        },
        { tieBreaker: (a, b) => compareSortValues(a.poNumber, b.poNumber) },
      ),
    [orders, sortColumn, sortDirection],
  );

  const scrollRootRef = useRef<HTMLDivElement>(null);
  const {
    visibleItems: pagedOrders,
    hasMore,
    sentinelRef,
    totalCount,
    visibleCount, nextPageSize, loadMore } = useInfiniteScrollSlice(sortedOrders, { scrollRootRef });

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
          <RefreshCw size={12}  />
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
            <thead className="bg-muted/30">
              <SortableTableHeaderRow
                columns={ACTIVE_PURCHASE_TABLE_COLUMNS}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSort={toggleSort}
                className="border-b border-border"
              />
            </thead>
            <tbody>
              {loading && orders.length === 0 ? (
                <TableLoadingRow colSpan={9} label="Loading…" />
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
                    <td className={`${tdCls} font-sans`}>{rm(orderTotal(order))}</td>
                    <td className={tdCls}>{statusBadge(order)}</td>
                    <td className={tdCls}>
                      <span className="text-xs font-medium text-primary">{nextActionLabel(order)}</span>
                    </td>
                  </tr>
                ))
              )}
              <InfiniteScrollTableSentinel colSpan={9} hasMore={hasMore} onLoadMore={loadMore} nextPageSize={nextPageSize} sentinelRef={sentinelRef} totalCount={totalCount} visibleCount={visibleCount} />
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
