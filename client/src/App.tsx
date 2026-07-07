import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteScrollSlice } from './hooks/useInfiniteScrollSlice';
import { useTableSort } from './hooks/useTableSort';
import { InfiniteScrollTableSentinel } from './components/shared/infiniteScroll';
import { SortableTableHeaderRow, type SortableColumnDef } from './components/shared/SortableTableHead';
import { TableScrollContainer } from './components/shared/TableScrollContainer';
import { sortTableRows } from './utils/tableSort';
import {
  TrendingUp, Users, ShoppingBag, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Package, FileText
} from 'lucide-react';
import { api, type MenuItem, type PurchaseOrder, type InventoryAlert, type RevenuePoint, type ProgressData } from './api';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { RevenueSection } from './components/revenue/RevenueSection';
import { ProgressPanel } from './components/overview/ProgressPanel';
import { SystemConfigurationPage } from './components/admin/SystemConfigurationPage';
import { HumanResourcesPage } from './components/hr/HumanResourcesPage';
import { AccountingPage } from './components/accounting/AccountingPage';
import { aggregateLocationMetrics } from './utils/locationMetrics';
import { configLocationToDropdown, filterMetricsByOrg } from './utils/orgFilters';
import { useOrgFilters } from './hooks/useOrgFilters';
import type { NavItem } from './data/revenueManagement';

