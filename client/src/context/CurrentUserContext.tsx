import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, type AppUser } from '../api';

const STORAGE_KEY = 'bisync.currentUserId';

type CurrentUserContextValue = {
  currentUser: AppUser | null;
  users: AppUser[];
  loading: boolean;
  setCurrentUserId: (id: number) => void;
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

  useEffect(() => {
    api.users()
      .then(list => {
        const active = list.filter(user => user.active);
        setUsers(active);
        const defaultId = resolveDefaultUserId(active);
        if (defaultId) {
          setCurrentUserIdState(defaultId);
          localStorage.setItem(STORAGE_KEY, String(defaultId));
        }
      })
      .catch(() => {
        setUsers([]);
        setCurrentUserIdState(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const setCurrentUserId = (id: number) => {
    setCurrentUserIdState(id);
    localStorage.setItem(STORAGE_KEY, String(id));
  };

  const currentUser = users.find(user => user.id === currentUserId) ?? null;

  return (
    <CurrentUserContext.Provider value={{ currentUser, users, loading, setCurrentUserId }}>
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
