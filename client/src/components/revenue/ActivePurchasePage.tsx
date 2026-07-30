import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { useTableSort } from '../../hooks/useTableSort';
import { sortTableRows, compareSortValues } from '../../utils/tableSort';
import { SortableTableHeaderRow, TableColGroup, tableColWidth, type SortableColumnDef } from '../shared/SortableTableHead';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { pageShellClass, TABLE_COL_ACTION } from '../layout/pageLayout';
import { PageStickyFilters } from '../layout/PageStickyFilters';
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
  { key: 'type', label: 'Type', ...tableColWidth('8%') },
  { key: 'number', label: 'Number', ...tableColWidth('12%') },
  { key: 'vendor', label: 'Vendor', ...tableColWidth('16%') },
  { key: 'ordered', label: 'Ordered', ...tableColWidth('11%') },
  { key: 'delivery', label: 'Delivery', ...tableColWidth('11%') },
  { key: 'items', label: 'Items', align: 'right', ...tableColWidth('7%') },
  { key: 'total', label: 'Total', align: 'right', ...tableColWidth('10%') },
  { key: 'status', label: 'Status', ...tableColWidth('12%') },
  { key: 'action', label: 'Action', sortable: false, ...TABLE_COL_ACTION },
];

type PreCommittedSortColumn =
  | 'number'
  | 'vendor'
  | 'commitment'
  | 'committed'
  | 'consolidated'
  | 'remaining'
  | 'status'
  | 'action';

