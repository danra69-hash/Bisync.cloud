import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { useTableSort } from '../../hooks/useTableSort';
import { sortTableRows, compareSortValues } from '../../utils/tableSort';
import { SortableTableHeaderRow, type SortableColumnDef } from '../shared/SortableTableHead';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { pageShellClass } from '../layout/pageLayout';
import { Activity, AlertTriangle, Bell, ClipboardList, Package, ShoppingCart } from 'lucide-react';
import { api, type Company, type PurchaseOrder, type UserNotification } from '../../api';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { getCompanyMessages } from '../../data/revMgmtCompanyMessages';
import { filterPurchaseOrdersByOrg } from '../../utils/orgFilters';
import { ActivePurchasePanel } from './ActivePurchasePanel';
import { MillstoneLoader } from '../shared/MillstoneLoader';

type Props = {
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
  onOpenTransfer?: () => void;
};

type ActivityItem = {
  id: string;
  orderId?: number;
  time: string;
  title: string;
  detail: string;
  tone: 'neutral' | 'warning' | 'success';
  clickable: boolean;
};

function isPendingStatus(status: string) {
  return status.toLowerCase().includes('pending');
}

function orderValue(order: PurchaseOrder) {
  return order.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

type PendingOrderSortColumn = 'po' | 'vendor' | 'delivery' | 'value' | 'status';

const PENDING_ORDER_TABLE_COLUMNS: SortableColumnDef<PendingOrderSortColumn>[] = [
  { key: 'po', label: 'PO' },
  { key: 'vendor', label: 'Vendor' },
  { key: 'delivery', label: 'Delivery' },
  { key: 'value', label: 'Value', align: 'right' },
  { key: 'status', label: 'Status' },
];

function formatPostedDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function isToday(dateStr: string) {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate()
  );
}

function buildActivityToday(
  orders: PurchaseOrder[],
  pendingCount: number,
): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const order of orders) {
    if (!isToday(order.orderDate)) continue;
    items.push({
      id: `po-${order.id}`,
      orderId: order.id,
      time: 'Today',
      title: `${order.documentType === 'PR' ? 'Purchase request' : 'Purchase order'} ${order.poNumber}`,
      detail: `${order.vendorName} · ${order.status}`,
      tone: isPendingStatus(order.status) ? 'warning' : 'success',
      clickable: true,
    });
  }

  if (pendingCount > 0) {
    items.push({
      id: 'pending-summary',
      time: 'Now',
      title: `${pendingCount} order${pendingCount === 1 ? '' : 's'} awaiting action`,
      detail: 'Click a PO below to approve, receive, or reconcile',
      tone: 'warning',
      clickable: false,
    });
  }

  if (items.length === 0) {
    items.push({
      id: 'empty',
      time: 'Today',
      title: 'No activity yet',
      detail: 'Orders and approvals for the selected company and locations will appear here.',
      tone: 'neutral',
      clickable: false,
    });
  }

  return items;
}

