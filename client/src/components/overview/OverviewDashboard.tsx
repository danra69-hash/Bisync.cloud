import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Eye, EyeOff, GripVertical, ShoppingBag, TrendingUp, Users } from 'lucide-react';
import type { B2bSalesOrder, InventoryAlert, MenuItem, ProgressData, PurchaseOrder, RevenuePoint } from '../../api';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { useTableSort } from '../../hooks/useTableSort';
import { sortTableRows } from '../../utils/tableSort';
import type { DashboardActivityMode, PeriodTotals } from '../../utils/locationMetrics';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { SortableTableHeaderRow, type SortableColumnDef } from '../shared/SortableTableHead';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { ProgressPanel } from './ProgressPanel';
import { useAppTranslation } from '../../i18n/useAppTranslation';
import {
  DEFAULT_OVERVIEW_LAYOUT,
  loadOverviewLayout,
  reorderOverviewSections,
  saveOverviewLayout,
  toggleOverviewSectionHidden,
  type OverviewLayoutState,
  type OverviewSectionId,
} from '../../data/overviewLayout';

function fmtUsd(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

function fmtAov(n: number) {
  return `$${n.toFixed(2)}`;
}

function fmtCount(n: number) {
  return n.toLocaleString();
}

function delta(current: number, prev: number) {
  if (prev === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - prev) / prev) * 1000) / 10;
}

