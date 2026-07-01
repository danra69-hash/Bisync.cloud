import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  ClipboardList,
  Package,
  ShoppingCart,
} from 'lucide-react';
import { api, type Company, type InventoryAlert, type PurchaseOrder } from '../../api';
import { getCompanyMessages } from '../../data/revMgmtCompanyMessages';

type Props = {
  selectedCompanyId: number | null;
};

type ActivityItem = {
  id: string;
  time: string;
  title: string;
  detail: string;
  tone: 'neutral' | 'warning' | 'success';
};

function isPendingStatus(status: string) {
  return status.toLowerCase().includes('pending');
}

function orderValue(order: PurchaseOrder) {
  return order.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

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
  alerts: InventoryAlert[],
  pendingCount: number,
): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const order of orders) {
    if (!isToday(order.orderDate)) continue;
    items.push({
      id: `po-${order.id}`,
      time: 'Today',
      title: `Purchase order ${order.poNumber}`,
      detail: `${order.vendorName} · ${order.status}`,
      tone: isPendingStatus(order.status) ? 'warning' : 'success',
    });
  }

  for (const alert of alerts) {
    items.push({
      id: `alert-${alert.id}`,
      time: 'Now',
      title: alert.itemName,
      detail: `Stock ${alert.stock} · minimum ${alert.threshold}`,
      tone: alert.status === 'critical' ? 'warning' : 'neutral',
    });
  }

  if (pendingCount > 0) {
    items.push({
      id: 'pending-summary',
      time: 'Now',
      title: `${pendingCount} order${pendingCount === 1 ? '' : 's'} awaiting action`,
      detail: 'Review pending purchase orders below',
      tone: 'warning',
    });
  }

  if (items.length === 0) {
    items.push({
      id: 'empty',
      time: 'Today',
      title: 'No activity yet',
      detail: 'Orders, alerts, and approvals will appear here throughout the day.',
      tone: 'neutral',
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

export function RevMgmtLandingPage({ selectedCompanyId }: Props) {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const results = await Promise.allSettled([
        api.purchaseOrders(),
        api.inventoryAlerts(),
        api.companies(),
      ]);

      if (cancelled) return;

      if (results[0].status === 'fulfilled') setOrders(results[0].value);
      if (results[1].status === 'fulfilled') setAlerts(results[1].value);
      if (results[2].status === 'fulfilled') setCompanies(results[2].value);
      setLoading(false);
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  const companyName = useMemo(() => {
    if (!selectedCompanyId) return 'your company';
    return companies.find(c => c.id === selectedCompanyId)?.name ?? 'your company';
  }, [companies, selectedCompanyId]);

  const scopedOrders = selectedCompanyId ? orders : [];
  const scopedAlerts = selectedCompanyId ? alerts : [];

  const pendingOrders = useMemo(
    () => scopedOrders.filter(o => isPendingStatus(o.status)),
    [scopedOrders],
  );

  const activityItems = useMemo(
    () => buildActivityToday(scopedOrders, scopedAlerts, pendingOrders.length),
    [scopedOrders, scopedAlerts, pendingOrders.length],
  );

  const messages = useMemo(
    () => getCompanyMessages(selectedCompanyId),
    [selectedCompanyId],
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Revenue Management</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Operations overview for {companyName}
        </p>
      </div>

      {!selectedCompanyId && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          Select a company in the header to load live orders and inventory activity.
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
              <p className="text-xs text-muted-foreground">Live operations feed</p>
            </div>
          </div>
          <div className="flex-1 divide-y divide-border overflow-y-auto">
            {loading ? (
              <p className="px-5 py-4 text-xs text-muted-foreground">Loading activity…</p>
            ) : (
              activityItems.map(item => (
                <div key={item.id} className="px-5 py-4 flex items-start gap-3">
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
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <div className="p-2 rounded-md bg-primary/10">
              <Bell size={14} className="text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Messages from Company</h2>
              <p className="text-xs text-muted-foreground">Announcements and reminders</p>
            </div>
          </div>
          <div className="flex-1 divide-y divide-border overflow-y-auto">
            {messages.map(message => (
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
                <p className="text-xs text-muted-foreground">Awaiting approval or dispatch</p>
              </div>
            </div>
            <span className="text-xs font-sans px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {pendingOrders.length}
            </span>
          </div>
          <div className="flex-1 overflow-auto">
            {loading ? (
              <p className="px-5 py-4 text-xs text-muted-foreground">Loading orders…</p>
            ) : pendingOrders.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-xs font-medium">No pending orders</p>
                <p className="text-xs text-muted-foreground mt-1">
                  New purchase orders awaiting action will show here.
                </p>
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {['PO', 'Vendor', 'Delivery', 'Value', 'Status'].map(h => (
                      <th key={h} className="text-left px-4 py-2 text-muted-foreground font-normal uppercase text-[10px] tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pendingOrders.map(order => (
                    <tr key={order.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3 font-sans text-primary whitespace-nowrap">{order.poNumber}</td>
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
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
