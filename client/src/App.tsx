import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, Ghost } from 'lucide-react';
import {
  api,
  setApiTenantCompanyId,
  type B2bSalesOrder,
  type MenuItem,
  type PurchaseOrder,
  type InventoryAlert,
  type RevenuePoint,
  type ProgressData,
} from './api';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { StickyChromeSync } from './components/layout/StickyChromeSync';
import { RevenueSection } from './components/revenue/RevenueSection';
import { OverviewDashboard } from './components/overview/OverviewDashboard';
import { SystemConfigurationPage } from './components/admin/SystemConfigurationPage';
import { HumanResourcesPage } from './components/hr/HumanResourcesPage';
import { AccountingPage } from './components/accounting/AccountingPage';
import {
  aggregateDashboardMetrics,
  filterPurchaseOrdersForOrg,
} from './utils/locationMetrics';
import { resolveDashboardActivityMode } from './data/companyProfile';
import type { CreateOrderPrefillItem } from './data/createOrderPrefill';
import { configLocationToDropdown, filterMetricsByOrg } from './utils/orgFilters';
import { useOrgFilters } from './hooks/useOrgFilters';
import { OrgCountryProvider } from './context/OrgCountryContext';
import { isNavItemEnabled, moduleForNavItem, resolveOrgEnabledModules } from './data/companyModules';
import {
  filterAccessModulesByPlatformGoLive,
  isNavItemPlatformLive,
  type ModulesGoLiveMap,
} from './data/platformGoLiveModules';
import type { NavItem } from './data/revenueManagement';
import { useAppTranslation } from './i18n/useAppTranslation';
import { NAV_ITEM_I18N } from './i18n/navKeys';
import {
  clearGhostSupportSession,
  getGhostSupportSession,
  type GhostSupportSession,
} from './data/ghostSupportSession';

