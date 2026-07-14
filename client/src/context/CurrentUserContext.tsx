import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api, type AppUser } from '../api';
import { REQUIRE_PLATFORM_LOGIN } from '../config/platformAuth';
import { clearUserActivity, markUserActivity, useIdleLogout } from '../hooks/useIdleLogout';
import { clearAllOnboardingFlags } from '../data/onboardingFlags';
import {
  CurrentUserContext,
  DEMO_PASSWORD,
} from './currentUserContext';
import { isAppLocale } from '../i18n/languages';
import { setAppLocale } from '../i18n';

const STORAGE_KEY = 'bisync.currentUserId';
const AUTH_KEY = 'bisync.authenticated';

export { DEMO_PASSWORD };

function resolveDefaultUserId(users: AppUser[]): number | null {
  const active = users.filter(user => user.active);
  const storedRaw = localStorage.getItem(STORAGE_KEY);
  const storedId = storedRaw ? Number(storedRaw) : null;
  if (storedId && active.some(user => user.id === storedId)) return storedId;

  const superAdmin = active.find(user => user.email.toLowerCase() === 'dra@cubevalue.com');
  if (superAdmin) return superAdmin.id;

  const james = active.find(user => user.fullName === 'James Dubois');
  return james?.id ?? active[0]?.id ?? null;
}

function upsertUser(list: AppUser[], user: AppUser): AppUser[] {
  const next = list.filter(u => u.id !== user.id);
  return [...next, user];
}

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [currentUserId, setCurrentUserIdState] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => !REQUIRE_PLATFORM_LOGIN || localStorage.getItem(AUTH_KEY) === 'true',
  );

  useEffect(() => {
    api.users()
      .then(list => {
        const active = list.filter(user => user.active);
        setUsers(active);

        const authenticated = !REQUIRE_PLATFORM_LOGIN || localStorage.getItem(AUTH_KEY) === 'true';
        if (!authenticated) {
          setIsAuthenticated(false);
          setCurrentUserIdState(null);
          return;
        }

        const defaultId = resolveDefaultUserId(active);
        if (defaultId) {
          setCurrentUserIdState(defaultId);
          localStorage.setItem(STORAGE_KEY, String(defaultId));
          if (!REQUIRE_PLATFORM_LOGIN) localStorage.setItem(AUTH_KEY, 'true');
          setIsAuthenticated(true);
          markUserActivity();
        } else {
          localStorage.removeItem(AUTH_KEY);
          setIsAuthenticated(false);
          setCurrentUserIdState(null);
        }
      })
      .catch(() => {
        setUsers([]);
        setCurrentUserIdState(null);
        setIsAuthenticated(false);
      })
      .finally(() => setLoading(false));
  }, []);

  const setCurrentUserId = (id: number) => {
    setCurrentUserIdState(id);
    localStorage.setItem(STORAGE_KEY, String(id));
  };

  const login = useCallback(async (email: string, password: string) => {
    const user = await api.login(email, password);
    if (!user.active) throw new Error('Invalid email or password.');

    setUsers(prev => upsertUser(prev, user));
    localStorage.setItem(AUTH_KEY, 'true');
    localStorage.setItem(STORAGE_KEY, String(user.id));
    markUserActivity();
    setCurrentUserIdState(user.id);
    setIsAuthenticated(true);
    if (isAppLocale(user.preferredLanguage)) {
      void setAppLocale(user.preferredLanguage);
    }
  }, []);

  const applyAuthenticatedUser = useCallback((user: AppUser) => {
    const normalized: AppUser = {
      ...user,
      id: Number(user.id),
      companyId: user.companyId == null ? null : Number(user.companyId),
      locationIds: Array.isArray(user.locationIds) ? user.locationIds : [],
      locationIdsJson: user.locationIdsJson ?? '[]',
      accessJson: user.accessJson ?? '{"modules":[]}',
    };
    setUsers(prev => upsertUser(prev, normalized));
    localStorage.setItem(AUTH_KEY, 'true');
    localStorage.setItem(STORAGE_KEY, String(normalized.id));
    markUserActivity();
    setCurrentUserIdState(normalized.id);
    setIsAuthenticated(true);
    if (isAppLocale(normalized.preferredLanguage)) {
      void setAppLocale(normalized.preferredLanguage);
    }
  }, []);

  const logout = useCallback(() => {
    const userId = currentUserId;
    const companyIdRaw = localStorage.getItem('bisync.selectedCompanyId');
    const companyId = companyIdRaw ? Number(companyIdRaw) : null;
    if (userId) {
      void api.recordLogoutAudit({
        userId,
        companyId: companyId && companyId > 0 ? companyId : null,
        reason: 'user-logout',
      }).catch(() => { /* audit best-effort */ });
    }

    if (!REQUIRE_PLATFORM_LOGIN) {
      // Auth paused — stay in-app on the default user instead of bouncing to landing.
      const defaultId = resolveDefaultUserId(users);
      if (defaultId) {
        setCurrentUserIdState(defaultId);
        localStorage.setItem(STORAGE_KEY, String(defaultId));
        localStorage.setItem(AUTH_KEY, 'true');
        setIsAuthenticated(true);
        markUserActivity();
        return;
      }
    }
    localStorage.removeItem(AUTH_KEY);
    clearAllOnboardingFlags();
    clearUserActivity();
    setIsAuthenticated(false);
    setCurrentUserIdState(null);
  }, [users, currentUserId]);

  useIdleLogout(REQUIRE_PLATFORM_LOGIN && isAuthenticated, logout);

  const currentUser = users.find(user => user.id === currentUserId) ?? null;

  return (
    <CurrentUserContext.Provider
      value={{
        currentUser,
        users,
        loading,
        isAuthenticated,
        setCurrentUserId,
        login,
        logout,
        applyAuthenticatedUser,
      }}
    >
      {children}
    </CurrentUserContext.Provider>
  );
}
