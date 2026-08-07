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

type SummaryBucket =
  | 'purchase_request'
  | 'po_accepted'
  | 'received'
  | 'reconciled'
  | 'pre_committed';

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

const SUMMARY_BOXES: {
  id: SummaryBucket;
  label: string;
  empty: string;
  hint: string;
}[] = [
  {
    id: 'purchase_request',
    label: 'Purchase Request',
    empty: 'No purchase requests awaiting approval.',
    hint: 'Pending approval — click a line to open and approve.',
  },
  {
    id: 'po_accepted',
    label: 'PO accepted',
    empty: 'No accepted purchase orders awaiting receive.',
    hint: 'Vendor-accepted / open POs ready to receive into stock.',
  },
  {
    id: 'received',
    label: 'Received',
    empty: 'No received purchases awaiting consolidate.',
    hint: 'Received or partially delivered — consolidate / finalize next.',
  },
  {
    id: 'reconciled',
    label: 'Reconciled',
    empty: 'No reconciled purchase orders.',
    hint: 'Accounting consolidated — click a line to view.',
  },
  {
    id: 'pre_committed',
    label: 'Pre-committed Purchase Order',
    empty: 'No active pre-committed purchase orders.',
    hint: 'Blanket commitments available for drawdown — click a line to view.',
  },
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

function nextActionLabel(order: PurchaseOrder): string {
  if (order.isPreCommitted) return 'View';
  if (order.canApprove) return 'Approve';
  if (order.canReceive) return 'Receive';
  if (order.canReconcile) return order.allowPartialDelivery ? 'Consolidate' : 'Reconcile';
  if (order.canFinalizeDelivery) return 'Finalize';
  return 'View';
}

function isPurchaseRequestOrder(order: PurchaseOrder): boolean {
  return order.documentType === 'PR'
    || order.status === 'Pending Approval'
    || order.canApprove === true;
}

/** Workflow bucket for Active Purchase KPI boxes. */
export function resolveActivePurchaseBucket(order: PurchaseOrder): SummaryBucket | null {
  if (order.isPreCommitted) return 'pre_committed';
  if (isPurchaseRequestOrder(order)) return 'purchase_request';
  if (order.status === 'Reconciled') return 'reconciled';
  if (order.status === 'Received' || order.status === 'Partially Delivered') return 'received';
  if (
    order.canReceive
    || order.status === 'Open'
    || order.status === 'Pending'
    || order.status === 'Confirmed'
    || order.status === 'Accepted'
    || order.status === 'In Transit'
  ) {
    return 'po_accepted';
  }
  return null;
}

export function ActivePurchasePage({ selectedCompanyId, embedded = false }: Props) {
  const { rm } = useCountryFormatters();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [selectedBucket, setSelectedBucket] = useState<SummaryBucket | null>(null);
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
    setSelectedBucket(null);
    setSelectedOrderId(null);
  }, [selectedCompanyId, resetSort]);

  const selectedOrder = useMemo(
    () => orders.find(o => o.id === selectedOrderId) ?? null,
    [orders, selectedOrderId],
  );

  const bucketed = useMemo(() => {
    const map: Record<SummaryBucket, PurchaseOrder[]> = {
      purchase_request: [],
      po_accepted: [],
      received: [],
      reconciled: [],
      pre_committed: [],
    };
    for (const order of orders) {
      const bucket = resolveActivePurchaseBucket(order);
      if (bucket) map[bucket].push(order);
    }
    return map;
  }, [orders]);

  const summaryOrders = useMemo(
    () => (selectedBucket ? bucketed[selectedBucket] : []),
    [bucketed, selectedBucket],
  );

  const sortedOrders = useMemo(
    () =>
      sortTableRows(
        summaryOrders,
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
    [summaryOrders, sortColumn, sortDirection],
  );

  const scrollRootRef = useRef<HTMLDivElement>(null);
  const {
    visibleItems: pagedOrders,
    hasMore,
    sentinelRef,
    totalCount,
    visibleCount,
    nextPageSize,
    loadMore,
  } = useInfiniteScrollSlice(sortedOrders, { scrollRootRef });

  function handleOrderUpdated(updated: PurchaseOrder) {
    setOrders(prev => {
      if (updated.status === 'Commitment Closed') {
        return prev.filter(o => o.id !== updated.id);
      }
      const exists = prev.some(o => o.id === updated.id);
      if (!exists) return [updated, ...prev];
      return prev.map(o => (o.id === updated.id ? updated : o));
    });
    // Keep panel open after workflow steps; close only when commitment masters close.
    if (updated.status === 'Commitment Closed') {
      setSelectedOrderId(null);
    } else {
      setSelectedOrderId(updated.id);
      const nextBucket = resolveActivePurchaseBucket(updated);
      if (nextBucket) setSelectedBucket(nextBucket);
    }
  }

  function toggleBucket(bucket: SummaryBucket) {
    setSelectedBucket(prev => (prev === bucket ? null : bucket));
  }

  const activeBox = SUMMARY_BOXES.find(b => b.id === selectedBucket) ?? null;

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
            <RefreshCw size={12} />
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {SUMMARY_BOXES.map(box => {
          const count = bucketed[box.id].length;
          const selected = selectedBucket === box.id;
          return (
            <button
              key={box.id}
              type="button"
              onClick={() => toggleBucket(box.id)}
              aria-pressed={selected}
              className={`rounded-lg border bg-card p-4 text-left transition-colors ${
                selected
                  ? 'border-primary ring-2 ring-primary/30 bg-primary/5'
                  : 'border-border hover:border-primary/40 hover:bg-muted/30'
              }`}
            >
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{box.label}</p>
              <p className="text-2xl font-semibold mt-1 tabular-nums">{loading ? '…' : count}</p>
            </button>
          );
        })}
      </div>

      {activeBox ? (
        <div className="bg-card border border-border rounded-lg overflow-hidden flex flex-col min-h-0">
          <div className="px-4 py-3 border-b border-border shrink-0 bg-card">
            <h2 className="text-sm font-semibold">{activeBox.label}</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">{activeBox.hint}</p>
          </div>
          <TableScrollContainer
            ref={scrollRootRef}
            className="max-h-[calc(100vh-12rem)] overflow-y-auto min-h-0"
            tableId={`revenue.active-purchase.${activeBox.id}`}
          >
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
                {loading && summaryOrders.length === 0 ? (
                  <TableLoadingRow colSpan={9} label="Loading…" />
                ) : summaryOrders.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      {activeBox.empty}
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
                <InfiniteScrollTableSentinel
                  colSpan={9}
                  hasMore={hasMore}
                  onLoadMore={loadMore}
                  nextPageSize={nextPageSize}
                  sentinelRef={sentinelRef}
                  totalCount={totalCount}
                  visibleCount={visibleCount}
                />
              </tbody>
            </table>
          </TableScrollContainer>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-6">
          Select a box above to view purchase requests or orders in that stage.
        </p>
      )}

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
