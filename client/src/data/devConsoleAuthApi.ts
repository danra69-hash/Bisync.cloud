import {
  clearDevConsoleSession,
  devConsoleAuthHeaders,
  setDevConsoleSession,
  type DevConsoleProfile,
} from './devConsoleSession';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

export const DEV_CONSOLE_TAB_IDS = [
  'overview',
  'tenant-rollups',
  'sales-module',
  'automated-qa',
  'audit-trail',
  'ghost-support',
  'ref-library',
  'control-panel',
] as const;

export type DevConsoleTabId = (typeof DEV_CONSOLE_TAB_IDS)[number];

export const DEV_CONSOLE_TAB_LABELS: Record<DevConsoleTabId, string> = {
  overview: 'Overview',
  'tenant-rollups': 'Tenant Rollups',
  'sales-module': 'Sales Module',
  'automated-qa': 'Automated QA',
  'audit-trail': 'Audit Trail',
  'ghost-support': 'Ghost Support',
  'ref-library': 'Ref & Library',
  'control-panel': 'Control Panel',
};

/** Tabs that can be granted to Dev Team members (Control Panel is email-allowlist only). */
export const DEV_CONSOLE_ASSIGNABLE_TAB_IDS = DEV_CONSOLE_TAB_IDS.filter(
  id => id !== 'control-panel',
);

/** Map legacy `qa-history` access into Automated QA (history lives under that tab). */
export function normalizeDevConsoleAccessTabs(tabs: string[] | undefined | null): DevConsoleTabId[] {
  const allowed = new Set<DevConsoleTabId>();
  for (const raw of tabs ?? []) {
    const key = raw.trim().toLowerCase();
    if (key === 'qa-history') {
      allowed.add('automated-qa');
      continue;
    }
    if ((DEV_CONSOLE_TAB_IDS as readonly string[]).includes(key)) {
      allowed.add(key as DevConsoleTabId);
    }
  }
  return DEV_CONSOLE_TAB_IDS.filter(id => allowed.has(id));
}

export const DEV_CONSOLE_TEAM_TYPES = ['Management', 'Hunter', 'Farmer', 'Accounts'] as const;
export type DevConsoleTeamType = (typeof DEV_CONSOLE_TEAM_TYPES)[number];

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
  teamTypes?: string[];
  tabs?: string[];
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
  position?: string;
  teamType?: string;
  isRoot: boolean;
  canManageTeam?: boolean;
  accessTabs?: string[];
  mustChangePassword?: boolean;
};

export type DevTeamUserRow = {
  id: number;
  email: string;
  fullName: string;
  position: string;
  teamType: string;
  accessTabs: string[];
  active: boolean;
  isRoot: boolean;
  hasPassword: boolean;
  invitePending: boolean;
  mustChangePassword?: boolean;
  hasGoogle: boolean;
  createdAt: string;
  createdByEmail: string;
  updatedAt: string | null;
};

export type DevTeamUpsertPayload = {
  email: string;
  fullName: string;
  position?: string;
  teamType?: string;
  accessTabs?: string[];
  password?: string;
  active?: boolean;
};

function toProfile(session: DevSessionResult): DevConsoleProfile {
  const normalized = normalizeDevConsoleAccessTabs(session.accessTabs);
  return {
    email: session.email,
    fullName: session.fullName,
    isRoot: session.isRoot,
    expiresAt: session.expiresAt,
    position: session.position,
    teamType: session.teamType,
    mustChangePassword: session.mustChangePassword === true,
    accessTabs: session.isRoot
      ? [...DEV_CONSOLE_TAB_IDS]
      : (normalized.length > 0 ? normalized : ['overview']),
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
    position: string;
    teamType: string;
    isRoot: boolean;
    canManageTeam?: boolean;
    accessTabs: string[];
    expiresAt: string;
    googleVerified: boolean;
    mustChangePassword?: boolean;
  }>('/api/dev-console/auth/me'),

  logout: async () => {
    try {
      await fetchJson<void>('/api/dev-console/auth/logout', { method: 'POST' });
    } finally {
      clearDevConsoleSession();
    }
  },

  changePassword: (currentPassword: string, newPassword: string) =>
    fetchJson<{ message: string }>('/api/dev-console/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  forgotPassword: (email: string) =>
    fetchJson<{ message: string; resetUrl?: string }>('/api/dev-console/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  peekInvite: (token: string) =>
    fetchJson<{ email: string; fullName: string; position: string; teamType: string }>(
      `/api/dev-console/auth/invite/${encodeURIComponent(token)}`,
    ),

  acceptInvite: (token: string, password: string) =>
    fetchJson<{ message: string; email: string; fullName: string }>('/api/dev-console/auth/accept-invite', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }),

  peekReset: (token: string) =>
    fetchJson<{ email: string; fullName: string }>(
      `/api/dev-console/auth/reset/${encodeURIComponent(token)}`,
    ),

  resetPassword: (token: string, password: string) =>
    fetchJson<{ message: string; email: string }>('/api/dev-console/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }),

  listTeam: () => fetchJson<{
    users: DevTeamUserRow[];
    actorEmail: string;
    teamTypes: string[];
    tabs: string[];
  }>('/api/dev-console/auth/team'),

  createTeamUser: (payload: DevTeamUpsertPayload) =>
    fetchJson<DevTeamUserRow & { inviteUrl?: string }>(
      '/api/dev-console/auth/team',
      { method: 'POST', body: JSON.stringify(payload) },
    ),

  updateTeamUser: (id: number, payload: Partial<DevTeamUpsertPayload>) =>
    fetchJson<DevTeamUserRow>(
      `/api/dev-console/auth/team/${id}`,
      { method: 'PUT', body: JSON.stringify(payload) },
    ),

  resendInvite: (id: number) =>
    fetchJson<{ message: string; inviteUrl?: string; email: string; defaultPassword?: string }>(
      `/api/dev-console/auth/team/${id}/resend-invite`,
      { method: 'POST' },
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
