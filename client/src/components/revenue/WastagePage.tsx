import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Plus, Search } from 'lucide-react';
import {
  api,
  type Ingredient,
  type Product,
  type WastageEntry,
} from '../../api';
import { pageShellClass } from '../layout/pageLayout';
import { filterSelectCls } from '../layout/formControls';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';
import { InfiniteScrollDivSentinel } from '../shared/infiniteScroll';
import { MillstoneLoader, TableLoadingRow } from '../shared/MillstoneLoader';
import { componentMatchesLocations } from '../../data/createOrder';
import { ingredientToRow } from './smartIngredientShared';
import { fromApiUom } from '../../data/componentForm';

type Props = {
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
};

type ItemKind = 'component' | 'product' | 'sub-product';

const WASTE_TYPES = ['All', 'Product', 'Sub-Product', 'Smart Component'] as const;
type WasteTypeFilter = (typeof WASTE_TYPES)[number];

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
  // Prefer inventory UOM first — stock cards default to inventory units.
  return uniqueUoms([inventory], [recipe]);
}

function formatWastedDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function itemTypeLabel(itemType: string) {
  switch (itemType) {
    case 'component':
      return 'Smart Component';
    case 'sub-product':
      return 'Sub-Product';
    case 'product':
      return 'Product';
    default:
      return itemType;
  }
}

function itemTypeFilterParam(filter: WasteTypeFilter): string {
  switch (filter) {
    case 'Product':
      return 'product';
    case 'Sub-Product':
      return 'sub-product';
    case 'Smart Component':
      return 'component';
    default:
      return 'all';
  }
}

function kindMatchesFilter(kind: ItemKind, filter: WasteTypeFilter) {
  if (filter === 'All') return true;
  return kind === itemTypeFilterParam(filter);
}

const fieldCls =
  'w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary/40';
const labelCls = 'block text-[11px] font-sans uppercase tracking-wide text-muted-foreground mb-1';

