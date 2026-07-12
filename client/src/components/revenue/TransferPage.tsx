import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRightLeft, Plus, Search } from 'lucide-react';
import {
  api,
  type Ingredient,
  type Location,
  type Product,
  type TransferEntry,
} from '../../api';
import { pageShellClass } from '../layout/pageLayout';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { InfiniteScrollDivSentinel } from '../shared/infiniteScroll';
import {
  currentStockCardMonth,
  earliestStockCardMonth,
  formatStockCardMonthLabel,
} from './stockCardPeriod';
import { componentMatchesLocations } from '../../data/createOrder';
import { ingredientToRow } from './smartIngredientShared';
import { fromApiUom } from '../../data/componentForm';

type Props = {
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
};

type ItemKind = 'component' | 'product' | 'sub-product';

type CatalogItem = {
  kind: ItemKind;
  key: string;
  name: string;
  uoms: string[];
  searchText: string;
};

function toDateInputValue(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function earliestLiveDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 2);
  return toDateInputValue(d);
}

function parseAltUnits(json?: string): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(item => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object' && 'uom' in item) {
          return String((item as { uom?: string }).uom ?? '').trim();
        }
        if (item && typeof item === 'object' && 'unit' in item) {
          return String((item as { unit?: string }).unit ?? '').trim();
        }
        return '';
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function uniqueUoms(...lists: string[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const raw of list) {
      const u = raw.trim();
      if (!u) continue;
      const key = u.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(u);
    }
  }
  return out;
}

function productUoms(p: Product): string[] {
  const yieldUom = (p.yieldUom || 'pcs').trim();
  const alt = parseAltUnits(p.yieldAltUnitsJson);
  const par = (p.parStockUom || '').trim();
  const pack = (p.b2bPackageUnit || '').trim();
  return uniqueUoms([yieldUom], alt, [par], [pack]);
}

function componentUoms(ing: Ingredient): string[] {
  const inventory = fromApiUom(ing.inventoryUom || '');
  const recipe = fromApiUom(ing.recipeUom || '');
  return uniqueUoms([inventory], [recipe]);
}

function formatTransferDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const fieldCls =
  'w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary/40';
const labelCls = 'block text-[11px] font-sans uppercase tracking-wide text-muted-foreground mb-1';

