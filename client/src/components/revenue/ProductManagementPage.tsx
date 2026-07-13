import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { useTableSort } from '../../hooks/useTableSort';
import { sortTableRows, compareSortValues, type SortDirection } from '../../utils/tableSort';
import { SortableTableHeaderRow, type SortableColumnDef } from '../shared/SortableTableHead';
import { tableHeaderCls, TABLE_HEADER_LABEL_CLS } from '../shared/tableHeaderStyles';
import { InfiniteScrollDivSentinel } from '../shared/infiniteScroll';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { pageShellClass, TABLE_SCROLL_CLS } from '../layout/pageLayout';
import { filterSelectCls, inlineNumberCls } from '../layout/formControls';
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { api, ApiError, type Product, type ProductManagementSummary, type ProduceBatchShortage } from '../../api';
import { resolveManagementBatchUnit } from '../../data/productForm';
import { formatCountryNumber } from '../../utils/numberFormat';
import { useOrgCountryCode } from '../../context/OrgCountryContext';
import {
  allocateFifoRemainingBatches,
  compareProductBatchesOldestFirst,
} from '../../data/productManagementFifo';
import { ProductDetailPanel } from './ProductDetailPanel';
import { ProduceBatchModal } from './ProduceBatchModal';
import { resyncStaleTaggedComponentPrices } from '../../utils/resyncTaggedComponentPrices';

type Props = {
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
  embedded?: boolean;
  viewMode?: 'b2b' | 'sub-product';
};

type ManagementBatchRow = Product & {
  rowKey: string;
  batchLogId: number | null;
  isSummaryRow: boolean;
  batchUnit: string;
  inStock: number;
  onOrderQty: number;
  onOrderLocks: { quantity: number; lockExpiryDate: string }[];
  lockExpiryDate: string | null;
  salesPerDay: number;
  toProduceQty: number;
  producedQty: number;
  batchNumber: string | null;
  productionDate: string | null;
  expiryDate: string | null;
  batchQty: number | null;
  fifoRemainingQty?: number;
  incubationQty: number | null;
  incubationTimeLeft: string | null;
  dateRequested: string | null;
};

type ProduceModalTarget = {
  product: ManagementBatchRow;
  purpose: 'queue' | 'produce' | 'edit';
  batchLogId?: number;
};

const PRODUCT_MANAGEMENT_CATEGORIES = ['Food', 'Beverage', 'Retail'] as const;

const tableColGroup = (
  <colgroup>
    <col className="w-[16%]" />
    <col className="w-[11%]" />
    <col className="w-[9%]" />
    <col className="w-[15%]" />
    <col className="w-[12%]" />
    <col className="w-[12%]" />
    <col className="w-[12%]" />
  </colgroup>
);

const tdCls = 'px-3 py-2.5 align-middle border-r border-b border-border last:border-r-0 text-xs';
const filterCls = filterSelectCls;
const actionBtnCls =
  'inline-flex items-center justify-center px-2 py-1 rounded border text-[10px] font-semibold whitespace-nowrap disabled:opacity-50';

type BatchSortColumn =
  | 'name'
  | 'categoryGroup'
  | 'batchUnit'
  | 'onHand'
  | 'onOrder'
  | 'incubation'
  | 'qtyToProduce';

const BATCH_TABLE_COLUMNS: SortableColumnDef<BatchSortColumn>[] = [
  { key: 'name', label: 'Product Name / Product ID' },
  { key: 'categoryGroup', label: 'Category / Group' },
  { key: 'batchUnit', label: 'Delivery Unit', sortable: false },
  { key: 'onHand', label: 'QTY On Hand / Batch Date / Expiry Date' },
  { key: 'onOrder', label: 'QTY On Order', sortable: false },
  { key: 'incubation', label: 'QTY in incubation / Time left', sortable: false },
  { key: 'qtyToProduce', label: 'QTY to Produce / Date requested', align: 'center' },
];

function defaultBatchRowOrder(rows: ManagementBatchRow[]): ManagementBatchRow[] {
  return [...rows].sort((a, b) => {
    if (a.id !== b.id) return a.name.localeCompare(b.name);
    if (a.isSummaryRow !== b.isSummaryRow) return a.isSummaryRow ? -1 : 1;
    return (b.batchLogId ?? 0) - (a.batchLogId ?? 0);
  });
}

