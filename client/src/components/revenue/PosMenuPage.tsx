import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type Product } from '../../api';
import {
  productMatchesPosMenu,
  resolvePosMenuRrp,
} from '../../data/posCatalog';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';
import { pageShellClass } from '../layout/pageLayout';
import { MillstoneLoader } from '../shared/MillstoneLoader';
import { TableHeaderCell } from '../shared/TableHeaderCell';
import { TableScrollContainer } from '../shared/TableScrollContainer';

type Props = {
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
};

/** Compulsory modifiers / forced choices — not modeled on Product yet. */
function formatCompulsoryOption(_product: Product): string {
  return '—';
}

export function PosMenuPage({ selectedCompanyId, selectedLocationIds }: Props) {
  const { currency } = useCountryFormatters();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    if (!selectedCompanyId) {
      setProducts([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await api.products(selectedCompanyId);
      setProducts(
        rows
          .filter(p => productMatchesPosMenu(p, selectedCompanyId, selectedLocationIds))
          .sort((a, b) => {
            const cat = (a.category || '').localeCompare(b.category || '');
            if (cat !== 0) return cat;
            const grp = (a.group || '').localeCompare(b.group || '');
            if (grp !== 0) return grp;
            return a.name.localeCompare(b.name);
          }),
      );
    } catch (e) {
      setProducts([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId, selectedLocationIds]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const menuRows = useMemo(
    () =>
      products.map(product => ({
        product,
        rrp: resolvePosMenuRrp(product, products),
        compulsoryOption: formatCompulsoryOption(product),
      })),
    [products],
  );

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

      {error ? (
        <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <MillstoneLoader label="Loading POS menu…" />
        </div>
      ) : menuRows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card px-4 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No POS menu items for this company.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Create a customer-facing product with an RRP under Revenue Management → Products — it is enabled for POS automatically.
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <TableScrollContainer className="max-h-[calc(100dvh-14rem)] overflow-y-auto">
            <table className="w-full table-fixed text-xs">
              <colgroup>
                <col className="w-[14%]" />
                <col className="w-[14%]" />
                <col className="w-[12%]" />
                <col className="w-[28%]" />
                <col className="w-[18%]" />
                <col className="w-[14%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <TableHeaderCell>Category</TableHeaderCell>
                  <TableHeaderCell>Group</TableHeaderCell>
                  <TableHeaderCell>Product Code</TableHeaderCell>
                  <TableHeaderCell>Product</TableHeaderCell>
                  <TableHeaderCell>Compulsory Option</TableHeaderCell>
                  <TableHeaderCell headerAlign="right">RRP</TableHeaderCell>
                </tr>
              </thead>
              <tbody>
                {menuRows.map(({ product, rrp, compulsoryOption }) => (
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
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums whitespace-nowrap">
                      {rrp > 0 ? currency(rrp) : '—'}
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
