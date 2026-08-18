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
import { api, type DeliveryLocation, type PurchaseOrder } from '../../api';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';
import { refreshVendorProductPricesFromApi } from '../../data/vendorProductPrices';
import { ActivePurchasePanel } from './ActivePurchasePanel';
import { PreCommittedProgressSummary } from './PreCommittedProgressSummary';
import {
  purchaseOrderStatusBadgeClass,
  resolvePurchaseOrderStatusLabel,
} from '../../data/purchaseOrderStatus';
import { formatCommitmentDate } from '../../data/preCommittedProgress';
import { TableLoadingRow } from '../shared/MillstoneLoader';
import { filterSelectCls } from '../layout/formControls';
import { commitmentVendorProductLabel } from '../../data/createOrder';

type Props = {
  selectedCompanyId: number | null;
  selectedLocationIds?: string[];
  embedded?: boolean;
};

const tdCls = 'px-3 py-2.5 align-middle border-r border-b border-border last:border-r-0 text-xs';

export type ActivePurchaseSummaryBucket =
  | 'purchase_request'
  | 'po_accepted'
  | 'received'
  | 'reconciled'
  | 'expired'
  | 'pre_committed';

type SummaryBucket = ActivePurchaseSummaryBucket;

/** Purchase Request summary — group detail lines by one of these dimensions. */
type PrViewBy = 'location' | 'vendor' | 'vendor_product' | 'po_number';

type PrSummaryLine = {
  key: string;
  orderId: number;
  poNumber: string;
  vendorName: string;
  vendorProductName: string;
  deliveryUnit: string;
  qtyOrdered: number;
  location: string;
};

type ActivePurchaseSortColumn =
  | 'type'
  | 'number'
  | 'vendor'
  | 'shipTo'
  | 'ordered'
  | 'delivery'
  | 'items'
  | 'total'
  | 'status'
  | 'action';

type PrLineSortColumn =
  | 'poNumber'
  | 'vendor'
  | 'vendorProduct'
  | 'deliveryUnit'
  | 'qtyOrdered'
  | 'location';

const ACTIVE_PURCHASE_TABLE_COLUMNS: SortableColumnDef<ActivePurchaseSortColumn>[] = [
  { key: 'type', label: 'Type', ...tableColWidth('7%') },
  { key: 'number', label: 'Number', ...tableColWidth('11%') },
  { key: 'vendor', label: 'Vendor', ...tableColWidth('13%') },
  { key: 'shipTo', label: 'Delivery location', ...tableColWidth('14%') },
  { key: 'ordered', label: 'Ordered', ...tableColWidth('9%') },
  { key: 'delivery', label: 'Delivery', ...tableColWidth('9%') },
  { key: 'items', label: 'Items', align: 'right', ...tableColWidth('6%') },
  { key: 'total', label: 'Total', align: 'right', ...tableColWidth('9%') },
  { key: 'status', label: 'Status', ...tableColWidth('11%') },
  { key: 'action', label: 'Action', sortable: false, ...TABLE_COL_ACTION },
];

const PR_SUMMARY_TABLE_COLUMNS: SortableColumnDef<PrLineSortColumn>[] = [
  { key: 'poNumber', label: 'PO Number', ...tableColWidth('14%') },
  { key: 'vendor', label: 'Vendor', ...tableColWidth('18%') },
  { key: 'vendorProduct', label: 'Vendor Product', ...tableColWidth('22%') },
  { key: 'deliveryUnit', label: 'Delivery Unit', ...tableColWidth('14%') },
  { key: 'qtyOrdered', label: 'QTY Ordered', align: 'right', ...tableColWidth('12%') },
  { key: 'location', label: 'Location', ...tableColWidth('20%') },
];

const PR_VIEW_BY_OPTIONS: { id: PrViewBy; label: string }[] = [
  { id: 'location', label: 'Location' },
  { id: 'vendor', label: 'Vendor' },
  { id: 'vendor_product', label: 'Vendor Product' },
  { id: 'po_number', label: 'PO Number' },
];

function shipToLabel(order: PurchaseOrder, outletsById: Map<string, string>): string {
  if (order.deliveryLocation?.name?.trim()) return order.deliveryLocation.name.trim();
  const ids = order.locationExternalIds ?? [];
  if (ids.length === 0) return '—';
  const names = ids.map(id => outletsById.get(id) || id);
  if (names.length === 1) return names[0];
  return `${names[0]} +${names.length - 1}`;
}

