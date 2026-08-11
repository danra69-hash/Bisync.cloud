import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { useTableSort } from '../../hooks/useTableSort';
import { sortTableRows, compareSortValues } from '../../utils/tableSort';
import { labelsEqual } from '../../utils/labelMatch';
import { SortableTableHeaderRow, TableColGroup, tableColWidth, type SortableColumnDef } from '../shared/SortableTableHead';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { pageShellClass, TABLE_SCROLL_CLS } from '../layout/pageLayout';
import { PageStickyFilters } from '../layout/PageStickyFilters';
import { filterSelectCls } from '../layout/formControls';
import { Plus, RefreshCw, ArrowDown, ArrowUp } from 'lucide-react';
import { api, type PosDeliveryUnitSelection, type Product } from '../../api';
import { formatRm } from '../../data/createOrder';
import { resolveCogsPercentTrend } from '../../data/productForm';
import {
  collectProductListRrpPoints,
  resolveProductListCogsPercentSortValue,
  resolveProductListDeliveryUnitSortValue,
  resolveProductListRrpSortValue,
  resolveProductListVariationCogsSortValue,
  type ProductListRrpPoint,
} from '../../data/productListDisplay';
import { useOrgCountryCode } from '../../context/OrgCountryContext';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';
import { getSiCategoryFilterOptions, getSiGroupFilterOptions } from '../../data/revenueManagement';
import { ToggleSwitch } from '../admin/ToggleSwitch';
import { ProductDetailPanel } from './ProductDetailPanel';
import { ProductPosUnitsModal } from './ProductPosUnitsModal';
import { resyncStaleTaggedComponentPrices } from '../../utils/resyncTaggedComponentPrices';
import { TableLoadingRow } from '../shared/MillstoneLoader';

type Props = {
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
  embedded?: boolean;
  onCreateProduct?: () => void;
};

const tdCls = 'px-3 py-2.5 align-middle border-r border-b border-border last:border-r-0 text-xs';
const filterCls = filterSelectCls;

type ProductListSortColumn =
  | 'category'
  | 'group'
  | 'productId'
  | 'type'
  | 'name'
  | 'deliveryUnit'
  | 'rrp'
  | 'cogs'
  | 'cogsPercent'
  | 'channel'
  | 'pos'
  | 'activate';

const PRODUCT_LIST_TABLE_COLUMNS: SortableColumnDef<ProductListSortColumn>[] = [
  { key: 'category', label: 'Category', ...tableColWidth('9%') },
  { key: 'group', label: 'Group', ...tableColWidth('9%') },
  { key: 'productId', label: 'Product ID', ...tableColWidth('9%') },
  { key: 'type', label: 'Product Type', ...tableColWidth('8%') },
  { key: 'name', label: 'Product', ...tableColWidth('16%') },
  { key: 'deliveryUnit', label: 'Delivery Unit', ...tableColWidth('10%') },
  { key: 'rrp', label: 'RRP', ...tableColWidth('8%') },
  { key: 'cogs', label: 'COGS', ...tableColWidth('7%') },
  { key: 'cogsPercent', label: 'COGS %', ...tableColWidth('7%') },
  { key: 'channel', label: 'Channel', ...tableColWidth('8%') },
  { key: 'pos', label: 'POS', align: 'center', sortable: false, ...tableColWidth(72) },
  { key: 'activate', label: 'Activate', align: 'center', sortable: false, ...tableColWidth(80) },
];

const PRODUCT_LIST_COL_SPAN = PRODUCT_LIST_TABLE_COLUMNS.length;

function productMatchesLocations(product: Product, locationIds: string[]): boolean {
  const productLocs = product.locationExternalIds ?? [];
  if (locationIds.length === 0) return false;
  if (productLocs.length === 0) return true;
  return locationIds.some(id => productLocs.includes(id));
}

