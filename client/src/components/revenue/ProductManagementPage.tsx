import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { useTableSort } from '../../hooks/useTableSort';
import { sortTableRows, compareSortValues, type SortDirection } from '../../utils/tableSort';
import {
  SortableTableHeaderRow,
  TableColGroup,
  tableColWidth,
  type SortableColumnDef,
} from '../shared/SortableTableHead';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { pageShellClass, TABLE_COL_ACTION, TABLE_SCROLL_CLS } from '../layout/pageLayout';
import { PageStickyFilters } from '../layout/PageStickyFilters';
import { filterSelectCls, inlineNumberCls } from '../layout/formControls';
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { api, ApiError, type Product, type ProductManagementSummary, type ProduceBatchShortage } from '../../api';
import { resolveManagementBatchUnit } from '../../data/productForm';
import {
  convertProduceQtyToBase,
  listProduceUomOptions,
} from '../../data/productProduceUomOptions';
import { formatCountryNumber } from '../../utils/numberFormat';
import { labelsEqual } from '../../utils/labelMatch';
import { useOrgCountryCode } from '../../context/OrgCountryContext';
import {
  allocateFifoRemainingBatches,
  compareProductBatchesOldestFirst,
} from '../../data/productManagementFifo';
import { ProductDetailPanel } from './ProductDetailPanel';
import { ProduceBatchModal, type ProduceConfirmPayload } from './ProduceBatchModal';
import { resyncStaleTaggedComponentPrices } from '../../utils/resyncTaggedComponentPrices';
import {
  coerceGroupFilterForCategory,
  listCategoryFilterOptions,
  listGroupFilterOptions,
} from '../../data/categoryGroupFilters';
import { TableLoadingRow } from '../shared/MillstoneLoader';

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

const tdCls = 'px-3 py-2.5 align-top border-r border-b border-border last:border-r-0 text-xs min-w-0';
const filterCls = filterSelectCls;
const actionBtnCls =
  'inline-flex items-center justify-center w-full px-2 py-1.5 rounded-md text-[10px] font-bold whitespace-nowrap disabled:opacity-50 shadow-sm border';
const toProduceBtnCls =
  `${actionBtnCls} border-amber-600 bg-amber-500 text-white hover:bg-amber-600`;
const producedBtnCls =
  `${actionBtnCls} border-emerald-700 bg-emerald-600 text-white hover:bg-emerald-700`;
const editBtnCls =
  `${actionBtnCls} border-slate-500 bg-slate-600 text-white hover:bg-slate-700`;

type BatchSortColumn =
  | 'name'
  | 'categoryGroup'
  | 'batchUnit'
  | 'onHand'
  | 'onOrder'
  | 'incubation'
  | 'qtyToProduce'
  | 'actions';

const BATCH_TABLE_COLUMNS: SortableColumnDef<BatchSortColumn>[] = [
  { key: 'name', label: 'Product Name / Product ID', ...tableColWidth('18%') },
  { key: 'categoryGroup', label: 'Category / Group', ...tableColWidth('11%') },
  { key: 'batchUnit', label: 'Delivery Unit', sortable: false, ...tableColWidth('9%') },
  { key: 'onHand', label: 'QTY On Hand / Batch Date / Expiry Date', ...tableColWidth('15%') },
  { key: 'onOrder', label: 'QTY Holdout', sortable: false, ...tableColWidth('11%') },
  { key: 'incubation', label: 'QTY in incubation / Time left', sortable: false, ...tableColWidth('12%') },
  { key: 'qtyToProduce', label: 'QTY to Produce / Date requested', align: 'center', ...tableColWidth('12%') },
  { key: 'actions', label: 'Actions', sortable: false, align: 'center', ...TABLE_COL_ACTION },
];