export function TransferPage({ selectedCompanyId, selectedLocationIds }: Props) {
  const orgReady = !!selectedCompanyId;

  const [month, setMonth] = useState(currentStockCardMonth);
  const [rows, setRows] = useState<TransferEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [locations, setLocations] = useState<Location[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [fromLocationId, setFromLocationId] = useState('');
  const [toLocationId, setToLocationId] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [selected, setSelected] = useState<CatalogItem | null>(null);
  const [quantity, setQuantity] = useState('');
  const [uom, setUom] = useState('');
  const [availableQty, setAvailableQty] = useState<number | null>(null);
  const [availableLoading, setAvailableLoading] = useState(false);
  const [transferDate, setTransferDate] = useState(() => toDateInputValue(new Date()));

  const companyLocations = useMemo(
    () => locations.filter(l => l.companyId === selectedCompanyId).sort((a, b) => a.name.localeCompare(b.name)),
    [locations, selectedCompanyId],
  );

  const locationNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const loc of companyLocations) map.set(loc.externalId, loc.name);
    return map;
  }, [companyLocations]);

  useEffect(() => {
    if (!selectedCompanyId) {
      setFromLocationId('');
      setToLocationId('');
      return;
    }
    const preferred = selectedLocationIds.filter(id =>
      companyLocations.some(l => l.externalId === id),
    );
    const fallback = companyLocations.map(l => l.externalId);
    const pool = preferred.length > 0 ? preferred : fallback;
    if (!fromLocationId || !companyLocations.some(l => l.externalId === fromLocationId)) {
      setFromLocationId(pool[0] ?? '');
    }
    if (!toLocationId || !companyLocations.some(l => l.externalId === toLocationId) || toLocationId === fromLocationId) {
      const nextTo = pool.find(id => id !== (fromLocationId || pool[0])) ?? pool[1] ?? '';
      setToLocationId(nextTo);
    }
  }, [selectedCompanyId, selectedLocationIds, companyLocations, fromLocationId, toLocationId]);

  const loadRows = useCallback(async () => {
    if (!orgReady || !selectedCompanyId) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.transfers(selectedCompanyId, selectedLocationIds, month);
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transfers.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [orgReady, selectedCompanyId, selectedLocationIds, month]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    if (!selectedCompanyId) {
      setLocations([]);
      setIngredients([]);
      setProducts([]);
      return;
    }
    let cancelled = false;
    Promise.all([
      api.locations(),
      api.ingredients(selectedCompanyId),
      api.products(selectedCompanyId),
    ])
      .then(([locs, ings, prods]) => {
        if (cancelled) return;
        setLocations(locs);
        setIngredients(ings);
        setProducts(prods.filter(p => p.active !== false));
      })
      .catch(() => {
        if (!cancelled) {
          setLocations([]);
          setIngredients([]);
          setProducts([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCompanyId]);

  const catalog = useMemo(() => {
    const items: CatalogItem[] = [];
    const fromIds = fromLocationId ? [fromLocationId] : selectedLocationIds;

    for (const ing of ingredients) {
      if (!ing.active) continue;
      const row = ingredientToRow(ing);
      if (fromIds.length > 0 && !componentMatchesLocations(row, fromIds)) continue;
      const uoms = componentUoms(ing);
      if (uoms.length === 0) continue;
      items.push({
        kind: 'component',
        key: ing.componentId,
        name: ing.name,
        uoms,
        searchText: `${ing.name} ${ing.componentId} component`.toLowerCase(),
      });
    }

    for (const p of products) {
      const locs = p.locationExternalIds ?? [];
      if (fromIds.length > 0 && locs.length > 0 && !locs.some(l => fromIds.includes(l))) continue;

      if (p.isSubProduct) {
        const uoms = productUoms(p);
        items.push({
          kind: 'sub-product',
          key: String(p.id),
          name: p.name,
          uoms,
          searchText: `${p.name} ${p.productId} sub-product`.toLowerCase(),
        });
        continue;
      }

      // Finished goods: B2B only
      if (!p.b2bEnabled) continue;
      const uoms = productUoms(p);
      items.push({
        kind: 'product',
        key: String(p.id),
        name: p.name,
        uoms,
        searchText: `${p.name} ${p.productId} product b2b`.toLowerCase(),
      });
    }

    return items.sort((a, b) => a.name.localeCompare(b.name));
  }, [ingredients, products, fromLocationId, selectedLocationIds]);

  const filteredCatalog = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    if (!q) return catalog.slice(0, 40);
    return catalog.filter(c => c.searchText.includes(q)).slice(0, 40);
  }, [catalog, itemSearch]);

  useEffect(() => {
    if (!selected) {
      setUom('');
      setAvailableQty(null);
      return;
    }
    setUom(selected.uoms[0] ?? '');
  }, [selected]);

  useEffect(() => {
    if (!selectedCompanyId || !selected || !fromLocationId || !uom) {
      setAvailableQty(null);
      return;
    }
    let cancelled = false;
    setAvailableLoading(true);
    void api
      .transferAvailable(selectedCompanyId, selected.kind, selected.key, fromLocationId, uom)
      .then(res => {
        if (!cancelled) setAvailableQty(res.availableQty);
      })
      .catch(() => {
        if (!cancelled) setAvailableQty(null);
      })
      .finally(() => {
        if (!cancelled) setAvailableLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCompanyId, selected, fromLocationId, uom]);

  const historyScrollRef = useRef<HTMLDivElement | null>(null);
  const { visibleItems, sentinelRef, hasMore } = useInfiniteScrollSlice(rows, {
    pageSize: 40,
    scrollRootRef: historyScrollRef,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCompanyId || !fromLocationId || !toLocationId || !selected) {
      setError('Select company, from/to locations, and an item.');
      return;
    }
    if (fromLocationId === toLocationId) {
      setError('From and To locations must be different.');
      return;
    }
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('Enter a transfer quantity greater than zero.');
      return;
    }
    if (!uom.trim()) {
      setError('Select a UOM.');
      return;
    }
    if (availableQty != null && qty > availableQty) {
      setError(`Transfer quantity exceeds available (${availableQty} ${uom}).`);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api.createTransfer({
        companyId: selectedCompanyId,
        fromLocationExternalId: fromLocationId,
        toLocationExternalId: toLocationId,
        itemType: selected.kind,
        itemKey: selected.key,
        itemName: selected.name,
        quantity: qty,
        uom: uom.trim(),
        transferDate,
      });
      setQuantity('');
      setSelected(null);
      setItemSearch('');
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save transfer.');
    } finally {
      setSaving(false);
    }
  }

  if (!orgReady) {
    return (
      <div className={pageShellClass()}>
        <p className="text-sm text-muted-foreground">Select a company to manage transfers.</p>
      </div>
    );
  }

  return (
    <div className={pageShellClass({ spacing: 'loose' })}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Transfer</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Move B2B product, sub-product, or smart component stock between locations · 2-year live history
          </p>
        </div>
        <label className="text-xs">
          <span className={labelCls}>Month</span>
          <input
            type="month"
            className={fieldCls + ' w-[11rem]'}
            value={month}
            min={earliestStockCardMonth()}
            max={currentStockCardMonth()}
            onChange={e => e.target.value && setMonth(e.target.value)}
          />
          <span className="block text-[10px] text-muted-foreground mt-1">
            {formatStockCardMonthLabel(month, month === currentStockCardMonth())}
          </span>
        </label>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <form
        onSubmit={submit}
        className="rounded-lg border border-border bg-card p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-12 gap-3"
      >
        <div className="lg:col-span-2">
          <label className={labelCls}>From location</label>
          <select
            className={fieldCls}
            value={fromLocationId}
            onChange={e => setFromLocationId(e.target.value)}
          >
            {companyLocations.map(l => (
              <option key={l.externalId} value={l.externalId}>{l.name}</option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-2">
          <label className={labelCls}>To location</label>
          <select
            className={fieldCls}
            value={toLocationId}
            onChange={e => setToLocationId(e.target.value)}
          >
            {companyLocations.map(l => (
              <option key={l.externalId} value={l.externalId} disabled={l.externalId === fromLocationId}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-3 relative">
          <label className={labelCls}>Product (B2B) / Sub-product / Component</label>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              className={fieldCls + ' pl-8'}
              placeholder="Search catalog…"
              value={selected ? selected.name : itemSearch}
              onChange={e => {
                setSelected(null);
                setItemSearch(e.target.value);
              }}
              onFocus={() => {
                if (selected) {
                  setItemSearch(selected.name);
                  setSelected(null);
                }
              }}
            />
          </div>
          {!selected && (itemSearch.trim() || filteredCatalog.length > 0) && (
            <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-card shadow-lg">
              {filteredCatalog.map(item => (
                <li key={`${item.kind}:${item.key}`}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 flex items-center justify-between gap-2"
                    onClick={() => {
                      setSelected(item);
                      setItemSearch('');
                    }}
                  >
                    <span className="truncate">{item.name}</span>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">
                      {item.kind}
                    </span>
                  </button>
                </li>
              ))}
              {filteredCatalog.length === 0 && (
                <li className="px-3 py-2 text-xs text-muted-foreground">No matches</li>
              )}
            </ul>
          )}
        </div>

        <div className="lg:col-span-1">
          <label className={labelCls}>UOM</label>
          <select
            className={fieldCls}
            value={uom}
            disabled={!selected}
            onChange={e => setUom(e.target.value)}
          >
            {(selected?.uoms ?? []).map(u => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-1">
          <label className={labelCls}>Available</label>
          <div className={fieldCls + ' bg-muted/40 text-muted-foreground tabular-nums'}>
            {availableLoading ? '…' : availableQty == null ? '—' : availableQty}
          </div>
        </div>

        <div className="lg:col-span-1">
          <label className={labelCls}>Transfer qty</label>
          <input
            type="number"
            min="0.0001"
            step="any"
            className={fieldCls}
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            disabled={!selected}
          />
        </div>

        <div className="lg:col-span-2">
          <label className={labelCls}>Transfer date</label>
          <input
            type="date"
            className={fieldCls}
            value={transferDate}
            min={earliestLiveDate()}
            max={toDateInputValue(new Date())}
            onChange={e => setTransferDate(e.target.value)}
          />
        </div>

        <div className="lg:col-span-12 flex justify-end">
          <button
            type="submit"
            disabled={saving || !selected || !fromLocationId || !toLocationId}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <Plus size={14} />
            {saving ? 'Saving…' : 'Add transfer'}
          </button>
        </div>
      </form>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold inline-flex items-center gap-1.5">
            <ArrowRightLeft size={14} />
            History · {formatStockCardMonthLabel(month, month === currentStockCardMonth())}
          </h3>
          <span className="text-[11px] text-muted-foreground">{rows.length} record{rows.length === 1 ? '' : 's'}</span>
        </div>
        <div
          ref={historyScrollRef}
          className="overflow-x-auto max-h-[calc(100dvh-22rem)] overflow-y-auto"
        >
          <table className="w-full table-fixed border-collapse text-sm">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="text-left px-2 py-1.5 w-24">Date</th>
                <th className="text-left px-2 py-1.5 w-32">From</th>
                <th className="text-left px-2 py-1.5 w-32">To</th>
                <th className="text-left px-2 py-1.5">Item</th>
                <th className="text-left px-2 py-1.5 w-24">Type</th>
                <th className="text-right px-2 py-1.5 w-20">Qty</th>
                <th className="text-left px-2 py-1.5 w-16">UOM</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground text-xs">Loading…</td>
                </tr>
              )}
              {!loading && visibleItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground text-xs">
                    No transfers in this month.
                  </td>
                </tr>
              )}
              {visibleItems.map(row => (
                <tr key={row.id} className="border-b border-border/60 hover:bg-muted/30">
                  <td className="px-2 py-1.5 whitespace-nowrap">{formatTransferDate(row.transferDate)}</td>
                  <td className="px-2 py-1.5 truncate" title={row.fromLocationExternalId}>
                    {locationNameById.get(row.fromLocationExternalId) ?? row.fromLocationExternalId}
                  </td>
                  <td className="px-2 py-1.5 truncate" title={row.toLocationExternalId}>
                    {locationNameById.get(row.toLocationExternalId) ?? row.toLocationExternalId}
                  </td>
                  <td className="px-2 py-1.5 truncate" title={row.itemName}>{row.itemName}</td>
                  <td className="px-2 py-1.5 capitalize text-xs text-muted-foreground">{row.itemType}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{row.quantity}</td>
                  <td className="px-2 py-1.5">{row.uom}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <InfiniteScrollDivSentinel hasMore={hasMore} sentinelRef={sentinelRef} />
        </div>
      </div>
    </div>
  );
}
