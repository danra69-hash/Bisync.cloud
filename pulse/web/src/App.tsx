import { useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useSearchParams } from 'react-router-dom';
import { api, getToken, setToken, type ModuleId, type User } from './lib/api';
import { LoginPage } from './pages/LoginPage';
import { AppShell } from './components/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { MembersPage } from './pages/MembersPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { PromotionsPage } from './pages/PromotionsPage';
import { AppointmentsPage } from './pages/AppointmentsPage';
import { EquipmentPage } from './pages/EquipmentPage';
import { TrainingPage } from './pages/TrainingPage';
import { TeamPage } from './pages/TeamPage';

export type Surface = 'team' | 'admin';

const MODULE_ROUTES: { id: ModuleId; path: string; label: string; adminOnly?: boolean }[] = [
  { id: 'dashboard', path: '/app', label: 'Dashboard' },
  { id: 'members', path: '/app/members', label: 'Members' },
  { id: 'payments', path: '/app/payments', label: 'Payments' },
  { id: 'invoices', path: '/app/invoices', label: 'Invoices' },
  { id: 'promotions', path: '/app/promotions', label: 'Promotions' },
  { id: 'appointments', path: '/app/appointments', label: 'Appointments' },
  { id: 'equipment', path: '/app/equipment', label: 'Equipment' },
  { id: 'training', path: '/app/training', label: 'Training' },
  { id: 'team', path: '/app/team', label: 'Team', adminOnly: true },
];

function detectSurface(params: URLSearchParams): Surface {
  const q = params.get('surface');
  if (q === 'admin') return 'admin';
  if (q === 'team') return 'team';
  if (typeof window !== 'undefined' && (window as Window & { pulseDesktop?: boolean }).pulseDesktop) {
    return 'admin';
  }
  return 'team';
}

export default function App() {
  const [params] = useSearchParams();
  const surface = useMemo(() => detectSurface(params), [params]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api<{ user: User }>('/api/auth/me')
      .then((r) => setUser(r.user))
      .catch(() => setToken(null))
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
  }, [user, loading]);

  async function login(email: string, password: string) {
    setBootError(null);
    const res = await api<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (surface === 'admin' && res.user.role !== 'admin' && res.user.role !== 'management') {
      throw new Error('Admin desktop requires Admin or Management role');
    }
    setToken(res.token);
    setUser(res.user);
  }

  async function logout() {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch {
      /* ignore */
    }
    setToken(null);
    setUser(null);
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

  const nav = MODULE_ROUTES.filter((m) => {
    if (!user.modules.includes(m.id)) return false;
    if (surface === 'admin') return true;
    // Team web: hide admin-heavy team directory unless management
    if (m.adminOnly && user.role !== 'management' && user.role !== 'admin') return false;
    return true;
  });

  return (
    <Routes>
      <Route
        path="/app/*"
        element={
          <AppShell user={user} surface={surface} nav={nav} onLogout={logout}>
            <Routes>
              <Route index element={<DashboardPage />} />
              <Route path="members" element={<MembersPage />} />
              <Route path="payments" element={<PaymentsPage />} />
              <Route path="invoices" element={<InvoicesPage />} />
              <Route path="promotions" element={<PromotionsPage />} />
              <Route path="appointments" element={<AppointmentsPage />} />
              <Route path="equipment" element={<EquipmentPage />} />
              <Route path="training" element={<TrainingPage />} />
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
