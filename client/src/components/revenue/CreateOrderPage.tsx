import { useEffect, useMemo, useState } from 'react';
import { Search, ShoppingCart } from 'lucide-react';
import { api, type Vendor } from '../../api';
import {
  buildCartItems,
  buildCreateOrderLines,
  countCartItems,
  formatRm,
  resolveVendorsForSelectedLocations,
  type CreateOrderLine,
} from '../../data/createOrder';
import { ingredientToRow } from './smartIngredientShared';
import { OrderCartModal } from './OrderCartModal';

const thCls =
  'text-left px-3 py-2.5 text-[9px] font-mono uppercase tracking-wider text-muted-foreground font-normal border-r border-border last:border-r-0 whitespace-nowrap';
const tdCls = 'px-3 py-2.5 align-middle border-r border-b border-border last:border-r-0 text-xs';

type Props = {
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
};

export function CreateOrderPage({ selectedCompanyId, selectedLocationIds }: Props) {
  const [loading, setLoading] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorFilter, setVendorFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [orderQtyByKey, setOrderQtyByKey] = useState<Record<string, string>>({});
  const [showCart, setShowCart] = useState(false);

  const orgReady = Boolean(selectedCompanyId) && selectedLocationIds.length > 0;

  useEffect(() => {
    if (!selectedCompanyId) {
      setVendors([]);
      return;
    }
    api.vendors()
      .then(setVendors)
      .catch(() => setVendors([]));
  }, [selectedCompanyId]);

  const [components, setComponents] = useState<ReturnType<typeof ingredientToRow>[]>([]);

  useEffect(() => {
    if (!orgReady) {
      setComponents([]);
      return;
    }
    setLoading(true);
    api.ingredients()
      .then(data => setComponents(data.map(ingredientToRow)))
      .catch(() => setComponents([]))
      .finally(() => setLoading(false));
  }, [orgReady, selectedCompanyId, selectedLocationIds]);

  const categoryOptions = useMemo(
    () => ['All', ...new Set(components.map(c => c.category).filter(Boolean))].sort((a, b) => {
      if (a === 'All') return -1;
      if (b === 'All') return 1;
      return a.localeCompare(b);
    }),
    [components],
  );

  const vendorOptions = useMemo(
    () => resolveVendorsForSelectedLocations(components, selectedLocationIds, vendors),
    [components, selectedLocationIds, vendors],
  );

  useEffect(() => {
    if (!vendorFilter) return;
    if (!vendorOptions.some(v => v.externalId === vendorFilter)) {
      setVendorFilter('');
    }
  }, [vendorFilter, vendorOptions]);

  const lines = useMemo(
    () => buildCreateOrderLines(
      components,
      selectedLocationIds,
      vendorFilter,
      categoryFilter,
      search,
    ),
    [components, selectedLocationIds, vendorFilter, categoryFilter, search],
  );

  const cartItems = useMemo(
    () => buildCartItems(lines, orderQtyByKey),
    [lines, orderQtyByKey],
  );

  const cartCount = useMemo(() => countCartItems(cartItems), [cartItems]);

  const grandTotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.lineTotal, 0),
    [cartItems],
  );

  function setOrderQty(key: string, value: string) {
    setOrderQtyByKey(prev => ({ ...prev, [key]: value }));
  }

  function applySuggested(line: CreateOrderLine) {
    if (line.suggestedDeliveryUnits === null) return;
    setOrderQty(line.key, String(line.suggestedDeliveryUnits));
  }

  function lineTotal(line: CreateOrderLine): number {
    const qty = parseFloat(orderQtyByKey[line.key] || '') || 0;
    return qty * line.deliveryPrice;
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1">Operation · Order</p>
        <h2 className="text-lg font-semibold">Create Order</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Build purchase orders from smart components, tagged vendor products, and usage-based par levels.
        </p>
      </div>

      {!selectedCompanyId ? (
        <p className="text-xs text-muted-foreground border border-dashed border-border rounded-lg px-4 py-10 text-center">
          Select a company to create an order.
        </p>
      ) : selectedLocationIds.length === 0 ? (
        <p className="text-xs text-muted-foreground border border-dashed border-border rounded-lg px-4 py-10 text-center">
          Select at least one location to create an order.
        </p>
      ) : loading ? (
        <p className="text-xs text-muted-foreground">Loading order data…</p>
      ) : (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={vendorFilter}
              onChange={e => setVendorFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-md border border-border bg-card focus:outline-none focus:ring-1 focus:ring-primary min-w-[180px]"
            >
              <option value="">All vendors</option>
              {vendorOptions.map(v => (
                <option key={v.externalId} value={v.externalId}>{v.name}</option>
              ))}
            </select>

            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-md border border-border bg-card focus:outline-none focus:ring-1 focus:ring-primary min-w-[160px]"
            >
              {categoryOptions.map(cat => (
                <option key={cat} value={cat}>{cat === 'All' ? 'All component types' : cat}</option>
              ))}
            </select>

            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search smart component…"
                className="w-full pl-8 pr-3 py-2 text-xs rounded-md border border-border bg-card focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <p className="text-[10px] font-mono text-muted-foreground">
              {lines.length} line{lines.length !== 1 ? 's' : ''}
            </p>

            <button
              type="button"
              onClick={() => setShowCart(true)}
              disabled={cartCount === 0}
              className="relative inline-flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold border border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="View my carte"
            >
              <ShoppingCart size={16} className="text-primary" />
              <span>My Carte</span>
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shadow-sm">
                  {cartCount}
                </span>
              )}
            </button>
          </div>

          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1400px]">
                <thead className="bg-muted/30">
                  <tr className="border-b border-border">
                    {[
                      'Component ID',
                      'Component Name',
                      'Stock On Hand',
                      'Usage Per Day',
                      'Parstock',
                      'Suggested Order (Delivery Unit)',
                      'Vendor Product',
                      'Delivery Unit',
                      'Delivery Price',
                      'Order Qty',
                      'Total Order Value',
                    ].map(h => (
                      <th key={h} className={thCls}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lines.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-10 text-center text-xs text-muted-foreground font-mono">
                        No components match the selected filters.
                      </td>
                    </tr>
                  ) : lines.map(line => (
                    <tr key={line.key} className="hover:bg-muted/20">
                      <td className={`${tdCls} font-mono text-muted-foreground`}>{line.component.componentId || '—'}</td>
                      <td className={tdCls}>
                        <p className="font-medium text-foreground">{line.component.name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{line.component.category} · {line.component.group}</p>
                      </td>
                      <td className={`${tdCls} font-mono text-muted-foreground`}>—</td>
                      <td className={`${tdCls} font-mono text-muted-foreground`}>
                        {line.component.dailyUsage > 0
                          ? `${line.component.dailyUsage} ${line.parStockUom}/day`
                          : '—'}
                      </td>
                      <td className={`${tdCls} font-mono text-foreground`}>
                        {line.parStock > 0 ? `${line.parStock.toFixed(2)} ${line.parStockUom}` : '—'}
                      </td>
                      <td className={tdCls}>
                        {line.suggestedDeliveryUnits === null ? (
                          <span className="font-mono text-muted-foreground">—</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => applySuggested(line)}
                            className="font-mono text-primary hover:underline"
                            title="Click to apply to order quantity"
                          >
                            {line.suggestedDeliveryUnits} {line.deliveryUnitLabel}
                          </button>
                        )}
                      </td>
                      <td className={tdCls}>
                        <p className="font-medium">{line.vendorProduct.productName}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{line.vendorProduct.vendorName}</p>
                      </td>
                      <td className={`${tdCls} font-mono text-muted-foreground`}>{line.deliveryUnitLabel}</td>
                      <td className={`${tdCls} font-mono text-foreground`}>{formatRm(line.deliveryPrice)}</td>
                      <td className={tdCls}>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={orderQtyByKey[line.key] ?? ''}
                          onChange={e => setOrderQty(line.key, e.target.value)}
                          placeholder="0"
                          className="w-20 bg-background border border-border rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </td>
                      <td className={`${tdCls} font-mono font-semibold text-foreground`}>
                        {lineTotal(line) > 0 ? formatRm(lineTotal(line)) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {lines.length > 0 && (
                  <tfoot>
                    <tr className="bg-muted/20 border-t border-border">
                      <td colSpan={10} className="px-3 py-3 text-right text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        Grand Total
                      </td>
                      <td className="px-3 py-3 font-mono font-semibold text-sm text-foreground">
                        {grandTotal > 0 ? formatRm(grandTotal) : '—'}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      )}

      {showCart && selectedCompanyId && cartCount > 0 && (
        <OrderCartModal
          items={cartItems}
          selectedCompanyId={selectedCompanyId}
          selectedLocationIds={selectedLocationIds}
          onClose={() => setShowCart(false)}
          onConfirmed={clearedLineKeys => {
            setOrderQtyByKey(prev => {
              const next = { ...prev };
              for (const key of clearedLineKeys) delete next[key];
              return next;
            });
          }}
        />
      )}
    </div>
  );
}
