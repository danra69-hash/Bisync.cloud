import { createContext } from 'react';
import type { AppUser } from '../api';

/** Legacy demo password for seeded users without a stored password hash. */
export const DEMO_PASSWORD = 'Pass@123';

export type CurrentUserContextValue = {
  currentUser: AppUser | null;
  users: AppUser[];
  loading: boolean;
  isAuthenticated: boolean;
  setCurrentUserId: (id: number) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  applyAuthenticatedUser: (user: AppUser) => void;
};

export const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

export function userInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');
}