export function WastagePage({ selectedCompanyId, selectedLocationIds }: Props) {
  const orgReady = !!selectedCompanyId && selectedLocationIds.length > 0;
  const primaryLocation = selectedLocationIds[0] ?? '';
  const { rm } = useCountryFormatters();

  const [filterDate, setFilterDate] = useState(() => toDateInputValue(new Date()));
  const [wasteTypeFilter, setWasteTypeFilter] = useState<WasteTypeFilter>('All');
  const [rows, setRows] = useState<WastageEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [itemSearch, setItemSearch] = useState('');
  const [selected, setSelected] = useState<CatalogItem | null>(null);
  const [quantity, setQuantity] = useState('');
  const [uom, setUom] = useState('');
  const [onHandQty, setOnHandQty] = useState<number | null>(null);
  const [onHandLoading, setOnHandLoading] = useState(false);
  const [wastageValue, setWastageValue] = useState<number | null>(null);
  const [wastageValueLoading, setWastageValueLoading] = useState(false);
  const [wastedDate, setWastedDate] = useState(() => toDateInputValue(new Date()));
  const [reason, setReason] = useState('');
  const [reasonSuggestions, setReasonSuggestions] = useState<string[]>([]);
  const [showReasonMenu, setShowReasonMenu] = useState(false);
  const reasonTimer = useRef<number | null>(null);
  const valueTimer = useRef<number | null>(null);

  const loadRows = useCallback(async () => {
    if (!orgReady || !selectedCompanyId) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.wastageEntries(selectedCompanyId, selectedLocationIds, {
        date: filterDate,
        itemType: itemTypeFilterParam(wasteTypeFilter),
      });
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load wastage.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [orgReady, selectedCompanyId, selectedLocationIds, filterDate, wasteTypeFilter]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    if (!orgReady || !selectedCompanyId) {
      setIngredients([]);
      setProducts([]);
      return;
    }
    let cancelled = false;
    Promise.all([
      api.ingredients(selectedCompanyId),
      api.products(selectedCompanyId),
    ])
      .then(([ings, prods]) => {
        if (cancelled) return;
        setIngredients(ings);
        setProducts(prods.filter(p => p.active !== false));
      })
      .catch(() => {
        if (!cancelled) {
          setIngredients([]);
          setProducts([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [orgReady, selectedCompanyId, selectedLocationIds]);

  const catalog = useMemo(() => {
    const items: CatalogItem[] = [];
    for (const ing of ingredients) {
      if (!ing.active) continue;
      const row = ingredientToRow(ing);
      if (!componentMatchesLocations(row, selectedLocationIds)) continue;
      const uoms = componentUoms(ing);
      if (uoms.length === 0) continue;
      items.push({
        kind: 'component',
        key: ing.componentId,
        name: ing.name,
        uoms,
        searchText: `${ing.name} ${ing.componentId} component smart`.toLowerCase(),
      });
    }
    for (const p of products) {
      const locs = p.locationExternalIds ?? [];
      if (locs.length > 0 && !locs.some(l => selectedLocationIds.includes(l))) continue;
      const kind: ItemKind = p.isSubProduct ? 'sub-product' : 'product';
      const uoms = productUoms(p);
      items.push({
        kind,
        key: String(p.id),
        name: p.name,
        uoms,
        searchText: `${p.name} ${p.productId} ${kind}`.toLowerCase(),
      });
    }
    return items.sort((a, b) => a.name.localeCompare(b.name));
  }, [ingredients, products, selectedLocationIds]);

  const typeFilteredCatalog = useMemo(
    () => catalog.filter(c => kindMatchesFilter(c.kind, wasteTypeFilter)),
    [catalog, wasteTypeFilter],
  );

  const filteredCatalog = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    if (!q) return typeFilteredCatalog.slice(0, 40);
    return typeFilteredCatalog.filter(c => c.searchText.includes(q)).slice(0, 40);
  }, [typeFilteredCatalog, itemSearch]);

  useEffect(() => {
    if (selected && !kindMatchesFilter(selected.kind, wasteTypeFilter)) {
      setSelected(null);
      setItemSearch('');
    }
  }, [wasteTypeFilter, selected]);

  useEffect(() => {
    if (!selected) {
      setUom('');
      setOnHandQty(null);
      setWastageValue(null);
      return;
    }
    setUom(selected.uoms[0] ?? '');
  }, [selected]);

  useEffect(() => {
    if (!selectedCompanyId || !selected || !primaryLocation || !uom) {
      setOnHandQty(null);
      return;
    }
    let cancelled = false;
    setOnHandLoading(true);
    void api
      .transferAvailable(selectedCompanyId, selected.kind, selected.key, primaryLocation, uom)
      .then(res => {
        if (!cancelled) setOnHandQty(res.availableQty);
      })
      .catch(() => {
        if (!cancelled) setOnHandQty(null);
      })
      .finally(() => {
        if (!cancelled) setOnHandLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCompanyId, selected, primaryLocation, uom]);

  useEffect(() => {
    if (valueTimer.current) window.clearTimeout(valueTimer.current);

    if (!selectedCompanyId || !selected || !primaryLocation || !uom || !wastedDate) {
      setWastageValue(null);
      setWastageValueLoading(false);
      return;
    }

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setWastageValue(null);
      setWastageValueLoading(false);
      return;
    }

    setWastageValueLoading(true);
    valueTimer.current = window.setTimeout(() => {
      void api
        .wastageValue({
          companyId: selectedCompanyId,
          locationExternalId: primaryLocation,
          itemType: selected.kind,
          itemKey: selected.key,
          quantity: qty,
          uom,
          wastedDate,
        })
        .then(res => setWastageValue(res.totalValue))
        .catch(() => setWastageValue(null))
        .finally(() => setWastageValueLoading(false));
    }, 200);

    return () => {
      if (valueTimer.current) window.clearTimeout(valueTimer.current);
    };
  }, [selectedCompanyId, selected, primaryLocation, uom, quantity, wastedDate]);

  useEffect(() => {
    if (reasonTimer.current) window.clearTimeout(reasonTimer.current);
    reasonTimer.current = window.setTimeout(() => {
      if (!selectedCompanyId) {
        setReasonSuggestions([]);
        return;
      }
      void api.wastageReasons(selectedCompanyId, reason).then(setReasonSuggestions).catch(() => setReasonSuggestions([]));
    }, 200);
    return () => {
      if (reasonTimer.current) window.clearTimeout(reasonTimer.current);
    };
  }, [reason, selectedCompanyId]);

  const historyScrollRef = useRef<HTMLDivElement | null>(null);
  const { visibleItems, sentinelRef, hasMore } = useInfiniteScrollSlice(rows, {
    pageSize: 40,
    scrollRootRef: historyScrollRef,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCompanyId || !primaryLocation || !selected) {
      setError('Select company, location, and an item.');
      return;
    }
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('Enter a quantity greater than zero.');
      return;
    }
    if (!uom.trim()) {
      setError('Select a UOM.');
      return;
    }
    if (onHandQty != null && qty > onHandQty) {
      setError(`Wastage quantity exceeds on hand (${onHandQty} ${uom}).`);
      return;
    }
    if (!reason.trim()) {
      setError('Enter a wastage reason.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.createWastage({
        companyId: selectedCompanyId,
        locationExternalId: primaryLocation,
        itemType: selected.kind,
        itemKey: selected.key,
        itemName: selected.name,
        quantity: qty,
        uom: uom.trim(),
        wastedDate,
        reason: reason.trim(),
      });
      setQuantity('');
      setReason('');
      setSelected(null);
      setItemSearch('');
      if (wastedDate !== filterDate) setFilterDate(wastedDate);
      else await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save wastage.');
    } finally {
      setSaving(false);
    }
  }

  if (!orgReady) {
    return (
      <div className={pageShellClass()}>
        <p className="text-sm text-muted-foreground">Select a company and location to manage wastage.</p>
      </div>
    );
  }

  const catalogLabel =
    wasteTypeFilter === 'All'
      ? 'Smart Component / Product / Sub-Product'
      : wasteTypeFilter;

  return (
    <div className={pageShellClass({ spacing: 'loose' })}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Wastage</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manual spoilage &amp; POS void/refund wastage · 2-year live history
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Date</label>
            <input
              type="date"
              className={`${filterSelectCls} min-w-[11rem]`}
              value={filterDate}
              min={earliestLiveDate()}
              max={toDateInputValue(new Date())}
              onChange={e => e.target.value && setFilterDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Type of Waste</label>
            <select
              value={wasteTypeFilter}
              onChange={e => setWasteTypeFilter(e.target.value as WasteTypeFilter)}
              className={`${filterSelectCls} min-w-[11rem]`}
            >
              {WASTE_TYPES.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>
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
        <div className="lg:col-span-3 relative">
          <label className={labelCls}>{catalogLabel}</label>
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
          {!selected && itemSearch.trim().length > 0 && (
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
                      {itemTypeLabel(item.kind)}
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
          <label className={labelCls}>On hand</label>
          <div className={fieldCls + ' bg-muted/40 text-muted-foreground tabular-nums flex items-center'}>
            {onHandLoading
              ? <MillstoneLoader size="xs" layout="inline" label="" />
              : onHandQty == null
                ? '—'
                : onHandQty}
          </div>
        </div>

        <div className="lg:col-span-1">
          <label className={labelCls}>Qty</label>
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
          <label className={labelCls}>Wastage value</label>
          <div className={fieldCls + ' bg-muted/40 text-muted-foreground tabular-nums flex items-center'}>
            {!selected || !quantity || Number(quantity) <= 0
              ? '—'
              : wastageValueLoading
                ? <MillstoneLoader size="xs" layout="inline" label="" />
                : wastageValue == null
                  ? '—'
                  : rm(wastageValue)}
          </div>
        </div>

        <div className="lg:col-span-2">
          <label className={labelCls}>Wasted date</label>
          <input
            type="date"
            className={fieldCls}
            value={wastedDate}
            min={earliestLiveDate()}
            max={toDateInputValue(new Date())}
            onChange={e => setWastedDate(e.target.value)}
          />
        </div>

        <div className="lg:col-span-2 relative">
          <label className={labelCls}>Reason</label>
          <input
            className={fieldCls}
            value={reason}
            placeholder="e.g. Spoilage"
            onChange={e => {
              setReason(e.target.value);
              setShowReasonMenu(true);
            }}
            onFocus={() => setShowReasonMenu(true)}
            onBlur={() => window.setTimeout(() => setShowReasonMenu(false), 150)}
            autoComplete="off"
          />
          {showReasonMenu && reasonSuggestions.length > 0 && (
            <ul className="absolute z-20 mt-1 max-h-40 w-full overflow-y-auto rounded-md border border-border bg-card shadow-lg">
              {reasonSuggestions.map(r => (
                <li key={r}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted/60"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => {
                      setReason(r);
                      setShowReasonMenu(false);
                    }}
                  >
                    {r}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="lg:col-span-12 flex justify-end">
          <button
            type="submit"
            disabled={saving || !selected}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <Plus size={14} />
            {saving ? 'Saving…' : 'Add wastage'}
          </button>
        </div>
      </form>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">
            Summary · {formatWastedDate(filterDate)}
            {wasteTypeFilter !== 'All' ? ` · ${wasteTypeFilter}` : ''}
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
                <th className="text-left px-2 py-1.5 w-10">POS</th>
                <th className="text-left px-2 py-1.5 w-24">Date</th>
                <th className="text-left px-2 py-1.5">Item</th>
                <th className="text-left px-2 py-1.5 w-28">Type</th>
                <th className="text-right px-2 py-1.5 w-20">Qty</th>
                <th className="text-left px-2 py-1.5 w-16">UOM</th>
                <th className="text-left px-2 py-1.5">Reason</th>
                <th className="text-left px-2 py-1.5 w-28">Check no.</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <TableLoadingRow colSpan={8} />
              )}
              {!loading && visibleItems.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground text-xs">
                    No wastage for this date{wasteTypeFilter !== 'All' ? ` and type` : ''}.
                  </td>
                </tr>
              )}
              {visibleItems.map(row => (
                <tr key={row.id} className="border-b border-border/60 hover:bg-muted/30">
                  <td className="px-2 py-1.5 text-center">
                    {row.isPos ? (
                      <Check size={14} className="inline text-primary" aria-label="POS wastage" />
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{formatWastedDate(row.wastedDate)}</td>
                  <td className="px-2 py-1.5 truncate" title={row.itemName}>{row.itemName}</td>
                  <td className="px-2 py-1.5 text-xs text-muted-foreground">{itemTypeLabel(row.itemType)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{row.quantity}</td>
                  <td className="px-2 py-1.5">{row.uom}</td>
                  <td className="px-2 py-1.5 truncate" title={row.reason}>{row.reason}</td>
                  <td className="px-2 py-1.5 font-mono text-xs">{row.posCheckNo || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <InfiniteScrollDivSentinel hasMore={hasMore} sentinelRef={sentinelRef} />
        </div>
        <p className="px-3 py-2 text-[10px] text-muted-foreground border-t border-border">
          POS void/refund wastage posts automatically once POS is live (API: <code className="font-mono">POST /api/wastage/pos</code>).
          Component BOM is depleted through products and nested sub-products.
        </p>
      </div>
    </div>
  );
}
