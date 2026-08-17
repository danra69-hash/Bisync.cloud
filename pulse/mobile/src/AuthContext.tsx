import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  api,
  getToken,
  isPinUnlocked,
  setPinUnlocked,
  setToken,
  type MobileUser,
} from './api';

type AuthState = {
  user: MobileUser | null;
  loading: boolean;
  pinOk: boolean;
  login: (email: string, password: string, as?: 'subscriber' | 'coach' | 'auto') => Promise<void>;
  verifyPin: (pin: string) => Promise<void>;
  unlockWithBiometricsFlag: () => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MobileUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [pinOk, setPinOk] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const unlocked = await isPinUnlocked();
        if (!token) return;
        const me = await api<{ user: MobileUser }>('/api/mobile/me');
        setUser(me.user);
        setPinOk(unlocked);
      } catch {
        await setToken(null);
        await setPinUnlocked(false);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      pinOk,
      async login(email, password, as = 'auto') {
        const res = await api<{ token: string; user: MobileUser }>('/api/mobile/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password, as }),
        });
        await setToken(res.token);
        await setPinUnlocked(false);
        setUser(res.user);
        setPinOk(false);
      },
      async verifyPin(pin) {
        await api('/api/mobile/auth/pin', { method: 'POST', body: JSON.stringify({ pin }) });
        await setPinUnlocked(true);
        setPinOk(true);
      },
      async unlockWithBiometricsFlag() {
        await setPinUnlocked(true);
        setPinOk(true);
      },
      async logout() {
        try {
          await api('/api/mobile/auth/logout', { method: 'POST' });
        } catch {
          /* ignore */
        }
        await setToken(null);
        await setPinUnlocked(false);
        setUser(null);
        setPinOk(false);
      },
    }),
    [user, loading, pinOk],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth outside provider');
  return ctx;
}
