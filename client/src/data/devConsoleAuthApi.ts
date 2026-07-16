import {
  clearDevConsoleSession,
  devConsoleAuthHeaders,
  setDevConsoleSession,
  type DevConsoleProfile,
} from './devConsoleSession';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

async function parseError(res: Response): Promise<string> {
  if (res.status === 404) {
    return 'Dev Console API is not enabled on this server. Redeploy with Dev Console enabled, or restart the local API with DEV_CONSOLE_ENABLED=true.';
  }
  try {
    const body = await res.json() as { message?: string };
    if (body?.message) return body.message;
  } catch {
    // ignore
  }
  const text = await res.text().catch(() => '');
  return text || `API error ${res.status}`;
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...devConsoleAuthHeaders(init?.headers),
    },
  });
  if (!res.ok) throw new Error(await parseError(res));
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export type DevAuthConfig = {
  googleClientId: string;
  googleRequired: boolean;
  allowPasswordOnly: boolean;
  allowedDomains: string[];
  rootEmail: string;
};

export type PasswordLoginResult = {
  passwordTicket: string;
  expiresAt: string;
  email: string;
  fullName: string;
  googleRequired: boolean;
  allowPasswordOnly: boolean;
  googleClientId: string;
};

export type DevSessionResult = {
  token: string;
  expiresAt: string;
  email: string;
  fullName: string;
  isRoot: boolean;
};

export type DevTeamUserRow = {
  id: number;
  email: string;
  fullName: string;
  active: boolean;
  isRoot: boolean;
  hasGoogle: boolean;
  createdAt: string;
  createdByEmail: string;
  updatedAt: string | null;
};

function toProfile(session: DevSessionResult): DevConsoleProfile {
  return {
    email: session.email,
    fullName: session.fullName,
    isRoot: session.isRoot,
    expiresAt: session.expiresAt,
  };
}

export const devConsoleAuthApi = {
  config: () => fetchJson<DevAuthConfig>('/api/dev-console/auth/config'),

  passwordLogin: (email: string, password: string) =>
    fetchJson<PasswordLoginResult>('/api/dev-console/auth/password', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  completeGoogle: async (passwordTicket: string, googleIdToken: string) => {
    const session = await fetchJson<DevSessionResult>('/api/dev-console/auth/google', {
      method: 'POST',
      body: JSON.stringify({ passwordTicket, googleIdToken }),
    });
    setDevConsoleSession(session.token, toProfile(session));
    return session;
  },

  completePasswordOnly: async (passwordTicket: string) => {
    const session = await fetchJson<DevSessionResult>('/api/dev-console/auth/password-only', {
      method: 'POST',
      body: JSON.stringify({ passwordTicket }),
    });
    setDevConsoleSession(session.token, toProfile(session));
    return session;
  },

  me: () => fetchJson<{
    email: string;
    fullName: string;
    isRoot: boolean;
    expiresAt: string;
    googleVerified: boolean;
  }>('/api/dev-console/auth/me'),

  logout: async () => {
    try {
      await fetchJson<void>('/api/dev-console/auth/logout', { method: 'POST' });
    } finally {
      clearDevConsoleSession();
    }
  },

  listTeam: () => fetchJson<{ users: DevTeamUserRow[]; actorEmail: string }>('/api/dev-console/auth/team'),

  createTeamUser: (payload: { email: string; fullName: string; password: string }) =>
    fetchJson<{ id: number; email: string; fullName: string; active: boolean; isRoot: boolean }>(
      '/api/dev-console/auth/team',
      { method: 'POST', body: JSON.stringify(payload) },
    ),

  updateTeamUser: (id: number, payload: {
    email?: string;
    fullName?: string;
    password?: string;
    active?: boolean;
  }) =>
    fetchJson<{ id: number; email: string; fullName: string; active: boolean; isRoot: boolean }>(
      `/api/dev-console/auth/team/${id}`,
      { method: 'PUT', body: JSON.stringify(payload) },
    ),

  deleteTeamUser: (id: number) =>
    fetchJson<void>(`/api/dev-console/auth/team/${id}`, { method: 'DELETE' }),

  ghostEnter: (payload: { companyId: number; locationId: number }) =>
    fetchJson<{
      user: import('../api').AppUser;
      company: { id: number; name: string; countryCode?: string };
      location: { id: number; externalId: string; name: string; companyId: number | null };
      actorEmail: string;
    }>('/api/dev-console/auth/ghost-enter', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