function batchSortAccessors() {
  return {
    name: (row: ManagementBatchRow) => row.name,
    categoryGroup: (row: ManagementBatchRow) => `${row.category} ${row.group}`,
    onHand: (row: ManagementBatchRow) => row.inStock,
    onOrder: (row: ManagementBatchRow) => row.onOrderQty,
    incubation: (row: ManagementBatchRow) => row.incubationQty ?? -1,
    qtyToProduce: (row: ManagementBatchRow) => row.toProduceQty,
  };
}

function sortGroupedBatchRows(
  rows: ManagementBatchRow[],
  sortColumn: BatchSortColumn | null,
  sortDirection: SortDirection,
): ManagementBatchRow[] {
  if (!sortColumn) return defaultBatchRowOrder(rows);

  const groups = new Map<number, ManagementBatchRow[]>();
  for (const row of rows) {
    const list = groups.get(row.id) ?? [];
    list.push(row);
    groups.set(row.id, list);
  }

  const summaryRows = [...groups.values()]
    .map(group => group.find(r => r.isSummaryRow) ?? group[0])
    .filter((row): row is ManagementBatchRow => row != null);

  const sortedSummaries = sortTableRows(summaryRows, sortColumn, sortDirection, batchSortAccessors(), {
    tieBreaker: (a, b) => compareSortValues(a.name, b.name),
  });

  const result: ManagementBatchRow[] = [];
  for (const summary of sortedSummaries) {
    const group = groups.get(summary.id) ?? [];
    const summaryRow = group.find(r => r.isSummaryRow);
    if (summaryRow) result.push(summaryRow);
    result.push(
      ...group
        .filter(r => !r.isSummaryRow)
        .sort((a, b) => (b.batchLogId ?? 0) - (a.batchLogId ?? 0)),
    );
  }
  return result;
}

function productMatchesLocations(product: Product, locationIds: string[]): boolean {
  const productLocs = product.locationExternalIds ?? [];
  if (locationIds.length === 0) return false;
  if (productLocs.length === 0) return true;
  return locationIds.some(id => productLocs.includes(id));
}

type ProductTypeFilter = 'b2b' | 'sub-product';

function matchesProductManagementFilters(
  product: Product,
  productTypeFilter: ProductTypeFilter,
): boolean {
  if (!product.active) return false;

  if (productTypeFilter === 'sub-product') {
    return product.isSubProduct;
  }

  return !product.isSubProduct && product.b2bEnabled;
}

function formatQty(value: number, countryCode: string): string {
  if (!Number.isFinite(value)) return formatCountryNumber(0, countryCode);
  return Number.isInteger(value) && value !== 0 ? String(value) : formatCountryNumber(value, countryCode);
}

function formatDisplayDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatCompactLockDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function formatOnOrderWithLocks(
  onOrderQty: number,
  locks: { quantity: number; lockExpiryDate: string }[],
  countryCode: string,
): ReactNode {
  if (!(onOrderQty > 0) && locks.length === 0) return '—';

  if (locks.length === 0) {
    return <span className="font-medium tabular-nums">{formatQty(onOrderQty, countryCode)}</span>;
  }

  // Multiple issued orders: show each qty with its lock expiry, then any unlocked remainder.
  const lockedQty = locks.reduce((sum, lock) => sum + (Number(lock.quantity) || 0), 0);
  const unlockedQty = Math.max(0, onOrderQty - lockedQty);
  const parts = locks.map(lock => (
    <span key={`${lock.lockExpiryDate}-${lock.quantity}`} className="tabular-nums">
      {formatQty(lock.quantity, countryCode)}
      <span className="font-normal text-muted-foreground">
        {' '}({formatCompactLockDate(lock.lockExpiryDate)})
      </span>
    </span>
  ));
  if (unlockedQty > 0) {
    parts.push(
      <span key="unlocked" className="tabular-nums">
        {formatQty(unlockedQty, countryCode)}
      </span>,
    );
  }

  return (
    <span className="font-medium inline-flex flex-wrap items-baseline gap-x-1 gap-y-0.5">
      {parts.map((part, index) => (
        <span key={index} className="inline-flex items-baseline gap-1">
          {index > 0 ? <span className="text-muted-foreground font-normal">·</span> : null}
          {part}
        </span>
      ))}
    </span>
  );
}

