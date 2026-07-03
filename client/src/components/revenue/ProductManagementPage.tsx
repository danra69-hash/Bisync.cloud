import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { InfiniteScrollDivSentinel } from '../shared/infiniteScroll';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { pageShellClass, TABLE_SCROLL_CLS } from '../layout/pageLayout';
import { filterSelectCls, inlineNumberCls } from '../layout/formControls';
import { RefreshCw, ArrowDown, ArrowUp } from 'lucide-react';
import { api, ApiError, type Product, type ProductManagementSummary, type ProduceBatchShortage } from '../../api';
import { formatRm } from '../../data/createOrder';
import { calcProductCogs, calcSubProductUnitCost, formatCogsPercent, resolveCogsPercentTrend, formatSubProductBatchPackageUnit, resolveManagementBatchUnit, calcManagementBatchCogs } from '../../data/productForm';
import { fromApiUom } from '../../data/componentForm';
import { siCategories, siGroups } from '../../data/revenueManagement';
import { ProductDetailPanel } from './ProductDetailPanel';
import { ProduceBatchModal } from './ProduceBatchModal';
import { resyncStaleTaggedComponentPrices } from '../../utils/resyncTaggedComponentPrices';

type Props = {
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
};

type ManagementBatchRow = Product & {
  rowKey: string;
  batchLogId: number | null;
  isSummaryRow: boolean;
  batchUnit: string;
  inStock: number;
  salesPerDay: number;
  toProduceQty: number;
  producedQty: number;
  batchNumber: string | null;
  productionDate: string | null;
  expiryDate: string | null;
  batchQty: number | null;
};

type ProduceModalTarget = {
  product: ManagementBatchRow;
  purpose: 'queue' | 'produce' | 'edit';
  batchLogId?: number;
};

const tableColGroup = (
  <colgroup>
    <col className="w-[13%]" />
    <col className="w-[8%]" />
    <col className="w-[7%]" />
    <col className="w-[9%]" />
    <col className="w-[8%]" />
    <col className="w-[7%]" />
    <col className="w-[7%]" />
    <col className="w-[7%]" />
    <col className="w-[6%]" />
    <col className="w-[6%]" />
    <col className="w-[7%]" />
    <col className="w-[6%]" />
    <col className="w-[7%]" />
  </colgroup>
);

const thCls =
  'text-left px-3 py-2.5 text-xs font-sans uppercase tracking-wider text-muted-foreground font-normal border-r border-border last:border-r-0 truncate';
const tdCls = 'px-3 py-2.5 align-middle border-r border-b border-border last:border-r-0 text-xs';
const filterCls = filterSelectCls;
const actionBtnCls =
  'inline-flex items-center justify-center px-2 py-1 rounded border text-[10px] font-semibold whitespace-nowrap disabled:opacity-50';

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

function productCogsDisplay(product: Product): string {
  const batchCogs = calcManagementBatchCogs(product);
  if (product.isSubProduct) {
    const batchLabel = formatSubProductBatchPackageUnit(product);
    if (batchLabel === '—') return formatRm(batchCogs);
    return `${formatRm(batchCogs)} / ${batchLabel}`;
  }
  return formatRm(batchCogs);
}

function productCogsPercentDisplay(product: Product): string {
  if (product.isSubProduct) return '—';
  const cogs = calcProductCogs(product.totalCost, product.packagingCost ?? 0, product);
  return formatCogsPercent(cogs, product.rrp);
}

