import { useCallback, useEffect, useMemo, useState } from 'react';
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { api, type PosTestTapStatus, type Product } from '../../api';
import { productMatchesPosMenu, resolvePosMenuRrp } from '../../data/posCatalog';
import { pageShellClass } from '../layout/pageLayout';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';
import { MillstoneLoader } from '../shared/MillstoneLoader';

type Props = {
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
};

type CartLine = {
  productId: number;
  name: string;
  unitPrice: number;
  qty: number;
};

export function PosTestTapPage({ selectedCompanyId, selectedLocationIds }: Props) {
  const { currency } = useCountryFormatters();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [charging, setCharging] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [schemaStatus, setSchemaStatus] = useState<PosTestTapStatus | null>(null);

  const locationId = selectedLocationIds[0] ?? null;

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

  useEffect(() => {
    let cancelled = false;
    async function loadSchema() {
      if (!selectedCompanyId) {
        setSchemaStatus(null);
        return;
      }
      try {
        const data = await api.posTestTapStatus(selectedCompanyId, locationId);
        if (!cancelled) setSchemaStatus(data);
      } catch {
        if (!cancelled) setSchemaStatus(null);
      }
    }
    void loadSchema();
    return () => {
      cancelled = true;
    };
  }, [selectedCompanyId, locationId]);

  useEffect(() => {
    setCart([]);
    setStatus(null);
  }, [selectedCompanyId, locationId]);

  const tapTiles = useMemo(
    () => products.filter(p => !p.isSubProduct),
    [products],
  );

  const cartTotal = useMemo(
    () => cart.reduce((sum, line) => sum + line.unitPrice * line.qty, 0),
    [cart],
  );

  function tapProduct(product: Product) {
    setStatus(null);
    setCart(prev => {
      const existing = prev.find(line => line.productId === product.id);
      if (existing) {
        return prev.map(line =>
          line.productId === product.id ? { ...line, qty: line.qty + 1 } : line,
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          unitPrice: resolvePosMenuRrp(product, products),
          qty: 1,
        },
      ];
    });
  }

  function adjustQty(productId: number, delta: number) {
    setStatus(null);
    setCart(prev =>
      prev
        .map(line =>
          line.productId === productId ? { ...line, qty: line.qty + delta } : line,
        )
        .filter(line => line.qty > 0),
    );
  }

  function clearCart() {
    setCart([]);
    setStatus(null);
  }

  async function chargeSale() {
    if (!locationId || cart.length === 0) return;
    setCharging(true);
    setError(null);
    setStatus(null);
    try {
      for (const line of cart) {
        await api.recordProductSale(line.productId, {
          locationExternalIds: [locationId],
          quantitySold: line.qty,
          salesChannel: 'pos',
        });
      }
      const total = cartTotal;
      const count = cart.reduce((n, line) => n + line.qty, 0);
      setCart([]);
      setStatus(`Recorded POS sale · ${count} item${count === 1 ? '' : 's'} · ${currency(total)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCharging(false);
    }
  }

  if (!selectedCompanyId) {
    return (
      <div className={pageShellClass()}>
        <p className="text-sm text-muted-foreground">Select a company to open POS Test Tap.</p>
      </div>
    );
  }

  if (!locationId) {
    return (
      <div className={pageShellClass()}>
        <p className="text-sm text-muted-foreground">Select a location to ring POS Test Tap sales.</p>
      </div>
    );
  }

  return (
    <div className={pageShellClass({ spacing: 'default' })}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">POS Test Tap</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tap B2C POS menu products (with RRP) to build a test sale, then charge to deplete inventory.
          </p>
        </div>
        {status ? (
          <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">{status}</p>
        ) : null}
      </div>

      {schemaStatus?.ready ? (
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground space-y-1">
          <p className="font-medium text-foreground/80">
            Operational tables ready
            {schemaStatus.openBlocksEod ? ' · open checks block EOD' : ''}
          </p>
          <p className="tabular-nums">
            {(schemaStatus.tables ?? [])
              .map(t => `${t.name.replace(/^Pos/, '')} ${t.count}`)
              .join(' · ')}
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="min-w-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <MillstoneLoader label="Loading POS products…" />
            </div>
          ) : tapTiles.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card px-4 py-12 text-center">
              <p className="text-sm text-muted-foreground">
                No B2C POS menu products for this company/location.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Set type to B2C, enter RRP, then tick POS under Revenue Management → Products.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
              {tapTiles.map(product => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => tapProduct(product)}
                  className="rounded-lg border border-border bg-card px-3 py-4 text-left transition-colors hover:border-primary/60 hover:bg-muted/30 active:scale-[0.98]"
                >
                  <p className="text-sm font-medium text-foreground line-clamp-2 min-h-[2.5rem]">
                    {product.name}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">{product.category || '—'}</p>
                  <p className="mt-1 text-sm font-semibold tabular-nums">
                    {currency(resolvePosMenuRrp(product, products))}
                  </p>
                </button>
              ))}
            </div>
          )}
        </section>

        <aside className="rounded-lg border border-border bg-card p-3 flex flex-col min-h-[18rem]">
          <div className="flex items-center justify-between gap-2 mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
              <ShoppingBag size={13} />
              Ticket
            </p>
            {cart.length > 0 ? (
              <button
                type="button"
                onClick={clearCart}
                className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                <Trash2 size={12} />
                Clear
              </button>
            ) : null}
          </div>

          {cart.length === 0 ? (
            <p className="text-xs text-muted-foreground flex-1 py-6 text-center">
              Tap a product to add it.
            </p>
          ) : (
            <ul className="flex-1 space-y-2 overflow-y-auto max-h-[calc(100dvh-22rem)]">
              {cart.map(line => (
                <li key={line.productId} className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{line.name}</p>
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      {currency(line.unitPrice)} × {line.qty}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => adjustQty(line.productId, -1)}
                      className="h-7 w-7 rounded-md border border-border flex items-center justify-center hover:bg-muted"
                      aria-label={`Decrease ${line.name}`}
                    >
                      <Minus size={12} />
                    </button>
                    <span className="w-6 text-center text-xs tabular-nums">{line.qty}</span>
                    <button
                      type="button"
                      onClick={() => adjustQty(line.productId, 1)}
                      className="h-7 w-7 rounded-md border border-border flex items-center justify-center hover:bg-muted"
                      aria-label={`Increase ${line.name}`}
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-border pt-3 mt-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="font-semibold tabular-nums">{currency(cartTotal)}</span>
            </div>
            <button
              type="button"
              disabled={cart.length === 0 || charging}
              onClick={() => void chargeSale()}
              className="w-full rounded-md bg-primary text-primary-foreground text-sm font-semibold py-2.5 disabled:opacity-45 disabled:cursor-not-allowed hover:opacity-95"
            >
              {charging ? 'Recording…' : 'Charge POS sale'}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
