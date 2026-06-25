import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Minus, Search } from 'lucide-react';
import { api, type Ingredient, type Vendor } from '../../api';
import { VENDOR_DISTANCES, VENDOR_PRICES } from '../../data/revenueManagement';

type PriceCell = { deliveryUnit: string; deliveryQty: number; pricePerDelivery: number } | null;

function unitPrice(cell: NonNullable<PriceCell>) {
  return cell.pricePerDelivery / cell.deliveryQty;
}

export function ComparePricePage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedIngredient, setSelectedIngredient] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    Promise.all([api.ingredients(), api.vendors()])
      .then(([ings, vends]) => {
        setIngredients(ings);
        setVendors(vends);
        if (ings.length > 0) setSelectedIngredient(ings[0].name);
      })
      .catch(() => {});
  }, []);

  const ingredientNames = useMemo(() => {
    const fromApi = ingredients.map(i => i.name);
    const fromMock = Object.keys(VENDOR_PRICES);
    return [...new Set([...fromApi, ...fromMock])];
  }, [ingredients]);

  const filteredNames = ingredientNames.filter(n =>
    !search || n.toLowerCase().includes(search.toLowerCase())
  );

  const prices = VENDOR_PRICES[selectedIngredient] ?? {};
  const vendorRows = vendors
    .filter(v => prices[v.externalId] || VENDOR_DISTANCES[v.externalId] !== undefined)
    .map(v => ({
      vendor: v,
      price: (prices[v.externalId] ?? null) as PriceCell,
      distance: VENDOR_DISTANCES[v.externalId] ?? '—',
    }));

  const bestPrice = vendorRows.reduce<number | null>((best, row) => {
    if (!row.price) return best;
    const p = unitPrice(row.price);
    return best === null || p < best ? p : best;
  }, null);

  return (
    <div className="p-6 space-y-4">
      <div>
        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1">Vendors</p>
        <h2 className="text-lg font-semibold">Compare Price</h2>
        <p className="text-xs text-muted-foreground mt-1">Compare vendor pricing for the same component across engaged suppliers</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-1 bg-card border border-border rounded-lg p-3 space-y-2">
          <div className="relative">
            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter components…"
              className="w-full pl-7 pr-2 py-1.5 text-xs rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="max-h-64 overflow-y-auto space-y-0.5">
            {filteredNames.map(name => (
              <button
                key={name}
                onClick={() => setSelectedIngredient(name)}
                className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors ${
                  selectedIngredient === name ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3 bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold">{selectedIngredient || 'Select a component'}</h3>
            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{vendorRows.length} vendor quotes</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {['Vendor', 'Delivery Unit', 'Qty', 'Price / Delivery', 'Unit Price', 'Distance', 'vs Best'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-normal whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vendorRows.map(({ vendor, price, distance }) => {
                  const up = price ? unitPrice(price) : null;
                  const isBest = up !== null && bestPrice !== null && up === bestPrice;
                  const diff = up !== null && bestPrice !== null && !isBest
                    ? Math.round(((up - bestPrice) / bestPrice) * 1000) / 10
                    : null;
                  return (
                    <tr key={vendor.id} className={`border-b border-border last:border-0 hover:bg-muted/20 ${isBest ? 'bg-[#5A7A2A]/5' : ''}`}>
                      <td className="px-4 py-3">
                        <p className="font-medium">{vendor.name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{vendor.externalId}</p>
                      </td>
                      <td className="px-4 py-3 font-mono">{price?.deliveryUnit ?? '—'}</td>
                      <td className="px-4 py-3 font-mono">{price?.deliveryQty ?? '—'}</td>
                      <td className="px-4 py-3 font-mono">{price ? `$${price.pricePerDelivery.toFixed(2)}` : '—'}</td>
                      <td className="px-4 py-3 font-mono font-semibold">{up !== null ? `$${up.toFixed(4)}` : '—'}</td>
                      <td className="px-4 py-3 font-mono text-muted-foreground">
                        {distance === 'online' ? 'Online' : typeof distance === 'number' ? `${distance} km` : distance}
                      </td>
                      <td className="px-4 py-3">
                        {isBest ? (
                          <span className="flex items-center gap-0.5 text-[#5A7A2A] font-mono text-[10px]"><ArrowDown size={10} /> Best</span>
                        ) : diff !== null ? (
                          <span className="flex items-center gap-0.5 text-accent font-mono text-[10px]"><ArrowUp size={10} /> +{diff}%</span>
                        ) : (
                          <Minus size={10} className="text-muted-foreground" />
                        )}
                      </td>
                    </tr>
                  );
                })}
                {vendorRows.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No price data for this component.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