function toneClasses(tone: ActivityItem['tone']) {
  switch (tone) {
    case 'warning':
      return 'bg-amber-500/10 text-amber-700 dark:text-amber-400';
    case 'success':
      return 'bg-[#5A7A2A]/15 text-[#5A7A2A]';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export function RevMgmtLandingPage({ selectedCompanyId, selectedLocationIds, onOpenTransfer }: Props) {
  const { currentUser } = useCurrentUser();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [openingOrderId, setOpeningOrderId] = useState<number | null>(null);
  const { sortColumn, sortDirection, toggleSort, resetSort } = useTableSort<PendingOrderSortColumn>();

  const orgReady = Boolean(selectedCompanyId) && selectedLocationIds.length > 0;

  async function loadNotifications() {
    if (!currentUser) {
      setNotifications([]);
      return;
    }

    try {
      const rows = await api.userNotifications(currentUser.id, currentUser.fullName);
      setNotifications(rows);
    } catch {
      setNotifications([]);
    }
  }

  async function loadOrders() {
    setLoading(true);
    const results = await Promise.allSettled([
      api.activePurchaseOrders(selectedCompanyId ?? undefined),
      api.companies(),
    ]);

    if (results[0].status === 'fulfilled') setOrders(results[0].value);
    if (results[1].status === 'fulfilled') setCompanies(results[1].value);
    setLoading(false);
  }

  useEffect(() => {
    void loadOrders();
  }, [selectedCompanyId]);

  useEffect(() => {
    void loadNotifications();
  }, [currentUser?.id, currentUser?.fullName]);

  const companyName = useMemo(() => {
    if (!selectedCompanyId) return 'your company';
    return companies.find(c => c.id === selectedCompanyId)?.name ?? 'your company';
  }, [companies, selectedCompanyId]);

  const actionableOrders = useMemo(
    () => filterPurchaseOrdersByOrg(orders, selectedCompanyId, selectedLocationIds),
    [orders, selectedCompanyId, selectedLocationIds],
  );

  const pendingOrders = actionableOrders;

  useEffect(() => {
    resetSort();
  }, [selectedCompanyId, selectedLocationIds, resetSort]);

  const sortedPendingOrders = useMemo(
    () =>
      sortTableRows(
        pendingOrders,
        sortColumn,
        sortDirection,
        {
          po: o => o.poNumber,
          vendor: o => o.vendorName,
          delivery: o => o.deliveryDate,
          value: o => orderValue(o),
          status: o => o.status,
        },
        { tieBreaker: (a, b) => compareSortValues(a.poNumber, b.poNumber) },
      ),
    [pendingOrders, sortColumn, sortDirection],
  );

  const scrollRootRef = useRef<HTMLDivElement>(null);
  const {
    visibleItems: pagedPendingOrders,
    hasMore,
    sentinelRef,
    totalCount,
    visibleCount, nextPageSize, loadMore } = useInfiniteScrollSlice(sortedPendingOrders, { scrollRootRef });

  const activityItems = useMemo(
    () => buildActivityToday(actionableOrders, pendingOrders.length),
    [actionableOrders, pendingOrders.length],
  );

  const selectedOrder = useMemo(
    () => orders.find(o => o.id === selectedOrderId) ?? null,
    [orders, selectedOrderId],
  );

  async function openOrder(orderId: number) {
    setOpeningOrderId(orderId);
    try {
      const order = await api.purchaseOrder(orderId);
      setOrders(prev => {
        const exists = prev.some(o => o.id === order.id);
        if (!exists) return [order, ...prev];
        return prev.map(o => (o.id === order.id ? order : o));
      });
      setSelectedOrderId(order.id);
    } finally {
      setOpeningOrderId(null);
    }
  }

  function handleOrderUpdated(updated: PurchaseOrder) {
    setOrders(prev => {
      if (updated.status === 'Reconciled') {
        return prev.filter(o => o.id !== updated.id);
      }
      const exists = prev.some(o => o.id === updated.id);
      if (!exists) return [updated, ...prev];
      return prev.map(o => (o.id === updated.id ? updated : o));
    });
    setSelectedOrderId(updated.status === 'Reconciled' ? null : updated.id);
    void loadNotifications();
  }

  async function openNotification(notification: UserNotification) {
    if (!notification.isRead) {
      try {
        const updated = await api.markNotificationRead(notification.id);
        setNotifications(prev => prev.map(n => (n.id === updated.id ? updated : n)));
      } catch {
        // ignore read errors
      }
    }

    if (notification.purchaseOrderId) {
      await openOrder(notification.purchaseOrderId);
      return;
    }

    if (
      notification.transferId
      || notification.type === 'transfer_initiated'
      || notification.type === 'transfer_received'
    ) {
      onOpenTransfer?.();
    }
  }

  const unreadNotifications = useMemo(
    () => notifications.filter(n => !n.isRead),
    [notifications],
  );

  const companyMessages = useMemo(
    () => getCompanyMessages(selectedCompanyId),
    [selectedCompanyId],
  );

  return (
    <div className={pageShellClass({ spacing: 'wide' })}>
      <div>
        <h1 className="text-lg font-semibold">Revenue Management</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Operations overview for {companyName}
        </p>
      </div>

      {!orgReady && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          {!selectedCompanyId
            ? 'Select a company in the header to load activity and pending orders.'
            : 'Select one or more locations in the header to scope activity and pending orders.'}
        </div>
      )}

      {unreadNotifications.length > 0 && (
        <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 space-y-2">
          <p className="text-sm font-semibold text-foreground">Action required</p>
          {unreadNotifications.map(notification => (
            <button
              key={notification.id}
              type="button"
              onClick={() => void openNotification(notification)}
              className="w-full text-left rounded-md border border-border/60 bg-card px-3 py-2 hover:bg-muted/40 transition-colors"
            >
              <p className="text-xs font-medium">{notification.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{notification.body}</p>
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <section className="bg-card border border-border rounded-lg overflow-hidden flex flex-col min-h-[320px]">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <div className="p-2 rounded-md bg-primary/10">
              <Activity size={14} className="text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Activity Today</h2>
              <p className="text-xs text-muted-foreground">Orders for selected company & locations</p>
            </div>
          </div>
          <div className="flex-1 divide-y divide-border overflow-y-auto">
            {loading ? (
              <MillstoneLoader size="sm" layout="block" label="Loading activity…" />
            ) : !orgReady ? (
              <p className="px-5 py-4 text-xs text-muted-foreground">
                Select a company and locations to view today&apos;s activity.
              </p>
            ) : (
              activityItems.map(item => (
                <div
                  key={item.id}
                  role={item.clickable ? 'button' : undefined}
                  tabIndex={item.clickable ? 0 : undefined}
                  onClick={item.clickable && item.orderId ? () => void openOrder(item.orderId!) : undefined}
                  onKeyDown={item.clickable && item.orderId ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      void openOrder(item.orderId!);
                    }
                  } : undefined}
                  className={`px-5 py-4 flex items-start gap-3 ${item.clickable ? 'cursor-pointer hover:bg-muted/30 focus:outline-none focus:bg-muted/30' : ''}`}
                >
                  <span className={`mt-0.5 shrink-0 text-[10px] font-sans uppercase tracking-wide px-1.5 py-0.5 rounded ${toneClasses(item.tone)}`}>
                    {item.time}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.detail}</p>
                  </div>
                  {item.tone === 'warning' ? (
                    <AlertTriangle size={13} className="shrink-0 text-amber-600 mt-0.5" />
                  ) : item.id.startsWith('po-') ? (
                    <ShoppingCart size={13} className="shrink-0 text-muted-foreground mt-0.5" />
                  ) : (
                    <Package size={13} className="shrink-0 text-muted-foreground mt-0.5" />
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        <section className="bg-card border border-border rounded-lg overflow-hidden flex flex-col min-h-[320px]">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-2 rounded-md bg-primary/10 shrink-0">
                <Bell size={14} className="text-primary" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold">Alerts &amp; Messages</h2>
                <p className="text-xs text-muted-foreground">Your alerts and company announcements</p>
              </div>
            </div>
            {unreadNotifications.length > 0 && (
              <span className="text-[10px] font-sans px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">
                {unreadNotifications.length}
              </span>
            )}
          </div>
          <div className="flex-1 divide-y divide-border overflow-y-auto">
            {notifications.length > 0 && (
              <div className="px-5 py-3 bg-muted/20">
                <p className="text-[10px] font-sans uppercase tracking-wide text-muted-foreground mb-2">Your alerts</p>
                <div className="space-y-2">
                  {notifications.map(notification => (
                    <button
                      key={notification.id}
                      type="button"
                      onClick={() => void openNotification(notification)}
                      className={`w-full text-left rounded-md border px-3 py-2 transition-colors ${
                        notification.isRead
                          ? 'border-border bg-card hover:bg-muted/30'
                          : 'border-primary/30 bg-primary/5 hover:bg-primary/10'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-xs font-medium">{notification.title}</p>
                        <span className="text-[10px] font-sans text-muted-foreground shrink-0">
                          {formatPostedDate(notification.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{notification.body}</p>
                      {!notification.isRead && (
                        <span className="inline-flex mt-2 text-[10px] font-sans uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                          New
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {companyMessages.map(message => (
              <article key={message.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs font-medium">{message.title}</p>
                  <span className="text-[10px] font-sans text-muted-foreground shrink-0">
                    {formatPostedDate(message.postedAt)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{message.body}</p>
                {message.priority === 'important' && (
                  <span className="inline-flex mt-2 text-[10px] font-sans uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                    Important
                  </span>
                )}
              </article>
            ))}
          </div>
        </section>

        <section className="bg-card border border-border rounded-lg overflow-hidden flex flex-col min-h-[320px]">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-md bg-primary/10">
                <ClipboardList size={14} className="text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold">List of Pending Orders</h2>
                <p className="text-xs text-muted-foreground">Click to approve, receive, or reconcile</p>
              </div>
            </div>
            <span className="text-xs font-sans px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {pendingOrders.length}
            </span>
          </div>
          <TableScrollContainer ref={scrollRootRef} className="flex-1 overflow-auto max-h-[calc(100vh-12rem)]">
            {loading ? (
              <MillstoneLoader size="sm" layout="block" label="Loading orders…" />
            ) : !orgReady ? (
              <div className="px-5 py-8 text-center">
                <p className="text-xs font-medium">Select company and locations</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Pending orders are scoped to your header selection.
                </p>
              </div>
            ) : pendingOrders.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-xs font-medium">No pending orders</p>
                <p className="text-xs text-muted-foreground mt-1">
                  New purchase orders awaiting action will show here.
                </p>
              </div>
            ) : (
              <table className="w-full table-fixed text-xs">
                <thead className="bg-muted/30">
                  <SortableTableHeaderRow
                    columns={PENDING_ORDER_TABLE_COLUMNS}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={toggleSort}
                    className="border-b border-border"
                  />
                </thead>
                <tbody>
                  {pagedPendingOrders.map(order => (
                    <tr
                      key={order.id}
                      className="border-b border-border last:border-0 hover:bg-muted/20 cursor-pointer"
                      onClick={() => void openOrder(order.id)}
                    >
                      <td className="px-4 py-3 font-sans text-primary whitespace-nowrap underline-offset-2 hover:underline">
                        {openingOrderId === order.id ? '…' : order.poNumber}
                      </td>
                      <td className="px-4 py-3">{order.vendorName}</td>
                      <td className="px-4 py-3 font-sans text-muted-foreground whitespace-nowrap">{order.deliveryDate}</td>
                      <td className="px-4 py-3 font-sans whitespace-nowrap">${orderValue(order).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-sans px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400">
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  <InfiniteScrollTableSentinel colSpan={5} hasMore={hasMore} onLoadMore={loadMore} nextPageSize={nextPageSize} sentinelRef={sentinelRef} totalCount={totalCount} visibleCount={visibleCount} />
                </tbody>
              </table>
            )}
          </TableScrollContainer>
        </section>
      </div>

      {selectedOrder && (
        <ActivePurchasePanel
          order={selectedOrder}
          onClose={() => setSelectedOrderId(null)}
          onUpdated={handleOrderUpdated}
        />
      )}
    </div>
  );
}
