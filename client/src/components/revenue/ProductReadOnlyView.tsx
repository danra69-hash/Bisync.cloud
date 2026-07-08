import { useMemo, useRef } from 'react';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import type { Product, ProductComponentItem } from '../../api';
import { fromApiUom } from '../../data/componentForm';
import { formatRm } from '../../data/createOrder';
import {
  calcProductCogs,
  calcSubProductUnitCost,
  formatCogsPercent,
} from '../../data/productForm';
import { formatProductParStock } from '../../data/productParStock';
import { tableHeaderCls } from '../shared/tableHeaderStyles';

const fieldCls =
  'w-full rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-foreground';
const labelCls = 'text-xs font-medium text-foreground';
const tdCls = 'px-3 py-2 text-xs border-b border-border align-middle';

type LocationOption = { externalId: string; name: string };

type Props = {
  product: Product;
  locations: LocationOption[];
  locationIds: string[];
  saving: boolean;
  rrpDraft: string;
  onRrpChange: (value: string) => void;
  onRrpBlur: () => void;
  onToggleLocation: (externalId: string) => void;
};

function ComponentItemsTable({
  title,
  description,
  items,
  totalCost,
  totalLabel,
}: {
  title: string;
  description: string;
  items: ProductComponentItem[];
  totalCost: number;
  totalLabel: string;
}) {
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const {
    visibleItems: pagedItems,
    hasMore,
    sentinelRef,
    totalCount,
    visibleCount,
  } = useInfiniteScrollSlice(items, { scrollRootRef });

  return (
    <section className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/20">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground border-b border-border px-4 py-8 text-center">
          No smart components added.
        </p>
      ) : (
        <TableScrollContainer ref={scrollRootRef} className="max-h-[calc(100vh-12rem)] overflow-y-auto">
          <table className="w-full table-fixed border-collapse">
            <thead>
              <tr>
                <th className={tableHeaderCls('left', 'border-b border-border bg-muted/20')}>Smart component</th>
                <th className={tableHeaderCls('left', 'border-b border-border bg-muted/20')}>Smart component UOM</th>
                <th className={tableHeaderCls('left', 'border-b border-border bg-muted/20')}>Smart component UOM price</th>
                <th className={tableHeaderCls('left', 'border-b border-border bg-muted/20')}>Qty</th>
                <th className={tableHeaderCls('left', 'border-b border-border bg-muted/20')}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {pagedItems.map(item => (
                <tr key={item.id ?? `${item.componentId}-${item.sortOrder}`}>
                  <td className={tdCls}>
                    <p className="font-medium">{item.componentName || item.componentId}</p>
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{item.componentId}</p>
                  </td>
                  <td className={tdCls}>{item.componentUom || '—'}</td>
                  <td className={tdCls}>{formatRm(item.componentUomPrice)}</td>
                  <td className={tdCls}>{item.quantity}</td>
                  <td className={`${tdCls} font-medium`}>{formatRm(item.subtotal)}</td>
                </tr>
              ))}
              <InfiniteScrollTableSentinel colSpan={5} hasMore={hasMore} sentinelRef={sentinelRef} totalCount={totalCount} visibleCount={visibleCount} />
            </tbody>
          </table>
        </TableScrollContainer>
      )}

      <div className="px-4 py-3 border-t border-border bg-muted/10 flex items-center justify-end gap-3">
        <span className="text-xs text-muted-foreground">{totalLabel}</span>
        <span className="text-sm font-semibold">{formatRm(totalCost)}</span>
      </div>
    </section>
  );
}