function buildPurchaseRequestSummaryLines(
  orders: PurchaseOrder[],
  outletsById: Map<string, string>,
): PrSummaryLine[] {
  const lines: PrSummaryLine[] = [];
  for (const order of orders) {
    const location = shipToLabel(order, outletsById);
    for (const item of order.items) {
      if (item.isReturnableDeposit) continue;
      lines.push({
        key: `${order.id}-${item.id}`,
        orderId: order.id,
        poNumber: order.poNumber,
        vendorName: order.vendorName,
        vendorProductName: commitmentVendorProductLabel(item),
        deliveryUnit: (item.deliveryPackage || item.unit || '').trim() || '—',
        qtyOrdered: item.quantity,
        location,
      });
    }
  }
  return lines;
}

function prViewByGroupKey(line: PrSummaryLine, viewBy: PrViewBy): string {
  if (viewBy === 'location') return line.location || '—';
  if (viewBy === 'vendor') return line.vendorName || '—';
  if (viewBy === 'vendor_product') return line.vendorProductName || '—';
  return line.poNumber || '—';
}

function prViewByGroupLabel(viewBy: PrViewBy, key: string): string {
  if (viewBy === 'location') return `Location: ${key}`;
  if (viewBy === 'vendor') return `Vendor: ${key}`;
  if (viewBy === 'vendor_product') return `Vendor Product: ${key}`;
  return `PO Number: ${key}`;
}

export const ACTIVE_PURCHASE_SUMMARY_BOXES: {
  id: SummaryBucket;
  label: string;
  empty: string;
  hint: string;
}[] = [
  {
    id: 'purchase_request',
    label: 'Purchase Request',
    empty: 'No purchase requests awaiting approval.',
    hint: 'Line detail of pending PRs — click a PO Number to open and adjust or approve.',
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
    id: 'expired',
    label: 'Expired',
    empty: 'No expired purchase orders.',
    hint: 'Vendor did not accept within 7 working days — deactivated.',
  },
  {
    id: 'pre_committed',
    label: 'Pre-committed Purchase Order',
    empty: 'No active pre-committed purchase orders.',
    hint: 'Issued, received vs committed, and expiry show under each line — click to open details.',
  },
];

const SUMMARY_BOXES = ACTIVE_PURCHASE_SUMMARY_BOXES;

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
  if (order.status === 'Expired') return 'expired';
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