const BATCH_TABLE_COL_SPAN = BATCH_TABLE_COLUMNS.length;

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
  if (!sortColumn || sortColumn === 'actions') return defaultBatchRowOrder(rows);

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
  return locationIds.some(selected =>
    productLocs.some(id => id.localeCompare(selected, undefined, { sensitivity: 'accent' }) === 0),
  );
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
  const [previewLoading, setPreviewLoading] = useState(false);
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
      const [productData, managementData] = await Promise.all([
        api.products(selectedCompanyId),
        api.productManagement(selectedCompanyId, selectedLocationIds, viewMode),
      ]);
      setProducts(productData);
      setManagementRows(managementData);
      void resyncStaleTaggedComponentPrices(selectedCompanyId);
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
    if (selectedLocationIds.length === 0) {
      setProduceError('Select at least one location in the header before production actions.');
      return;
    }
    const defaultQty = purpose === 'produce' && product.toProduceQty > 0
      ? product.toProduceQty
      : suggestedProduceQty(product);
    void runProductionPreview(product.id, defaultQty > 0 ? defaultQty : 1);
  }

  function openEditBatchModal(row: ManagementBatchRow) {
    if (!row.batchLogId) return;
    setProduceError(null);
    setProduceComponents([]);
    setProduceTarget({ product: row, purpose: 'edit', batchLogId: row.batchLogId });
  }

  async function runProductionPreview(productId: number, batchQty: number) {
    if (!selectedLocationIds.length || !(batchQty > 0)) return;
    setPreviewLoading(true);
    try {
      const preview = await api.previewProduction(productId, {
        locationExternalIds: selectedLocationIds,
        batchQty,
      });
      setProduceComponents(preview.components ?? []);
    } catch (e) {
      // Preview failures should not block the modal; keep prior rows.
      if (e instanceof Error && !produceError) {
        setProduceError(e.message);
      }
    } finally {
      setPreviewLoading(false);
    }
  }

  async function confirmProduceAction(payload: ProduceConfirmPayload) {
    if (!produceTarget) return;
    const { product, purpose } = produceTarget;
    if (selectedLocationIds.length === 0) {
      setProduceError('Select at least one location in the header before production actions.');
      return;
    }
    setActionId(product.id);
    setProduceError(null);
    try {
      if (purpose === 'queue') {
        await api.markProductToProduce(product.id, {
          locationExternalIds: selectedLocationIds,
          batchQty: payload.batchQty,
          batchUom: payload.batchUom,
          productionDate: payload.productionDate,
          overrideStock: payload.overrideStock === true,
        });
      } else {
        await api.produceProductBatches(product.id, {
          locationExternalIds: selectedLocationIds,
          batchQty: payload.batchQty,
          batchUom: payload.batchUom,
          productionDate: payload.productionDate,
          expiryDate: payload.expiryDate,
          overrideStock: payload.overrideStock === true,
          componentUsages: payload.componentUsages,
          subProductOutputs: payload.subProductOutputs,
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

  async function confirmEditBatchAction(payload: ProduceConfirmPayload) {
    if (!produceTarget?.batchLogId) return;
    setEditingBatchId(produceTarget.batchLogId);
    setProduceError(null);
    try {
      await api.patchProductionBatch(produceTarget.batchLogId, {
        batchQty: payload.batchQty,
        batchUom: payload.batchUom,
        productionDate: payload.productionDate,
        expiryDate: payload.expiryDate,
        overrideStock: payload.overrideStock === true,
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
    () => listCategoryFilterOptions([...PRODUCT_MANAGEMENT_CATEGORIES]).filter(c => c !== 'All'),
    [],
  );

  const managementScopedProducts = useMemo(() => {
    const allowed = new Set(categoryOptions.map(c => c.toLowerCase()));
    return products.filter(p => p.active && allowed.has((p.category ?? '').toLowerCase()));
  }, [products, categoryOptions]);

  const groupOptions = useMemo(
    () => listGroupFilterOptions(managementScopedProducts, categoryFilter).filter(g => g !== 'All'),
    [managementScopedProducts, categoryFilter],
  );

  useEffect(() => {
    setGroupFilter(prev => coerceGroupFilterForCategory(prev, categoryFilter, managementScopedProducts));
  }, [categoryFilter, managementScopedProducts, groupOptions]);

  const { productSummaries, fifoBatchRowsByProductId } = useMemo(() => {
    const productById = new Map(products.map(product => [product.id, product]));

    let rows = managementRows
      .map(entry => {
        const product = productById.get(entry.productId);
        if (!product) return null;
        if (!matchesProductManagementFilters(product, productTypeFilter)) return null;
        if (!productMatchesLocations(product, selectedLocationIds)) return null;
        if (!categoryOptions.some(c => c.toLowerCase() === (product.category ?? '').toLowerCase())) {
          return null;
        }
        return buildBatchRow(product, entry);
      })
      .filter((row): row is ManagementBatchRow => row !== null);

    if (categoryFilter !== 'All') {
      rows = rows.filter(row => labelsEqual(row.category, categoryFilter));
    }
    if (groupFilter !== 'All') {
      rows = rows.filter(row => labelsEqual(row.group, groupFilter));
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
    totalCount,
    visibleCount, nextPageSize, loadMore } = useInfiniteScrollSlice(displayRows, { scrollRootRef });

  function replaceProduct(updated: Product) {
    setProducts(prev => {
      const index = prev.findIndex(p => p.id === updated.id);
      if (index >= 0) {
        const next = [...prev];
        next[index] = updated;
        return next;
      }
      return [...prev, updated];
    });
    setDetailProduct(prev => (prev?.id === updated.id ? updated : prev));
  }

  const hasActiveFilters = Boolean(
    search.trim()
    || categoryFilter !== 'All'
    || groupFilter !== 'All',
  );

  const emptyMessage = viewMode === 'sub-product'
    ? 'No active sub-products yet. Add sub-products on the Products page and link them to a B2C or B2B Principal product.'
    : 'No active B2B Principal products yet. Enable B2B Principal on a product on the Products page.';

  return (
    <div className={pageShellClass({ embedded })}>
      {!orgReady ? (
        <p className="text-xs text-muted-foreground border border-dashed border-border rounded-lg px-4 py-5 text-center">
          Select a company and at least one location in the header to view products.
        </p>
      ) : (
        <>
          <PageStickyFilters opaque className="py-2">
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
                onChange={e => {
                  const next = e.target.value;
                  setCategoryFilter(next);
                  setGroupFilter(prev => coerceGroupFilterForCategory(prev, next, managementScopedProducts));
                }}
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
                <RefreshCw size={11}  />
                Refresh
              </button>
            </div>
          </PageStickyFilters>

          {error ? (
            <p className="text-xs text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2">
              {error}
            </p>
          ) : null}

          <TableScrollContainer
            ref={scrollRootRef}
            className={TABLE_SCROLL_CLS}
            tableId="opera.production.product-management"
          >
            <table className="w-full min-w-[52rem] border-collapse">
              <TableColGroup columns={BATCH_TABLE_COLUMNS} />
              <thead className="sticky top-0 z-10 bg-muted/20">
                <SortableTableHeaderRow
                  columns={BATCH_TABLE_COLUMNS}
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                  className="bg-muted/20 border-b border-border"
                />
              </thead>
              <tbody>
                {loading ? (
                  <TableLoadingRow colSpan={BATCH_TABLE_COL_SPAN} label="Loading products…" />
                ) : displayRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={BATCH_TABLE_COL_SPAN}
                      className="px-3 py-8 text-center text-xs text-muted-foreground"
                    >
                      {hasActiveFilters
                        ? 'No products match your filters.'
                        : emptyMessage}
                    </td>
                  </tr>
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
                        <tr
                          key={row.rowKey}
                          className={`hover:bg-muted/20 ${
                            isSummary && row.onOrderQty > row.inStock
                              ? 'bg-yellow-300/90 dark:bg-yellow-500/30'
                              : isSummary && row.toProduceQty > 0
                                ? 'bg-amber-50/70 dark:bg-amber-950/20'
                                : ''
                          } ${isBatchLine ? 'bg-muted/10' : ''}`}
                        >
                          <td className={tdCls}>
                            {isSummary ? (
                              <div className="flex items-start gap-1.5 min-w-0">
                                <button
                                  type="button"
                                  onClick={() => toggleProductExpanded(row.id)}
                                  className="inline-flex shrink-0 mt-0.5 text-muted-foreground hover:text-primary"
                                  aria-expanded={isExpanded}
                                  aria-label={fifoBatchCount > 0
                                    ? `${isExpanded ? 'Hide' : 'Show'} ${fifoBatchCount} batch line${fifoBatchCount !== 1 ? 's' : ''}`
                                    : 'No batch lines on hand'}
                                  title={fifoBatchCount > 0
                                    ? `${isExpanded ? 'Hide' : 'Show'} ${fifoBatchCount} batch line${fifoBatchCount !== 1 ? 's' : ''}`
                                    : 'No batch lines on hand'}
                                >
                                  {fifoBatchCount > 0 ? (
                                    isExpanded
                                      ? <ChevronDown size={14} />
                                      : <ChevronRight size={14} />
                                  ) : (
                                    <span className="w-3.5" aria-hidden />
                                  )}
                                </button>
                                <div className="min-w-0 flex-1 space-y-0.5">
                                  <button
                                    type="button"
                                    onClick={() => toggleProductExpanded(row.id)}
                                    className="block w-full text-left font-medium truncate hover:text-primary hover:underline"
                                    title={row.name}
                                  >
                                    {row.name}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDetailProduct(row)}
                                    className="block w-full text-left text-[10px] text-muted-foreground font-mono truncate hover:text-primary hover:underline"
                                    title="Open product details"
                                  >
                                    {row.productId}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="pl-5 min-w-0">
                                <p className="text-[10px] text-muted-foreground">↳ batch</p>
                                <p className="text-[11px] font-medium truncate" title={row.batchNumber || row.name}>
                                  {row.batchNumber || row.name}
                                </p>
                              </div>
                            )}
                          </td>
                          {primaryCell(isSummary, (
                            <>
                              <p className="truncate">{row.category || '—'}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{row.group || '—'}</p>
                            </>
                          ))}
                          {primaryCell(isSummary, row.isSubProduct ? (
                            <span className="font-medium text-foreground truncate block" title="Batch size from product yield (QTY/UOM)">
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
                                  className={`${inlineNumberCls} ml-auto`}
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
                                  'QTY Holdout',
                                  formatOnOrderWithLocks(row.onOrderQty, row.onOrderLocks, countryCode),
                                )}
                              </div>
                            ) : null}
                          </td>
                          <td className={tdCls}>
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
                          <td className={`${tdCls} align-middle`}>
                            <div className={`flex flex-col justify-center gap-1.5 ${
                              !isSummary && !isBatchLine ? 'opacity-0 pointer-events-none' : ''
                            }`}>
                              {isSummary ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={rowBusy || editBusy}
                                    onClick={() => openProduceModal(row, 'queue')}
                                    className={toProduceBtnCls}
                                  >
                                    To Produce
                                  </button>
                                  <button
                                    type="button"
                                    disabled={rowBusy || editBusy}
                                    onClick={() => openProduceModal(row, 'produce')}
                                    className={producedBtnCls}
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
                                  className={editBtnCls}
                                >
                                  {editBusy ? 'Saving…' : 'Edit'}
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    <InfiniteScrollTableSentinel
                      colSpan={BATCH_TABLE_COL_SPAN}
                      hasMore={hasMore}
                      onLoadMore={loadMore}
                      nextPageSize={nextPageSize}
                      totalCount={totalCount}
                      visibleCount={visibleCount}
                    />
                  </>
                )}
              </tbody>
            </table>
          </TableScrollContainer>
        </>
      )}

      {produceTarget ? (
        <ProduceBatchModal
          key={`${produceTarget.product.id}-${produceTarget.purpose}-${produceTarget.batchLogId ?? 'new'}`}
          productName={produceTarget.product.name}
          batchUnit={produceTarget.product.batchUnit}
          uomOptions={listProduceUomOptions(produceTarget.product).map(option => option.label)}
          defaultBatchQty={
            produceTarget.purpose === 'edit'
              ? (produceTarget.product.batchQty ?? 1)
              : produceTarget.purpose === 'produce' && produceTarget.product.toProduceQty > 0
                ? produceTarget.product.toProduceQty
                : suggestedProduceQty(produceTarget.product)
          }
          isSubProduct={produceTarget.product.isSubProduct}
          isB2bProduct={!produceTarget.product.isSubProduct}
          baseUnitCost={
            produceTarget.product.isSubProduct && produceTarget.product.yieldQuantity > 0
              ? produceTarget.product.totalCost / produceTarget.product.yieldQuantity
              : produceTarget.product.totalCost
          }
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
          previewLoading={previewLoading}
          subProductOptions={products
            .filter(p => p.active
              && p.id !== produceTarget.product.id
              && (p.isSubProduct || p.isBiProduct))
            .map(p => ({
              id: p.id,
              name: p.name,
              productId: p.productId,
              batchUnit: resolveManagementBatchUnit(p),
            }))
            .sort((a, b) => a.name.localeCompare(b.name))}
          convertQtyToBase={(enteredQty, batchUom) => convertProduceQtyToBase(
            enteredQty,
            batchUom,
            listProduceUomOptions(produceTarget.product),
          )}
          onClose={() => {
            const saving = produceTarget.purpose === 'edit'
              ? editingBatchId === produceTarget.batchLogId
              : actionId === produceTarget.product.id;
            if (!saving) {
              setProduceTarget(null);
              setProduceError(null);
              setProduceComponents([]);
            }
          }}
          onQtyChange={qty => {
            if (produceTarget.purpose === 'edit') return;
            void runProductionPreview(produceTarget.product.id, qty);
          }}
          onConfirm={payload => {
            if (produceTarget.purpose === 'edit') {
              void confirmEditBatchAction(payload);
              return;
            }
            void confirmProduceAction(payload);
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