const PRE_COMMITTED_TABLE_COLUMNS: SortableColumnDef<PreCommittedSortColumn>[] = [
  { key: 'number', label: 'Number', ...tableColWidth('12%') },
  { key: 'vendor', label: 'Vendor', ...tableColWidth('16%') },
  { key: 'commitment', label: 'Commitment', ...tableColWidth('14%') },
  { key: 'committed', label: 'Committed qty', align: 'right', ...tableColWidth('12%') },
  { key: 'consolidated', label: 'Received & consolidated', align: 'right', ...tableColWidth('14%') },
  { key: 'remaining', label: 'Remaining to order', align: 'right', ...tableColWidth('12%') },
  { key: 'status', label: 'Status', ...tableColWidth('10%') },
  { key: 'action', label: 'Action', sortable: false, ...TABLE_COL_ACTION },
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

function documentTypeLabel(order: PurchaseOrder): string {
  if (order.isPreCommitted) return 'Pre-PO';
  if (order.documentType === 'PR') return 'PR';
  return 'PO';
}

function commitmentLabel(order: PurchaseOrder): string {
  return `${order.commitmentStartDate ?? '—'} → ${order.commitmentEndDate ?? '—'}`;
}

function committedQty(order: PurchaseOrder): number {
  return order.committedQuantity
    ?? order.items.reduce((sum, item) => sum + item.quantity, 0);
}

function consolidatedQty(order: PurchaseOrder): number {
  return order.consolidatedQuantity
    ?? order.items.reduce((sum, item) => sum + (item.consolidatedQuantity ?? 0), 0);
}

function remainingToOrderQty(order: PurchaseOrder): number {
  return order.items.reduce((sum, item) => {
    const remaining = item.remainingCommitmentQuantity
      ?? item.remainingQuantity
      ?? Math.max(0, item.quantity - (item.drawnQuantity ?? 0));
    return sum + remaining;
  }, 0);
}

function nextActionLabel(order: PurchaseOrder): string {
  if (order.isPreCommitted) return 'View';
  if (order.canApprove) return 'Approve';
  if (order.canReceive) return 'Receive';
  if (order.canReconcile) return order.allowPartialDelivery ? 'Consolidate' : 'Reconcile';
  if (order.canFinalizeDelivery) return 'Finalize';
  return 'View';
}

export function ActivePurchasePage({ selectedCompanyId, embedded = false }: Props) {
  const { rm, number } = useCountryFormatters();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const { sortColumn, sortDirection, toggleSort, resetSort } = useTableSort<ActivePurchaseSortColumn>();
  const {
    sortColumn: preSortColumn,
    sortDirection: preSortDirection,
    toggleSort: togglePreSort,
    resetSort: resetPreSort,
  } = useTableSort<PreCommittedSortColumn>();

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
    resetPreSort();
  }, [selectedCompanyId, resetSort, resetPreSort]);

  const selectedOrder = useMemo(
    () => orders.find(o => o.id === selectedOrderId) ?? null,
    [orders, selectedOrderId],
  );

  const purchaseRequests = useMemo(
    () => orders.filter(o => o.documentType === 'PR' || o.status === 'Pending Approval'),
    [orders],
  );
  const purchaseOrders = useMemo(
    () => orders.filter(o => !(o.documentType === 'PR' || o.status === 'Pending Approval') && !o.isPreCommitted),
    [orders],
  );
  const committedOrders = useMemo(
    () => orders.filter(o => o.isPreCommitted),
    [orders],
  );
  const releaseOrders = useMemo(
    () => orders.filter(o => !o.isPreCommitted),
    [orders],
  );

  const sortedCommitted = useMemo(
    () =>
      sortTableRows(
        committedOrders,
        preSortColumn,
        preSortDirection,
        {
          number: o => o.poNumber,
          vendor: o => o.vendorName,
          commitment: o => commitmentLabel(o),
          committed: o => committedQty(o),
          consolidated: o => consolidatedQty(o),
          remaining: o => remainingToOrderQty(o),
          status: o => resolvePurchaseOrderStatusLabel(o),
        },
        { tieBreaker: (a, b) => compareSortValues(a.poNumber, b.poNumber) },
      ),
    [committedOrders, preSortColumn, preSortDirection],
  );

  const sortedOrders = useMemo(
    () =>
      sortTableRows(
        releaseOrders,
        sortColumn,
        sortDirection,
        {
          type: o => documentTypeLabel(o),
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
    [releaseOrders, sortColumn, sortDirection],
  );

  const scrollRootRef = useRef<HTMLDivElement>(null);
  const preScrollRootRef = useRef<HTMLDivElement>(null);
  const {
    visibleItems: pagedOrders,
    hasMore,
    sentinelRef,
    totalCount,
    visibleCount, nextPageSize, loadMore } = useInfiniteScrollSlice(sortedOrders, { scrollRootRef });
  const {
    visibleItems: pagedCommitted,
    hasMore: preHasMore,
    sentinelRef: preSentinelRef,
    totalCount: preTotalCount,
    visibleCount: preVisibleCount,
    nextPageSize: preNextPageSize,
    loadMore: preLoadMore,
  } = useInfiniteScrollSlice(sortedCommitted, { scrollRootRef: preScrollRootRef });

  function handleOrderUpdated(updated: PurchaseOrder) {
    setOrders(prev => {
      if (updated.status === 'Reconciled' || updated.status === 'Commitment Closed') {
        return prev.filter(o => o.id !== updated.id);
      }
      const exists = prev.some(o => o.id === updated.id);
      if (!exists) return [updated, ...prev];
      return prev.map(o => (o.id === updated.id ? updated : o));
    });
    setSelectedOrderId(
      updated.status === 'Reconciled' || updated.status === 'Commitment Closed'
        ? null
        : updated.id,
    );
  }

  return (
    <div className={pageShellClass({ embedded })}>
      <PageStickyFilters opaque className="py-2">
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
      </PageStickyFilters>

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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
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
        <div className="rounded-lg border border-teal-500/30 bg-teal-500/5 p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Pre-committed</p>
          <p className="text-2xl font-semibold mt-1">{committedOrders.length}</p>
        </div>
      </div>

      <div className="bg-card border border-teal-500/30 rounded-lg overflow-hidden">
        <div data-table-title data-sticky-table-title className="px-4 py-3 border-b border-teal-500/20 bg-teal-500/5">
          <h2 className="text-sm font-semibold">Pre-committed POs</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Company-level commitments sit above regular purchases. Received &amp; consolidated updates only after
            each drawdown PO is received and consolidated — masters do not affect inbound stock directly.
          </p>
        </div>
        <TableScrollContainer ref={preScrollRootRef} className="max-h-[min(40vh,22rem)] overflow-y-auto">
          <table className="w-full">
            <TableColGroup columns={PRE_COMMITTED_TABLE_COLUMNS} />
            <thead className="bg-muted/30">
              <SortableTableHeaderRow
                columns={PRE_COMMITTED_TABLE_COLUMNS}
                sortColumn={preSortColumn}
                sortDirection={preSortDirection}
                onSort={togglePreSort}
                className="border-b border-border"
              />
            </thead>
            <tbody>
              {loading && committedOrders.length === 0 ? (
                <TableLoadingRow colSpan={8} label="Loading…" />
              ) : committedOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No active Pre-committed POs. Create one from My Order → Pre-committed PO.
                  </td>
                </tr>
              ) : (
                pagedCommitted.map(order => (
                  <tr
                    key={order.id}
                    className="hover:bg-muted/20 cursor-pointer"
                    onClick={() => setSelectedOrderId(order.id)}
                  >
                    <td className={`${tdCls} font-sans text-primary`}>{order.poNumber}</td>
                    <td className={tdCls}>{order.vendorName}</td>
                    <td className={`${tdCls} font-sans text-muted-foreground`}>{commitmentLabel(order)}</td>
                    <td className={`${tdCls} font-sans tabular-nums text-right`}>{number(committedQty(order))}</td>
                    <td className={`${tdCls} font-sans tabular-nums text-right`}>{number(consolidatedQty(order))}</td>
                    <td className={`${tdCls} font-sans tabular-nums text-right`}>{number(remainingToOrderQty(order))}</td>
                    <td className={tdCls}>{statusBadge(order)}</td>
                    <td className={tdCls}>
                      <span className="text-xs font-medium text-primary">View</span>
                    </td>
                  </tr>
                ))
              )}
              <InfiniteScrollTableSentinel
                colSpan={8}
                hasMore={preHasMore}
                onLoadMore={preLoadMore}
                nextPageSize={preNextPageSize}
                sentinelRef={preSentinelRef}
                totalCount={preTotalCount}
                visibleCount={preVisibleCount}
              />
            </tbody>
          </table>
        </TableScrollContainer>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div data-table-title data-sticky-table-title className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">Unreconciled purchases</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Issue regular POs as usual. Matching Pre-committed products use commitment delivery unit and price;
            qty draws against the commitment above.
          </p>
        </div>
        <TableScrollContainer ref={scrollRootRef} className="max-h-[calc(100vh-12rem)] overflow-y-auto">
          <table className="w-full">
            <TableColGroup columns={ACTIVE_PURCHASE_TABLE_COLUMNS} />
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
              {loading && releaseOrders.length === 0 ? (
                <TableLoadingRow colSpan={9} label="Loading…" />
              ) : releaseOrders.length === 0 ? (
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
                    <td className={tdCls}>{documentTypeLabel(order)}</td>
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