function fmtUsd(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

function delta(current: number, prev: number) {
  if (prev === 0) return 0;
  return Math.round(((current - prev) / prev) * 1000) / 10;
}

type MenuSortColumn = 'item' | 'orders' | 'revenue' | 'margin';
type OrderSortColumn = 'po' | 'vendor' | 'delivery' | 'value' | 'status';

const MENU_TABLE_COLUMNS: SortableColumnDef<MenuSortColumn>[] = [
  { key: 'item', label: 'Item' },
  { key: 'orders', label: 'Orders', align: 'right' },
  { key: 'revenue', label: 'Revenue', align: 'right' },
  { key: 'margin', label: 'Margin', align: 'right' },
];

const ORDERS_TABLE_COLUMNS: SortableColumnDef<OrderSortColumn>[] = [
  { key: 'po', label: 'PO' },
  { key: 'vendor', label: 'Vendor' },
  { key: 'delivery', label: 'Delivery' },
  { key: 'value', label: 'Value', align: 'right' },
  { key: 'status', label: 'Status' },
];

function MetricCard({ title, value, deltaVal, icon: Icon, accent }: {
  title: string; value: string; deltaVal: number; icon: React.ElementType; accent?: boolean;
}) {
  const up = deltaVal >= 0;
  return (
    <div className={`rounded-lg p-3 border border-border flex flex-col gap-2 ${accent ? 'bg-primary/10' : 'bg-card'}`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-sans tracking-wide text-muted-foreground uppercase">{title}</span>
        <div className={`p-1.5 rounded-md ${accent ? 'bg-primary/20' : 'bg-muted'}`}>
          <Icon size={13} className={accent ? 'text-primary' : 'text-muted-foreground'} />
        </div>
      </div>
      <p className="text-2xl font-semibold leading-none">{value}</p>
      <div className={`flex items-center gap-1 text-xs font-sans ${up ? 'text-[#5A7A2A]' : 'text-accent'}`}>
        {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
        {up ? '+' : ''}{deltaVal}% vs prior period
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

function PlaceholderModule({ title }: { title: string }) {
  return (
    <div className="p-2 sm:p-3 w-full min-w-0">
      <div className="bg-card border border-border rounded-lg flex flex-col items-center justify-center text-center gap-3 p-12">
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
          <FileText size={18} className="text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground font-sans max-w-xs">This module is ready to be configured.</p>
      </div>
    </div>
  );
}

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [editLayout, setEditLayout] = useState(false);
  const [activeNav, setActiveNav] = useState<NavItem>('Overview');
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
  const {
    companies,
    configLocations,
    metricsLocations,
    loading: orgLoading,
    error: orgError,
    refreshOrgFilters,
  } = useOrgFilters();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [revenue, setRevenue] = useState<RevenuePoint[]>([]);
  const [progress, setProgress] = useState<ProgressData | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    async function load() {
      const results = await Promise.allSettled([
        api.menu(),
        api.purchaseOrders(),
        api.inventoryAlerts(),
        api.revenue(),
        api.progress(),
      ]);

      if (results[0].status === 'fulfilled') setMenuItems(results[0].value);
      if (results[1].status === 'fulfilled') setOrders(results[1].value);
      if (results[2].status === 'fulfilled') setAlerts(results[2].value);
      if (results[3].status === 'fulfilled') setRevenue(results[3].value);
      if (results[4].status === 'fulfilled') setProgress(results[4].value);
    }
    load();
  }, []);

  useEffect(() => {
    if (selectedCompanyId && !companies.some(c => c.id === selectedCompanyId)) {
      setSelectedCompanyId(null);
      setSelectedLocationIds([]);
    }
  }, [companies, selectedCompanyId]);

  useEffect(() => {
    if (!selectedCompanyId) return;
    const allowed = new Set(
      configLocations.filter(l => l.companyId === selectedCompanyId).map(l => l.externalId),
    );
    setSelectedLocationIds(prev => prev.filter(id => allowed.has(id)));
  }, [configLocations, selectedCompanyId]);

  const companyScopedConfigLocations = selectedCompanyId
    ? configLocations.filter(l => l.companyId === selectedCompanyId)
    : [];
  const headerLocations = companyScopedConfigLocations.map(configLocationToDropdown);
  const activeLocations = selectedCompanyId
    ? filterMetricsByOrg(metricsLocations, configLocations, selectedCompanyId, selectedLocationIds)
    : [];
  const { totalSales, totalSalesPrev, totalCovers, totalCoversPrev, aov, aovPrev } = aggregateLocationMetrics(activeLocations);
  const overviewMenuItems = selectedCompanyId ? menuItems : [];
  const overviewAlerts = selectedCompanyId ? alerts : [];
  const overviewOrders = selectedCompanyId ? orders : [];
  const overviewRevenue = selectedCompanyId ? revenue : [];
  const overviewProgress = selectedCompanyId ? progress : null;

  const {
    sortColumn: menuSortColumn,
    sortDirection: menuSortDirection,
    toggleSort: toggleMenuSort,
    resetSort: resetMenuSort,
  } = useTableSort<MenuSortColumn>();
  const {
    sortColumn: ordersSortColumn,
    sortDirection: ordersSortDirection,
    toggleSort: toggleOrdersSort,
    resetSort: resetOrdersSort,
  } = useTableSort<OrderSortColumn>();

  useEffect(() => {
    resetMenuSort();
    resetOrdersSort();
  }, [selectedCompanyId, resetMenuSort, resetOrdersSort]);

  const sortedOverviewMenuItems = useMemo(
    () =>
      sortTableRows(overviewMenuItems, menuSortColumn, menuSortDirection, {
        item: row => row.name,
        orders: row => row.orders,
        revenue: row => row.revenue,
        margin: row => row.marginPercent,
      }),
    [overviewMenuItems, menuSortColumn, menuSortDirection],
  );
  const sortedOverviewOrders = useMemo(
    () =>
      sortTableRows(overviewOrders, ordersSortColumn, ordersSortDirection, {
        po: row => row.poNumber,
        vendor: row => row.vendorName,
        delivery: row => row.deliveryDate,
        value: row => row.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
        status: row => row.status,
      }),
    [overviewOrders, ordersSortColumn, ordersSortDirection],
  );

  const menuScrollRef = useRef<HTMLDivElement>(null);
  const ordersScrollRef = useRef<HTMLDivElement>(null);
  const menuScroll = useInfiniteScrollSlice(sortedOverviewMenuItems, { scrollRootRef: menuScrollRef });
  const ordersScroll = useInfiniteScrollSlice(sortedOverviewOrders, { scrollRootRef: ordersScrollRef });

  const isRevenueSection = activeNav === 'Revenue Management' || activeNav === 'Point-of-Sales';
  const isHrSection = activeNav === 'Human Resources';
  const isFullBleed = isRevenueSection || isHrSection;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar
        open={sidebarOpen}
        activeNav={activeNav}
        onClose={() => setSidebarOpen(false)}
        onNavigate={setActiveNav}
      />

      <div className="flex flex-col min-h-screen w-full min-w-0 overflow-x-hidden">
        <Header
          activeNav={activeNav}
          darkMode={darkMode}
          editLayout={editLayout}
          companies={companies}
          orgLoading={orgLoading}
          orgError={orgError}
          onRefreshOrg={refreshOrgFilters}
          selectedCompanyId={selectedCompanyId}
          locations={headerLocations}
          selectedLocationIds={selectedLocationIds}
          onCompanyChange={(companyId) => {
            setSelectedCompanyId(companyId);
            setSelectedLocationIds([]);
          }}
          onLocationChange={setSelectedLocationIds}
          onToggleSidebar={() => setSidebarOpen(v => !v)}
          onToggleDark={() => setDarkMode(v => !v)}
          onToggleEditLayout={() => setEditLayout(v => !v)}
        />

        <main className={`flex-1 flex flex-col min-h-0 w-full min-w-0 overflow-x-hidden ${isFullBleed ? '' : 'p-2 sm:p-3 space-y-3'}`}>
          {activeNav === 'Overview' ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                <MetricCard title="Sales Today" value={fmtUsd(totalSales)} deltaVal={delta(totalSales, totalSalesPrev)} icon={TrendingUp} accent />
                <MetricCard title="Covers Today" value={totalCovers.toLocaleString()} deltaVal={delta(totalCovers, totalCoversPrev)} icon={Users} />
                <MetricCard title="Avg Order Value" value={`$${aov.toFixed(2)}`} deltaVal={delta(aov, aovPrev)} icon={ShoppingBag} />
                <MetricCard title="Open POs" value={String(overviewOrders.length)} deltaVal={0} icon={Package} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
                <div className="lg:col-span-2 bg-card border border-border rounded-lg p-3">
                  <h2 className="text-sm font-semibold">Revenue Trend</h2>
                  <p className="text-xs text-muted-foreground mb-1">This week vs last week</p>
                  <RevenueChart data={overviewRevenue} />
                </div>
                <ProgressPanel progress={overviewProgress} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                <div className="bg-card border border-border rounded-lg overflow-hidden">
                  <div className="p-2 border-b border-border">
                    <h2 className="text-sm font-semibold">Menu Performance</h2>
                  </div>
                  <TableScrollContainer ref={menuScrollRef} className="max-h-[calc(100vh-12rem)] overflow-y-auto">
                  <table className="w-full table-fixed text-xs">
                    <thead>
                      <SortableTableHeaderRow
                        columns={MENU_TABLE_COLUMNS}
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
                      <InfiniteScrollTableSentinel colSpan={4} hasMore={menuScroll.hasMore} sentinelRef={menuScroll.sentinelRef} totalCount={menuScroll.totalCount} visibleCount={menuScroll.visibleCount} />
                    </tbody>
                  </table>
                  </TableScrollContainer>
                </div>

                <div className="bg-card border border-border rounded-lg overflow-hidden">
                  <div className="p-2 border-b border-border">
                    <h2 className="text-sm font-semibold">Inventory Alerts</h2>
                  </div>
                  <div className="divide-y divide-border">
                    {overviewAlerts.map(a => (
                      <div key={a.id} className="px-5 py-4 flex items-start gap-3">
                        <AlertTriangle size={13} className={`mt-0.5 ${a.status === 'critical' ? 'text-red-500' : 'text-primary'}`} />
                        <div className="flex-1">
                          <p className="text-xs font-medium">{a.itemName}</p>
                          <p className="text-xs text-muted-foreground">Stock: {a.stock} · Min: {a.threshold}</p>
                        </div>
                        <span className={`text-xs font-sans px-1.5 py-0.5 rounded ${a.status === 'critical' ? 'bg-red-500/15 text-red-500' : 'bg-primary/15 text-primary'}`}>{a.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="p-2 border-b border-border">
                  <h2 className="text-sm font-semibold">Active Purchase Orders</h2>
                </div>
                <TableScrollContainer ref={ordersScrollRef} className="max-h-[calc(100vh-12rem)] overflow-y-auto">
                <table className="w-full table-fixed text-xs">
                  <thead>
                    <SortableTableHeaderRow
                      columns={ORDERS_TABLE_COLUMNS}
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
                    <InfiniteScrollTableSentinel colSpan={5} hasMore={ordersScroll.hasMore} sentinelRef={ordersScroll.sentinelRef} totalCount={ordersScroll.totalCount} visibleCount={ordersScroll.visibleCount} />
                  </tbody>
                </table>
                </TableScrollContainer>
              </div>
            </>
          ) : isRevenueSection ? (
            <RevenueSection
              section={activeNav}
              selectedCompanyId={selectedCompanyId}
              selectedLocationIds={selectedLocationIds}
            />
          ) : activeNav === 'System Configuration' ? (
            <SystemConfigurationPage
              selectedCompanyId={selectedCompanyId}
              onOrgDataChanged={refreshOrgFilters}
            />
          ) : activeNav === 'Human Resources' ? (
            <HumanResourcesPage selectedCompanyId={selectedCompanyId} />
          ) : activeNav === 'Accounting' ? (
            <AccountingPage selectedCompanyId={selectedCompanyId} />
          ) : (
            <PlaceholderModule title={activeNav} />
          )}
        </main>
      </div>
    </div>
  );
}
