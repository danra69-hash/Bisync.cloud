import { useEffect, useMemo, useRef, useState } from 'react';
import { FileStack, Search, ShoppingCart } from 'lucide-react';
import { pageShellClass } from '../layout/pageLayout';
import { PageStickyFilters } from '../layout/PageStickyFilters';
import { filterSelectCls, inlineNumberCls } from '../layout/formControls';
import { api, type OrderTemplate, type Vendor } from '../../api';
import {
  buildCartItems,
  buildCreateOrderLines,
  countCartItems,
  resolveVendorsForSelectedLocations,
  type CreateOrderLine,
} from '../../data/createOrder';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';
import { buildOrderQtyFromTemplate } from '../../data/orderTemplates';
import { refreshVendorProductPricesFromApi } from '../../data/vendorProductPrices';
import { useOrgVendorPolicy } from '../../hooks/useOrgVendorPolicy';
import { ingredientToRow } from './smartIngredientShared';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { useTableSort } from '../../hooks/useTableSort';
import { sortTableRows, compareSortValues } from '../../utils/tableSort';
import { SortableTableHeaderRow, type SortableColumnDef } from '../shared/SortableTableHead';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { OrderCartModal } from './OrderCartModal';
import { OrderTemplatePickerModal } from './OrderTemplatePickerModal';
import { MillstoneLoader } from '../shared/MillstoneLoader';

const tdCls = 'px-3 py-2.5 align-middle border-r border-b border-border last:border-r-0 text-xs';

type CreateOrderSortColumn =
  | 'componentId'
  | 'name'
  | 'stockOnHand'
  | 'usagePerDay'
  | 'parstock'
  | 'suggestedOrder'
  | 'vendorProduct'
  | 'deliveryUnit'
  | 'deliveryPrice'
  | 'orderQty'
  | 'totalOrderValue';

const CREATE_ORDER_TABLE_COLUMNS: SortableColumnDef<CreateOrderSortColumn>[] = [
  { key: 'componentId', label: 'Component ID' },
  { key: 'name', label: 'Component Name' },
  { key: 'stockOnHand', label: 'Stock On Hand', align: 'right' },
  { key: 'usagePerDay', label: 'Usage Per Day', align: 'right' },
  { key: 'parstock', label: 'Parstock', align: 'right' },
  { key: 'suggestedOrder', label: 'Suggested Order (Delivery Unit)', align: 'right' },
  { key: 'vendorProduct', label: 'Vendor Product' },
  { key: 'deliveryUnit', label: 'Delivery Unit' },
  { key: 'deliveryPrice', label: 'Delivery Price', align: 'right' },
  { key: 'orderQty', label: 'Order Qty', sortable: false },
  { key: 'totalOrderValue', label: 'Total Order Value', align: 'right' },
];

type Props = {
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
  embedded?: boolean;
};

