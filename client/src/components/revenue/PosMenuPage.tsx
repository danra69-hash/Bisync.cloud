import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type Product } from '../../api';
import {
  listSelectedPosMenuUnits,
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
          .sort((a, b) => a.name.localeCompare(b.name)),
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
      products.map(product => {
        const units = listSelectedPosMenuUnits(product, products);
        const rrp = resolvePosMenuRrp(product, products);
        return { product, units, rrp };
      }),
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
            B2C products with POS enabled for this company, with RRP.
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
            Set product type to B2C, enter RRP, then tick POS under Revenue Management → Products.
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <TableScrollContainer className="max-h-[calc(100dvh-14rem)] overflow-y-auto">
            <table className="w-full table-fixed text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <TableHeaderCell>Product</TableHeaderCell>
                  <TableHeaderCell>Category</TableHeaderCell>
                  <TableHeaderCell>Packaging</TableHeaderCell>
                  <TableHeaderCell headerAlign="right">RRP</TableHeaderCell>
                </tr>
              </thead>
              <tbody>
                {menuRows.map(({ product, units, rrp }) => (
                  <tr key={product.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2.5 font-medium min-w-0">
                      <span className="line-clamp-2">{product.name}</span>
                      <span className="block text-[10px] text-muted-foreground mt-0.5 font-sans">
                        {product.productId}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {[product.category, product.group].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {units.length === 0 ? (
                        'B2C Retail'
                      ) : (
                        <ul className="space-y-0.5">
                          {units.map(unit => (
                            <li key={unit.key} className="truncate" title={unit.unitTitle}>
                              {unit.unitTitle}
                              {unit.rrp > 0 && units.length > 1 ? (
                                <span className="text-[10px] ml-1 tabular-nums">
                                  ({currency(unit.rrp)})
                                </span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      )}
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
