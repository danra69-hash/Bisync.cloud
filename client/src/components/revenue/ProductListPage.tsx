import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { useTableSort } from '../../hooks/useTableSort';
import { sortTableRows, compareSortValues } from '../../utils/tableSort';
import { SortableTableHeaderRow, type SortableColumnDef } from '../shared/SortableTableHead';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { pageShellClass, TABLE_SCROLL_CLS } from '../layout/pageLayout';
import { filterSelectCls } from '../layout/formControls';
import { Plus, RefreshCw, ArrowDown, ArrowUp } from 'lucide-react';
import { api, type Product } from '../../api';
import { formatRm } from '../../data/createOrder';
import { calcProductCogs, calcSubProductUnitCost, formatCogsPercent, resolveCogsPercentTrend } from '../../data/productForm';
import { fromApiUom } from '../../data/componentForm';
import { siCategories, siGroups } from '../../data/revenueManagement';
import { ToggleSwitch } from '../admin/ToggleSwitch';
import { ProductDetailPanel } from './ProductDetailPanel';
import { resyncStaleTaggedComponentPrices } from '../../utils/resyncTaggedComponentPrices';

type Props = {
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
  embedded?: boolean;
  onCreateProduct?: () => void;
  onEditProduct?: (productId: number) => void;
};

const tdCls = 'px-3 py-2.5 align-middle border-r border-b border-border last:border-r-0 text-xs';
const filterCls = filterSelectCls;

type ProductListSortColumn =
  | 'name'
  | 'type'
  | 'cogs'
  | 'cogsPercent'
  | 'rrp'
  | 'channel'
  | 'pos'
  | 'activate';

const PRODUCT_LIST_TABLE_COLUMNS: SortableColumnDef<ProductListSortColumn>[] = [
  { key: 'name', label: 'Product Name' },
  { key: 'type', label: 'Type' },
  { key: 'cogs', label: 'Cogs' },
  { key: 'cogsPercent', label: 'COGS %' },
  { key: 'rrp', label: 'RRP' },
  { key: 'channel', label: 'Channel' },
  { key: 'pos', label: 'POS', align: 'center', sortable: false },
  { key: 'activate', label: 'Activate', align: 'center', sortable: false },
];

function productMatchesLocations(product: Product, locationIds: string[]): boolean {
  const productLocs = product.locationExternalIds ?? [];
  if (locationIds.length === 0) return false;
  if (productLocs.length === 0) return true;
  return locationIds.some(id => productLocs.includes(id));
}

function productCogsDisplay(product: Product): string {
  return formatRm(calcProductCogs(product.totalCost, product.packagingCost ?? 0, product));
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
    const productCogs = calcProductCogs(product.totalCost, product.packagingCost ?? 0, product);
    if (product.yieldQuantity <= 0 || !product.yieldUom) return '—';
    const unitCost = calcSubProductUnitCost(productCogs, String(product.yieldQuantity));
    const uom = fromApiUom(product.yieldUom);
    return `${formatRm(unitCost)} / ${uom}`;
  }
  return product.rrp > 0 ? formatRm(product.rrp) : '—';
}

function channelLabel(product: Product): string {
  const channels: string[] = [];
  if (product.b2cEnabled) channels.push('B2C');
  if (product.b2bEnabled) channels.push('B2B');
  return channels.length > 0 ? channels.join(', ') : '—';
}

