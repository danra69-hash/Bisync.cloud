import { useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useSearchParams } from 'react-router-dom';
import {
  api,
  clearTenant,
  getCompanyId,
  getLocationId,
  getToken,
  setCompanyId,
  setLocationId,
  setToken,
  type Membership,
  type ModuleId,
  type User,
} from './lib/api';
import { LoginPage } from './pages/LoginPage';
import { AppShell } from './components/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { MembersPage } from './pages/MembersPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { PromotionsPage } from './pages/PromotionsPage';
import { AppointmentsPage } from './pages/AppointmentsPage';
import { EquipmentPage } from './pages/EquipmentPage';
import { TrainingPage } from './pages/TrainingPage';
import { ProductsPage } from './pages/ProductsPage';
import { SystemConfigPage } from './pages/SystemConfigPage';
import { TeamPage } from './pages/TeamPage';

export type Surface = 'team' | 'admin';

const MODULE_ROUTES: { id: ModuleId; path: string; label: string; adminOnly?: boolean }[] = [
  { id: 'dashboard', path: '/app', label: 'Dashboard' },
  { id: 'members', path: '/app/members', label: 'Members' },
  { id: 'products', path: '/app/products', label: 'Product' },
  { id: 'system_config', path: '/app/system-config', label: 'System Config' },
  { id: 'payments', path: '/app/payments', label: 'Payments' },
  { id: 'promotions', path: '/app/promotions', label: 'Promotions' },
  { id: 'appointments', path: '/app/appointments', label: 'Appointments' },
  { id: 'equipment', path: '/app/equipment', label: 'Equipment' },
  { id: 'training', path: '/app/training', label: 'Training' },
  { id: 'team', path: '/app/team', label: 'Team', adminOnly: true },
];

function isCompanyWide(role: string, hint?: boolean) {
  if (typeof hint === 'boolean') return hint;
  return role === 'superuser' || role === 'management' || role === 'admin' || role === 'accounting';
}

const ROLE_MODULE_FALLBACK: Record<string, ModuleId[]> = {
  superuser: MODULE_ROUTES.map((m) => m.id),
  management: MODULE_ROUTES.map((m) => m.id),
  admin: MODULE_ROUTES.map((m) => m.id),
  accounting: ['dashboard', 'members', 'products', 'payments', 'promotions'],
  fitness_coach: ['dashboard', 'appointments', 'equipment', 'training', 'members'],
  sales: ['dashboard', 'members', 'products', 'promotions', 'appointments'],
};

function detectSurface(params: URLSearchParams): Surface {
  const q = params.get('surface');
  if (q === 'admin') return 'admin';
  if (q === 'team') return 'team';
  if (typeof window !== 'undefined' && (window as Window & { pulseDesktop?: boolean }).pulseDesktop) {
    return 'admin';
  }
  return 'team';
}

function applyTenantDefaults(
  memberships: Membership[],
  preferredCompany?: string | null,
  preferredLocation?: string | null,
) {
  const company =
    memberships.find((m) => m.companyId === preferredCompany) ||
    memberships.find((m) => m.companyId === getCompanyId()) ||
    memberships[0];
  if (!company) {
    clearTenant();
    return { companyId: null as string | null, locationId: null as string | null };
  }
  setCompanyId(company.companyId);
  const companyWide = isCompanyWide(company.role, company.companyWide);
  const storedLoc = preferredLocation ?? getLocationId();
  const locOk = company.locations.some((l) => l.id === storedLoc);
  if (locOk) {
    setLocationId(storedLoc);
    return { companyId: company.companyId, locationId: storedLoc };
  }
  if (companyWide) {
    setLocationId(null);
    return { companyId: company.companyId, locationId: null };
  }
  const first = company.locations[0]?.id || null;
  setLocationId(first);
  return { companyId: company.companyId, locationId: first };
}