function VariationStack({
  points,
  render,
  empty = '—',
}: {
  points: ProductListRrpPoint[];
  render: (point: ProductListRrpPoint) => React.ReactNode;
  empty?: string;
}) {
  if (points.length === 0) return <>{empty}</>;
  if (points.length === 1) return <>{render(points[0])}</>;
  return (
    <div className="inline-flex flex-col gap-0.5 rounded border border-border/80 bg-muted/10 px-1.5 py-1 min-w-0">
      {points.map(point => (
        <span key={point.key} className="whitespace-nowrap truncate" title={point.label}>
          {render(point)}
        </span>
      ))}
    </div>
  );
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

function channelLabel(product: Product): string {
  const channels: string[] = [];
  if (product.b2cEnabled) channels.push('B2C');
  if (product.b2bEnabled) channels.push('B2B');
  return channels.length > 0 ? channels.join(', ') : '—';
}

function InlineRrpInput({
  product,
  disabled,
  onCommit,
}: {
  product: Product;
  disabled?: boolean;
  onCommit: (rrp: number) => void | Promise<void>;
}) {
  const { symbol } = useCountryFormatters();
  const [draft, setDraft] = useState(() => String(product.rrp ?? 0));

  useEffect(() => {
    setDraft(String(product.rrp ?? 0));
  }, [product.id, product.rrp]);

  async function commit() {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setDraft(String(product.rrp ?? 0));
      return;
    }
    const next = Math.round(parsed * 100) / 100;
    if (next === Number(product.rrp ?? 0)) {
      setDraft(String(next));
      return;
    }
    await onCommit(next);
  }

  if (product.isSubProduct) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <div className="inline-flex items-center gap-1 min-w-0 w-full">
      <span className="text-[10px] text-muted-foreground shrink-0">{symbol}</span>
      <input
        type="number"
        min={0}
        step="0.01"
        value={draft}
        disabled={disabled}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.blur();
          }
          if (e.key === 'Escape') {
            setDraft(String(product.rrp ?? 0));
            e.currentTarget.blur();
          }
        }}
        className="w-full min-w-0 max-w-[6rem] rounded-md border border-border bg-background px-1.5 py-1 text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
        aria-label={`RRP for ${product.name}`}
      />
    </div>
  );
}

