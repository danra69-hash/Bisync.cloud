import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api, type AppUser } from '../api';
import { clearUserActivity, markUserActivity, useIdleLogout } from '../hooks/useIdleLogout';
import {
  CurrentUserContext,
  DEMO_PASSWORD,
} from './currentUserContext';

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
    () => localStorage.getItem(AUTH_KEY) === 'true',
  );

  useEffect(() => {
    api.users()
      .then(list => {
        const active = list.filter(user => user.active);
        setUsers(active);

        const authenticated = localStorage.getItem(AUTH_KEY) === 'true';
        if (!authenticated) {
          setIsAuthenticated(false);
          setCurrentUserIdState(null);
          return;
        }

        const defaultId = resolveDefaultUserId(active);
        if (defaultId) {
          setCurrentUserIdState(defaultId);
          localStorage.setItem(STORAGE_KEY, String(defaultId));
          setIsAuthenticated(true);
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
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_KEY);
    clearUserActivity();
    setIsAuthenticated(false);
    setCurrentUserIdState(null);
  }, []);

  useIdleLogout(isAuthenticated, logout);

  const currentUser = users.find(user => user.id === currentUserId) ?? null;

  return (
    <CurrentUserContext.Provider
      value={{ currentUser, users, loading, isAuthenticated, setCurrentUserId, login, logout }}
    >
      {children}
    </CurrentUserContext.Provider>
  );
}
