import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { pageShellClass, TABLE_SCROLL_CLS } from '../layout/pageLayout';
import { filterSelectCls, inlineNumberCls } from '../layout/formControls';
import { RefreshCw, ArrowDown, ArrowUp } from 'lucide-react';
import { api, type Product, type ProductManagementSummary } from '../../api';
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

type ManagementRow = Product & {
  batchUnit: string;
  inStock: number;
  salesPerDay: number;
  toProduceQty: number;
};

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

function mergeManagementRow(product: Product, summary?: ProductManagementSummary): ManagementRow {
  const storedUnit = summary?.batchUnit ?? summary?.packageUnit;
  return {
    ...product,
    batchUnit: resolveManagementBatchUnit(product, storedUnit),
    inStock: summary?.inStock ?? 0,
    salesPerDay: summary?.salesPerDay ?? 0,
    toProduceQty: summary?.toProduceQty ?? 0,
  };
}

export function ProductManagementPage({ selectedCompanyId, selectedLocationIds }: Props) {
  const orgReady = Boolean(selectedCompanyId) && selectedLocationIds.length > 0;

  const [products, setProducts] = useState<Product[]>([]);
  const [managementByProductId, setManagementByProductId] = useState<Record<number, ProductManagementSummary>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [groupFilter, setGroupFilter] = useState('All');
  const [productTypeFilter, setProductTypeFilter] = useState<ProductTypeFilter>('b2b');
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [actionId, setActionId] = useState<number | null>(null);
  const [produceTarget, setProduceTarget] = useState<ManagementRow | null>(null);
  const [produceError, setProduceError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!selectedCompanyId || selectedLocationIds.length === 0) {
      setProducts([]);
      setManagementByProductId({});
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
      setManagementByProductId(
        Object.fromEntries(managementData.map(row => [row.productId, row])),
      );
    } catch (e) {
      setProducts([]);
      setManagementByProductId({});
      setError(e instanceof Error ? e.message : 'Failed to load products.');
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId, selectedLocationIds]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function applyManagementSummary(summary: ProductManagementSummary) {
    setManagementByProductId(prev => ({ ...prev, [summary.productId]: summary }));
  }

  async function patchManagement(
    productId: number,
    payload: Parameters<typeof api.patchProductManagement>[1],
  ) {
    setSavingId(productId);
    setError(null);
    try {
      const summary = await api.patchProductManagement(productId, payload);
      applyManagementSummary(summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update product management.');
    } finally {
      setSavingId(null);
    }
  }

  async function runProductionAction(productId: number) {
    setActionId(productId);
    setError(null);
    try {
      const summary = await api.markProductToProduce(productId, selectedLocationIds);
      applyManagementSummary(summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update production status.');
    } finally {
      setActionId(null);
    }
  }

  function openProduceModal(product: ManagementRow) {
    setProduceError(null);
    setProduceTarget(product);
  }

  async function confirmProduce(batchQty: number) {
    if (!produceTarget) return;
    setActionId(produceTarget.id);
    setProduceError(null);
    try {
      const summary = await api.produceProductBatches(produceTarget.id, {
        locationExternalIds: selectedLocationIds,
        batchQty,
      });
      applyManagementSummary(summary);
      setProduceTarget(null);
    } catch (e) {
      setProduceError(e instanceof Error ? e.message : 'Failed to record production.');
    } finally {
      setActionId(null);
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

  const visibleProducts = useMemo(() => {
    let scoped = products
      .filter(p => matchesProductManagementFilters(p, productTypeFilter))
      .filter(p => productMatchesLocations(p, selectedLocationIds));

    if (categoryFilter !== 'All') {
      scoped = scoped.filter(p => p.category === categoryFilter);
    }
    if (groupFilter !== 'All') {
      scoped = scoped.filter(p => p.group === groupFilter);
    }

    const query = search.trim().toLowerCase();
    if (query) {
      scoped = scoped.filter(p => [
        p.productId,
        p.name,
        p.category,
        p.group,
      ].join(' ').toLowerCase().includes(query));
    }

    return scoped.map(product => mergeManagementRow(product, managementByProductId[product.id]));
  }, [products, managementByProductId, selectedLocationIds, search, categoryFilter, groupFilter, productTypeFilter]);

  const scrollRootRef = useRef<HTMLDivElement>(null);
  const {
    visibleItems: pagedVisibleProducts,
    hasMore,
    sentinelRef,
    totalCount,
    visibleCount,
  } = useInfiniteScrollSlice(visibleProducts, { scrollRootRef });

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
              {visibleProducts.length} product{visibleProducts.length !== 1 ? 's' : ''}
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
            <table className="w-full table-fixed border-collapse">
              <thead>
                <tr className="bg-muted/20 border-b border-border">
                  <th className={thCls}>Product Name</th>
                  <th className={thCls}>Category</th>
                  <th className={thCls}>Group</th>
                  <th className={thCls}>Batch Unit</th>
                  <th className={thCls}>In Stock</th>
                  <th className={thCls}>Sales/day</th>
                  <th className={thCls}>Cogs</th>
                  <th className={thCls}>COGS %</th>
                  <th className={thCls}>RRP</th>
                  <th className={`${thCls} text-center`}>To Produce</th>
                  <th className={`${thCls} text-center`}>Produced</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={11} className="px-3 py-8 text-center text-xs text-muted-foreground">
                      Loading products…
                    </td>
                  </tr>
                ) : visibleProducts.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-3 py-8 text-center text-xs text-muted-foreground">
                      {hasActiveFilters
                        ? 'No products match your filters.'
                        : 'No active products yet. Enable B2B or add sub-products on the Products page.'}
                    </td>
                  </tr>
                ) : (
                  pagedVisibleProducts.map(product => {
                    const rowBusy = savingId === product.id || actionId === product.id;
                    return (
                      <tr
                        key={product.id}
                        className={`hover:bg-muted/20 ${product.toProduceQty > 0 ? 'bg-amber-50/70 dark:bg-amber-950/20' : ''}`}
                      >
                        <td className={tdCls}>
                          <button
                            type="button"
                            onClick={() => setDetailProduct(product)}
                            className="font-medium text-left hover:text-primary hover:underline"
                          >
                            {product.name}
                          </button>
                          <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{product.productId}</p>
                          {product.toProduceQty > 0 ? (
                            <p className="text-[10px] text-amber-700 dark:text-amber-300 mt-0.5">
                              Queue: {product.isSubProduct
                                ? `${formatQty(product.toProduceQty)} batch${product.toProduceQty !== 1 ? 'es' : ''} (${product.batchUnit})`
                                : `${formatQty(product.toProduceQty)} ${product.batchUnit}`}
                            </p>
                          ) : null}
                        </td>
                        <td className={tdCls}>{product.category || '—'}</td>
                        <td className={tdCls}>{product.group || '—'}</td>
                        <td className={tdCls}>
                          {product.isSubProduct ? (
                            <span className="font-medium text-foreground" title="Batch size from product yield (QTY/UOM)">
                              {product.batchUnit}
                            </span>
                          ) : (
                            <input
                              type="text"
                              defaultValue={product.batchUnit}
                              key={`${product.id}-${product.batchUnit}`}
                              disabled={rowBusy}
                              onBlur={e => {
                                const next = e.target.value.trim();
                                if (!next || next === product.batchUnit) return;
                                void patchManagement(product.id, {
                                  packageUnit: next,
                                  locationExternalIds: selectedLocationIds,
                                });
                              }}
                              className={`${filterCls} w-full max-w-[5.5rem]`}
                              aria-label={`Batch unit for ${product.name}`}
                            />
                          )}
                        </td>
                        <td className={tdCls}>
                          <input
                            type="number"
                            min={0}
                            step="any"
                            defaultValue={product.inStock}
                            key={`${product.id}-stock-${product.inStock}`}
                            disabled={rowBusy}
                            onBlur={e => {
                              const next = Number.parseFloat(e.target.value);
                              if (!Number.isFinite(next) || next < 0 || next === product.inStock) return;
                              void patchManagement(product.id, {
                                inStock: next,
                                locationExternalIds: selectedLocationIds,
                              });
                            }}
                            className={`${inlineNumberCls} w-full max-w-[5rem]`}
                            aria-label={product.isSubProduct
                              ? `Batches in stock for ${product.name}`
                              : `In stock for ${product.name}`}
                          />
                        </td>
                        <td className={tdCls}>
                          <input
                            type="number"
                            min={0}
                            step="any"
                            defaultValue={product.salesPerDay}
                            key={`${product.id}-sales-${product.salesPerDay}`}
                            disabled={rowBusy}
                            onBlur={e => {
                              const next = Number.parseFloat(e.target.value);
                              if (!Number.isFinite(next) || next < 0 || next === product.salesPerDay) return;
                              void patchManagement(product.id, {
                                salesPerDay: next,
                                locationExternalIds: selectedLocationIds,
                              });
                            }}
                            className={`${inlineNumberCls} w-full max-w-[5rem]`}
                            aria-label={product.isSubProduct
                              ? `Batches sold per day for ${product.name}`
                              : `Sales per day for ${product.name}`}
                          />
                        </td>
                        <td className={tdCls}>{productCogsDisplay(product)}</td>
                        <td className={tdCls}>
                          <span className="inline-flex items-center font-sans">
                            {productCogsPercentDisplay(product)}
                            <CogsPercentTrendIcon product={product} />
                          </span>
                        </td>
                        <td className={tdCls}>{rrpDisplay(product)}</td>
                        <td className={`${tdCls} text-center`}>
                          <button
                            type="button"
                            disabled={rowBusy}
                            onClick={() => void runProductionAction(product.id)}
                            className={`${actionBtnCls} border-amber-300 text-amber-800 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-950/40`}
                          >
                            To Produce
                          </button>
                        </td>
                        <td className={`${tdCls} text-center`}>
                          <button
                            type="button"
                            disabled={rowBusy}
                            onClick={() => openProduceModal(product)}
                            className={`${actionBtnCls} border-primary text-primary hover:bg-primary/10`}
                          >
                            Produced
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
                <InfiniteScrollTableSentinel colSpan={11} hasMore={hasMore} sentinelRef={sentinelRef} totalCount={totalCount} visibleCount={visibleCount} />
              </tbody>
            </table>
          </TableScrollContainer>
        </>
      )}

      {produceTarget ? (
        <ProduceBatchModal
          productName={produceTarget.name}
          batchUnit={produceTarget.batchUnit}
          defaultBatchQty={produceTarget.toProduceQty > 0 ? produceTarget.toProduceQty : 1}
          isSubProduct={produceTarget.isSubProduct}
          saving={actionId === produceTarget.id}
          error={produceError}
          onClose={() => {
            if (actionId !== produceTarget.id) setProduceTarget(null);
          }}
          onConfirm={qty => void confirmProduce(qty)}
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