export function ProductListPage({
  selectedCompanyId,
  selectedLocationIds,
  embedded = false,
  onCreateProduct,
}: Props) {
  const countryCode = useOrgCountryCode();
  const orgReady = Boolean(selectedCompanyId) && selectedLocationIds.length > 0;

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [groupFilter, setGroupFilter] = useState('All');
  const [filterProduct, setFilterProduct] = useState(false);
  const [filterSubProduct, setFilterSubProduct] = useState(false);
  const [filterVariableProduct, setFilterVariableProduct] = useState(false);
  const [filterB2c, setFilterB2c] = useState(false);
  const [filterB2b, setFilterB2b] = useState(false);
  const [filterPos, setFilterPos] = useState(false);
  /** When true, show only deactivated products (exclusive, like Smart Components). */
  const [showDeactivated, setShowDeactivated] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [posModalProduct, setPosModalProduct] = useState<Product | null>(null);
  const { sortColumn, sortDirection, toggleSort, resetSort } = useTableSort<ProductListSortColumn>();

  const loadProducts = useCallback(async () => {
    if (!selectedCompanyId) {
      setProducts([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await resyncStaleTaggedComponentPrices();
      const data = await api.products(selectedCompanyId);
      setProducts(data);
    } catch (e) {
      setProducts([]);
      setError(e instanceof Error ? e.message : 'Failed to load products.');
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    resetSort();
  }, [
    search,
    categoryFilter,
    groupFilter,
    filterProduct,
    filterSubProduct,
    filterVariableProduct,
    filterB2c,
    filterB2b,
    filterPos,
    showDeactivated,
    selectedLocationIds,
    resetSort,
  ]);

  const categoryOptions = useMemo(() => {
    const fromProducts = products.map(p => p.category).filter(Boolean);
    return [...new Set([
      ...getSiCategoryFilterOptions().filter(c => c !== 'All'),
      ...fromProducts,
    ])].sort((a, b) => a.localeCompare(b));
  }, [products]);

  const groupOptions = useMemo(() => {
    const fromProducts = products.map(p => p.group).filter(Boolean);
    return [...new Set([
      ...getSiGroupFilterOptions().filter(g => g !== 'All'),
      ...fromProducts,
    ])].sort((a, b) => a.localeCompare(b));
  }, [products]);

  const visibleProducts = useMemo(() => {
    let scoped = products.filter(p => productMatchesLocations(p, selectedLocationIds));

    // Exclusive modes (parity with Smart Components inactive list).
    scoped = scoped.filter(p => (showDeactivated ? !p.active : p.active));

    if (categoryFilter !== 'All') {
      scoped = scoped.filter(p => labelsEqual(p.category, categoryFilter));
    }
    if (groupFilter !== 'All') {
      scoped = scoped.filter(p => labelsEqual(p.group, groupFilter));
    }

    const typeFiltersOn = [filterProduct, filterSubProduct, filterVariableProduct].filter(Boolean).length;
    if (typeFiltersOn > 0 && typeFiltersOn < 3) {
      scoped = scoped.filter(p => {
        if (p.isSubProduct) return filterSubProduct;
        if (p.isVariableProduct) return filterVariableProduct;
        return filterProduct;
      });
    }

    if (filterB2c || filterB2b) {
      scoped = scoped.filter(p => (
        (filterB2c && p.b2cEnabled) || (filterB2b && p.b2bEnabled)
      ));
    }

    if (filterPos) {
      scoped = scoped.filter(p => p.posEnabled);
    }

    const query = search.trim().toLowerCase();
    if (!query) return scoped;

    return scoped.filter(p => [
      p.productId,
      p.name,
      p.category,
      p.group,
    ].join(' ').toLowerCase().includes(query));
  }, [products, selectedLocationIds, search, categoryFilter, groupFilter, filterProduct, filterSubProduct, filterVariableProduct, filterB2c, filterB2b, filterPos, showDeactivated]);

  const listResetKey = [
    search,
    categoryFilter,
    groupFilter,
    filterProduct,
    filterSubProduct,
    filterVariableProduct,
    filterB2c,
    filterB2b,
    filterPos,
    showDeactivated,
    selectedLocationIds.join(','),
  ].join('|');

  const sortedVisibleProducts = useMemo(
    () =>
      sortTableRows(
        visibleProducts,
        sortColumn,
        sortDirection,
        {
          category: p => p.category || '',
          group: p => p.group || '',
          productId: p => p.productId || '',
          name: p => p.name,
          type: p => (p.isSubProduct ? 'Sub-Product' : p.isVariableProduct ? 'Variable Product' : 'Product'),
          deliveryUnit: p => resolveProductListDeliveryUnitSortValue(p, products),
          rrp: p => resolveProductListRrpSortValue(p, products),
          cogs: p => resolveProductListVariationCogsSortValue(p, products),
          cogsPercent: p => resolveProductListCogsPercentSortValue(p, products),
          channel: p => channelLabel(p),
        },
        { tieBreaker: (a, b) => compareSortValues(a.name, b.name) },
      ),
    [visibleProducts, sortColumn, sortDirection, products],
  );

  const scrollRootRef = useRef<HTMLDivElement>(null);
  const {
    visibleItems: pagedVisibleProducts,
    hasMore,
    sentinelRef,
    totalCount,
    visibleCount, nextPageSize, loadMore } = useInfiniteScrollSlice(sortedVisibleProducts, {
    scrollRootRef,
    resetKey: listResetKey,
  });

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

  async function patchProduct(product: Product, payload: Parameters<typeof api.patchProduct>[1]) {
    setSavingId(product.id);
    setError(null);
    try {
      const updated = await api.patchProduct(product.id, payload);
      replaceProduct(updated);
      return updated;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update product.');
      return null;
    } finally {
      setSavingId(null);
    }
  }

  async function handlePosSave(product: Product, units: PosDeliveryUnitSelection[]) {
    const updated = await patchProduct(product, {
      posEnabled: true,
      posDeliveryUnits: units,
    });
    if (updated) setPosModalProduct(null);
  }

  const hasFacetFilters = Boolean(
    search.trim()
    || categoryFilter !== 'All'
    || groupFilter !== 'All'
    || filterProduct
    || filterSubProduct
    || filterVariableProduct
    || filterB2c
    || filterB2b
    || filterPos,
  );
  const hasActiveFilters = hasFacetFilters || showDeactivated;

  return (
    <div className={pageShellClass({ embedded })}>
      <PageStickyFilters opaque className="space-y-2 py-2">
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => void loadProducts()}
            disabled={loading || !orgReady}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw size={12}  />
            Refresh
          </button>
          {onCreateProduct ? (
            <button
              type="button"
              onClick={onCreateProduct}
              disabled={!orgReady}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50"
            >
              <Plus size={12} />
              New product
            </button>
          ) : null}
        </div>

        {!orgReady ? (
          <p className="text-xs text-muted-foreground border border-dashed border-border rounded-lg px-4 py-5 text-center">
            Select a company and at least one location in the header to view products.
          </p>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1 flex-1 min-w-[14rem]">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="product-search">
                Search
              </label>
              <input
                id="product-search"
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by ID or name…"
                className={`${filterCls} w-full`}
              />
            </div>
            <div className="flex flex-wrap items-center gap-4 pb-0.5">
              <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterProduct}
                  onChange={e => setFilterProduct(e.target.checked)}
                  className="rounded border-border"
                />
                Product
              </label>
              <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterSubProduct}
                  onChange={e => setFilterSubProduct(e.target.checked)}
                  className="rounded border-border"
                />
                Sub-Product
              </label>
              <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterVariableProduct}
                  onChange={e => setFilterVariableProduct(e.target.checked)}
                  className="rounded border-border"
                />
                Variable Product
              </label>
              <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterB2c}
                  onChange={e => setFilterB2c(e.target.checked)}
                  className="rounded border-border"
                />
                B2C
              </label>
              <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterB2b}
                  onChange={e => setFilterB2b(e.target.checked)}
                  className="rounded border-border"
                />
                B2B
              </label>
              <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterPos}
                  onChange={e => setFilterPos(e.target.checked)}
                  className="rounded border-border"
                />
                POS
              </label>
              <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={showDeactivated}
                  onChange={e => setShowDeactivated(e.target.checked)}
                  className="rounded border-border"
                />
                <span>
                  Show deactivated
                  <span className="block text-[10px] text-muted-foreground font-normal">
                    Show only inactive products
                  </span>
                </span>
              </label>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="product-category-filter">
                Category
              </label>
              <select
                id="product-category-filter"
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className={`${filterCls} `}
              >
                <option value="All">All categories</option>
                {categoryOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="product-group-filter">
                Group
              </label>
              <select
                id="product-group-filter"
                value={groupFilter}
                onChange={e => setGroupFilter(e.target.value)}
                className={`${filterCls} `}
              >
                <option value="All">All groups</option>
                {groupOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            <p className="text-xs text-muted-foreground pb-2">
              {visibleProducts.length} {showDeactivated ? 'deactivated ' : ''}product{visibleProducts.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </PageStickyFilters>

      {!orgReady ? null : (
        <>
          {error ? (
            <p className="text-xs text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2">
              {error}
            </p>
          ) : null}

          <TableScrollContainer
            ref={scrollRootRef}
            className={TABLE_SCROLL_CLS}
            tableId="revenue.product-list"
          >
            <table className="w-full border-collapse">
              <TableColGroup columns={PRODUCT_LIST_TABLE_COLUMNS} />
              <thead>
                <SortableTableHeaderRow
                  columns={PRODUCT_LIST_TABLE_COLUMNS}
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                  className="bg-muted/20 border-b border-border"
                />
              </thead>
              <tbody>
                {loading ? (
                  <TableLoadingRow colSpan={PRODUCT_LIST_COL_SPAN} label="Loading products…" />
                ) : visibleProducts.length === 0 ? (
                  <tr>
                    <td colSpan={PRODUCT_LIST_COL_SPAN} className="px-3 py-8 text-center text-xs text-muted-foreground">
                      {showDeactivated
                        && !hasFacetFilters
                        ? 'No deactivated products for this location.'
                        : !showDeactivated
                          && products.some(p => !p.active && productMatchesLocations(p, selectedLocationIds))
                          && !hasFacetFilters
                          ? 'No active products. Tick “Show deactivated” to view inactive ones.'
                          : hasActiveFilters
                            ? 'No products match your filters.'
                            : 'No products saved yet. Create one from the Products tab.'}
                    </td>
                  </tr>
                ) : (
                  pagedVisibleProducts.map(product => {
                    const rowBusy = savingId === product.id;
                    const variationPoints = collectProductListRrpPoints(product, products);
                    const openDetails = () => setDetailProduct(product);
                    return (
                      <tr
                        key={product.id}
                        className={`hover:bg-muted/30 cursor-pointer ${!product.active ? 'opacity-60' : ''} ${detailProduct?.id === product.id ? 'bg-primary/5' : ''}`}
                        onClick={openDetails}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openDetails();
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        aria-label={`View details for ${product.name}`}
                      >
                        <td className={`${tdCls} text-muted-foreground min-w-0`}>
                          <span className="line-clamp-2">{product.category?.trim() || '—'}</span>
                        </td>
                        <td className={`${tdCls} text-muted-foreground min-w-0`}>
                          <span className="line-clamp-2">{product.group?.trim() || '—'}</span>
                        </td>
                        <td className={`${tdCls} font-mono text-[11px] text-muted-foreground tabular-nums whitespace-nowrap`}>
                          {product.productId || '—'}
                        </td>
                        <td className={tdCls}>
                          {product.isSubProduct
                            ? 'Sub-Product'
                            : product.isVariableProduct
                              ? 'Variable Product'
                              : 'Product'}
                        </td>
                        <td className={tdCls}>
                          <span className="font-medium text-left line-clamp-2">
                            {product.name}
                          </span>
                        </td>
                        <td className={tdCls}>
                          <VariationStack
                            points={variationPoints}
                            render={point => point.deliveryUnit}
                          />
                        </td>
                        <td className={tdCls} onClick={e => e.stopPropagation()}>
                          <InlineRrpInput
                            product={product}
                            disabled={rowBusy}
                            onCommit={rrp => void patchProduct(product, { rrp })}
                          />
                        </td>
                        <td className={tdCls}>
                          <VariationStack
                            points={variationPoints}
                            render={point => (
                              point.unitCogs != null ? formatRm(point.unitCogs, countryCode) : '—'
                            )}
                          />
                        </td>
                        <td className={tdCls}>
                          <span className="inline-flex items-center gap-1 font-sans">
                            <VariationStack
                              points={variationPoints}
                              render={point => point.cogsPercentLabel}
                            />
                            {!product.isSubProduct ? <CogsPercentTrendIcon product={product} /> : null}
                          </span>
                        </td>
                        <td className={tdCls}>{channelLabel(product)}</td>
                        <td
                          className={`${tdCls} text-center`}
                          onClick={e => e.stopPropagation()}
                          onDoubleClick={() => {
                            if (!product.isSubProduct && product.b2cEnabled && product.posEnabled) {
                              setPosModalProduct(product);
                            }
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={product.posEnabled}
                            disabled={
                              rowBusy
                              || product.isSubProduct
                              || !product.b2cEnabled
                            }
                            onChange={e => {
                              if (product.isSubProduct || !product.b2cEnabled) return;
                              if (e.target.checked) {
                                setPosModalProduct(product);
                                return;
                              }
                              void patchProduct(product, { posEnabled: false, posDeliveryUnits: [] });
                            }}
                            className="rounded border-border disabled:opacity-40 disabled:cursor-not-allowed"
                            aria-label={`POS for ${product.name}`}
                            title={
                              product.isSubProduct
                                ? 'POS is not available for sub-products'
                                : !product.b2cEnabled
                                  ? 'POS requires a B2C product'
                                  : product.posEnabled
                                    ? 'POS enabled — double-click to change sell units, uncheck to disable'
                                    : (product.rrp ?? 0) <= 0
                                      ? 'Enable POS and choose sell units (RRP can be set after)'
                                      : 'Enable POS and choose sell units'
                            }
                          />
                        </td>
                        <td className={`${tdCls} text-center`} onClick={e => e.stopPropagation()}>
                          <div className="inline-flex justify-center">
                            <ToggleSwitch
                              checked={product.active}
                              disabled={rowBusy}
                              label={`Activate ${product.name}`}
                              onChange={active => void patchProduct(product, { active })}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
                <InfiniteScrollTableSentinel colSpan={PRODUCT_LIST_COL_SPAN} hasMore={hasMore} onLoadMore={loadMore} nextPageSize={nextPageSize} sentinelRef={sentinelRef} totalCount={totalCount} visibleCount={visibleCount} />
              </tbody>
            </table>
          </TableScrollContainer>
        </>
      )}

      {detailProduct ? (
        <ProductDetailPanel
          product={detailProduct}
          companyId={selectedCompanyId}
          selectedLocationIds={selectedLocationIds}
          onClose={() => setDetailProduct(null)}
          onUpdated={replaceProduct}
        />
      ) : null}

      {posModalProduct ? (
        <ProductPosUnitsModal
          product={posModalProduct}
          catalogProducts={products}
          saving={savingId === posModalProduct.id}
          onClose={() => setPosModalProduct(null)}
          onSave={units => void handlePosSave(posModalProduct, units)}
        />
      ) : null}
    </div>
  );
}
