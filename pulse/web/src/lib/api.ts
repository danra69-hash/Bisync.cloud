export type Role = 'superuser' | 'management' | 'admin' | 'accounting' | 'fitness_coach' | 'sales';

export type ModuleId =
  | 'dashboard'
  | 'members'
  | 'payments'
  | 'invoices'
  | 'promotions'
  | 'appointments'
  | 'equipment'
  | 'training'
  | 'products'
  | 'system_config'
  | 'team';

export interface Location {
  id: string;
  companyId: string;
  code: string;
  name: string;
  address: string;
  active: boolean;
}

export interface Membership {
  companyId: string;
  companyCode: string;
  companyName: string;
  role: Role;
  currency?: string;
  timezone?: string;
  plans?: string[];
  locations: Location[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  roleLabel: string;
  modules: ModuleId[];
  active: boolean;
  memberships?: Membership[];
}

export interface Member {
  id: string;
  companyId?: string;
  homeLocationId?: string | null;
  memberCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  plan: string;
  status: string;
  joinedAt: string | null;
  renewsAt: string | null;
  tags: string[];
  notes: string;
  salesOwnerEmail?: string;
}

export interface Invoice {
  id: string;
  number: string;
  memberId: string;
  status: string;
  issuedAt: string;
  dueAt: string;
  lines: { description: string; qty: number; unitPrice: number }[];
  subtotal: number;
  tax: number;
  total: number;
  promoCode: string | null;
  discount: number;
  member?: Member | null;
}

export interface Payment {
  id: string;
  memberId: string;
  invoiceId: string | null;
  amount: number;
  method: string;
  status: string;
  paidAt: string;
  reference: string;
  member?: Member | null;
  invoice?: Invoice | null;
}

export interface Promotion {
  id: string;
  name: string;
  code: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  appliesTo: string;
  status: string;
  startsAt: string;
  endsAt: string;
  currentlyActive?: boolean;
}

export interface Appointment {
  id: string;
  companyId?: string;
  locationId?: string | null;
  memberId: string;
  coachUserId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: string;
  area?: string;
  location: string;
  notes: string;
  member?: Member | null;
  coach?: User | null;
}

export interface Equipment {
  id: string;
  companyId?: string;
  locationId?: string | null;
  code: string;
  name: string;
  category: string;
  status: string;
  area?: string;
  location: string;
  lastServiceAt: string;
  notes: string;
}

export interface ActivityType {
  id: string;
  name: string;
  description: string;
}

export interface TrainingSession {
  id: string;
  memberId: string;
  coachUserId: string | null;
  activityTypeId: string;
  startedAt: string;
  endedAt: string | null;
  equipmentIds: string[];
  notes: string;
  calories: number | null;
  member?: Member | null;
  coach?: User | null;
  activityType?: ActivityType | null;
  equipment?: Equipment[];
}

export interface DashboardData {
  stats: {
    activeMembers: number;
    leads: number;
    openInvoices: number;
    openInvoiceTotal: number;
    capturedRevenue: number;
    upcomingAppointments: number;
    equipmentIssues: number;
    trainingSessions: number;
  };
  upcoming: Appointment[];
  equipmentIssues: Equipment[];
  role: User;
}

const TOKEN_KEY = 'pulse_token';
const COMPANY_KEY = 'pulse_company_id';
const LOCATION_KEY = 'pulse_location_id';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (!token) localStorage.removeItem(TOKEN_KEY);
  else localStorage.setItem(TOKEN_KEY, token);
}

export function getCompanyId() {
  return localStorage.getItem(COMPANY_KEY);
}

export function setCompanyId(id: string | null) {
  if (!id) localStorage.removeItem(COMPANY_KEY);
  else localStorage.setItem(COMPANY_KEY, id);
}

export function getLocationId() {
  return localStorage.getItem(LOCATION_KEY);
}

export function setLocationId(id: string | null) {
  if (!id || id === 'all') localStorage.removeItem(LOCATION_KEY);
  else localStorage.setItem(LOCATION_KEY, id);
}

export function clearTenant() {
  setCompanyId(null);
  setLocationId(null);
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const companyId = getCompanyId();
  if (companyId) headers.set('X-Pulse-Company-Id', companyId);
  const locationId = getLocationId();
  if (locationId) headers.set('X-Pulse-Location-Id', locationId);
  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function money(n: number, currency = 'USD') {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n);
}

export function fmtWhen(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