export default function App() {
  const [params] = useSearchParams();
  const surface = useMemo(() => detectSurface(params), [params]);
  const [user, setUser] = useState<User | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [companyId, setCompanyIdState] = useState<string | null>(getCompanyId());
  const [locationId, setLocationIdState] = useState<string | null>(getLocationId());
  const [loading, setLoading] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api<{
      user: User;
      memberships: Membership[];
      defaultCompanyId?: string;
      defaultLocationId?: string | null;
    }>('/api/auth/me')
      .then((r) => {
        const list = r.memberships || r.user.memberships || [];
        setMemberships(list);
        const tenant = applyTenantDefaults(list, r.defaultCompanyId, r.defaultLocationId);
        setCompanyIdState(tenant.companyId);
        setLocationIdState(tenant.locationId);
        const membership = list.find((m) => m.companyId === tenant.companyId);
        setUser({
          ...r.user,
          role: membership?.role || r.user.role,
          roleLabel: membership ? membership.role.replace(/_/g, ' ') : r.user.roleLabel,
          modules: r.user.modules,
        });
      })
      .catch(() => {
        setToken(null);
        clearTenant();
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const nodes = document.querySelectorAll('.reveal');
    if (!nodes.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) e.target.classList.add('is-in');
        }
      },
      { threshold: 0.12 },
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [user, loading, companyId, locationId]);

  async function login(email: string, password: string) {
    setBootError(null);
    const res = await api<{
      token: string;
      user: User;
      memberships: Membership[];
      defaultCompanyId: string;
      defaultLocationId: string | null;
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    const list = res.memberships || [];
    const membership = list.find((m) => m.companyId === res.defaultCompanyId) || list[0];
    const role = membership?.role || res.user.role;
    if (surface === 'admin' && role !== 'admin' && role !== 'management' && role !== 'superuser') {
      throw new Error('Admin desktop requires Admin, Management, or Superuser role');
    }
    setToken(res.token);
    setMemberships(list);
    const tenant = applyTenantDefaults(list, res.defaultCompanyId, res.defaultLocationId);
    setCompanyIdState(tenant.companyId);
    setLocationIdState(tenant.locationId);
    setUser({
      ...res.user,
      role,
      memberships: list,
    });
  }

  async function logout() {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch {
      /* ignore */
    }
    setToken(null);
    clearTenant();
    setUser(null);
    setMemberships([]);
    setCompanyIdState(null);
    setLocationIdState(null);
  }

  function handleCompanyChange(nextCompanyId: string) {
    const membership = memberships.find((m) => m.companyId === nextCompanyId);
    if (!membership || !user) return;
    setCompanyId(nextCompanyId);
    setCompanyIdState(nextCompanyId);
    const companyWide = isCompanyWide(membership.role, membership.companyWide);
    const nextLoc = companyWide ? null : membership.locations[0]?.id || null;
    setLocationId(nextLoc);
    setLocationIdState(nextLoc);
    setUser({
      ...user,
      role: membership.role,
      roleLabel: membership.roleLabel || membership.role.replace(/_/g, ' '),
      modules: membership.modules || ROLE_MODULE_FALLBACK[membership.role] || user.modules,
    });
  }

  function handleLocationChange(nextLocationId: string | null) {
    setLocationId(nextLocationId);
    setLocationIdState(nextLocationId);
  }

  if (loading) {
    return (
      <div className="login-page" style={{ placeItems: 'center', display: 'grid' }}>
        <p className="mono muted">Loading Pulse…</p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage surface={surface} onLogin={login} error={bootError} setError={setBootError} />;
  }

  const activeMembership = memberships.find((m) => m.companyId === companyId);
  const effectiveRole = activeMembership?.role || user.role;
  const modules = user.modules?.length
    ? user.modules
    : activeMembership?.modules?.length
      ? activeMembership.modules
      : ROLE_MODULE_FALLBACK[effectiveRole] || [];

  const nav = MODULE_ROUTES.filter((m) => {
    if (!modules.includes(m.id)) return false;
    if (surface === 'admin') return true;
    if (
      m.adminOnly &&
      !modules.includes('team') &&
      effectiveRole !== 'management' &&
      effectiveRole !== 'admin' &&
      effectiveRole !== 'superuser'
    ) {
      return false;
    }
    return true;
  });

  return (
    <Routes>
      <Route
        path="/app/*"
        element={
          <AppShell
            user={{ ...user, role: effectiveRole }}
            surface={surface}
            nav={nav}
            memberships={memberships}
            companyId={companyId}
            locationId={locationId}
            onCompanyChange={handleCompanyChange}
            onLocationChange={handleLocationChange}
            onLogout={logout}
          >
            <Routes>
              <Route index element={<DashboardPage />} />
              <Route path="members" element={<MembersPage />} />
              <Route path="payments" element={<PaymentsPage />} />
              <Route path="invoices" element={<Navigate to="/app/payments" replace />} />
              <Route path="promotions" element={<PromotionsPage />} />
              <Route path="appointments" element={<AppointmentsPage />} />
              <Route path="equipment" element={<EquipmentPage />} />
              <Route path="training" element={<TrainingPage />} />
              <Route path="products" element={<ProductsPage />} />
              <Route path="system-config" element={<SystemConfigPage />} />
              <Route path="team" element={<TeamPage />} />
              <Route path="*" element={<Navigate to="/app" replace />} />
            </Routes>
          </AppShell>
        }
      />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}