export function CreateOrderPage({ selectedCompanyId, selectedLocationIds, embedded = false }: Props) {
  const { number, rm } = useCountryFormatters();
  const [loading, setLoading] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorFilter, setVendorFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [orderQtyByKey, setOrderQtyByKey] = useState<Record<string, string>>({});
  const [showCart, setShowCart] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [templateNotice, setTemplateNotice] = useState<string | null>(null);
  const pendingTemplateRef = useRef<OrderTemplate | null>(null);
  const { sortColumn, sortDirection, toggleSort, resetSort } = useTableSort<CreateOrderSortColumn>();

  const orgReady = Boolean(selectedCompanyId) && selectedLocationIds.length > 0;
  const orgPolicyTags = useOrgVendorPolicy(selectedCompanyId, selectedLocationIds);

  useEffect(() => {
    resetSort();
  }, [vendorFilter, categoryFilter, search, resetSort]);

  useEffect(() => {
    void refreshVendorProductPricesFromApi();
  }, []);

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
    () => resolveVendorsForSelectedLocations(components, selectedLocationIds, vendors, orgPolicyTags),
    [components, selectedLocationIds, vendors, orgPolicyTags],
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
      vendors,
      orgPolicyTags,
    ),
    [components, selectedLocationIds, vendorFilter, categoryFilter, search, vendors, orgPolicyTags],
  );

  const sortedLines = useMemo(
    () =>
      sortTableRows(
        lines,
        sortColumn,
        sortDirection,
        {
          componentId: line => line.component.componentId || '',
          name: line => line.component.name,
          stockOnHand: line => line.stockOnHand ?? -1,
          usagePerDay: line => line.component.dailyUsage,
          parstock: line => line.parStock,
          suggestedOrder: line => line.suggestedDeliveryUnits ?? -1,
          vendorProduct: line => line.vendorProduct.productName,
          deliveryUnit: line => line.deliveryUnitLabel,
          deliveryPrice: line => line.deliveryPrice,
          totalOrderValue: line => {
            const qty = parseFloat(orderQtyByKey[line.key] ?? '') || 0;
            return qty * line.deliveryPrice;
          },
        },
        { tieBreaker: (a, b) => compareSortValues(a.component.name, b.component.name) },
      ),
    [lines, sortColumn, sortDirection, orderQtyByKey],
  );

  const scrollRootRef = useRef<HTMLDivElement>(null);
  const {
    visibleItems: pagedLines,
    hasMore,
    sentinelRef,
    totalCount,
    visibleCount, nextPageSize, loadMore } = useInfiniteScrollSlice(sortedLines, { scrollRootRef });

  function applyTemplateNow(template: OrderTemplate, currentLines: CreateOrderLine[]) {
    const updates = buildOrderQtyFromTemplate(template, currentLines);
    const appliedCount = Object.keys(updates).length;

    if (appliedCount === 0) {
      setTemplateNotice(`Could not apply "${template.name}" — no matching order lines for the current filters.`);
      return;
    }

    setOrderQtyByKey(prev => ({ ...prev, ...updates }));
    setTemplateNotice(
      appliedCount === template.items.length
        ? `Applied "${template.name}" (${appliedCount} item${appliedCount === 1 ? '' : 's'}).`
        : `Applied "${template.name}" (${appliedCount} of ${template.items.length} items).`,
    );
  }

  useEffect(() => {
    const template = pendingTemplateRef.current;
    if (!template) return;

    pendingTemplateRef.current = null;
    applyTemplateNow(template, lines);
  }, [lines]);

  function handleApplyTemplate(template: OrderTemplate) {
    setShowTemplatePicker(false);
    setTemplateNotice(null);

    if (template.vendorExternalId && template.vendorExternalId !== vendorFilter) {
      pendingTemplateRef.current = template;
      setVendorFilter(template.vendorExternalId);
      return;
    }

    applyTemplateNow(template, lines);
  }

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
    <div className={pageShellClass({ embedded })}>
      {!selectedCompanyId ? (
        <p className="text-xs text-muted-foreground border border-dashed border-border rounded-lg px-4 py-5 text-center">
          Select a company to create an order.
        </p>
      ) : selectedLocationIds.length === 0 ? (
        <p className="text-xs text-muted-foreground border border-dashed border-border rounded-lg px-4 py-5 text-center">
          Select at least one location to create an order.
        </p>
      ) : loading ? (
        <MillstoneLoader size="sm" layout="block" label="Loading order data…" />
      ) : (
        <>
          <PageStickyFilters opaque className="py-2">
            <div className="flex items-center gap-3 flex-wrap">
              <select
                value={vendorFilter}
                onChange={e => setVendorFilter(e.target.value)}
                className={`${filterSelectCls} min-w-[180px]`}
              >
                <option value="">All vendors</option>
                {vendorOptions.map(v => (
                  <option key={v.externalId} value={v.externalId}>{v.name}</option>
                ))}
              </select>

              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className={`${filterSelectCls} min-w-[160px]`}
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

              <p className="text-xs font-sans text-muted-foreground">
                {lines.length} line{lines.length !== 1 ? 's' : ''}
              </p>

              <button
                type="button"
                onClick={() => setShowTemplatePicker(true)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold border border-border bg-card hover:bg-muted transition-colors"
              >
                <FileStack size={16} />
                PO Template
              </button>

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
                  <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shadow-sm">
                    {cartCount}
                  </span>
                )}
              </button>
            </div>
          </PageStickyFilters>

          {templateNotice && (
            <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">
              {templateNotice}
            </div>
          )}

          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <TableScrollContainer ref={scrollRootRef} className="max-h-[calc(100vh-12rem)] overflow-y-auto">
              <table className="w-full table-fixed">
                <thead className="bg-muted/30">
                  <SortableTableHeaderRow
                    columns={CREATE_ORDER_TABLE_COLUMNS}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={toggleSort}
                    className="border-b border-border"
                  />
                </thead>
                <tbody>
                  {lines.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-5 text-center text-xs text-muted-foreground font-sans">
                        No components match the selected filters.
                      </td>
                    </tr>
                  ) : pagedLines.map(line => (
                    <tr key={line.key} className="hover:bg-muted/20">
                      <td className={`${tdCls} font-sans text-muted-foreground`}>{line.component.componentId || '—'}</td>
                      <td className={tdCls}>
                        <p className="font-medium text-foreground">{line.component.name}</p>
                        <p className="text-xs text-muted-foreground font-sans">{line.component.category} · {line.component.group}</p>
                      </td>
                      <td className={`${tdCls} font-sans text-muted-foreground`}>—</td>
                      <td className={`${tdCls} font-sans text-muted-foreground`}>
                        {line.component.dailyUsage > 0
                          ? `${line.component.dailyUsage} ${line.parStockUom}/day`
                          : '—'}
                      </td>
                      <td className={`${tdCls} font-sans text-foreground`}>
                        {line.parStock > 0 ? `${number(line.parStock)} ${line.parStockUom}` : '—'}
                      </td>
                      <td className={tdCls}>
                        {line.suggestedDeliveryUnits === null ? (
                          <span className="font-sans text-muted-foreground">—</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => applySuggested(line)}
                            className="font-sans text-primary hover:underline"
                            title="Click to apply to order quantity"
                          >
                            {line.suggestedDeliveryUnits} {line.deliveryUnitLabel}
                          </button>
                        )}
                      </td>
                      <td className={tdCls}>
                        <p className="font-medium">{line.vendorProduct.productName}</p>
                        <p className="text-xs text-muted-foreground font-sans">{line.vendorProduct.vendorName}</p>
                      </td>
                      <td className={`${tdCls} font-sans text-muted-foreground`}>{line.deliveryUnitLabel}</td>
                      <td className={`${tdCls} font-sans text-foreground`}>{rm(line.deliveryPrice)}</td>
                      <td className={tdCls}>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={orderQtyByKey[line.key] ?? ''}
                          onChange={e => setOrderQty(line.key, e.target.value)}
                          placeholder="0"
                          className={inlineNumberCls}
                        />
                      </td>
                      <td className={`${tdCls} font-sans font-semibold text-foreground`}>
                        {lineTotal(line) > 0 ? rm(lineTotal(line)) : '—'}
                      </td>
                    </tr>
                  ))}
                  <InfiniteScrollTableSentinel colSpan={11} hasMore={hasMore} onLoadMore={loadMore} nextPageSize={nextPageSize} sentinelRef={sentinelRef} totalCount={totalCount} visibleCount={visibleCount} />
                </tbody>
                {lines.length > 0 && (
                  <tfoot>
                    <tr className="bg-muted/20 border-t border-border">
                      <td colSpan={10} className="px-3 py-3 text-right text-xs font-sans uppercase tracking-wider text-muted-foreground">
                        Grand Total
                      </td>
                      <td className="px-3 py-3 font-sans font-semibold text-sm text-foreground">
                        {grandTotal > 0 ? rm(grandTotal) : '—'}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </TableScrollContainer>
          </div>
        </>
      )}

      {showTemplatePicker && selectedCompanyId && (
        <OrderTemplatePickerModal
          selectedCompanyId={selectedCompanyId}
          selectedLocationIds={selectedLocationIds}
          lines={lines}
          onClose={() => setShowTemplatePicker(false)}
          onApply={handleApplyTemplate}
        />
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
