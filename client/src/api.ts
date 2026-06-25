const API_BASE = import.meta.env.VITE_API_URL ?? '';

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

export interface Location {
  id: number;
  externalId: string;
  name: string;
  address: string;
  companyId?: number | null;
  companyName?: string | null;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateProvince?: string;
  postcode?: string;
  principalContactUserId?: number | null;
  principalContactName?: string | null;
  salesToday: number;
  salesWtd: number;
  salesMtd: number;
  salesYtd: number;
  salesPrevToday: number;
  salesPrevWtd: number;
  salesPrevMtd: number;
  salesPrevYtd: number;
  coversToday: number;
  coversWtd: number;
  coversMtd: number;
  coversYtd: number;
  coversPrevToday: number;
  coversPrevWtd: number;
  coversPrevMtd: number;
  coversPrevYtd: number;
}

export interface LocationConfig {
  id: number;
  externalId: string;
  name: string;
  companyId: number | null;
  companyName: string | null;
  countryCode: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateProvince: string;
  postcode: string;
  principalContactUserId: number | null;
  principalContactName: string | null;
}

export interface Company {
  id: number;
  name: string;
  brn: string;
  gstTin: string;
  countryCode: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateProvince: string;
  postcode: string;
  phone: string;
  fax: string;
  email: string;
  active: boolean;
  locationCount?: number;
}

export interface AppUser {
  id: number;
  fullName: string;
  email: string;
  role: string;
  phone: string;
  active: boolean;
  accessJson: string;
  companyId: number | null;
  companyName?: string | null;
  locationIds: number[];
  locationNames?: string[];
  locationIdsJson: string;
}

export interface UserUpsert {
  fullName: string;
  email: string;
  role: string;
  phone: string;
  active: boolean;
  accessJson: string;
  companyId: number | null;
  locationIdsJson: string;
}

export interface MenuItem {
  id: number;
  name: string;
  category: string;
  orders: number;
  revenue: number;
  marginPercent: number;
}

export interface Vendor {
  id: number;
  externalId: string;
  name: string;
  type: string;
  products: string;
  city: string;
  engaged: boolean;
}

export interface PurchaseOrder {
  id: number;
  poNumber: string;
  vendorName: string;
  orderDate: string;
  deliveryDate: string;
  status: string;
  items: { id: number; name: string; quantity: number; unitPrice: number; unit: string }[];
}

export interface InventoryAlert {
  id: number;
  itemName: string;
  stock: string;
  status: string;
  threshold: string;
}

export interface RevenuePoint {
  id: number;
  period: string;
  label: string;
  currentValue: number;
  priorValue: number;
  covers?: number;
}

export interface ProgressData {
  overallPercent: number;
  completedCount: number;
  totalCount: number;
  lastUpdated: string;
  milestones: { phase: string; items: { id: number; title: string; status: string; progressPercent: number; notes?: string }[] }[];
}

export interface Ingredient {
  id: number;
  name: string;
  category: string;
  group: string;
  recipeUom: string;
  inventoryUom: string;
  lastPriceRecipe: number;
  lastPriceInventory: number;
  dailyUsage: number;
  orderFreqDays: number;
  storageJson: string;
  attachedProducts: number;
  attachedVendors: number;
  active: boolean;
  locationsJson: string;
}

async function fetchJsonWithMethod<T>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

export const api = {
  health: () => fetchJson<{ status: string }>('/api/health'),
  locations: () => fetchJson<Location[]>('/api/locations'),
  locationsConfig: () => fetchJson<LocationConfig[]>('/api/locations/config'),
  updateLocationConfig: (id: number, data: Omit<LocationConfig, 'id' | 'externalId' | 'companyName' | 'countryCode' | 'principalContactName'>) =>
    fetchJsonWithMethod(`/api/locations/${id}/config`, 'PUT', data),
  companies: () => fetchJson<Company[]>('/api/companies'),
  createCompany: (data: Omit<Company, 'id' | 'locationCount'>) => fetchJsonWithMethod<Company>('/api/companies', 'POST', data),
  updateCompany: (id: number, data: Company) => fetchJsonWithMethod<Company>(`/api/companies/${id}`, 'PUT', data),
  users: () => fetchJson<AppUser[]>('/api/users'),
  createUser: (data: UserUpsert) => fetchJsonWithMethod<AppUser>('/api/users', 'POST', data),
  updateUser: (id: number, data: UserUpsert) => fetchJsonWithMethod<AppUser>(`/api/users/${id}`, 'PUT', data),
  menu: (category?: string) => fetchJson<MenuItem[]>(`/api/menu${category ? `?category=${category}` : ''}`),
  vendors: (engaged?: boolean) => fetchJson<Vendor[]>(`/api/vendors${engaged !== undefined ? `?engaged=${engaged}` : ''}`),
  engageVendor: (externalId: string) => fetchJsonWithMethod<Vendor>(`/api/vendors/${externalId}/engage`, 'POST'),
  ingredients: () => fetchJson<Ingredient[]>('/api/ingredients'),
  createIngredient: (data: Omit<Ingredient, 'id'>) => fetchJsonWithMethod<Ingredient>('/api/ingredients', 'POST', data),
  updateIngredient: (id: number, data: Ingredient) => fetchJsonWithMethod<Ingredient>(`/api/ingredients/${id}`, 'PUT', data),
  purchaseOrders: () => fetchJson<PurchaseOrder[]>('/api/purchaseorders'),
  inventoryAlerts: () => fetchJson<InventoryAlert[]>('/api/inventory/alerts'),
  revenue: (period = 'week') => fetchJson<RevenuePoint[]>(`/api/revenue?period=${period}`),
  progress: () => fetchJson<ProgressData>('/api/progress'),
};
