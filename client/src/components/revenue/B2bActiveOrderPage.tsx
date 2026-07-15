import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api, type B2bSalesOrder, type B2bSalesOrderLine, type ProductManagementSummary } from '../../api';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { useTableSort } from '../../hooks/useTableSort';
import { sortTableRows } from '../../utils/tableSort';
import { SortableTableHeaderRow, type SortableColumnDef } from '../shared/SortableTableHead';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { ProduceBatchModal } from './ProduceBatchModal';
import { TableLoadingRow } from '../shared/MillstoneLoader';

type Props = {
  selectedCompanyId: number | null;
  selectedLocationIds?: string[];
  embedded?: boolean;
};

type ProductProduceMeta = {
  batchUnit: string;
  isSubProduct: boolean;
  expiryPeriodDays: number;
};

type ActiveOrderLineRow = {
  key: string;
  order: B2bSalesOrder;
  line: B2bSalesOrderLine;
  stockAvailable: number;
  deliveryUom: string;
};

type ProduceTarget = {
  row: ActiveOrderLineRow;
  meta: ProductProduceMeta;
};

type SortColumn =
  | 'orderNumber'
  | 'customer'
  | 'product'
  | 'qtyOrdered'
  | 'deliveryUom'
  | 'stockAvailable'
  | 'action';

const COLUMNS: SortableColumnDef<SortColumn>[] = [
  { key: 'orderNumber', label: 'SO Number' },
  { key: 'customer', label: 'Customer' },
  { key: 'product', label: 'Product' },
  { key: 'qtyOrdered', label: 'QTY Ordered', align: 'right' },
  { key: 'deliveryUom', label: 'Delivery UOM' },
  { key: 'stockAvailable', label: 'Stock Available', align: 'right' },
  { key: 'action', label: 'Action', sortable: false },
];

const actionBtnCls =
  'inline-flex items-center justify-center px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors disabled:opacity-60';

function isSummaryStockRow(row: ProductManagementSummary): boolean {
  return row.isSummaryRow === true || (row.batchLogId == null && row.isSummaryRow !== false);
}

function isLineReady(line: B2bSalesOrderLine): boolean {
  const status = (line.status || '').toLowerCase();
  return status === 'ready_to_ship' || status === 'fulfilled';
}

function isActiveSalesOrderStatus(status: string | null | undefined): boolean {
  const value = (status || '').toLowerCase();
  return value === 'draft' || value === 'issued' || value === 'confirmed';
}

function statusLabel(status: string | null | undefined): string {
  const value = (status || '').toLowerCase();
  if (value === 'draft') return 'Draft';
  if (value === 'issued') return 'Issued';
  if (value === 'confirmed') return 'Confirmed';
  return status?.trim() || '—';
}

function statusToneClass(status: string | null | undefined): string {
  const value = (status || '').toLowerCase();
  if (value === 'confirmed') return 'text-emerald-700';
  if (value === 'issued') return 'text-sky-700';
  return 'text-amber-700';
}


/** Labels incorrectly stored as UOM when create SO used unitTitle instead of delivery path. */
function isPlaceholderDeliveryUom(uom: string | null | undefined): boolean {
  const value = (uom || '').trim().toLowerCase();
  if (!value) return true;
  return value === 'principal delivery unit'
    || /^alternate du\d+$/i.test(value);
}

function resolveDeliveryUom(line: B2bSalesOrderLine, productBatchUnit: string | undefined): string {
  if (!isPlaceholderDeliveryUom(line.uom)) return line.uom.trim();
  const fromProduct = productBatchUnit?.trim();
  if (fromProduct) return fromProduct;
  return '—';
}

function defaultToProduceQty(row: ActiveOrderLineRow): number {
  const shortfall = row.line.quantityOrdered - row.stockAvailable;
  if (shortfall > 0) return shortfall;
  return row.line.quantityOrdered > 0 ? row.line.quantityOrdered : 1;
}

