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
  employeeId?: number | null;
  employeeCode?: string | null;
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

export interface AvailableEmployee {
  id: number;
  employeeCode: string;
  name: string;
  email: string;
  mobile: string;
  position: string;
  department: string;
  bisyncEnabled: boolean;
}

export interface UserUpsert {
  employeeId?: number | null;
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

export interface VendorContact {
  id?: string;
  name: string;
  position: string;
  mobile: string;
  email: string;
  isDefault: boolean;
}

export interface EngageVendorContact {
  name: string;
  position: string;
  mobile: string;
  email: string;
  isDefault: boolean;
}

export interface EngageVendorPayload {
  contacts: EngageVendorContact[];
}

export interface Vendor {
  id: number;
  externalId: string;
  name: string;
  type: string;
  products: string;
  city: string;
  state: string;
  address: string;
  contactPerson: string;
  contactPosition: string;
  mobile: string;
  email: string;
  contactsJson: string;
  engaged: boolean;
}

export interface VendorCreatePayload {
  externalId: string;
  name: string;
  type: string;
  brn: string;
  products: string;
  city: string;
  state: string;
  address: string;
  contactPerson: string;
  contactPosition: string;
  mobile: string;
  email: string;
}

export interface PurchaseOrderItem {
  id: number;
  componentId?: string;
  componentName?: string;
  vendorProductId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  issuedUnitPrice?: number;
  unit: string;
  componentUom?: string;
  deliveryPackage?: string;
  receivedQuantity?: number | null;
  receivedUnitPrice?: number | null;
  reconciledQuantity?: number | null;
  reconciledUnitPrice?: number | null;
}

export interface PurchaseOrder {
  id: number;
  poNumber: string;
  vendorName: string;
  orderDate: string;
  deliveryDate: string;
  documentType: 'PR' | 'PO' | string;
  status: string;
  companyId?: number | null;
  locationExternalIds?: string[];
  initiatedBy?: string;
  approvedBy?: string;
  approvedAt?: string | null;
  receivedAt?: string | null;
  reconciledAt?: string | null;
  vendorShareToken?: string | null;
  vendorAcceptedAt?: string | null;
  vendorAcceptedBy?: string | null;
  canApprove?: boolean;
  canReceive?: boolean;
  canReconcile?: boolean;
  items: PurchaseOrderItem[];
}

export interface CreatePurchaseOrderItemPayload {
  componentId?: string;
  componentName?: string;
  vendorProductId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  unit: string;
  componentUom?: string;
  deliveryPackage: string;
}

export interface CreatePurchaseOrderPayload {
  vendorName: string;
  poNumber?: string;
  documentType?: 'PR' | 'PO';
  orderDate?: string;
  deliveryDate?: string;
  status?: string;
  items: CreatePurchaseOrderItemPayload[];
}

export interface CreatePurchaseOrdersBatchPayload {
  companyId?: number;
  locationExternalIds?: string[];
  initiatedBy?: string;
  approvedBy?: string;
  orders: CreatePurchaseOrderPayload[];
}

export interface PurchaseOrderLineWorkflowPayload {
  itemId: number;
  quantity: number;
  unitPrice: number;
  componentUom?: string;
}

export interface PurchaseOrderWorkflowPayload {
  items: PurchaseOrderLineWorkflowPayload[];
}

export interface ReconcilePurchaseOrderResult {
  order: PurchaseOrder;
  updatedVendorProductPrices: { id: string; deliveryPrice: number }[];
}

export interface VendorOrderPortalItem {
  name: string;
  deliveryPackage: string;
  quantity: number;
  unitPrice: number;
}

export interface VendorOrderPortal {
  id: number;
  poNumber: string;
  vendorName: string;
  documentType: string;
  documentKind: 'purchase_order' | 'purchase_request';
  status: string;
  orderDate: string;
  deliveryDate: string;
  initiatedBy: string;
  approvedBy: string;
  vendorAcceptedAt?: string | null;
  vendorAcceptedBy?: string | null;
  canAccept: boolean;
  company: {
    name: string;
    brn: string;
    gstTin: string;
    phone: string;
    email: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    stateProvince: string;
    postcode: string;
  } | null;
  vendor: {
    name: string;
    brn: string;
    address: string;
    city: string;
    state: string;
    contactPerson: string;
    contactPosition: string;
    mobile: string;
    email: string;
  };
  deliveryLocations: {
    name: string;
    externalId: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    stateProvince: string;
    postcode: string;
  }[];
  items: VendorOrderPortalItem[];
}

export interface VendorProductPriceRow {
  id: string;
  deliveryPrice: number;
  updatedAt?: string;
}

export interface InventoryPurchase {
  id: number;
  componentId: string;
  componentName: string;
  quantity: number;
  uom: string;
  unitPrice: number;
  dateOrdered: string;
  dateCreatedInStock: string;
  purchaseOrderId: number;
  purchaseOrderItemId: number;
  companyId?: number | null;
  locationExternalIds?: string[];
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
  componentId: string;
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
  storageNote?: string;
  detailConfigJson?: string;
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
  if (!res.ok) {
    const text = await res.text();
    let message = `API error ${res.status}: ${path}`;
    try {
      const parsed = JSON.parse(text) as { message?: string; title?: string };
      message = parsed.message ?? parsed.title ?? message;
    } catch {
      if (text) message = text;
    }
    throw new Error(message);
  }
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
  login: (email: string, password: string) =>
    fetchJsonWithMethod<AppUser>('/api/auth/login', 'POST', { email, password }),
  availableEmployees: () => fetchJson<AvailableEmployee[]>('/api/users/available-employees'),
  createUser: (data: UserUpsert) => fetchJsonWithMethod<AppUser>('/api/users', 'POST', data),
  updateUser: (id: number, data: UserUpsert) => fetchJsonWithMethod<AppUser>(`/api/users/${id}`, 'PUT', data),
  menu: (category?: string) => fetchJson<MenuItem[]>(`/api/menu${category ? `?category=${category}` : ''}`),
  vendors: (engaged?: boolean) => fetchJson<Vendor[]>(`/api/vendors${engaged !== undefined ? `?engaged=${engaged}` : ''}`),
  createVendor: (data: VendorCreatePayload) => fetchJsonWithMethod<Vendor>('/api/vendors', 'POST', data),
  engageVendor: (externalId: string, data: EngageVendorPayload) =>
    fetchJsonWithMethod<Vendor>(`/api/vendors/${externalId}/engage`, 'POST', data),
  ingredients: () => fetchJson<Ingredient[]>('/api/ingredients'),
  createIngredient: (data: Omit<Ingredient, 'id'>) => fetchJsonWithMethod<Ingredient>('/api/ingredients', 'POST', data),
  updateIngredient: (id: number, data: Ingredient) => fetchJsonWithMethod<Ingredient>(`/api/ingredients/${id}`, 'PUT', data),
  purchaseOrders: () => fetchJson<PurchaseOrder[]>('/api/purchaseorders'),
  activePurchaseOrders: (companyId?: number) =>
    fetchJson<PurchaseOrder[]>(`/api/purchaseorders/active${companyId ? `?companyId=${companyId}` : ''}`),
  purchaseOrder: (id: number) => fetchJson<PurchaseOrder>(`/api/purchaseorders/${id}`),
  createPurchaseOrders: (payload: CreatePurchaseOrdersBatchPayload) =>
    fetchJsonWithMethod<PurchaseOrder[]>('/api/purchaseorders/batch', 'POST', payload),
  approvePurchaseOrder: (id: number, approvedBy: string) =>
    fetchJsonWithMethod<PurchaseOrder>(`/api/purchaseorders/${id}/approve`, 'POST', { approvedBy }),
  receivePurchaseOrder: (id: number, payload: PurchaseOrderWorkflowPayload) =>
    fetchJsonWithMethod<PurchaseOrder>(`/api/purchaseorders/${id}/receive`, 'POST', payload),
  reconcilePurchaseOrder: (id: number, payload: PurchaseOrderWorkflowPayload) =>
    fetchJsonWithMethod<ReconcilePurchaseOrderResult>(`/api/purchaseorders/${id}/reconcile`, 'POST', payload),
  vendorOrderPortal: (token: string) => fetchJson<VendorOrderPortal>(`/api/vendor-orders/${token}`),
  acceptVendorOrder: (token: string, acceptedBy?: string) =>
    fetchJsonWithMethod<VendorOrderPortal>(`/api/vendor-orders/${token}/accept`, 'POST', { acceptedBy }),
  vendorProductPrices: () => fetchJson<VendorProductPriceRow[]>('/api/vendorproducts/prices'),
  inventoryPurchases: (companyId?: number) =>
    fetchJson<InventoryPurchase[]>(`/api/inventory/purchases${companyId ? `?companyId=${companyId}` : ''}`),
  inventoryAlerts: () => fetchJson<InventoryAlert[]>('/api/inventory/alerts'),
  revenue: (period = 'week') => fetchJson<RevenuePoint[]>(`/api/revenue?period=${period}`),
  progress: () => fetchJson<ProgressData>('/api/progress'),
};
