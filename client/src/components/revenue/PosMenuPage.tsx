import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { api, type Product } from '../../api';
import {
  productMatchesPosMenu,
  resolvePosMenuRrp,
  resolvePosMenuSellPrice,
} from '../../data/posCatalog';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';
import { filterSelectCls } from '../layout/formControls';
import { pageShellClass } from '../layout/pageLayout';
import { PageStickyFilters } from '../layout/PageStickyFilters';
import { MillstoneLoader } from '../shared/MillstoneLoader';
import { TableHeaderCell } from '../shared/TableHeaderCell';
import { TableScrollContainer } from '../shared/TableScrollContainer';

type Props = {
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
};

const filterCls = filterSelectCls;

/** Compulsory modifiers / forced choices — not modeled on Product yet. */
function formatCompulsoryOption(_product: Product): string {
  return '—';
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.map(v => v.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  );
}

export function PosMenuPage({ selectedCompanyId, selectedLocationIds }: Props) {
  const { currency } = useCountryFormatters();
  const [products, setProducts] = useState<Product[]>([]);
  const [promoRppByProductId, setPromoRppByProductId] = useState<Map<number, number>>(
    () => new Map(),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [groupFilter, setGroupFilter] = useState('All');
  const [searchDraft, setSearchDraft] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  const loadProducts = useCallback(async () => {
    if (!selectedCompanyId) {
      setProducts([]);
      setPromoRppByProductId(new Map());
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await api.products(selectedCompanyId);
      const menu = rows
        .filter(p => productMatchesPosMenu(p, selectedCompanyId, selectedLocationIds))
        .sort((a, b) => {
          const cat = (a.category || '').localeCompare(b.category || '');
          if (cat !== 0) return cat;
          const grp = (a.group || '').localeCompare(b.group || '');
          if (grp !== 0) return grp;
          return a.name.localeCompare(b.name);
        });
      setProducts(menu);

      try {
        const active = await api.posPromotionActivePrices(selectedCompanyId, {
          locationExternalId: selectedLocationIds[0],
          productIds: menu.map(p => p.id),
        });
        const next = new Map<number, number>();
        for (const row of active.prices) {
          if (row.productId > 0 && Number.isFinite(row.rpp) && row.rpp >= 0) {
            next.set(row.productId, row.rpp);
          }
        }
        setPromoRppByProductId(next);
      } catch {
        setPromoRppByProductId(new Map());
      }
    } catch (e) {
      setProducts([]);
      setPromoRppByProductId(new Map());
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId, selectedLocationIds]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    setCategoryFilter('All');
    setGroupFilter('All');
    setSearchDraft('');
    setAppliedSearch('');
  }, [selectedCompanyId, selectedLocationIds]);

  const categoryOptions = useMemo(
    () => uniqueSorted(products.map(p => p.category || '')),
    [products],
  );

  const groupOptions = useMemo(() => {
    const scoped =
      categoryFilter === 'All'
        ? products
        : products.filter(p => (p.category || '') === categoryFilter);
    return uniqueSorted(scoped.map(p => p.group || ''));
  }, [products, categoryFilter]);

  useEffect(() => {
    if (categoryFilter !== 'All' && !categoryOptions.includes(categoryFilter)) {
      setCategoryFilter('All');
    }
  }, [categoryFilter, categoryOptions]);

  useEffect(() => {
    if (groupFilter !== 'All' && !groupOptions.includes(groupFilter)) {
      setGroupFilter('All');
    }
  }, [groupFilter, groupOptions]);

  const runSearch = useCallback(() => {
    setAppliedSearch(searchDraft.trim());
  }, [searchDraft]);

  const menuRows = useMemo(() => {
    const q = appliedSearch.toLowerCase();
    return products
      .filter(product => {
        if (categoryFilter !== 'All' && (product.category || '') !== categoryFilter) return false;
        if (groupFilter !== 'All' && (product.group || '') !== groupFilter) return false;
        if (!q) return true;
        const hay = [
          product.name,
          product.productId,
          product.category,
          product.group,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      })
      .map(product => {
        const rrp = resolvePosMenuRrp(product, products);
        const sellPrice = resolvePosMenuSellPrice(product, products, promoRppByProductId);
        return {
          product,
          rrp,
          sellPrice,
          onPromo: promoRppByProductId.has(product.id),
          compulsoryOption: formatCompulsoryOption(product),
        };
      });
  }, [products, categoryFilter, groupFilter, appliedSearch, promoRppByProductId]);

  const filtersActive =
    categoryFilter !== 'All' || groupFilter !== 'All' || appliedSearch.length > 0;

  if (!selectedCompanyId) {
    return (
      <div className={pageShellClass()}>
        <p className="text-sm text-muted-foreground">Select a company to open POS Menu.</p>
      </div>
    );
  }

  return (
    <div className={pageShellClass({ spacing: 'default' })}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">POS Menu</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Products enabled for POS with a retail price (RRP) for this company.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadProducts()}
          disabled={loading}
          className="text-xs font-sans border border-border rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      <PageStickyFilters opaque className="py-2">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label
              className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
              htmlFor="pos-menu-category-filter"
            >
              Category
            </label>
            <select
              id="pos-menu-category-filter"
              value={categoryFilter}
              onChange={e => {
                setCategoryFilter(e.target.value);
                setGroupFilter('All');
              }}
              className={filterCls}
            >
              <option value="All">All categories</option>
              {categoryOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label
              className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
              htmlFor="pos-menu-group-filter"
            >
              Group
            </label>
            <select
              id="pos-menu-group-filter"
              value={groupFilter}
              onChange={e => setGroupFilter(e.target.value)}
              className={filterCls}
            >
              <option value="All">All groups</option>
              {groupOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1 flex-1 min-w-[14rem]">
            <label
              className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
              htmlFor="pos-menu-search"
            >
              Search
            </label>
            <div className="flex gap-2">
              <input
                id="pos-menu-search"
                type="search"
                value={searchDraft}
                onChange={e => setSearchDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    runSearch();
                  }
                }}
                placeholder="Search by name, code, category, or group…"
                className={`${filterCls} w-full`}
              />
              <button
                type="button"
                onClick={runSearch}
                className="inline-flex items-center gap-1.5 shrink-0 text-xs font-semibold border border-border rounded-md px-3 py-1.5 text-foreground hover:bg-muted/50"
              >
                <Search size={12} />
                Search
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground pb-2">
            {menuRows.length} item{menuRows.length !== 1 ? 's' : ''}
          </p>
        </div>
      </PageStickyFilters>

      {error ? (
        <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <MillstoneLoader label="Loading POS menu…" />
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card px-4 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No POS menu items for this company.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Create a customer-facing product with an RRP under Revenue Management → Products — it is enabled for POS automatically.
          </p>
        </div>
      ) : menuRows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card px-4 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No POS menu items match the current filters.
          </p>
          {filtersActive ? (
            <button
              type="button"
              className="mt-3 text-xs font-semibold text-primary hover:underline"
              onClick={() => {
                setCategoryFilter('All');
                setGroupFilter('All');
                setSearchDraft('');
                setAppliedSearch('');
              }}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <TableScrollContainer className="max-h-[calc(100dvh-16rem)] overflow-y-auto">
            <table className="w-full text-xs">
              <colgroup>
                <col className="w-[12%]" />
                <col className="w-[12%]" />
                <col className="w-[11%]" />
                <col className="w-[24%]" />
                <col className="w-[15%]" />
                <col className="w-[13%]" />
                <col className="w-[13%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <TableHeaderCell>Category</TableHeaderCell>
                  <TableHeaderCell>Group</TableHeaderCell>
                  <TableHeaderCell>Product Code</TableHeaderCell>
                  <TableHeaderCell>Product</TableHeaderCell>
                  <TableHeaderCell>Compulsory Option</TableHeaderCell>
                  <TableHeaderCell headerAlign="right">RRP</TableHeaderCell>
                  <TableHeaderCell headerAlign="right">Sell</TableHeaderCell>
                </tr>
              </thead>
              <tbody>
                {menuRows.map(({ product, rrp, sellPrice, onPromo, compulsoryOption }) => (
                  <tr key={product.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2.5 text-muted-foreground min-w-0">
                      <span className="line-clamp-2">{product.category?.trim() || '—'}</span>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground min-w-0">
                      <span className="line-clamp-2">{product.group?.trim() || '—'}</span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
                      {product.productId || '—'}
                    </td>
                    <td className="px-3 py-2.5 font-medium min-w-0">
                      <span className="line-clamp-2">{product.name}</span>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground min-w-0">
                      <span className="line-clamp-2">{compulsoryOption}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap text-muted-foreground">
                      {rrp > 0 ? currency(rrp) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums whitespace-nowrap">
                      {sellPrice >= 0 ? currency(sellPrice) : '—'}
                      {onPromo ? (
                        <span className="ml-1 text-[10px] font-bold uppercase text-primary">RPP</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScrollContainer>
        </div>
      )}
    </div>
  );
}