function PlaceholderModule({ title }: { title: NavItem | string }) {
  const { t, navLabel } = useAppTranslation();
  const displayTitle = typeof title === 'string' && title in NAV_ITEM_I18N
    ? navLabel(title as NavItem)
    : String(title);

  return (
    <div className="p-2 sm:p-3 w-full min-w-0">
      <div className="bg-card border border-border rounded-lg flex flex-col items-center justify-center text-center gap-3 p-12">
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
          <FileText size={18} className="text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">{displayTitle}</p>
        <p className="text-xs text-muted-foreground font-sans max-w-xs capitalize">{t('common.comingSoon')}</p>
      </div>
    </div>
  );
}

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [editLayout, setEditLayout] = useState(false);
  const [activeNav, setActiveNav] = useState<NavItem>('Overview');
  const [ghostSession, setGhostSession] = useState<GhostSupportSession | null>(() => getGhostSupportSession());
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(() => getGhostSupportSession()?.companyId ?? null);
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>(() => {
    const ghost = getGhostSupportSession();
    return ghost?.locationExternalId ? [ghost.locationExternalId] : [];
  });
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
  const [allPurchaseOrders, setAllPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [clientOrders, setClientOrders] = useState<B2bSalesOrder[]>([]);
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [revenue, setRevenue] = useState<RevenuePoint[]>([]);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [modulesGoLive, setModulesGoLive] = useState<ModulesGoLiveMap | null>(null);
  const [revenueIntent, setRevenueIntent] = useState<{
    revItem: string;
    createOrderPrefill?: CreateOrderPrefillItem[];
  } | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    async function load() {
      const results = await Promise.allSettled([
        api.menu(),
        api.inventoryAlerts(),
        api.revenue(),
        api.progress(),
        api.registrationPolicy(),
      ]);

      if (results[0].status === 'fulfilled') setMenuItems(results[0].value);
      if (results[1].status === 'fulfilled') setAlerts(results[1].value);
      if (results[2].status === 'fulfilled') setRevenue(results[2].value);
      if (results[3].status === 'fulfilled') setProgress(results[3].value);
      if (results[4].status === 'fulfilled') {
        setModulesGoLive(results[4].value.modulesGoLive ?? null);
      } else {
        setModulesGoLive(null);
      }
    }
    load();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadCompanyOrders() {
      if (!selectedCompanyId) {
        setOrders([]);
        setAllPurchaseOrders([]);
        setClientOrders([]);
        return;
      }
      const results = await Promise.allSettled([
        api.activePurchaseOrders(selectedCompanyId),
        api.purchaseOrders(),
        api.b2bSalesOrders(selectedCompanyId),
      ]);
      if (cancelled) return;
      if (results[0].status === 'fulfilled') setOrders(results[0].value);
      else setOrders([]);
      if (results[1].status === 'fulfilled') setAllPurchaseOrders(results[1].value);
      else setAllPurchaseOrders([]);
      if (results[2].status === 'fulfilled') {
        setClientOrders(
          results[2].value.filter(o =>
            o.status === 'draft' || o.status === 'issued' || o.status === 'confirmed',
          ),
        );
      } else {
        setClientOrders([]);
      }
    }
    void loadCompanyOrders();
    return () => { cancelled = true; };
  }, [selectedCompanyId]);

  useEffect(() => {
    if (ghostSession) {
      setApiTenantCompanyId(ghostSession.companyId);
    }
  }, [ghostSession]);

  useEffect(() => {
    if (!selectedCompanyId || companies.length === 0) return;
    if (!companies.some(c => c.id === selectedCompanyId)) {
      setSelectedCompanyId(null);
      setSelectedLocationIds([]);
    }
  }, [companies, selectedCompanyId]);

  useEffect(() => {
    if (!selectedCompanyId) return;
    const forCompany = configLocations.filter(l => l.companyId === selectedCompanyId);
    if (forCompany.length === 0) return;
    const allowed = new Set(forCompany.map(l => l.externalId));
    setSelectedLocationIds(prev => {
      const next = prev.filter(id => allowed.has(id));
      // Keep ghost location if still valid; avoid clearing to empty while org loads.
      return next;
    });
  }, [configLocations, selectedCompanyId]);

  function exitGhostSupport() {
    const returnPath = ghostSession?.returnPath || '/dev/console';
    clearGhostSupportSession();
    setGhostSession(null);
    window.location.assign(returnPath);
  }

  const companyScopedConfigLocations = selectedCompanyId
    ? configLocations.filter(l => l.companyId === selectedCompanyId)
    : [];
  const selectedCompany = companies.find(company => company.id === selectedCompanyId) ?? null;
  const orgCountryCode = selectedCompany?.countryCode ?? 'MY';
  const enabledModules = useMemo(
    () => filterAccessModulesByPlatformGoLive(
      resolveOrgEnabledModules(selectedCompany, configLocations, selectedCompanyId, selectedLocationIds),
      modulesGoLive,
    ),
    [selectedCompany, configLocations, selectedCompanyId, selectedLocationIds, modulesGoLive],
  );

  function handleNavigate(item: NavItem) {
    if (!isNavItemPlatformLive(item, modulesGoLive)) return;
    if (!isNavItemEnabled(item, enabledModules)) return;
    setActiveNav(item);
  }

  useEffect(() => {
    if (!isNavItemPlatformLive(activeNav, modulesGoLive)) {
      setActiveNav('Overview');
      return;
    }
    if (moduleForNavItem(activeNav) && !isNavItemEnabled(activeNav, enabledModules)) {
      setActiveNav('Overview');
    }
  }, [activeNav, enabledModules, modulesGoLive]);
  const headerLocations = companyScopedConfigLocations.map(configLocationToDropdown);
  const activeLocations = selectedCompanyId
    ? filterMetricsByOrg(metricsLocations, configLocations, selectedCompanyId, selectedLocationIds)
    : [];
  const activityMode = useMemo(
    () => resolveDashboardActivityMode(selectedCompany, configLocations, selectedLocationIds),
    [selectedCompany, configLocations, selectedLocationIds],
  );
  const scopedPurchaseOrders = useMemo(
    () => filterPurchaseOrdersForOrg(allPurchaseOrders, selectedCompanyId, selectedLocationIds),
    [allPurchaseOrders, selectedCompanyId, selectedLocationIds],
  );
  const overviewOrders = useMemo(
    () => filterPurchaseOrdersForOrg(orders, selectedCompanyId, selectedLocationIds),
    [orders, selectedCompanyId, selectedLocationIds],
  );
  const overviewClientOrders = useMemo(() => {
    if (!selectedCompanyId) return [];
    if (selectedLocationIds.length === 0) return clientOrders;
    return clientOrders.filter(order =>
      (order.lines ?? []).some(line => selectedLocationIds.includes(line.locationExternalId))
      || (order.lines ?? []).length === 0,
    );
  }, [clientOrders, selectedCompanyId, selectedLocationIds]);
  const dashboardMetrics = useMemo(
    () => aggregateDashboardMetrics(activeLocations, scopedPurchaseOrders, activityMode),
    [activeLocations, scopedPurchaseOrders, activityMode],
  );
  const overviewMenuItems = selectedCompanyId ? menuItems : [];
  const overviewAlerts = selectedCompanyId ? alerts : [];
  const overviewRevenue = selectedCompanyId ? revenue : [];
  const overviewProgress = selectedCompanyId ? progress : null;

  const handleOrderNowFromAlerts = useCallback(async () => {
    if (!selectedCompanyId || overviewAlerts.length === 0) return;
    let prefill: CreateOrderPrefillItem[] = overviewAlerts.map(alert => ({
      name: alert.itemName,
    }));
    try {
      const ingredients = await api.ingredients();
      const byName = new Map(
        ingredients.map(ing => [ing.name.trim().replace(/\s+/g, ' ').toLowerCase(), ing]),
      );
      prefill = overviewAlerts.map(alert => {
        const key = alert.itemName.trim().replace(/\s+/g, ' ').toLowerCase();
        const match = byName.get(key);
        return {
          componentId: match?.componentId || undefined,
          name: alert.itemName,
        };
      });
    } catch {
      // Name-only prefill still applied in Create Order.
    }
    setRevenueIntent({
      revItem: 'Operation||Order||My Order',
      createOrderPrefill: prefill,
    });
    setActiveNav('Revenue Management');
  }, [overviewAlerts, selectedCompanyId]);

  const clearRevenueIntent = useCallback(() => setRevenueIntent(null), []);

  const isRevenueSection = activeNav === 'Revenue Management' || activeNav === 'Point-of-Sales';
  const isHrSection = activeNav === 'Human Resources';
  const isFullBleed = isRevenueSection || isHrSection;

  return (
    <div className="h-dvh max-h-dvh flex flex-col overflow-hidden bg-background text-foreground">
      {ghostSession && (
        <div className="shrink-0 z-40 px-3 py-2 flex flex-wrap items-center justify-between gap-2 bg-amber-500 text-amber-950 text-xs">
          <div className="inline-flex items-center gap-2 min-w-0">
            <Ghost size={14} className="shrink-0" />
            <span className="font-semibold">Ghost Support</span>
            <span className="truncate">
              {ghostSession.companyName} · {ghostSession.locationName}
              {ghostSession.actorEmail ? ` · ${ghostSession.actorEmail}` : ''}
            </span>
            <span className="hidden sm:inline opacity-80">· viewing as Super User</span>
          </div>
          <button
            type="button"
            onClick={exitGhostSupport}
            className="shrink-0 rounded-md border border-amber-900/30 bg-amber-100/80 px-2.5 py-1 font-medium hover:bg-amber-100"
          >
            Exit Ghost Support
          </button>
        </div>
      )}
      <Sidebar
        open={sidebarOpen}
        activeNav={activeNav}
        enabledModules={enabledModules}
        modulesGoLive={modulesGoLive}
        onClose={() => setSidebarOpen(false)}
        onNavigate={handleNavigate}
      />

      <div className="flex flex-col flex-1 min-h-0 w-full min-w-0 overflow-hidden">
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
            setApiTenantCompanyId(companyId);
          }}
          onLocationChange={setSelectedLocationIds}
          onToggleSidebar={() => setSidebarOpen(v => !v)}
          onToggleDark={() => setDarkMode(v => !v)}
          onToggleEditLayout={() => setEditLayout(v => !v)}
        />

        <OrgCountryProvider countryCode={orgCountryCode}>
        <StickyChromeSync />
        <main
          data-app-main
          className={`flex-1 flex flex-col min-h-0 w-full min-w-0 overflow-x-hidden overflow-y-auto ${isFullBleed ? '' : 'p-2 sm:p-3 space-y-3'}`}
        >
          {activeNav === 'Overview' ? (
            <OverviewDashboard
              editLayout={editLayout}
              menuItems={overviewMenuItems}
              alerts={overviewAlerts}
              orders={overviewOrders}
              clientOrders={overviewClientOrders}
              revenue={overviewRevenue}
              progress={overviewProgress}
              sales={dashboardMetrics.sales}
              activity={dashboardMetrics.activity}
              aov={dashboardMetrics.aov}
              activityMode={dashboardMetrics.activityMode}
              onOrderNowFromAlerts={handleOrderNowFromAlerts}
            />
          ) : isRevenueSection ? (
            <RevenueSection
              section={activeNav}
              selectedCompanyId={selectedCompanyId}
              selectedLocationIds={selectedLocationIds}
              initialRevItem={revenueIntent?.revItem ?? null}
              createOrderPrefill={revenueIntent?.createOrderPrefill}
              onRevenueIntentConsumed={clearRevenueIntent}
            />
          ) : activeNav === 'System Configuration' ? (
            <SystemConfigurationPage
              selectedCompanyId={selectedCompanyId}
              selectedLocationIds={selectedLocationIds}
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
        </OrgCountryProvider>
      </div>
    </div>
  );
}