export function B2bActiveOrderPage({ selectedCompanyId, selectedLocationIds = [], embedded = false }: Props) {
  const { number } = useCountryFormatters();
  const [orders, setOrders] = useState<B2bSalesOrder[]>([]);
  const [stockByKey, setStockByKey] = useState<Record<string, number>>({});
  const [productMetaById, setProductMetaById] = useState<Record<number, ProductProduceMeta>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyLineId, setBusyLineId] = useState<number | null>(null);
  const [produceTarget, setProduceTarget] = useState<ProduceTarget | null>(null);
  const [produceSaving, setProduceSaving] = useState(false);
  const [produceError, setProduceError] = useState<string | null>(null);
  const { sortColumn, sortDirection, toggleSort } = useTableSort<SortColumn>();
  const scrollRootRef = useRef<HTMLDivElement>(null);

  const loadOrders = useCallback(async () => {
    if (!selectedCompanyId) {
      setOrders([]);
      setStockByKey({});
      setProductMetaById({});
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [rows, products] = await Promise.all([
        api.b2bSalesOrders(selectedCompanyId),
        api.products(selectedCompanyId),
      ]);
      const active = rows.filter(o => isActiveSalesOrderStatus(o.status));
      const filtered = selectedLocationIds.length === 0
        ? active
        : active.filter(order =>
          (order.lines ?? []).some(line => selectedLocationIds.includes(line.locationExternalId)),
        );
      setOrders(filtered);

      const productMeta: Record<number, ProductProduceMeta> = {};
      for (const product of products) {
        productMeta[product.id] = {
          batchUnit: product.b2bPackageUnit?.trim() || 'pcs',
          isSubProduct: product.isSubProduct,
          expiryPeriodDays: product.expiryPeriodDays ?? 0,
        };
      }

      const locationIds = [...new Set(
        filtered.flatMap(order =>
          (order.lines ?? [])
            .map(line => line.locationExternalId)
            .filter(id => id && (selectedLocationIds.length === 0 || selectedLocationIds.includes(id))),
        ),
      )];

      if (locationIds.length === 0) {
        setStockByKey({});
        setProductMetaById(productMeta);
      } else {
        const stockEntries = await Promise.all(
          locationIds.map(async locationId => {
            const summaries = await api.productManagement(selectedCompanyId, [locationId], 'b2b');
            return { locationId, summaries };
          }),
        );
        const nextStock: Record<string, number> = {};
        for (const { locationId, summaries } of stockEntries) {
          for (const summary of summaries) {
            if (!isSummaryStockRow(summary)) continue;
            nextStock[`${summary.productId}:${locationId}`] = summary.inStock ?? 0;
            const unit = (summary.batchUnit || summary.packageUnit || '').trim();
            if (!productMeta[summary.productId]) {
              productMeta[summary.productId] = {
                batchUnit: unit || 'pcs',
                isSubProduct: summary.isSubProduct === true,
                expiryPeriodDays: 0,
              };
            } else if (unit) {
              productMeta[summary.productId] = {
                ...productMeta[summary.productId],
                batchUnit: unit,
                isSubProduct: summary.isSubProduct ?? productMeta[summary.productId].isSubProduct,
              };
            }
          }
        }
        setStockByKey(nextStock);
        setProductMetaById(productMeta);
      }
    } catch (err) {
      setOrders([]);
      setStockByKey({});
      setProductMetaById({});
      setError(err instanceof Error ? err.message : 'Failed to load active sales orders.');
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId, selectedLocationIds]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const lineRows = useMemo((): ActiveOrderLineRow[] => {
    const rows: ActiveOrderLineRow[] = [];
    for (const order of orders) {
      for (const line of order.lines ?? []) {
        if (selectedLocationIds.length > 0 && !selectedLocationIds.includes(line.locationExternalId)) {
          continue;
        }
        rows.push({
          key: `${order.id}-${line.id}`,
          order,
          line,
          stockAvailable: stockByKey[`${line.productId}:${line.locationExternalId}`] ?? 0,
          deliveryUom: resolveDeliveryUom(line, productMetaById[line.productId]?.batchUnit),
        });
      }
    }
    return rows;
  }, [orders, selectedLocationIds, stockByKey, productMetaById]);

  const sorted = useMemo(() => {
    return sortTableRows(lineRows, sortColumn, sortDirection, {
      orderNumber: row => row.order.orderNumber,
      customer: row => row.order.customerName,
      product: row => row.line.productName,
      qtyOrdered: row => row.line.quantityOrdered,
      deliveryUom: row => row.deliveryUom,
      stockAvailable: row => row.stockAvailable,
    });
  }, [lineRows, sortColumn, sortDirection]);

  const {
    visibleItems,
    hasMore,
    sentinelRef,
    totalCount,
    visibleCount,
  } = useInfiniteScrollSlice(sorted, { scrollRootRef });

  async function handleReadyToShip(row: ActiveOrderLineRow) {
    setBusyLineId(row.line.id);
    setError(null);
    try {
      const updated = await api.markB2bSalesOrderLineReadyToShip(row.order.id, row.line.id);
      setOrders(prev => prev.map(order => (order.id === updated.id ? updated : order)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark line ready to ship.');
    } finally {
      setBusyLineId(null);
    }
  }

  function openToProduce(row: ActiveOrderLineRow) {
    const meta = productMetaById[row.line.productId] ?? {
      batchUnit: row.deliveryUom !== '—' ? row.deliveryUom : 'pcs',
      isSubProduct: false,
      expiryPeriodDays: 0,
    };
    setProduceError(null);
    setProduceTarget({ row, meta });
  }

  async function confirmToProduce(batchQty: number, productionDate: string) {
    if (!produceTarget) return;
    const { row } = produceTarget;
    const locationId = row.line.locationExternalId?.trim();
    if (!locationId) {
      setProduceError('This order line has no production location.');
      return;
    }

    setProduceSaving(true);
    setProduceError(null);
    setBusyLineId(row.line.id);
    try {
      await api.markProductToProduce(row.line.productId, {
        locationExternalIds: [locationId],
        batchQty,
        productionDate,
      });
      setProduceTarget(null);
      await loadOrders();
    } catch (err) {
      setProduceError(err instanceof Error ? err.message : 'Failed to queue production.');
    } finally {
      setProduceSaving(false);
      setBusyLineId(null);
    }
  }

  if (!selectedCompanyId) {
    return (
      <div className={embedded ? 'pt-3' : ''}>
        <p className="text-sm text-muted-foreground">Select a company to view active B2B orders.</p>
      </div>
    );
  }

  return (
    <div className={embedded ? 'pt-3 space-y-3' : 'space-y-3'}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Draft, issued, and confirmed sales order lines. Short stock is highlighted in yellow.
          Lock expiry applies only while an order is issued and waiting for client confirmation.
        </p>
        <button
          type="button"
          onClick={() => void loadOrders()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border border-border hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw size={12}  />
          Refresh
        </button>
      </div>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      ) : null}

      <TableScrollContainer ref={scrollRootRef} className="max-h-[calc(100vh-14rem)] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/30">
            <SortableTableHeaderRow
              columns={COLUMNS}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSort={toggleSort}
              className="border-b border-border"
            />
          </thead>
          <tbody>
            {loading && lineRows.length === 0 ? (
              <TableLoadingRow colSpan={7} label="Loading…" />
            ) : visibleItems.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-muted-foreground">
                  No active sales order lines yet.
                </td>
              </tr>
            ) : visibleItems.map(row => {
              const ready = isLineReady(row.line);
              const shortStock = row.stockAvailable < row.line.quantityOrdered;
              const lineBusy = busyLineId === row.line.id;
              const canMarkReady = (row.order.status || '').toLowerCase() === 'confirmed';
              return (
                <tr
                  key={row.key}
                  className={`border-b border-border/60 align-top ${
                    shortStock
                      ? 'bg-yellow-300/90 hover:bg-yellow-300 dark:bg-yellow-500/30 dark:hover:bg-yellow-500/40'
                      : 'hover:bg-muted/30'
                  }`}
                >
                  <td className="py-2 pr-3 font-medium">
                    {row.order.orderNumber}
                    <p className={`text-[10px] font-semibold mt-0.5 ${statusToneClass(row.order.status)}`}>
                      {statusLabel(row.order.status)}
                    </p>
                    {(row.order.status || '').toLowerCase() === 'issued' && row.order.lockExpiryDate ? (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Lock {row.order.lockExpiryDate}
                        {row.order.lockPeriodDays ? ` · ${row.order.lockPeriodDays}d` : ''}
                      </p>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3">
                    {row.order.customerName}
                    {row.line.locationExternalId ? (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {row.line.locationExternalId}
                      </p>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3 font-medium">{row.line.productName}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{number(row.line.quantityOrdered)}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{row.deliveryUom || '—'}</td>
                  <td className={`py-2 pr-3 text-right tabular-nums font-semibold ${shortStock ? 'text-amber-700' : ''}`}>
                    {number(row.stockAvailable)}
                  </td>
                  <td className="py-2 text-right">
                    <div className="inline-flex flex-col items-stretch gap-1.5 min-w-[7.5rem]">
                      <button
                        type="button"
                        disabled={lineBusy}
                        onClick={() => openToProduce(row)}
                        className={`${actionBtnCls} border border-amber-300 text-amber-800 hover:bg-amber-50`}
                      >
                        To Produce
                      </button>
                      <button
                        type="button"
                        disabled={ready || lineBusy || !canMarkReady}
                        onClick={() => void handleReadyToShip(row)}
                        className={`${actionBtnCls} ${
                          ready
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-primary text-primary-foreground hover:bg-primary/90'
                        }`}
                        title={canMarkReady ? undefined : 'Available after customer confirms the order'}
                      >
                        {lineBusy && !produceTarget
                          ? 'Saving…'
                          : ready
                            ? 'Ready'
                            : 'Ready to Ship'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            <InfiniteScrollTableSentinel
              colSpan={7}
              hasMore={hasMore}
              sentinelRef={sentinelRef}
              totalCount={totalCount}
              visibleCount={visibleCount}
            />
          </tbody>
        </table>
      </TableScrollContainer>

      {produceTarget ? (
        <ProduceBatchModal
          key={`active-order-${produceTarget.row.key}`}
          productName={produceTarget.row.line.productName}
          batchUnit={produceTarget.meta.batchUnit}
          defaultBatchQty={defaultToProduceQty(produceTarget.row)}
          isSubProduct={produceTarget.meta.isSubProduct}
          expiryPeriodDays={produceTarget.meta.expiryPeriodDays}
          purpose="queue"
          saving={produceSaving}
          error={produceError}
          onClose={() => {
            if (produceSaving) return;
            setProduceTarget(null);
            setProduceError(null);
          }}
          onConfirm={(batchQty, productionDate) => {
            void confirmToProduce(batchQty, productionDate);
          }}
        />
      ) : null}
    </div>
  );
}