export function ProductListPage({
  selectedCompanyId,
  selectedLocationIds,
  embedded = false,
  onCreateProduct,
  onEditProduct,
}: Props) {
  const orgReady = Boolean(selectedCompanyId) && selectedLocationIds.length > 0;

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [groupFilter, setGroupFilter] = useState('All');
  const [filterProduct, setFilterProduct] = useState(false);
  const [filterSubProduct, setFilterSubProduct] = useState(false);
  const [filterB2c, setFilterB2c] = useState(false);
  const [filterB2b, setFilterB2b] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
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
    filterB2c,
    filterB2b,
    selectedLocationIds,
    resetSort,
  ]);

  const categoryOptions = useMemo(() => {
    const fromProducts = products.map(p => p.category).filter(Boolean);
    return [...new Set([
      ...siCategories.filter(c => c !== 'All'),
      ...fromProducts,
    ])].sort((a, b) => a.localeCompare(b));
  }, [products]);

  const groupOptions = useMemo(() => {
    const fromProducts = products.map(p => p.group).filter(Boolean);
    return [...new Set([
      ...siGroups.filter(g => g !== 'All'),
      ...fromProducts,
    ])].sort((a, b) => a.localeCompare(b));
  }, [products]);

  const visibleProducts = useMemo(() => {
    let scoped = products.filter(p => productMatchesLocations(p, selectedLocationIds));

    if (categoryFilter !== 'All') {
      scoped = scoped.filter(p => p.category === categoryFilter);
    }
    if (groupFilter !== 'All') {
      scoped = scoped.filter(p => p.group === groupFilter);
    }

    if (filterProduct && !filterSubProduct) {
      scoped = scoped.filter(p => !p.isSubProduct);
    } else if (filterSubProduct && !filterProduct) {
      scoped = scoped.filter(p => p.isSubProduct);
    }

    if (filterB2c || filterB2b) {
      scoped = scoped.filter(p => (
        (filterB2c && p.b2cEnabled) || (filterB2b && p.b2bEnabled)
      ));
    }

    const query = search.trim().toLowerCase();
    if (!query) return scoped;

    return scoped.filter(p => [
      p.productId,
      p.name,
      p.category,
      p.group,
    ].join(' ').toLowerCase().includes(query));
  }, [products, selectedLocationIds, search, categoryFilter, groupFilter, filterProduct, filterSubProduct, filterB2c, filterB2b]);

  const sortedVisibleProducts = useMemo(
    () =>
      sortTableRows(
        visibleProducts,
        sortColumn,
        sortDirection,
        {
          name: p => p.name,
          type: p => (p.isSubProduct ? 'Sub-Product' : 'Product'),
          cogs: p => calcProductCogs(p.totalCost, p.packagingCost ?? 0, p),
          cogsPercent: p => {
            if (p.isSubProduct) return -1;
            const cogs = calcProductCogs(p.totalCost, p.packagingCost ?? 0, p);
            return p.rrp > 0 ? (cogs / p.rrp) * 100 : -1;
          },
          rrp: p => {
            if (p.isSubProduct) {
              const productCogs = calcProductCogs(p.totalCost, p.packagingCost ?? 0, p);
              if (p.yieldQuantity <= 0 || !p.yieldUom) return -1;
              return calcSubProductUnitCost(productCogs, String(p.yieldQuantity));
            }
            return p.rrp;
          },
          channel: p => channelLabel(p),
        },
        { tieBreaker: (a, b) => compareSortValues(a.name, b.name) },
      ),
    [visibleProducts, sortColumn, sortDirection],
  );

  const scrollRootRef = useRef<HTMLDivElement>(null);
  const {
    visibleItems: pagedVisibleProducts,
    hasMore,
    sentinelRef,
    totalCount,
    visibleCount,
  } = useInfiniteScrollSlice(sortedVisibleProducts, { scrollRootRef });

  function replaceProduct(updated: Product) {
    setProducts(prev => prev.map(p => (p.id === updated.id ? updated : p)));
    setDetailProduct(prev => (prev?.id === updated.id ? updated : prev));
  }

  async function patchProduct(product: Product, payload: Parameters<typeof api.patchProduct>[1]) {
    setSavingId(product.id);
    setError(null);
    try {
      const updated = await api.patchProduct(product.id, payload);
      replaceProduct(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update product.');
    } finally {
      setSavingId(null);
    }
  }

  const hasActiveFilters = Boolean(
    search.trim()
    || categoryFilter !== 'All'
    || groupFilter !== 'All'
    || filterProduct
    || filterSubProduct
    || filterB2c
    || filterB2b,
  );

  return (
    <div className={pageShellClass({ embedded })}>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => void loadProducts()}
          disabled={loading || !orgReady}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
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
        <>
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
              {visibleProducts.length} product{visibleProducts.length !== 1 ? 's' : ''}
            </p>
          </div>

          {error ? (
            <p className="text-xs text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2">
              {error}
            </p>
          ) : null}

          <TableScrollContainer ref={scrollRootRef} className={TABLE_SCROLL_CLS}>
            <table className="w-full table-fixed border-collapse">
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
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-xs text-muted-foreground">
                      Loading products…
                    </td>
                  </tr>
                ) : visibleProducts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-xs text-muted-foreground">
                      {hasActiveFilters
                        ? 'No products match your filters.'
                        : 'No products saved yet. Create one from the Products tab.'}
                    </td>
                  </tr>
                ) : (
                  pagedVisibleProducts.map(product => {
                    const rowBusy = savingId === product.id;
                    return (
                      <tr key={product.id} className={`hover:bg-muted/20 ${!product.active ? 'opacity-60' : ''}`}>
                        <td className={tdCls}>
                          <button
                            type="button"
                            onClick={() => setDetailProduct(product)}
                            className="font-medium text-left hover:text-primary hover:underline"
                          >
                            {product.name}
                          </button>
                          <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{product.productId}</p>
                        </td>
                        <td className={tdCls}>{product.isSubProduct ? 'Sub-Product' : 'Product'}</td>
                        <td className={tdCls}>{productCogsDisplay(product)}</td>
                        <td className={tdCls}>
                          <span className="inline-flex items-center font-sans">
                            {productCogsPercentDisplay(product)}
                            <CogsPercentTrendIcon product={product} />
                          </span>
                        </td>
                        <td className={tdCls}>{rrpDisplay(product)}</td>
                        <td className={tdCls}>{channelLabel(product)}</td>
                        <td className={`${tdCls} text-center`}>
                          <input
                            type="checkbox"
                            checked={product.posEnabled}
                            disabled={rowBusy || product.isSubProduct}
                            onChange={e => void patchProduct(product, { posEnabled: e.target.checked })}
                            className="rounded border-border disabled:opacity-40 disabled:cursor-not-allowed"
                            aria-label={`POS for ${product.name}`}
                            title={product.isSubProduct ? 'POS is not available for sub-products' : undefined}
                          />
                        </td>
                        <td className={`${tdCls} text-center`}>
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
                <InfiniteScrollTableSentinel colSpan={8} hasMore={hasMore} sentinelRef={sentinelRef} totalCount={totalCount} visibleCount={visibleCount} />
              </tbody>
            </table>
          </TableScrollContainer>
        </>
      )}

      {detailProduct ? (
        <ProductDetailPanel
          product={detailProduct}
          companyId={selectedCompanyId}
          onClose={() => setDetailProduct(null)}
          onUpdated={replaceProduct}
          onEdit={onEditProduct ? () => {
            const id = detailProduct.id;
            setDetailProduct(null);
            onEditProduct(id);
          } : undefined}
        />
      ) : null}
    </div>
  );
}
