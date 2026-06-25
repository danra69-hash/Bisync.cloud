import { useEffect, useState } from 'react';
import {
  TrendingUp, Users, ShoppingBag, AlertTriangle, MapPin,
  Menu, X, Moon, Sun, Bell, ArrowUpRight, ArrowDownRight,
  ExternalLink, CheckCircle2, Package
} from 'lucide-react';
import { api, type Location, type MenuItem, type PurchaseOrder, type InventoryAlert, type RevenuePoint, type ProgressData } from './api';

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

function ProgressPanel({ progress }: { progress: ProgressData | null }) {
  if (!progress) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold">Development Progress</h2>
          <p className="text-xs text-muted-foreground">Auto-tracked from Bisync.cloud API</p>
        </div>
        <span className="text-2xl font-bold text-primary">{progress.overallPercent}%</span>
      </div>
      <div className="w-full bg-muted rounded-full h-2 mb-4">
        <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${progress.overallPercent}%` }} />
      </div>
      <div className="space-y-4">
        {progress.milestones.map(phase => (
          <div key={phase.phase}>
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">{phase.phase}</p>
            <div className="space-y-2">
              {phase.items.map(item => (
                <div key={item.id} className="flex items-center gap-3 text-xs">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${
                    item.status === 'completed' ? 'bg-[#5A7A2A]' :
                    item.status === 'in_progress' ? 'bg-primary' : 'bg-muted-foreground/40'
                  }`} />
                  <span className="flex-1">{item.title}</span>
                  <span className="font-mono text-muted-foreground">{item.progressPercent}%</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [activeNav, setActiveNav] = useState('Overview');
  const [apiStatus, setApiStatus] = useState<'loading' | 'ok' | 'error'>('loading');

  const [locations, setLocations] = useState<Location[]>([]);
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
      try {
        await api.health();
        const [locs, menu, pos, inv, rev, prog] = await Promise.all([
          api.locations(), api.menu(), api.purchaseOrders(),
          api.inventoryAlerts(), api.revenue(), api.progress(),
        ]);
        setLocations(locs);
        setMenuItems(menu);
        setOrders(pos);
        setAlerts(inv);
        setRevenue(rev);
        setProgress(prog);
        setApiStatus('ok');
      } catch {
        setApiStatus('error');
      }
    }
    load();
  }, []);

  const totalSales = locations.reduce((s, l) => s + l.salesToday, 0);
  const totalSalesPrev = locations.reduce((s, l) => s + Math.round(l.salesToday * 0.92), 0);
  const totalCovers = locations.reduce((s, l) => s + l.coversToday, 0);
  const totalCoversPrev = locations.reduce((s, l) => s + Math.round(l.coversToday * 0.95), 0);
  const aov = totalCovers > 0 ? totalSales / totalCovers : 0;

  const navItems = ['Overview', 'Revenue Management', 'Point-of-Sales', 'Development'];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {sidebarOpen && <div className="fixed inset-0 z-40" onClick={() => setSidebarOpen(false)} />}
      <aside className={`fixed top-0 left-0 h-full w-56 z-50 transition-transform duration-200 flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: '#2C1A0A' }}>
        <div className="px-5 py-4 flex items-center justify-between border-b border-white/10">
          <span className="text-white font-bold text-sm">Bisync.cloud</span>
          <button onClick={() => setSidebarOpen(false)} className="p-1 rounded hover:bg-white/10"><X size={14} className="text-white/60" /></button>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map(item => (
            <button key={item} onClick={() => { setActiveNav(item); setSidebarOpen(false); }}
              className="w-full text-left px-3 py-2 rounded-md text-sm transition-colors"
              style={{
                background: activeNav === item ? '#E87722' : 'transparent',
                color: activeNav === item ? '#2C1A0A' : 'rgba(255,255,255,0.6)',
                fontWeight: activeNav === item ? 700 : 500,
              }}>
              {item}
            </button>
          ))}
        </nav>
      </aside>

      <div className="flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 px-4 py-3 flex items-center gap-3" style={{ background: '#2C1A0A' }}>
          <button onClick={() => setSidebarOpen(v => !v)} className="p-2 rounded-md hover:bg-white/10">
            <Menu size={16} className="text-white" />
          </button>
          <div>
            <h1 className="text-sm font-bold text-white">{activeNav === 'Overview' ? 'Operations Overview' : activeNav}</h1>
            <p className="text-[10px] text-white/45">Imported from Figma Make · Connected to C# API</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className={`text-[10px] font-mono px-2 py-1 rounded ${apiStatus === 'ok' ? 'bg-[#5A7A2A]/20 text-[#5A7A2A]' : apiStatus === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white/60'}`}>
              API {apiStatus}
            </span>
            <button onClick={() => setDarkMode(v => !v)} className="p-2 rounded-md hover:bg-white/10">
              {darkMode ? <Sun size={15} className="text-primary" /> : <Moon size={15} className="text-white/70" />}
            </button>
            <button className="relative p-2 rounded-md hover:bg-white/10">
              <Bell size={14} className="text-white/70" />
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-primary" />
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 space-y-6">
          {activeNav === 'Development' ? (
            <ProgressPanel progress={progress} />
          ) : activeNav === 'Overview' ? (
            <>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin size={12} className="text-primary" />
                {locations.length} locations · Live data from SQLite
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard title="Sales Today" value={fmtUsd(totalSales)} deltaVal={delta(totalSales, totalSalesPrev)} icon={TrendingUp} accent />
                <MetricCard title="Covers Today" value={totalCovers.toLocaleString()} deltaVal={delta(totalCovers, totalCoversPrev)} icon={Users} />
                <MetricCard title="Avg Order Value" value={`$${aov.toFixed(2)}`} deltaVal={3.2} icon={ShoppingBag} />
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
          ) : (
            <div className="bg-card border border-border rounded-lg flex flex-col items-center justify-center p-12 text-center gap-3">
              <CheckCircle2 size={24} className="text-primary" />
              <p className="text-sm font-medium">{activeNav}</p>
              <p className="text-xs text-muted-foreground max-w-sm">
                Module scaffolded from Figma design. Backend API endpoints are ready — connect UI components from the full Figma Make export.
              </p>
              <a href="https://www.figma.com/make/QgoQ4Z3lguzeuUlJU7ycoe/Bisync.cloud" target="_blank" rel="noreferrer"
                className="flex items-center gap-1 text-xs text-primary hover:underline">
                View Figma design <ExternalLink size={10} />
              </a>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