export function ActivePurchasePage({
  selectedCompanyId,
  selectedLocationIds = [],
  embedded = false,
}: Props) {
  const { rm } = useCountryFormatters();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [selectedBucket, setSelectedBucket] = useState<SummaryBucket | null>(null);
  const [prViewBy, setPrViewBy] = useState<PrViewBy>('vendor');
  const [deliveryLocationFilter, setDeliveryLocationFilter] = useState('');
  const [deliveryLocations, setDeliveryLocations] = useState<DeliveryLocation[]>([]);
  const [outletNameById, setOutletNameById] = useState<Map<string, string>>(() => new Map());
  const { sortColumn, sortDirection, toggleSort, resetSort } = useTableSort<ActivePurchaseSortColumn>();
  const {
    sortColumn: prSortColumn,
    sortDirection: prSortDirection,
    toggleSort: togglePrSort,
    resetSort: resetPrSort,
  } = useTableSort<PrLineSortColumn>();

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
    if (!selectedCompanyId) {
      setDeliveryLocations([]);
      setOutletNameById(new Map());
      setDeliveryLocationFilter('');
      return;
    }
    let cancelled = false;
    void Promise.all([
      api.deliveryLocations({
        companyId: selectedCompanyId,
        locationExternalIds: selectedLocationIds.length > 0 ? selectedLocationIds : undefined,
      }),
      api.locations(),
    ])
      .then(([dls, locs]) => {
        if (cancelled) return;
        setDeliveryLocations(Array.isArray(dls) ? dls : []);
        const map = new Map<string, string>();
        for (const loc of Array.isArray(locs) ? locs : []) {
          if (loc.companyId != null && loc.companyId !== selectedCompanyId) continue;
          map.set(loc.externalId, loc.name);
        }
        setOutletNameById(map);
        setDeliveryLocationFilter(prev => (
          prev && (Array.isArray(dls) ? dls : []).some(d => d.externalId === prev) ? prev : ''
        ));
      })
      .catch(() => {
        if (!cancelled) {
          setDeliveryLocations([]);
          setOutletNameById(new Map());
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCompanyId, selectedLocationIds]);

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
    resetPrSort();
    setSelectedBucket(null);
    setSelectedOrderId(null);
    setPrViewBy('vendor');
  }, [selectedCompanyId, resetSort, resetPrSort]);

  const filteredOrders = useMemo(() => {
    if (!deliveryLocationFilter) return orders;
    return orders.filter(o => o.deliveryLocationExternalId === deliveryLocationFilter);
  }, [orders, deliveryLocationFilter]);

  const selectedOrder = useMemo(
    () => filteredOrders.find(o => o.id === selectedOrderId) ?? orders.find(o => o.id === selectedOrderId) ?? null,
    [filteredOrders, orders, selectedOrderId],
  );

  const bucketed = useMemo(() => {
    const map: Record<SummaryBucket, PurchaseOrder[]> = {
      purchase_request: [],
      po_accepted: [],
      received: [],
      reconciled: [],
      expired: [],
      pre_committed: [],
    };
    for (const order of filteredOrders) {
      const bucket = resolveActivePurchaseBucket(order);
      if (bucket) map[bucket].push(order);
    }
    return map;
  }, [filteredOrders]);

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
          shipTo: o => shipToLabel(o, outletNameById),
          ordered: o => o.orderDate,
          delivery: o => o.deliveryDate,
          items: o => o.items.length,
          total: o => orderTotal(o),
          status: o => resolvePurchaseOrderStatusLabel(o),
        },
        { tieBreaker: (a, b) => compareSortValues(a.poNumber, b.poNumber) },
      ),
    [summaryOrders, sortColumn, sortDirection, outletNameById],
  );

  const prSummaryLines = useMemo(
    () => (selectedBucket === 'purchase_request'
      ? buildPurchaseRequestSummaryLines(summaryOrders, outletNameById)
      : []),
    [selectedBucket, summaryOrders, outletNameById],
  );

  const sortedPrLines = useMemo(
    () =>
      sortTableRows(
        prSummaryLines,
        prSortColumn,
        prSortDirection,
        {
          poNumber: line => line.poNumber,
          vendor: line => line.vendorName,
          vendorProduct: line => line.vendorProductName,
          deliveryUnit: line => line.deliveryUnit,
          qtyOrdered: line => line.qtyOrdered,
          location: line => line.location,
        },
        { tieBreaker: (a, b) => compareSortValues(a.poNumber, b.poNumber) },
      ),
    [prSummaryLines, prSortColumn, prSortDirection],
  );

  const groupedPrLines = useMemo(() => {
    const groups = new Map<string, PrSummaryLine[]>();
    for (const line of sortedPrLines) {
      const key = prViewByGroupKey(line, prViewBy);
      const bucket = groups.get(key);
      if (bucket) bucket.push(line);
      else groups.set(key, [line]);
    }
    return [...groups.entries()].map(([key, rows]) => ({ key, rows }));
  }, [sortedPrLines, prViewBy]);

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

  const {
    visibleItems: pagedPrGroups,
    hasMore: prHasMore,
    sentinelRef: prSentinelRef,
    totalCount: prGroupTotal,
    visibleCount: prGroupVisible,
    nextPageSize: prNextPageSize,
    loadMore: loadMorePrGroups,
  } = useInfiniteScrollSlice(groupedPrLines, { scrollRootRef });

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
    setSelectedBucket(prev => {
      const next = prev === bucket ? null : bucket;
      if (next === 'purchase_request') resetPrSort();
      return next;
    });
  }

  const activeBox = SUMMARY_BOXES.find(b => b.id === selectedBucket) ?? null;
  const isPurchaseRequestSummary = selectedBucket === 'purchase_request';
  const tableColumns = useMemo(() => {
    if (selectedBucket !== 'pre_committed') return ACTIVE_PURCHASE_TABLE_COLUMNS;
    return ACTIVE_PURCHASE_TABLE_COLUMNS.map(col => {
      if (col.key === 'delivery') return { ...col, label: 'Expires' };
      if (col.key === 'shipTo') return { ...col, label: 'Drawdown locations' };
      return col;
    });
  }, [selectedBucket]);

  return (
    <div className={pageShellClass({ embedded })}>
      <PageStickyFilters opaque className="py-2">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-[12rem] max-w-xs flex-1">
            <label htmlFor="active-po-delivery-location-filter" className="text-[10px] font-sans uppercase tracking-wider text-muted-foreground">
              Delivery location
            </label>
            <select
              id="active-po-delivery-location-filter"
              value={deliveryLocationFilter}
              onChange={e => setDeliveryLocationFilter(e.target.value)}
              disabled={!selectedCompanyId}
              className={`${filterSelectCls} mt-1 w-full`}
            >
              <option value="">All (outlet or delivery)</option>
              {deliveryLocations.map(dl => (
                <option key={dl.externalId} value={dl.externalId}>
                  {dl.name}{dl.city ? ` · ${dl.city}` : ''}
                </option>
              ))}
            </select>
          </div>
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
          <div className="px-4 py-3 border-b border-border shrink-0 bg-card space-y-3">
            <div>
              <h2 className="text-sm font-semibold">{activeBox.label} Summary</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">{activeBox.hint}</p>
            </div>
            {isPurchaseRequestSummary ? (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-sans uppercase tracking-wider text-muted-foreground">
                  View by
                </span>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  {PR_VIEW_BY_OPTIONS.map(option => (
                    <label
                      key={option.id}
                      className="inline-flex items-center gap-1.5 text-[11px] cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={prViewBy === option.id}
                        onChange={() => setPrViewBy(option.id)}
                        className="rounded border-border"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <TableScrollContainer
            ref={scrollRootRef}
            className="max-h-[calc(100vh-12rem)] overflow-y-auto min-h-0"
            tableId={`revenue.active-purchase.${activeBox.id}`}
          >
            {isPurchaseRequestSummary ? (
              <table className="w-full">
                <TableColGroup columns={PR_SUMMARY_TABLE_COLUMNS} />
                <thead className="bg-muted/30">
                  <SortableTableHeaderRow
                    columns={PR_SUMMARY_TABLE_COLUMNS}
                    sortColumn={prSortColumn}
                    sortDirection={prSortDirection}
                    onSort={togglePrSort}
                    className="border-b border-border"
                  />
                </thead>
                <tbody>
                  {loading && prSummaryLines.length === 0 ? (
                    <TableLoadingRow colSpan={6} label="Loading…" />
                  ) : prSummaryLines.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        {activeBox.empty}
                      </td>
                    </tr>
                  ) : (
                    pagedPrGroups.flatMap(group => [
                      <tr key={`pr-group-${group.key}`} className="bg-muted/30 border-b border-border">
                        <td colSpan={6} className="px-3 py-2 text-[11px] font-semibold text-foreground">
                          {prViewByGroupLabel(prViewBy, group.key)}
                          <span className="text-muted-foreground font-normal ml-2">
                            ({group.rows.length} line{group.rows.length === 1 ? '' : 's'})
                          </span>
                        </td>
                      </tr>,
                      ...group.rows.map(line => (
                        <tr key={line.key} className="hover:bg-muted/20 border-b border-border">
                          <td className={tdCls}>
                            <button
                              type="button"
                              onClick={() => setSelectedOrderId(line.orderId)}
                              className="font-sans text-primary font-medium hover:underline text-left"
                              title="Open purchase request detail"
                            >
                              {line.poNumber}
                            </button>
                          </td>
                          <td className={tdCls}>{line.vendorName}</td>
                          <td className={tdCls}>{line.vendorProductName}</td>
                          <td className={tdCls}>{line.deliveryUnit}</td>
                          <td className={`${tdCls} text-right font-sans tabular-nums`}>
                            {line.qtyOrdered}
                          </td>
                          <td className={tdCls}>{line.location}</td>
                        </tr>
                      )),
                    ])
                  )}
                  <InfiniteScrollTableSentinel
                    colSpan={6}
                    hasMore={prHasMore}
                    onLoadMore={loadMorePrGroups}
                    nextPageSize={prNextPageSize}
                    sentinelRef={prSentinelRef}
                    totalCount={prGroupTotal}
                    visibleCount={prGroupVisible}
                  />
                </tbody>
              </table>
            ) : (
              <table className="w-full">
                <TableColGroup columns={tableColumns} />
                <thead className="bg-muted/30">
                  <SortableTableHeaderRow
                    columns={tableColumns}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={toggleSort}
                    className="border-b border-border"
                  />
                </thead>
                <tbody>
                  {loading && summaryOrders.length === 0 ? (
                    <TableLoadingRow colSpan={10} label="Loading…" />
                  ) : summaryOrders.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-sm text-muted-foreground">
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
                        <td className={`${tdCls} font-sans text-primary`}>
                          <p>{order.poNumber}</p>
                          {order.isPreCommitted ? (
                            <div className="mt-1">
                              <PreCommittedProgressSummary order={order} compact />
                            </div>
                          ) : null}
                        </td>
                        <td className={tdCls}>{order.vendorName}</td>
                        <td className={tdCls}>
                          <p className="font-medium">{shipToLabel(order, outletNameById)}</p>
                          {order.deliveryLocation ? (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {[order.deliveryLocation.city, order.deliveryLocation.postcode].filter(Boolean).join(' · ') || 'Delivery location'}
                            </p>
                          ) : (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {order.isPreCommitted ? 'Drawdown outlets' : 'Outlet'}
                            </p>
                          )}
                        </td>
                        <td className={`${tdCls} font-sans text-muted-foreground`}>{order.orderDate}</td>
                        <td className={`${tdCls} font-sans text-muted-foreground`}>
                          {order.isPreCommitted
                            ? formatCommitmentDate(order.commitmentEndDate)
                            : order.deliveryDate}
                        </td>
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
                    colSpan={10}
                    hasMore={hasMore}
                    onLoadMore={loadMore}
                    nextPageSize={nextPageSize}
                    sentinelRef={sentinelRef}
                    totalCount={totalCount}
                    visibleCount={visibleCount}
                  />
                </tbody>
              </table>
            )}
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