function stackedMetric(label: string, value: ReactNode) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-0.5">{value}</div>
    </div>
  );
}

function suggestedProduceQty(product: Pick<ManagementBatchRow, 'salesPerDay' | 'inStock'>): number {
  const target = product.salesPerDay > 0 ? product.salesPerDay : 1;
  const need = Math.max(0, target - product.inStock);
  return need > 0 ? need : 1;
}

function buildBatchRow(product: Product, entry: ProductManagementSummary): ManagementBatchRow {
  const storedUnit = entry.batchUnit ?? entry.packageUnit;
  const isSummaryRow = entry.isSummaryRow === true
    || (entry.batchLogId == null && entry.isSummaryRow !== false);
  return {
    ...product,
    rowKey: `${product.id}-${isSummaryRow ? 'summary' : entry.batchLogId}`,
    batchLogId: isSummaryRow ? null : (entry.batchLogId ?? null),
    isSummaryRow,
    batchUnit: resolveManagementBatchUnit(product, storedUnit),
    inStock: entry.inStock ?? 0,
    onOrderQty: entry.onOrderQty ?? 0,
    onOrderLocks: entry.onOrderLocks ?? [],
    lockExpiryDate: entry.lockExpiryDate ?? null,
    salesPerDay: entry.salesPerDay ?? 0,
    toProduceQty: entry.toProduceQty ?? 0,
    producedQty: entry.producedQty ?? 0,
    batchNumber: entry.batchNumber ?? null,
    productionDate: entry.productionDate ?? null,
    expiryDate: entry.expiryDate ?? null,
    batchQty: entry.batchQty ?? null,
    incubationQty: entry.incubationQty ?? null,
    incubationTimeLeft: entry.incubationTimeLeft ?? null,
    dateRequested: entry.dateRequested ?? null,
  };
}

function primaryCell(isPrimary: boolean, children: ReactNode) {
  if (!isPrimary) return <td className={tdCls} />;
  return <td className={tdCls}>{children}</td>;
}

