export type DevUsageResponse = {
  generatedAt: string;
  source: string;
  sourceNote: string;
  status?: string;
  tenantCount?: number;
  provisionedCount?: number;
  sharedCount?: number;
  errors?: string[];
  overall?: {
    companies: number;
    activeCompanies: number;
    locations: number;
    products: number;
    components: number;
    purchaseOrders: number;
    salesOrders: number;
    inventoryMovements: number;
    activeUsers: number;
    apiCalls30d: number;
    provisionedDatabases?: number;
    sharedDatabases?: number;
    vendors?: number;
    rollupErrors?: number;
  };
  trend14d: { date: string; apiCalls: number }[];
  byCompany: {
    companyId: number;
    companyName: string;
    active: boolean;
    locations: number;
    apiCalls30d: number;
    activeUsers: number;
    databaseMode?: string;
    databaseName?: string;
    products?: number;
    components?: number;
    vendors?: number;
    purchaseOrders?: number;
    salesOrders?: number;
    inventoryMovements?: number;
    error?: string | null;
  }[];
  byLocation: {
    locationExternalId: string;
    locationName: string;
    companyId: number | null;
    companyName: string;
    apiCalls30d: number;
    inventoryMovements?: number;
    registeredAt?: string | null;
    status?: string;
    statusLabel?: string;
    statusDate?: string | null;
    expiryDate?: string | null;
    yearsRenewed?: number;
    subscribedSince?: string | null;
    lastPaymentDate?: string | null;
    amount?: number | null;
    currency?: string | null;
    renewalDate?: string | null;
    subscriptionActive?: boolean;
    locked?: boolean;
  }[];
};

export type CompanySubscriptionLocation = {
  locationExternalId: string;
  locationName: string;
  status: string;
  statusLabel: string;
  statusDate?: string | null;
  expiryDate?: string | null;
  registeredAt?: string | null;
  yearsRenewed: number;
  locked: boolean;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  bankName?: string | null;
  amount?: number | null;
  currency?: string | null;
};

export type CompanySubscriptionPanel = {
  companyId: number;
  companyName: string;
  registeredAt?: string | null;
  companyLocked: boolean;
  locations: CompanySubscriptionLocation[];
};

export type DevQaHistoryRow = {
  id: number;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  triggeredBy: string;
  summary: string;
  resultsJson: string;
};

export type ModulesGoLiveMap = {
  RMS?: boolean;
  POS?: boolean;
  HRM?: boolean;
  Accounting?: boolean;
  SystemConfig?: boolean;
};

export type DevLaunchSettings = {
  demoMode: boolean;
  goLive: boolean;
  registrationRestricted: boolean;
  allowedEmailDomains: string[];
  modulesGoLive?: ModulesGoLiveMap;
  updatedAt?: string | null;
  updatedByEmail?: string;
};

import { getDevConsoleToken } from './devConsoleSession';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
  };
  const token = getDevConsoleToken();
  if (token) headers['X-Bisync-Dev-Console-Token'] = token;
  if (init?.headers) {
    new Headers(init.headers).forEach((v, k) => {
      headers[k] = v;
    });
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `API error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const devConsoleApi = {
  status: () => fetchJson<{ enabled: boolean; usageSource: string; environment: string }>('/api/dev-console/status'),
  usage: () => fetchJson<DevUsageResponse>('/api/dev-console/usage'),
  rollups: () => fetchJson<DevUsageResponse>('/api/dev-console/rollups'),
  refreshRollups: () =>
    fetchJson<DevUsageResponse>('/api/dev-console/rollups/refresh', { method: 'POST' }),
  companySubscriptionPanel: (companyId: number) =>
    fetchJson<CompanySubscriptionPanel>(`/api/dev-console/subscriptions/company/${companyId}`),
  extendFreeTrial: (payload: { companyId: number; locationExternalId: string; months: number }) =>
    fetchJson<{ panel?: CompanySubscriptionPanel }>('/api/dev-console/subscriptions/extend-trial', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  activateYearSubscription: (payload: {
    companyId: number;
    locationExternalId: string;
    commencementDate: string;
    paymentMethod: 'check' | 'bank-transfer';
    paymentReference: string;
    bankName?: string | null;
    amount?: number | null;
    currency?: string | null;
  }) =>
    fetchJson<{ panel?: CompanySubscriptionPanel }>('/api/dev-console/subscriptions/activate-year', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  launchSettings: () => fetchJson<DevLaunchSettings>('/api/dev-console/launch-settings'),
  updateLaunchSettings: (payload: {
    demoMode: boolean;
    goLive?: boolean;
    modulesGoLive?: ModulesGoLiveMap;
  }) =>
    fetchJson<DevLaunchSettings>('/api/dev-console/launch-settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  qaHistory: (take = 30) => fetchJson<DevQaHistoryRow[]>(`/api/dev-console/qa/history?take=${take}`),
  startQaRun: (payload: { triggeredBy: string; status?: string; summary?: string; resultsJson?: string }) =>
    fetchJson<{ id: number; startedAt: string; status: string }>('/api/dev-console/qa/runs', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  completeQaRun: (id: number, payload: { status: string; summary?: string; resultsJson?: string }) =>
    fetchJson<{ id: number; status: string; finishedAt: string; summary: string }>(`/api/dev-console/qa/runs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  purgeQaData: (payload: { companyIds?: number[]; purgeAllQaPower?: boolean } = {}) =>
    fetchJson<QaPurgeResult>('/api/dev-console/qa/cleanup', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export type QaPurgeResult = {
  companiesDeleted: number;
  companyNames: string[];
  deletedCounts: Record<string, number>;
  historyRowsKept: number;
  note: string;
};

export async function purgeQaOperationalData(
  payload: { companyIds?: number[]; purgeAllQaPower?: boolean } = {},
): Promise<QaPurgeResult> {
  return devConsoleApi.purgeQaData(payload);
}