function CogsPercentTrendIcon({ product }: { product: Product }) {
  const trend = resolveCogsPercentTrend(product);
  if (!trend) return null;
  const isUp = trend === 'up';
  return (
    <span
      className={`inline-flex items-center ml-1 ${isUp ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}
      title={isUp ? 'COGS% increased (cost up or RRP down)' : 'COGS% decreased (cost down or RRP up)'}
    >
      {isUp ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
    </span>
  );
}

function rrpDisplay(product: Product): string {
  if (product.isSubProduct) {
    const batchCogs = calcManagementBatchCogs(product);
    if (product.yieldQuantity <= 0 || !product.yieldUom) return '—';
    const unitCost = calcSubProductUnitCost(batchCogs, String(product.yieldQuantity));
    const uom = fromApiUom(product.yieldUom);
    return `${formatRm(unitCost)} / ${uom}`;
  }
  return product.rrp > 0 ? formatRm(product.rrp) : '—';
}

function formatQty(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatDisplayDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
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
    salesPerDay: entry.salesPerDay ?? 0,
    toProduceQty: entry.toProduceQty ?? 0,
    producedQty: entry.producedQty ?? 0,
    batchNumber: entry.batchNumber ?? null,
    productionDate: entry.productionDate ?? null,
    expiryDate: entry.expiryDate ?? null,
    batchQty: entry.batchQty ?? null,
  };
}

function primaryCell(isPrimary: boolean, children: ReactNode) {
  if (!isPrimary) return <td className={tdCls} />;
  return <td className={tdCls}>{children}</td>;
}

export function ProductManagementPage({ selectedCompanyId, selectedLocationIds }: Props) {
  const orgReady = Boolean(selectedCompanyId) && selectedLocationIds.length > 0;

  const [products, setProducts] = useState<Product[]>([]);
  const [managementRows, setManagementRows] = useState<ProductManagementSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [groupFilter, setGroupFilter] = useState('All');
  const [productTypeFilter, setProductTypeFilter] = useState<ProductTypeFilter>('b2b');
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [actionId, setActionId] = useState<number | null>(null);
  const [editingBatchId, setEditingBatchId] = useState<number | null>(null);
  const [produceTarget, setProduceTarget] = useState<ProduceModalTarget | null>(null);
  const [produceError, setProduceError] = useState<string | null>(null);
  const [produceComponents, setProduceComponents] = useState<ProduceBatchShortage[]>([]);

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
        api.productManagement(selectedCompanyId, selectedLocationIds),
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
  }, [selectedCompanyId, selectedLocationIds]);

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

  const categoryOptions = useMemo(() => {
    const fromProducts = products
      .filter(p => p.active)
      .map(p => p.category)
      .filter(Boolean);
    return [...new Set([
      ...siCategories.filter(c => c !== 'All'),
      ...fromProducts,
    ])].sort((a, b) => a.localeCompare(b));
  }, [products]);

  const groupOptions = useMemo(() => {
    const fromProducts = products
      .filter(p => p.active)
      .map(p => p.group)
      .filter(Boolean);
    return [...new Set([
      ...siGroups.filter(g => g !== 'All'),
      ...fromProducts,
    ])].sort((a, b) => a.localeCompare(b));
  }, [products]);

  const visibleBatchRows = useMemo(() => {
    const productById = new Map(products.map(product => [product.id, product]));

    let rows = managementRows
      .map(entry => {
        const product = productById.get(entry.productId);
        if (!product) return null;
        if (!matchesProductManagementFilters(product, productTypeFilter)) return null;
        if (!productMatchesLocations(product, selectedLocationIds)) return null;
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

    rows.sort((a, b) => {
      if (a.id !== b.id) return a.name.localeCompare(b.name);
      if (a.isSummaryRow !== b.isSummaryRow) return a.isSummaryRow ? -1 : 1;
      return (b.batchLogId ?? 0) - (a.batchLogId ?? 0);
    });

    return rows;
  }, [products, managementRows, selectedLocationIds, search, categoryFilter, groupFilter, productTypeFilter]);

  const visibleProductCount = useMemo(
    () => new Set(visibleBatchRows.filter(row => row.isSummaryRow).map(row => row.id)).size,
    [visibleBatchRows],
  );

  const scrollRootRef = useRef<HTMLDivElement>(null);
  const {
    visibleItems: pagedVisibleProducts,
    hasMore,
    sentinelRef,
    totalCount,
    visibleCount,
  } = useInfiniteScrollSlice(visibleBatchRows, { scrollRootRef });

  function replaceProduct(updated: Product) {
    setProducts(prev => prev.map(p => (p.id === updated.id ? updated : p)));
    setDetailProduct(prev => (prev?.id === updated.id ? updated : prev));
  }

  const hasActiveFilters = Boolean(
    search.trim()
    || categoryFilter !== 'All'
    || groupFilter !== 'All'
    || productTypeFilter !== 'b2b',
  );

  return (
    <div className={pageShellClass()}>
      {!orgReady ? (
        <p className="text-xs text-muted-foreground border border-dashed border-border rounded-lg px-4 py-5 text-center">
          Select a company and at least one location in the header to view products.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="b2b-product-search"
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by ID or name…"
              className={`${filterCls} flex-1 min-w-[9rem] max-w-[14rem]`}
            />
            <label className="inline-flex items-center gap-1.5 text-[11px] cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={productTypeFilter === 'b2b'}
                onChange={() => setProductTypeFilter('b2b')}
                className="rounded border-border"
              />
              B2B
            </label>
            <label className="inline-flex items-center gap-1.5 text-[11px] cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={productTypeFilter === 'sub-product'}
                onChange={() => setProductTypeFilter('sub-product')}
                className="rounded border-border"
              />
              Sub-Product
            </label>
            <select
              id="b2b-product-category-filter"
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
              id="b2b-product-group-filter"
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
              {visibleProductCount} product{visibleProductCount !== 1 ? 's' : ''}
              {visibleBatchRows.length > visibleProductCount
                ? ` · ${visibleBatchRows.length} batch line${visibleBatchRows.length !== 1 ? 's' : ''}`
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
            <div className="min-w-[58rem]">
              <div className="flex border-b border-border bg-muted/20 sticky top-0 z-10">
                <table className="flex-1 table-fixed border-collapse">
                  {tableColGroup}
                  <thead>
                    <tr>
                      <th className={thCls}>Product Name</th>
                      <th className={thCls}>Category / Group</th>
                      <th className={thCls}>Batch Unit</th>
                      <th className={thCls}>Batch No.</th>
                      <th className={`${thCls} text-center`}>Produced</th>
                      <th className={thCls}>In Stock</th>
                      <th className={thCls}>Sales/day</th>
                      <th className={thCls}>Cogs</th>
                      <th className={thCls}>COGS %</th>
                      <th className={thCls}>RRP</th>
                      <th className={`${thCls} text-center`}>Qty To Produce</th>
                      <th className={`${thCls} text-center`}>On Hand</th>
                      <th className={`${thCls} text-center`}>Expiry Date</th>
                    </tr>
                  </thead>
                </table>
                <div className="w-[5.5rem] shrink-0 border-l border-border px-2 py-2.5 text-xs font-sans uppercase tracking-wider text-muted-foreground font-normal text-center">
                  Actions
                </div>
              </div>

              {loading ? (
                <p className="px-3 py-8 text-center text-xs text-muted-foreground border-b border-border">
                  Loading products…
                </p>
              ) : visibleBatchRows.length === 0 ? (
                <p className="px-3 py-8 text-center text-xs text-muted-foreground border-b border-border">
                  {hasActiveFilters
                    ? 'No products match your filters.'
                    : 'No active products yet. Enable B2B or add sub-products on the Products page.'}
                </p>
              ) : (
                <>
                  {pagedVisibleProducts.map(row => {
                    const rowBusy = savingId === row.id || actionId === row.id;
                    const editBusy = row.batchLogId != null && editingBatchId === row.batchLogId;
                    const isSummary = row.isSummaryRow;
                    const isBatchLine = !row.isSummaryRow && row.batchLogId != null;
                    return (
                      <div
                        key={row.rowKey}
                        className={`flex border-b border-border ${
                          isSummary && row.toProduceQty > 0 ? 'bg-amber-50/70 dark:bg-amber-950/20' : ''
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
                                      onClick={() => setDetailProduct(row)}
                                      className="font-medium text-left hover:text-primary hover:underline"
                                    >
                                      {row.name}
                                    </button>
                                    <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{row.productId}</p>
                                  </>
                                ) : (
                                  <div className="pl-3">
                                    <p className="text-[10px] text-muted-foreground">↳ batch</p>
                                    <p className="text-[11px] font-medium truncate">{row.name}</p>
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
                                <span className="font-mono text-[10px]">
                                  {isBatchLine ? (row.batchNumber || '—') : '—'}
                                </span>
                              </td>
                              <td className={`${tdCls} text-center`}>
                                {isBatchLine ? formatDisplayDate(row.productionDate) : '—'}
                              </td>
                              {primaryCell(isSummary, (
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
                                />
                              ))}
                              {primaryCell(isSummary, (
                                <input
                                  type="number"
                                  min={0}
                                  step="any"
                                  defaultValue={row.salesPerDay}
                                  key={`${row.id}-sales-${row.salesPerDay}`}
                                  disabled={rowBusy}
                                  onBlur={e => {
                                    const next = Number.parseFloat(e.target.value);
                                    if (!Number.isFinite(next) || next < 0 || next === row.salesPerDay) return;
                                    void patchManagement(row.id, {
                                      salesPerDay: next,
                                      locationExternalIds: selectedLocationIds,
                                    });
                                  }}
                                  className={`${inlineNumberCls} w-full max-w-[5rem]`}
                                  aria-label={row.isSubProduct
                                    ? `Batches sold per day for ${row.name}`
                                    : `Sales per day for ${row.name}`}
                                />
                              ))}
                              {primaryCell(isSummary, productCogsDisplay(row))}
                              {primaryCell(isSummary, (
                                <span className="inline-flex items-center font-sans">
                                  {productCogsPercentDisplay(row)}
                                  <CogsPercentTrendIcon product={row} />
                                </span>
                              ))}
                              {primaryCell(isSummary, rrpDisplay(row))}
                              {primaryCell(isSummary, (
                                <span className="block text-center font-medium tabular-nums">
                                  {row.toProduceQty > 0 ? formatQty(row.toProduceQty) : '—'}
                                </span>
                              ))}
                              <td className={`${tdCls} text-center font-medium tabular-nums`}>
                                {isBatchLine && row.batchQty != null
                                  ? formatQty(row.batchQty)
                                  : isSummary
                                    ? formatQty(row.inStock)
                                    : '—'}
                              </td>
                              <td className={`${tdCls} text-center`}>
                                {isBatchLine ? formatDisplayDate(row.expiryDate) : '—'}
                              </td>
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