export function ProductManagementPage({
  selectedCompanyId,
  selectedLocationIds,
  embedded = false,
  viewMode = 'b2b',
}: Props) {
  const countryCode = useOrgCountryCode();
  const orgReady = Boolean(selectedCompanyId) && selectedLocationIds.length > 0;

  const [products, setProducts] = useState<Product[]>([]);
  const [managementRows, setManagementRows] = useState<ProductManagementSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [groupFilter, setGroupFilter] = useState('All');
  const productTypeFilter = viewMode;
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [actionId, setActionId] = useState<number | null>(null);
  const [editingBatchId, setEditingBatchId] = useState<number | null>(null);
  const [produceTarget, setProduceTarget] = useState<ProduceModalTarget | null>(null);
  const [produceError, setProduceError] = useState<string | null>(null);
  const [produceComponents, setProduceComponents] = useState<ProduceBatchShortage[]>([]);
  const [expandedProductIds, setExpandedProductIds] = useState<Set<number>>(() => new Set());
  const { sortColumn, sortDirection, toggleSort, resetSort } = useTableSort<BatchSortColumn>();

  const toggleProductExpanded = useCallback((productId: number) => {
    setExpandedProductIds(prev => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }, []);

  useEffect(() => {
    resetSort();
  }, [search, categoryFilter, groupFilter, productTypeFilter, selectedLocationIds, resetSort]);

  const loadData = useCallback(async () => {
    if (!selectedCompanyId || selectedLocationIds.length === 0) {
      setProducts([]);
      setManagementRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await resyncStaleTaggedComponentPrices();
      const [productData, managementData] = await Promise.all([
        api.products(selectedCompanyId),
        api.productManagement(selectedCompanyId, selectedLocationIds, viewMode),
      ]);
      setProducts(productData);
      setManagementRows(managementData);
    } catch (e) {
      setProducts([]);
      setManagementRows([]);
      setError(e instanceof Error ? e.message : 'Failed to load products.');
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId, selectedLocationIds, viewMode]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function patchManagement(
    productId: number,
    payload: Parameters<typeof api.patchProductManagement>[1],
  ) {
    setSavingId(productId);
    setError(null);
    try {
      await api.patchProductManagement(productId, payload);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update product management.');
    } finally {
      setSavingId(null);
    }
  }

  function openProduceModal(product: ManagementBatchRow, purpose: 'queue' | 'produce') {
    setProduceError(null);
    setProduceComponents([]);
    setProduceTarget({ product, purpose });
  }

  function openEditBatchModal(row: ManagementBatchRow) {
    if (!row.batchLogId) return;
    setProduceError(null);
    setProduceComponents([]);
    setProduceTarget({ product: row, purpose: 'edit', batchLogId: row.batchLogId });
  }

  async function confirmProduceAction(
    batchQty: number,
    productionDate: string,
    expiryDate?: string,
    overrideStock = false,
  ) {
    if (!produceTarget) return;
    const { product, purpose } = produceTarget;
    setActionId(product.id);
    setProduceError(null);
    try {
      if (purpose === 'queue') {
        await api.markProductToProduce(product.id, {
          locationExternalIds: selectedLocationIds,
          batchQty,
          productionDate,
        });
      } else {
        await api.produceProductBatches(product.id, {
          locationExternalIds: selectedLocationIds,
          batchQty,
          productionDate,
          expiryDate,
          overrideStock: overrideStock === true,
        });
      }
      await loadData();
      setProduceComponents([]);
      setProduceTarget(null);
    } catch (e) {
      if (e instanceof ApiError) {
        const lines = e.components?.length
          ? e.components
          : (e.shortages ?? []);
        if (lines.length > 0) {
          setProduceComponents(lines);
        }
        setProduceError(e.message);
      } else {
        setProduceComponents([]);
        setProduceError(e instanceof Error ? e.message : 'Failed to save production.');
      }
    } finally {
      setActionId(null);
    }
  }

  async function confirmEditBatchAction(
    batchQty: number,
    productionDate: string,
    expiryDate?: string,
    overrideStock = false,
  ) {
    if (!produceTarget?.batchLogId) return;
    setEditingBatchId(produceTarget.batchLogId);
    setProduceError(null);
    try {
      await api.patchProductionBatch(produceTarget.batchLogId, {
        batchQty,
        productionDate,
        expiryDate,
        overrideStock: overrideStock === true,
      });
      await loadData();
      setProduceComponents([]);
      setProduceTarget(null);
    } catch (e) {
      if (e instanceof ApiError) {
        const lines = e.components?.length ? e.components : (e.shortages ?? []);
        if (lines.length > 0) setProduceComponents(lines);
        setProduceError(e.message);
      } else {
        setProduceComponents([]);
        setProduceError(e instanceof Error ? e.message : 'Failed to update batch.');
      }
    } finally {
      setEditingBatchId(null);
    }
  }

  const categoryOptions = useMemo(
    () => [...PRODUCT_MANAGEMENT_CATEGORIES],
    [],
  );

  const groupOptions = useMemo(() => {
    const fromProducts = products
      .filter(p => p.active && PRODUCT_MANAGEMENT_CATEGORIES.includes(p.category as typeof PRODUCT_MANAGEMENT_CATEGORIES[number]))
      .map(p => p.group)
      .filter(Boolean);
    return [...new Set(fromProducts)].sort((a, b) => a.localeCompare(b));
  }, [products]);

  const { productSummaries, fifoBatchRowsByProductId } = useMemo(() => {
    const productById = new Map(products.map(product => [product.id, product]));

    let rows = managementRows
      .map(entry => {
        const product = productById.get(entry.productId);
        if (!product) return null;
        if (!matchesProductManagementFilters(product, productTypeFilter)) return null;
        if (!productMatchesLocations(product, selectedLocationIds)) return null;
        if (!PRODUCT_MANAGEMENT_CATEGORIES.includes(product.category as typeof PRODUCT_MANAGEMENT_CATEGORIES[number])) {
          return null;
        }
        return buildBatchRow(product, entry);
      })
      .filter((row): row is ManagementBatchRow => row !== null);

    if (categoryFilter !== 'All') {
      rows = rows.filter(row => row.category === categoryFilter);
    }
    if (groupFilter !== 'All') {
      rows = rows.filter(row => row.group === groupFilter);
    }

    const query = search.trim().toLowerCase();
    if (query) {
      rows = rows.filter(row => [
        row.productId,
        row.name,
        row.category,
        row.group,
        row.batchNumber ?? '',
      ].join(' ').toLowerCase().includes(query));
    }

    const grouped = new Map<number, { summary: ManagementBatchRow | null; batches: ManagementBatchRow[] }>();
    for (const row of rows) {
      const group = grouped.get(row.id) ?? { summary: null, batches: [] };
      if (row.isSummaryRow) group.summary = row;
      else group.batches.push(row);
      grouped.set(row.id, group);
    }

    const interleaved = sortGroupedBatchRows(rows, sortColumn, sortDirection);
    const sortedSummaries = interleaved.filter(row => row.isSummaryRow);
    const fifoBatches = new Map<number, ManagementBatchRow[]>();

    for (const summary of sortedSummaries) {
      const batches = grouped.get(summary.id)?.batches ?? [];
      const allocations = allocateFifoRemainingBatches(
        batches.map(batch => ({
          batchLogId: batch.batchLogId,
          batchQty: batch.batchQty,
          productionDate: batch.productionDate,
        })),
        summary.inStock,
      );
      const remainingByBatchId = new Map(
        allocations.map(allocation => [allocation.batchLogId, allocation.remainingQty]),
      );
      const fifoRows = batches
        .filter(batch => batch.batchLogId != null && remainingByBatchId.has(batch.batchLogId))
        .map(batch => ({
          ...batch,
          fifoRemainingQty: remainingByBatchId.get(batch.batchLogId!)!,
        }))
        .sort((a, b) => compareProductBatchesOldestFirst(
          { batchLogId: a.batchLogId, batchQty: a.batchQty, productionDate: a.productionDate },
          { batchLogId: b.batchLogId, batchQty: b.batchQty, productionDate: b.productionDate },
        ));
      fifoBatches.set(summary.id, fifoRows);
    }

    return { productSummaries: sortedSummaries, fifoBatchRowsByProductId: fifoBatches };
  }, [products, managementRows, selectedLocationIds, search, categoryFilter, groupFilter, productTypeFilter, sortColumn, sortDirection]);

  const displayRows = useMemo(() => {
    const rows: ManagementBatchRow[] = [];
    for (const summary of productSummaries) {
      rows.push(summary);
      if (expandedProductIds.has(summary.id)) {
        rows.push(...(fifoBatchRowsByProductId.get(summary.id) ?? []));
      }
    }
    return rows;
  }, [productSummaries, fifoBatchRowsByProductId, expandedProductIds]);

  const visibleProductCount = productSummaries.length;

  const visibleBatchLineCount = useMemo(() => {
    let count = 0;
    for (const productId of expandedProductIds) {
      count += fifoBatchRowsByProductId.get(productId)?.length ?? 0;
    }
    return count;
  }, [expandedProductIds, fifoBatchRowsByProductId]);

  const scrollRootRef = useRef<HTMLDivElement>(null);
  const {
    visibleItems: pagedVisibleProducts,
    hasMore,
    sentinelRef,
    totalCount,
    visibleCount,
  } = useInfiniteScrollSlice(displayRows, { scrollRootRef });

  function replaceProduct(updated: Product) {
    setProducts(prev => prev.map(p => (p.id === updated.id ? updated : p)));
    setDetailProduct(prev => (prev?.id === updated.id ? updated : prev));
  }

  const hasActiveFilters = Boolean(
    search.trim()
    || categoryFilter !== 'All'
    || groupFilter !== 'All',
  );

  const emptyMessage = viewMode === 'sub-product'
    ? 'No active sub-products yet. Add sub-products on the Products page and link them to a B2C or B2B product.'
    : 'No active B2B products yet. Enable B2B on a product on the Products page.';

  return (
    <div className={pageShellClass({ embedded })}>
      {!orgReady ? (
        <p className="text-xs text-muted-foreground border border-dashed border-border rounded-lg px-4 py-5 text-center">
          Select a company and at least one location in the header to view products.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id={viewMode === 'sub-product' ? 'sub-product-search' : 'b2b-product-search'}
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by ID or name…"
              className={`${filterCls} flex-1 min-w-[9rem] max-w-[14rem]`}
            />
            <select
              id={viewMode === 'sub-product' ? 'sub-product-category-filter' : 'b2b-product-category-filter'}
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className={filterCls}
              aria-label="Category"
            >
              <option value="All">All categories</option>
              {categoryOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <select
              id={viewMode === 'sub-product' ? 'sub-product-group-filter' : 'b2b-product-group-filter'}
              value={groupFilter}
              onChange={e => setGroupFilter(e.target.value)}
              className={filterCls}
              aria-label="Group"
            >
              <option value="All">All groups</option>
              {groupOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <p className="text-[10px] text-muted-foreground shrink-0">
              {visibleProductCount} {viewMode === 'sub-product' ? 'sub-product' : 'product'}{visibleProductCount !== 1 ? 's' : ''}
              {visibleBatchLineCount > 0
                ? ` · ${visibleBatchLineCount} batch line${visibleBatchLineCount !== 1 ? 's' : ''}`
                : ''}
            </p>
            <button
              type="button"
              onClick={() => void loadData()}
              disabled={loading}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border text-[11px] font-medium hover:bg-muted disabled:opacity-50 shrink-0 ml-auto"
            >
              <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          {error ? (
            <p className="text-xs text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2">
              {error}
            </p>
          ) : null}

          <TableScrollContainer ref={scrollRootRef} className={TABLE_SCROLL_CLS}>
            <div className="min-w-[52rem]">
              <div className="flex border-b border-border bg-muted/20 sticky top-0 z-10">
                <table className="flex-1 table-fixed border-collapse">
                  {tableColGroup}
                  <thead>
                    <SortableTableHeaderRow
                      columns={BATCH_TABLE_COLUMNS}
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={toggleSort}
                      className="bg-muted/20"
                    />
                  </thead>
                </table>
                <div className={`${tableHeaderCls('center')} w-[5.5rem] shrink-0 border-l border-border`}>
                  <span className={TABLE_HEADER_LABEL_CLS}>Actions</span>
                </div>
              </div>

              {loading ? (
                <p className="px-3 py-8 text-center text-xs text-muted-foreground border-b border-border">
                  Loading products…
                </p>
              ) : displayRows.length === 0 ? (
                <p className="px-3 py-8 text-center text-xs text-muted-foreground border-b border-border">
                  {hasActiveFilters
                    ? 'No products match your filters.'
                    : emptyMessage}
                </p>
              ) : (
                <>
                  {pagedVisibleProducts.map(row => {
                    const rowBusy = savingId === row.id || actionId === row.id;
                    const editBusy = row.batchLogId != null && editingBatchId === row.batchLogId;
                    const isSummary = row.isSummaryRow;
                    const isBatchLine = !row.isSummaryRow && row.batchLogId != null;
                    const isExpanded = expandedProductIds.has(row.id);
                    const fifoBatchCount = fifoBatchRowsByProductId.get(row.id)?.length ?? 0;
                    return (
                      <div
                        key={row.rowKey}
                        className={`flex border-b border-border ${
                          isSummary && row.onOrderQty > row.inStock
                            ? 'bg-yellow-300/90 dark:bg-yellow-500/30'
                            : isSummary && row.toProduceQty > 0
                              ? 'bg-amber-50/70 dark:bg-amber-950/20'
                              : ''
                        } ${isBatchLine ? 'bg-muted/10' : ''}`}
                      >
                        <table className="flex-1 table-fixed border-collapse">
                          {tableColGroup}
                          <tbody>
                            <tr className="hover:bg-muted/20">
                              <td className={tdCls}>
                                {isSummary ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => toggleProductExpanded(row.id)}
                                      className="inline-flex items-start gap-1 font-medium text-left hover:text-primary"
                                      aria-expanded={isExpanded}
                                      title={fifoBatchCount > 0
                                        ? `${isExpanded ? 'Hide' : 'Show'} ${fifoBatchCount} batch line${fifoBatchCount !== 1 ? 's' : ''}`
                                        : 'No batch lines on hand'}
                                    >
                                      {fifoBatchCount > 0 ? (
                                        isExpanded
                                          ? <ChevronDown size={14} className="shrink-0 mt-0.5" />
                                          : <ChevronRight size={14} className="shrink-0 mt-0.5" />
                                      ) : (
                                        <span className="w-3.5 shrink-0" aria-hidden />
                                      )}
                                      <span className="hover:underline">{row.name}</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDetailProduct(row)}
                                      className="text-[10px] text-muted-foreground mt-0.5 font-mono hover:text-primary hover:underline text-left"
                                      title="Open product details"
                                    >
                                      {row.productId}
                                    </button>
                                  </>
                                ) : (
                                  <div className="pl-3">
                                    <p className="text-[10px] text-muted-foreground">↳ batch</p>
                                    <p className="text-[11px] font-medium truncate">{row.batchNumber || row.name}</p>
                                  </div>
                                )}
                              </td>
                              {primaryCell(isSummary, (
                                <>
                                  <p>{row.category || '—'}</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">{row.group || '—'}</p>
                                </>
                              ))}
                              {primaryCell(isSummary, row.isSubProduct ? (
                                <span className="font-medium text-foreground" title="Batch size from product yield (QTY/UOM)">
                                  {row.batchUnit}
                                </span>
                              ) : (
                                <input
                                  type="text"
                                  defaultValue={row.batchUnit}
                                  key={`${row.id}-${row.batchUnit}`}
                                  disabled={rowBusy}
                                  onBlur={e => {
                                    const next = e.target.value.trim();
                                    if (!next || next === row.batchUnit) return;
                                    void patchManagement(row.id, {
                                      packageUnit: next,
                                      locationExternalIds: selectedLocationIds,
                                    });
                                  }}
                                  className={`${filterCls} w-full max-w-[5.5rem]`}
                                  aria-label={`Batch unit for ${row.name}`}
                                />
                              ))}
                              <td className={tdCls}>
                                {isSummary ? (
                                  stackedMetric(
                                    'QTY On Hand',
                                    <input
                                      type="number"
                                      min={0}
                                      step="any"
                                      defaultValue={row.inStock}
                                      key={`${row.id}-stock-${row.inStock}`}
                                      disabled={rowBusy}
                                      onBlur={e => {
                                        const next = Number.parseFloat(e.target.value);
                                        if (!Number.isFinite(next) || next < 0 || next === row.inStock) return;
                                        void patchManagement(row.id, {
                                          inStock: next,
                                          locationExternalIds: selectedLocationIds,
                                        });
                                      }}
                                      className={`${inlineNumberCls} w-full max-w-[5rem]`}
                                      aria-label={row.isSubProduct
                                        ? `Batches in stock for ${row.name}`
                                        : `In stock for ${row.name}`}
                                    />,
                                  )
                                ) : (
                                  <div className="space-y-1.5">
                                    {stackedMetric(
                                      'QTY On Hand',
                                      <span className="font-medium tabular-nums">
                                        {row.fifoRemainingQty != null
                                          ? formatQty(row.fifoRemainingQty, countryCode)
                                          : row.batchQty != null
                                            ? formatQty(row.batchQty, countryCode)
                                            : '—'}
                                      </span>,
                                    )}
                                    {stackedMetric('Batch Date', formatDisplayDate(row.productionDate))}
                                    {stackedMetric('Expiry Date', formatDisplayDate(row.expiryDate))}
                                  </div>
                                )}
                              </td>
                              <td className={tdCls}>
                                {isSummary ? (
                                  <div className="space-y-1.5">
                                    {stackedMetric(
                                      'QTY On Order',
                                      formatOnOrderWithLocks(row.onOrderQty, row.onOrderLocks, countryCode),
                                    )}
                                  </div>
                                ) : null}
                              </td>
                              <td className={tdCls}>
                                {isSummary ? (
                                  <div className="space-y-1.5">
                                    {stackedMetric(
                                      'QTY in incubation',
                                      <span className="font-medium tabular-nums">
                                        {row.incubationQty != null && row.incubationQty > 0
                                          ? formatQty(row.incubationQty, countryCode)
                                          : '—'}
                                      </span>,
                                    )}
                                    {stackedMetric(
                                      'Time left',
                                      row.incubationTimeLeft || '—',
                                    )}
                                  </div>
                                ) : (
                                  <div className="space-y-1.5">
                                    {stackedMetric(
                                      'QTY in incubation',
                                      <span className="font-medium tabular-nums">
                                        {row.incubationQty != null && row.incubationQty > 0
                                          ? formatQty(row.incubationQty, countryCode)
                                          : '—'}
                                      </span>,
                                    )}
                                    {stackedMetric('Time left', row.incubationTimeLeft || '—')}
                                  </div>
                                )}
                              </td>
                              {primaryCell(isSummary, (
                                <div className="space-y-1.5 text-center">
                                  {stackedMetric(
                                    'QTY to Produce',
                                    <span className="font-medium tabular-nums">
                                      {row.toProduceQty > 0 ? formatQty(row.toProduceQty, countryCode) : '—'}
                                    </span>,
                                  )}
                                  {stackedMetric(
                                    'Date requested',
                                    formatDisplayDate(row.dateRequested),
                                  )}
                                </div>
                              ))}
                            </tr>
                          </tbody>
                        </table>
                        <div className={`w-[6.5rem] shrink-0 border-l border-border flex flex-col justify-center gap-1.5 p-2 bg-card/50 ${
                          !isSummary && !isBatchLine ? 'opacity-0 pointer-events-none' : ''
                        }`}>
                          {isSummary ? (
                            <>
                              <button
                                type="button"
                                disabled={rowBusy || editBusy}
                                onClick={() => openProduceModal(row, 'queue')}
                                className={`${actionBtnCls} border-amber-300 text-amber-800 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-950/40`}
                              >
                                To Produce
                              </button>
                              <button
                                type="button"
                                disabled={rowBusy || editBusy}
                                onClick={() => openProduceModal(row, 'produce')}
                                className={`${actionBtnCls} border-primary text-primary hover:bg-primary/10`}
                              >
                                Produced
                              </button>
                            </>
                          ) : null}
                          {isBatchLine ? (
                            <button
                              type="button"
                              disabled={rowBusy || editBusy}
                              onClick={() => openEditBatchModal(row)}
                              className={`${actionBtnCls} border-border text-foreground hover:bg-muted/60`}
                            >
                              {editBusy ? 'Saving…' : 'Edit'}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                  <InfiniteScrollDivSentinel
                    hasMore={hasMore}
                    sentinelRef={sentinelRef}
                    totalCount={totalCount}
                    visibleCount={visibleCount}
                  />
                </>
              )}
            </div>
          </TableScrollContainer>
        </>
      )}

      {produceTarget ? (
        <ProduceBatchModal
          key={`${produceTarget.product.id}-${produceTarget.purpose}-${produceTarget.batchLogId ?? 'new'}`}
          productName={produceTarget.product.name}
          batchUnit={produceTarget.product.batchUnit}
          defaultBatchQty={
            produceTarget.purpose === 'edit'
              ? (produceTarget.product.batchQty ?? 1)
              : produceTarget.purpose === 'produce' && produceTarget.product.toProduceQty > 0
                ? produceTarget.product.toProduceQty
                : suggestedProduceQty(produceTarget.product)
          }
          isSubProduct={produceTarget.product.isSubProduct}
          expiryPeriodDays={produceTarget.product.expiryPeriodDays}
          purpose={produceTarget.purpose}
          batchNumber={produceTarget.product.batchNumber}
          initialProductionDate={produceTarget.product.productionDate}
          initialExpiryDate={produceTarget.product.expiryDate}
          saving={
            produceTarget.purpose === 'edit'
              ? editingBatchId === produceTarget.batchLogId
              : actionId === produceTarget.product.id
          }
          error={produceError}
          components={produceComponents}
          onClose={() => {
            const saving = produceTarget.purpose === 'edit'
              ? editingBatchId === produceTarget.batchLogId
              : actionId === produceTarget.product.id;
            if (!saving) setProduceTarget(null);
          }}
          onConfirm={(qty, productionDate, expiryDate, overrideStock) => {
            if (produceTarget.purpose === 'edit') {
              void confirmEditBatchAction(qty, productionDate, expiryDate, overrideStock);
              return;
            }
            void confirmProduceAction(qty, productionDate, expiryDate, overrideStock);
          }}
        />
      ) : null}

      {detailProduct ? (
        <ProductDetailPanel
          product={detailProduct}
          companyId={selectedCompanyId}
          onClose={() => setDetailProduct(null)}
          onUpdated={replaceProduct}
        />
      ) : null}
    </div>
  );
}