function DeltaBadge({ current, prev, label }: { current: number; prev: number; label: string }) {
  const deltaVal = delta(current, prev);
  const up = deltaVal >= 0;
  return (
    <div className={`flex items-center gap-1 text-xs font-sans ${up ? 'text-[#5A7A2A]' : 'text-accent'}`}>
      {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {up ? '+' : ''}{deltaVal}% {label}
    </div>
  );
}

function PeriodMetricCard({
  title,
  totals,
  formatValue,
  icon: Icon,
  accent,
  vsLastYearLabel,
  wtdLabel,
  mtdLabel,
}: {
  title: string;
  totals: PeriodTotals;
  formatValue: (n: number) => string;
  icon: React.ElementType;
  accent?: boolean;
  vsLastYearLabel: string;
  wtdLabel: string;
  mtdLabel: string;
}) {
  return (
    <div className={`rounded-lg p-3 border border-border flex flex-col gap-2 ${accent ? 'bg-primary/10' : 'bg-card'}`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-sans tracking-wide text-muted-foreground uppercase">{title}</span>
        <div className={`p-1.5 rounded-md ${accent ? 'bg-primary/20' : 'bg-muted'}`}>
          <Icon size={13} className={accent ? 'text-primary' : 'text-muted-foreground'} />
        </div>
      </div>
      <p className="text-2xl font-semibold leading-none">{formatValue(totals.today)}</p>
      <DeltaBadge current={totals.today} prev={totals.todayPrev} label={vsLastYearLabel} />
      <div className="mt-1 space-y-1.5 border-t border-border/70 pt-2">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground font-sans uppercase tracking-wide">{wtdLabel}</span>
          <span className="font-medium tabular-nums">{formatValue(totals.wtd)}</span>
        </div>
        <DeltaBadge current={totals.wtd} prev={totals.wtdPrev} label={vsLastYearLabel} />
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground font-sans uppercase tracking-wide">{mtdLabel}</span>
          <span className="font-medium tabular-nums">{formatValue(totals.mtd)}</span>
        </div>
        <DeltaBadge current={totals.mtd} prev={totals.mtdPrev} label={vsLastYearLabel} />
      </div>
    </div>
  );
}

function RevenueChart({ data }: { data: RevenuePoint[] }) {
  const max = Math.max(...data.flatMap(d => [d.currentValue, d.priorValue]), 1);
  return (
    <div className="flex items-end gap-2 h-40 mt-4">
      {data.map(d => (
        <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full flex gap-0.5 items-end h-32">
            <div className="flex-1 rounded-t bg-[#C9963A]/60" style={{ height: `${(d.priorValue / max) * 100}%` }} title={`Prior: ${fmtUsd(d.priorValue)}`} />
            <div className="flex-1 rounded-t bg-primary" style={{ height: `${(d.currentValue / max) * 100}%` }} title={`Current: ${fmtUsd(d.currentValue)}`} />
          </div>
          <span className="text-xs text-muted-foreground">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function clientOrderTotal(order: B2bSalesOrder): number {
  return (order.lines ?? []).reduce((sum, line) => sum + line.quantityOrdered * line.rrp, 0);
}

function clientOrderDate(order: B2bSalesOrder): string {
  if (order.issuedDate?.trim()) return order.issuedDate.trim().slice(0, 10);
  if (!order.createdAt) return '—';
  return order.createdAt.slice(0, 10);
}

const SECTION_LABELS: Record<OverviewSectionId, string> = {
  metrics: 'Key metrics',
  'revenue-progress': 'Revenue & progress',
  'menu-alerts': 'Product & inventory alerts',
  'purchase-orders': 'Active orders',
};

type MenuSortColumn = 'item' | 'orders' | 'revenue' | 'margin';
type OrderSortColumn = 'po' | 'vendor' | 'delivery' | 'value' | 'status';
type ClientOrderSortColumn = 'so' | 'customer' | 'date' | 'value' | 'status';

type Props = {
  editLayout: boolean;
  menuItems: MenuItem[];
  alerts: InventoryAlert[];
  orders: PurchaseOrder[];
  clientOrders: B2bSalesOrder[];
  revenue: RevenuePoint[];
  progress: ProgressData | null;
  sales: PeriodTotals;
  activity: PeriodTotals;
  aov: PeriodTotals;
  activityMode: DashboardActivityMode;
  onOrderNowFromAlerts?: () => void;
};

function OverviewSectionShell({
  sectionId,
  editLayout,
  hidden,
  onToggleHidden,
  onDragStart,
  onDragOver,
  onDrop,
  children,
}: {
  sectionId: OverviewSectionId;
  editLayout: boolean;
  hidden: boolean;
  onToggleHidden: () => void;
  onDragStart: () => void;
  onDragOver: (event: DragEvent) => void;
  onDrop: () => void;
  children: ReactNode;
}) {
  if (!editLayout && hidden) return null;

  return (
    <div
      className={`relative ${editLayout ? 'rounded-lg border-2 border-dashed border-primary/40 bg-primary/5' : ''}`}
      draggable={editLayout}
      onDragStart={event => {
        if (!editLayout) return;
        event.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragOver={event => {
        if (!editLayout) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        onDragOver(event);
      }}
      onDrop={event => {
        if (!editLayout) return;
        event.preventDefault();
        onDrop();
      }}
    >
      {editLayout ? (
        <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-primary/20 bg-primary/10 rounded-t-md">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary cursor-grab active:cursor-grabbing">
            <GripVertical size={14} />
            {SECTION_LABELS[sectionId]}
          </div>
          <button
            type="button"
            onClick={onToggleHidden}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-0.5 text-[11px] font-medium hover:bg-muted"
          >
            {hidden ? <Eye size={12} /> : <EyeOff size={12} />}
            {hidden ? 'Show' : 'Hide'}
          </button>
        </div>
      ) : null}
      {!hidden ? <div className={editLayout ? 'p-2' : undefined}>{children}</div> : null}
    </div>
  );
}

export function OverviewDashboard({
  editLayout,
  menuItems,
  alerts,
  orders,
  clientOrders,
  revenue,
  progress,
  sales,
  activity,
  aov,
  activityMode,
  onOrderNowFromAlerts,
}: Props) {
  const { t } = useAppTranslation();
  const [layout, setLayout] = useState<OverviewLayoutState>(() => loadOverviewLayout());
  const [draggingId, setDraggingId] = useState<OverviewSectionId | null>(null);
  const [dropTargetId, setDropTargetId] = useState<OverviewSectionId | null>(null);
  const wasEditingRef = useRef(false);

  useEffect(() => {
    if (wasEditingRef.current && !editLayout) {
      saveOverviewLayout(layout);
    }
    wasEditingRef.current = editLayout;
  }, [editLayout, layout]);

  const menuTableColumns = useMemo<SortableColumnDef<MenuSortColumn>[]>(() => [
    { key: 'item', label: t('overview.item') },
    { key: 'orders', label: t('overview.orders'), align: 'right' },
    { key: 'revenue', label: t('overview.revenue'), align: 'right' },
    { key: 'margin', label: t('overview.margin'), align: 'right' },
  ], [t]);

  const ordersTableColumns = useMemo<SortableColumnDef<OrderSortColumn>[]>(() => [
    { key: 'po', label: t('overview.po') },
    { key: 'vendor', label: t('common.vendor') },
    { key: 'delivery', label: t('overview.delivery') },
    { key: 'value', label: t('overview.value'), align: 'right' },
    { key: 'status', label: t('common.status') },
  ], [t]);

  const clientOrdersTableColumns = useMemo<SortableColumnDef<ClientOrderSortColumn>[]>(() => [
    { key: 'so', label: t('overview.so') },
    { key: 'customer', label: t('overview.customer') },
    { key: 'date', label: t('overview.orderDate') },
    { key: 'value', label: t('overview.value'), align: 'right' },
    { key: 'status', label: t('common.status') },
  ], [t]);

  const { sortColumn: menuSortColumn, sortDirection: menuSortDirection, toggleSort: toggleMenuSort } =
    useTableSort<MenuSortColumn>();
  const { sortColumn: ordersSortColumn, sortDirection: ordersSortDirection, toggleSort: toggleOrdersSort } =
    useTableSort<OrderSortColumn>();
  const { sortColumn: clientSortColumn, sortDirection: clientSortDirection, toggleSort: toggleClientSort } =
    useTableSort<ClientOrderSortColumn>();

  const sortedMenuItems = useMemo(
    () => sortTableRows(menuItems, menuSortColumn, menuSortDirection, {
      item: row => row.name,
      orders: row => row.orders,
      revenue: row => row.revenue,
      margin: row => row.marginPercent,
    }),
    [menuItems, menuSortColumn, menuSortDirection],
  );

  const sortedOrders = useMemo(
    () => sortTableRows(orders, ordersSortColumn, ordersSortDirection, {
      po: row => row.poNumber,
      vendor: row => row.vendorName,
      delivery: row => row.deliveryDate,
      value: row => row.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
      status: row => row.status,
    }),
    [orders, ordersSortColumn, ordersSortDirection],
  );

  const sortedClientOrders = useMemo(
    () => sortTableRows(clientOrders, clientSortColumn, clientSortDirection, {
      so: row => row.orderNumber,
      customer: row => row.customerName,
      date: row => clientOrderDate(row),
      value: row => clientOrderTotal(row),
      status: row => row.status,
    }),
    [clientOrders, clientSortColumn, clientSortDirection],
  );

  const menuScrollRef = useRef<HTMLDivElement>(null);
  const ordersScrollRef = useRef<HTMLDivElement>(null);
  const clientOrdersScrollRef = useRef<HTMLDivElement>(null);
  const menuScroll = useInfiniteScrollSlice(sortedMenuItems, { scrollRootRef: menuScrollRef });
  const ordersScroll = useInfiniteScrollSlice(sortedOrders, { scrollRootRef: ordersScrollRef });
  const clientOrdersScroll = useInfiniteScrollSlice(sortedClientOrders, { scrollRootRef: clientOrdersScrollRef });

  const activityTitle = activityMode === 'purchaseOrders'
    ? t('overview.purchaseOrdersToday')
    : t('overview.coversToday');
  const aovTitle = activityMode === 'purchaseOrders'
    ? t('overview.avgValuePerPo')
    : t('overview.avgOrderValue');

  function renderSection(sectionId: OverviewSectionId) {
    switch (sectionId) {
      case 'metrics':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            <PeriodMetricCard
              title={t('overview.salesToday')}
              totals={sales}
              formatValue={fmtUsd}
              icon={TrendingUp}
              accent
              vsLastYearLabel={t('overview.vsLastYear')}
              wtdLabel={t('overview.wtd')}
              mtdLabel={t('overview.mtd')}
            />
            <PeriodMetricCard
              title={activityTitle}
              totals={activity}
              formatValue={fmtCount}
              icon={Users}
              vsLastYearLabel={t('overview.vsLastYear')}
              wtdLabel={t('overview.wtd')}
              mtdLabel={t('overview.mtd')}
            />
            <PeriodMetricCard
              title={aovTitle}
              totals={aov}
              formatValue={fmtAov}
              icon={ShoppingBag}
              vsLastYearLabel={t('overview.vsLastYear')}
              wtdLabel={t('overview.wtd')}
              mtdLabel={t('overview.mtd')}
            />
          </div>
        );
      case 'revenue-progress':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
            <div className="lg:col-span-2 bg-card border border-border rounded-lg p-3">
              <h2 className="text-sm font-semibold">{t('overview.revenueTrend')}</h2>
              <p className="text-xs text-muted-foreground mb-1">{t('overview.revenueTrendSubtitle')}</p>
              <RevenueChart data={revenue} />
            </div>
            <ProgressPanel progress={progress} />
          </div>
        );
      case 'menu-alerts':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="p-2 border-b border-border">
                <h2 className="text-sm font-semibold">{t('overview.productPerformance')}</h2>
              </div>
              <TableScrollContainer ref={menuScrollRef} className="max-h-[calc(100vh-12rem)] overflow-y-auto">
                <table className="w-full table-fixed text-xs">
                  <thead>
                    <SortableTableHeaderRow
                      columns={menuTableColumns}
                      sortColumn={menuSortColumn}
                      sortDirection={menuSortDirection}
                      onSort={toggleMenuSort}
                      className="border-b border-border"
                    />
                  </thead>
                  <tbody>
                    {menuScroll.visibleItems.map(m => (
                      <tr key={m.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 font-medium">{m.name}</td>
                        <td className="px-4 py-3 font-sans text-muted-foreground">{m.orders}</td>
                        <td className="px-4 py-3 font-sans">${m.revenue.toLocaleString()}</td>
                        <td className="px-4 py-3 font-sans">{m.marginPercent}%</td>
                      </tr>
                    ))}
                    <InfiniteScrollTableSentinel colSpan={4} hasMore={menuScroll.hasMore} onLoadMore={menuScroll.loadMore} nextPageSize={menuScroll.nextPageSize} sentinelRef={menuScroll.sentinelRef} totalCount={menuScroll.totalCount} visibleCount={menuScroll.visibleCount} />
                  </tbody>
                </table>
              </TableScrollContainer>
            </div>

            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="p-2 border-b border-border flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">{t('overview.inventoryAlerts')}</h2>
                {alerts.length > 0 && onOrderNowFromAlerts ? (
                  <button
                    type="button"
                    onClick={onOrderNowFromAlerts}
                    className="rounded-md border border-border bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground hover:opacity-90"
                  >
                    {t('overview.orderNow')}
                  </button>
                ) : null}
              </div>
              <div className="divide-y divide-border">
                {alerts.length === 0 ? (
                  <p className="px-5 py-4 text-xs text-muted-foreground">{t('overview.noInventoryAlerts')}</p>
                ) : (
                  alerts.map(a => (
                    <div key={a.id} className="px-5 py-4 flex items-start gap-3">
                      <AlertTriangle size={13} className={`mt-0.5 ${a.status === 'critical' ? 'text-red-500' : 'text-primary'}`} />
                      <div className="flex-1">
                        <p className="text-xs font-medium">{a.itemName}</p>
                        <p className="text-xs text-muted-foreground">{t('overview.stockMin', { stock: a.stock, min: a.threshold })}</p>
                      </div>
                      <span className={`text-xs font-sans px-1.5 py-0.5 rounded ${a.status === 'critical' ? 'bg-red-500/15 text-red-500' : 'bg-primary/15 text-primary'}`}>{a.status}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        );
      case 'purchase-orders':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="p-2 border-b border-border">
                <h2 className="text-sm font-semibold">{t('overview.activePurchaseOrders')}</h2>
              </div>
              <TableScrollContainer ref={ordersScrollRef} className="max-h-[calc(100vh-12rem)] overflow-y-auto">
                <table className="w-full table-fixed text-xs">
                  <thead>
                    <SortableTableHeaderRow
                      columns={ordersTableColumns}
                      sortColumn={ordersSortColumn}
                      sortDirection={ordersSortDirection}
                      onSort={toggleOrdersSort}
                      className="border-b border-border"
                    />
                  </thead>
                  <tbody>
                    {ordersScroll.visibleItems.map(o => {
                      const value = o.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
                      return (
                        <tr key={o.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3 font-sans text-primary">{o.poNumber}</td>
                          <td className="px-4 py-3">{o.vendorName}</td>
                          <td className="px-4 py-3 font-sans text-muted-foreground">{o.deliveryDate}</td>
                          <td className="px-4 py-3 font-sans">${value.toFixed(2)}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-sans px-1.5 py-0.5 rounded bg-primary/15 text-primary">{o.status}</span>
                          </td>
                        </tr>
                      );
                    })}
                    <InfiniteScrollTableSentinel colSpan={5} hasMore={ordersScroll.hasMore} onLoadMore={ordersScroll.loadMore} nextPageSize={ordersScroll.nextPageSize} sentinelRef={ordersScroll.sentinelRef} totalCount={ordersScroll.totalCount} visibleCount={ordersScroll.visibleCount} />
                  </tbody>
                </table>
              </TableScrollContainer>
            </div>

            <div className="bg-card border border-border rounded-lg overflow-hidden min-h-[12rem]">
              <div className="p-2 border-b border-border">
                <h2 className="text-sm font-semibold">{t('overview.activeClientOrders')}</h2>
              </div>
              <TableScrollContainer ref={clientOrdersScrollRef} className="max-h-[calc(100vh-12rem)] overflow-y-auto">
                <table className="w-full table-fixed text-xs">
                  <thead>
                    <SortableTableHeaderRow
                      columns={clientOrdersTableColumns}
                      sortColumn={clientSortColumn}
                      sortDirection={clientSortDirection}
                      onSort={toggleClientSort}
                      className="border-b border-border"
                    />
                  </thead>
                  <tbody>
                    {sortedClientOrders.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-xs text-muted-foreground text-center">
                          {t('overview.noOrdersOnHand')}
                        </td>
                      </tr>
                    ) : null}
                    {clientOrdersScroll.visibleItems.map(o => {
                      const value = clientOrderTotal(o);
                      return (
                        <tr key={o.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3 font-sans text-primary">{o.orderNumber}</td>
                          <td className="px-4 py-3">{o.customerName}</td>
                          <td className="px-4 py-3 font-sans text-muted-foreground">{clientOrderDate(o)}</td>
                          <td className="px-4 py-3 font-sans">${value.toFixed(2)}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-sans px-1.5 py-0.5 rounded bg-primary/15 text-primary">{o.status}</span>
                          </td>
                        </tr>
                      );
                    })}
                    <InfiniteScrollTableSentinel colSpan={5} hasMore={clientOrdersScroll.hasMore} onLoadMore={clientOrdersScroll.loadMore} nextPageSize={clientOrdersScroll.nextPageSize} sentinelRef={clientOrdersScroll.sentinelRef} totalCount={clientOrdersScroll.totalCount} visibleCount={clientOrdersScroll.visibleCount} />
                  </tbody>
                </table>
              </TableScrollContainer>
            </div>
          </div>
        );
      default:
        return null;
    }
  }

  const activeLayout = layout.order.length > 0 ? layout : DEFAULT_OVERVIEW_LAYOUT;

  return (
    <div className="space-y-2">
      {editLayout ? (
        <p className="text-xs text-muted-foreground rounded-md border border-dashed border-primary/30 bg-primary/5 px-3 py-2">
          Drag sections to reorder. Hide sections you do not need. Click <span className="font-semibold text-primary">Editing</span> again to save.
        </p>
      ) : null}
      {activeLayout.order.map(sectionId => {
        const hidden = activeLayout.hidden.includes(sectionId);
        const isDropTarget = dropTargetId === sectionId && draggingId !== sectionId;
        return (
          <div key={sectionId} className={isDropTarget ? 'ring-2 ring-primary rounded-lg' : undefined}>
            <OverviewSectionShell
              sectionId={sectionId}
              editLayout={editLayout}
              hidden={hidden}
              onToggleHidden={() => setLayout(current => toggleOverviewSectionHidden(current, sectionId))}
              onDragStart={() => setDraggingId(sectionId)}
              onDragOver={() => setDropTargetId(sectionId)}
              onDrop={() => {
                if (!draggingId) return;
                setLayout(current => reorderOverviewSections(current, draggingId, sectionId));
                setDraggingId(null);
                setDropTargetId(null);
              }}
            >
              {renderSection(sectionId)}
            </OverviewSectionShell>
          </div>
        );
      })}
    </div>
  );
}