export function ProductReadOnlyView({
  product,
  locations,
  locationIds,
  saving,
  rrpDraft,
  onRrpChange,
  onRrpBlur,
  onToggleLocation,
}: Props) {
  const items = product.items ?? [];
  const packagingItems = product.packagingItems ?? [];
  const packagingCost = product.packagingCost ?? 0;

  const productCogs = useMemo(
    () => calcProductCogs(product.totalCost, packagingCost, product),
    [product, packagingCost],
  );

  const rrpValue = useMemo(() => {
    const parsed = parseFloat(rrpDraft);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : product.rrp;
  }, [rrpDraft, product.rrp]);

  const yieldUomLabel = product.yieldUom ? fromApiUom(product.yieldUom) : '';
  const parStockUomLabel = product.parStockUom ? fromApiUom(product.parStockUom) : '';
  const subProductUnitCost = product.isSubProduct && product.yieldQuantity > 0
    ? calcSubProductUnitCost(productCogs, String(product.yieldQuantity))
    : 0;

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-border bg-card p-4 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            <p className={labelCls}>Type</p>
            <div className="flex flex-wrap gap-4">
              <label className="inline-flex items-center gap-2 text-xs">
                <input type="checkbox" checked={!product.isSubProduct} disabled className="rounded border-border" />
                Product
              </label>
              <label className="inline-flex items-center gap-2 text-xs">
                <input type="checkbox" checked={product.isSubProduct} disabled className="rounded border-border" />
                Sub-Product
              </label>
            </div>
          </div>

          <div className="space-y-3">
            <p className={labelCls}>Channel</p>
            <div
              className={`flex flex-wrap gap-4 rounded-md border px-3 py-2 ${
                product.isSubProduct ? 'border-border bg-muted/30 opacity-70' : 'border-transparent'
              }`}
            >
              <label className="inline-flex items-center gap-2 text-xs">
                <input type="checkbox" checked={product.b2cEnabled} disabled className="rounded border-border" />
                B2C
              </label>
              <label className="inline-flex items-center gap-2 text-xs">
                <input type="checkbox" checked={product.b2bEnabled} disabled className="rounded border-border" />
                B2B
              </label>
            </div>
            {product.isSubProduct ? (
              <p className="text-[10px] text-muted-foreground">
                Channel is locked for sub-products — they are made or prepped as part of a product.
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <p className={labelCls}>Product ID</p>
            <p className={fieldCls}>{product.productId}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <p className={labelCls}>Category</p>
            <p className={fieldCls}>{product.category || '—'}</p>
          </div>
          <div className="space-y-1.5">
            <p className={labelCls}>Group</p>
            <p className={fieldCls}>{product.group || '—'}</p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4 space-y-4">
        <h3 className="text-sm font-semibold">
          {product.isSubProduct ? 'Batch Production & Location' : 'Pricing, Par Stock & Location'}
        </h3>
        <p className="text-[11px] text-muted-foreground -mt-2">
          {product.isSubProduct
            ? 'Sub-products are made or prepped in batches. Enter the yield quantity and UOM to calculate unit COGS.'
            : 'Principal product name and aliases share the same smart components; aliases can be sold at different prices for different clients.'}
        </p>

        {product.isSubProduct ? (
          <>
            <div className="space-y-1.5">
              <p className={labelCls}>Sub-Product Name</p>
              <p className={fieldCls}>{product.name}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <p className={labelCls}>Quantity</p>
                <p className={fieldCls}>{product.yieldQuantity > 0 ? String(product.yieldQuantity) : '—'}</p>
              </div>
              <div className="space-y-1.5">
                <p className={labelCls}>UOM</p>
                <p className={fieldCls}>{yieldUomLabel || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">COGS</p>
                <p className="text-sm font-semibold mt-1">
                  {yieldUomLabel && product.yieldQuantity > 0
                    ? `${formatRm(subProductUnitCost)} / ${yieldUomLabel}`
                    : '—'}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Product COGS {formatRm(productCogs)} ÷ {product.yieldQuantity > 0 ? product.yieldQuantity : '—'}
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-1.5">
              <p className={labelCls}>Principal Product Name</p>
              <p className={fieldCls}>{product.name}</p>
            </div>

            {(product.aliases ?? []).length > 0 ? (
              <div className="space-y-2 pl-3 border-l-2 border-primary/20">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Product aliases
                </p>
                {(product.aliases ?? []).map(alias => (
                  <div
                    key={alias.id}
                    className="grid grid-cols-1 sm:grid-cols-[1fr_8rem_5rem] gap-2 items-center text-xs"
                  >
                    <p className={fieldCls}>{alias.name}</p>
                    <p className={fieldCls}>RM {alias.rrp > 0 ? alias.rrp.toFixed(2) : '0.00'}</p>
                    <span className="text-muted-foreground">{formatCogsPercent(productCogs, alias.rrp)}</span>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Product COGS</p>
                <p className="text-sm font-semibold mt-1">{formatRm(productCogs)}</p>
                {!product.isSubProduct && product.b2cEnabled && !product.b2bEnabled && packagingCost > 0 ? (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    B2C dine-in excludes packaging; takeaway adds {formatRm(packagingCost)} at POS.
                  </p>
                ) : null}
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">RRP</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-xs text-muted-foreground">RM</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={rrpDraft}
                    disabled={saving}
                    onChange={e => onRrpChange(e.target.value)}
                    onBlur={onRrpBlur}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                  />
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">COGS %</p>
                <p className="text-sm font-semibold mt-1">{formatCogsPercent(productCogs, rrpValue)}</p>
              </div>
            </div>
          </>
        )}

        {(product.isSubProduct || product.b2bEnabled) ? (
          <div className={`grid gap-4 ${product.isSubProduct ? 'grid-cols-1 sm:grid-cols-2 max-w-2xl' : 'max-w-xs'}`}>
            <div className="space-y-1.5">
              <p className={labelCls}>Expiry period (days)</p>
              <p className={fieldCls}>
                {product.expiryPeriodDays > 0 ? String(product.expiryPeriodDays) : '—'}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Production batches expire this many days after their production date.
              </p>
            </div>
            {product.isSubProduct ? (
              <div className="space-y-1.5">
                <p className={labelCls}>Activation (hours)</p>
                <p className={fieldCls}>
                  {product.activationPeriodHours > 0 ? String(product.activationPeriodHours) : '0'}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Hours after production before the batch can be sold.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl">
          <div className="space-y-1.5">
            <p className={labelCls}>Par Stock</p>
            <p className={fieldCls}>{(product.parStock ?? 0) > 0 ? String(product.parStock) : '—'}</p>
          </div>
          <div className="space-y-1.5">
            <p className={labelCls}>UOM</p>
            <p className={fieldCls}>{parStockUomLabel || '—'}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Base Par Stock</p>
            <p className="text-sm font-semibold mt-1">
              {formatProductParStock(product.parStock ?? 0, parStockUomLabel)}
            </p>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Location</p>
          {locations.length === 0 ? (
            <p className="text-xs text-muted-foreground">No locations available for this company.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {locations.map(loc => {
                const checked = locationIds.includes(loc.externalId);
                return (
                  <label
                    key={loc.externalId}
                    className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs cursor-pointer transition-colors ${
                      checked
                        ? 'border-primary/40 bg-primary/10 text-primary'
                        : 'border-border bg-background hover:bg-muted/40'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={saving}
                      onChange={() => onToggleLocation(loc.externalId)}
                      className="rounded border-border"
                      aria-label={`Location ${loc.name}`}
                    />
                    {loc.name}
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-1 border-t border-border">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">POS</p>
            <p className="text-xs mt-1">{product.posEnabled ? 'Enabled' : 'Disabled'}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Status</p>
            <p className="text-xs mt-1">{product.active ? 'Active' : 'Inactive'}</p>
          </div>
        </div>
      </section>

      <ComponentItemsTable
        title="Product Component"
        description="Add smart components and quantities to calculate product cost"
        items={items}
        totalCost={product.totalCost}
        totalLabel="Total cost"
      />

      <ComponentItemsTable
        title="Packaging Cost"
        description="Add packaging smart components and quantities to calculate packaging cost"
        items={packagingItems}
        totalCost={packagingCost}
        totalLabel="Total packaging cost"
      />
    </div>
  );
}
