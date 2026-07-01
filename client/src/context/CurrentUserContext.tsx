import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, type AppUser } from '../api';

const STORAGE_KEY = 'bisync.currentUserId';
const AUTH_KEY = 'bisync.authenticated';
export const DEMO_PASSWORD = 'Pass@123';

type CurrentUserContextValue = {
  currentUser: AppUser | null;
  users: AppUser[];
  loading: boolean;
  isAuthenticated: boolean;
  setCurrentUserId: (id: number) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

function resolveDefaultUserId(users: AppUser[]): number | null {
  const active = users.filter(user => user.active);
  const storedRaw = localStorage.getItem(STORAGE_KEY);
  const storedId = storedRaw ? Number(storedRaw) : null;
  if (storedId && active.some(user => user.id === storedId)) return storedId;

  const james = active.find(user => user.fullName === 'James Dubois');
  return james?.id ?? active[0]?.id ?? null;
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
    let activeUsers = users;
    if (activeUsers.length === 0) {
      const list = await api.users();
      activeUsers = list.filter(user => user.active);
      setUsers(activeUsers);
    }

    const normalized = email.trim().toLowerCase();
    const user = activeUsers.find(u => u.email.toLowerCase() === normalized);
    if (!user || password !== DEMO_PASSWORD) {
      throw new Error('Invalid email or password.');
    }

    localStorage.setItem(AUTH_KEY, 'true');
    localStorage.setItem(STORAGE_KEY, String(user.id));
    setCurrentUserIdState(user.id);
    setIsAuthenticated(true);
  }, [users]);

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_KEY);
    setIsAuthenticated(false);
    setCurrentUserIdState(null);
  }, []);

  const currentUser = users.find(user => user.id === currentUserId) ?? null;

  return (
    <CurrentUserContext.Provider
      value={{ currentUser, users, loading, isAuthenticated, setCurrentUserId, login, logout }}
    >
      {children}
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUser(): CurrentUserContextValue {
  const context = useContext(CurrentUserContext);
  if (!context) {
    throw new Error('useCurrentUser must be used within CurrentUserProvider');
  }
  return context;
}

export function userInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');
}
