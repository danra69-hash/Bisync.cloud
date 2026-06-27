import { useEffect, useState } from 'react';
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

function MetricCard({ title, value, deltaVal, icon: Icon, accent }: {
  title: string; value: string; deltaVal: number; icon: React.ElementType; accent?: boolean;
}) {
  const up = deltaVal >= 0;
  return (
    <div className={`rounded-lg p-5 border border-border flex flex-col gap-3 ${accent ? 'bg-primary/10' : 'bg-card'}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono tracking-widest text-muted-foreground uppercase">{title}</span>
        <div className={`p-2 rounded-md ${accent ? 'bg-primary/20' : 'bg-muted'}`}>
          <Icon size={14} className={accent ? 'text-primary' : 'text-muted-foreground'} />
        </div>
      </div>
      <p className="text-3xl font-semibold">{value}</p>
      <div className={`flex items-center gap-1 text-xs font-mono ${up ? 'text-[#5A7A2A]' : 'text-accent'}`}>
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
          <span className="text-[10px] text-muted-foreground">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function PlaceholderModule({ title }: { title: string }) {
  return (
    <div className="p-6">
      <div className="bg-card border border-border rounded-lg flex flex-col items-center justify-center text-center gap-3 p-12">
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
          <FileText size={18} className="text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground font-mono max-w-xs">This module is ready to be configured.</p>
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
  const activeLocations = filterMetricsByOrg(metricsLocations, configLocations, selectedCompanyId, selectedLocationIds);
  const { totalSales, totalSalesPrev, totalCovers, totalCoversPrev, aov, aovPrev } = aggregateLocationMetrics(activeLocations);

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

      <div className="flex flex-col min-h-screen">
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

        <main className={`flex-1 flex flex-col min-h-0 ${isFullBleed ? '' : 'p-6 space-y-6'}`}>
          {activeNav === 'Overview' ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard title="Sales Today" value={fmtUsd(totalSales)} deltaVal={delta(totalSales, totalSalesPrev)} icon={TrendingUp} accent />
                <MetricCard title="Covers Today" value={totalCovers.toLocaleString()} deltaVal={delta(totalCovers, totalCoversPrev)} icon={Users} />
                <MetricCard title="Avg Order Value" value={`$${aov.toFixed(2)}`} deltaVal={delta(aov, aovPrev)} icon={ShoppingBag} />
                <MetricCard title="Open POs" value={String(orders.length)} deltaVal={0} icon={Package} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 bg-card border border-border rounded-lg p-5">
                  <h2 className="text-sm font-semibold">Revenue Trend</h2>
                  <p className="text-xs text-muted-foreground mb-2">This week vs last week</p>
                  <RevenueChart data={revenue} />
                </div>
                <ProgressPanel progress={progress} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-card border border-border rounded-lg overflow-hidden">
                  <div className="p-5 border-b border-border">
                    <h2 className="text-sm font-semibold">Menu Performance</h2>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        {['Item', 'Orders', 'Revenue', 'Margin'].map(h => (
                          <th key={h} className="text-left px-4 py-2 text-muted-foreground font-normal uppercase text-[10px]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {menuItems.map(m => (
                        <tr key={m.id} className="border-b border-border last:border-0">
                          <td className="px-4 py-3 font-medium">{m.name}</td>
                          <td className="px-4 py-3 font-mono text-muted-foreground">{m.orders}</td>
                          <td className="px-4 py-3 font-mono">${m.revenue.toLocaleString()}</td>
                          <td className="px-4 py-3 font-mono">{m.marginPercent}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bg-card border border-border rounded-lg overflow-hidden">
                  <div className="p-5 border-b border-border">
                    <h2 className="text-sm font-semibold">Inventory Alerts</h2>
                  </div>
                  <div className="divide-y divide-border">
                    {alerts.map(a => (
                      <div key={a.id} className="px-5 py-4 flex items-start gap-3">
                        <AlertTriangle size={13} className={`mt-0.5 ${a.status === 'critical' ? 'text-red-500' : 'text-primary'}`} />
                        <div className="flex-1">
                          <p className="text-xs font-medium">{a.itemName}</p>
                          <p className="text-[10px] text-muted-foreground">Stock: {a.stock} · Min: {a.threshold}</p>
                        </div>
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${a.status === 'critical' ? 'bg-red-500/15 text-red-500' : 'bg-primary/15 text-primary'}`}>{a.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="p-5 border-b border-border">
                  <h2 className="text-sm font-semibold">Active Purchase Orders</h2>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      {['PO', 'Vendor', 'Delivery', 'Value', 'Status'].map(h => (
                        <th key={h} className="text-left px-4 py-2 text-muted-foreground font-normal uppercase text-[10px]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(o => {
                      const value = o.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
                      return (
                        <tr key={o.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3 font-mono text-primary">{o.poNumber}</td>
                          <td className="px-4 py-3">{o.vendorName}</td>
                          <td className="px-4 py-3 font-mono text-muted-foreground">{o.deliveryDate}</td>
                          <td className="px-4 py-3 font-mono">${value.toFixed(2)}</td>
                          <td className="px-4 py-3">
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/15 text-primary">{o.status}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : isRevenueSection ? (
            <RevenueSection section={activeNav} />
          ) : activeNav === 'System Configuration' ? (
            <SystemConfigurationPage onOrgDataChanged={refreshOrgFilters} />
          ) : activeNav === 'Human Resources' ? (
            <HumanResourcesPage selectedCompanyId={selectedCompanyId} />
          ) : activeNav === 'Accounting' ? (
            <AccountingPage />
          ) : (
            <PlaceholderModule title={activeNav} />
          )}
        </main>
      </div>
    </div>
  );
}
