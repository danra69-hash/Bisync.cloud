import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api, setApiTenantCompanyId, type AppUser } from '../api';
import {
  assertPlatformCredential,
  clearBiometricEnrollment,
  createPlatformCredential,
  loadBiometricEnrollment,
  saveBiometricEnrollment,
} from '../auth/platformBiometric';
import { clearPinEnrollment, savePinEnrollment, unlockPinPayload } from '../auth/platformPin';
import { REQUIRE_PLATFORM_LOGIN } from '../config/platformAuth';
import { isDesktopAppSession } from '../data/desktopLauncher';
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
    // Clear stale tenant (e.g. leftover QA) before login; restore home company after.
    setApiTenantCompanyId(null);
    const user = await api.login(email, password);
    if (!user.active) throw new Error('Invalid email or password.');

    setUsers(prev => upsertUser(prev, user));
    localStorage.setItem(AUTH_KEY, 'true');
    localStorage.setItem(STORAGE_KEY, String(user.id));
    setApiTenantCompanyId(user.companyId ?? null);
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
    setApiTenantCompanyId(normalized.companyId ?? null);
    markUserActivity();
    setCurrentUserIdState(normalized.id);
    setIsAuthenticated(true);
    if (isAppLocale(normalized.preferredLanguage)) {
      void setAppLocale(normalized.preferredLanguage);
    }
  }, []);

  const resolveActiveUser = useCallback(async (userId: number, email: string) => {
    const fromState = users.find(
      u => u.id === userId || u.email.toLowerCase() === email.trim().toLowerCase(),
    );
    if (fromState?.active) return fromState;

    const list = await api.users();
    const active = list.filter(user => user.active);
    setUsers(active);
    const match = active.find(
      u => u.id === userId || u.email.toLowerCase() === email.trim().toLowerCase(),
    );
    if (!match) {
      throw new Error('The account linked on this device is no longer available.');
    }
    return match;
  }, [users]);

  const loginWithBiometric = useCallback(async () => {
    setApiTenantCompanyId(null);
    const enrollment = loadBiometricEnrollment();
    if (!enrollment) {
      throw new Error('Biometric login is not set up on this device.');
    }
    await assertPlatformCredential(enrollment.credentialId);
    const user = await resolveActiveUser(enrollment.userId, enrollment.email);
    setApiTenantCompanyId(user.companyId ?? null);
    applyAuthenticatedUser(user);
  }, [applyAuthenticatedUser, resolveActiveUser]);

  const loginWithPin = useCallback(async (pin: string) => {
    setApiTenantCompanyId(null);
    const payload = await unlockPinPayload(pin);
    const user = await resolveActiveUser(payload.userId, payload.email);
    setApiTenantCompanyId(user.companyId ?? null);
    applyAuthenticatedUser(user);
  }, [applyAuthenticatedUser, resolveActiveUser]);

  const enrollBiometric = useCallback(async () => {
    const user = users.find(u => u.id === currentUserId);
    if (!user) throw new Error('Sign in with your password before enabling biometrics.');
    const credentialId = await createPlatformCredential(user.email);
    saveBiometricEnrollment({
      email: user.email.trim().toLowerCase(),
      userId: user.id,
      credentialId,
    });
  }, [users, currentUserId]);

  const enrollPin = useCallback(async (pin: string) => {
    const user = users.find(u => u.id === currentUserId);
    if (!user) throw new Error('Sign in with your password before setting a device PIN.');
    await savePinEnrollment(pin, {
      kind: 'platform-session',
      email: user.email.trim().toLowerCase(),
      userId: user.id,
      fullName: user.fullName,
    });
  }, [users, currentUserId]);

  const clearBiometric = useCallback(() => {
    clearBiometricEnrollment();
  }, []);

  const clearPin = useCallback(() => {
    clearPinEnrollment();
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

    setApiTenantCompanyId(null);

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

  // Desktop app windows stay signed in until closed (or manual Log out).
  useIdleLogout(
    REQUIRE_PLATFORM_LOGIN && isAuthenticated && !isDesktopAppSession(),
    logout,
  );

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
        loginWithBiometric,
        loginWithPin,
        enrollBiometric,
        enrollPin,
        clearBiometric,
        clearPin,
        logout,
        applyAuthenticatedUser,
      }}
    >
      {children}
    </CurrentUserContext.Provider>
  );
}
