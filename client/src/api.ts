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
  taxAmount?: number;
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
  taxAmount?: number;
}

export interface PurchaseOrderWorkflowPayload {
  items: PurchaseOrderLineWorkflowPayload[];
}

export interface ReconcilePurchaseOrderResult {
  order: PurchaseOrder;
  updatedVendorProductPrices: { id: string; deliveryPrice: number }[];
}

export interface UserNotification {
  id: number;
  userId?: number | null;
  recipientName: string;
  purchaseOrderId?: number | null;
  type: string;
  title: string;
  body: string;
  createdAt: string;
  readAt?: string | null;
  isRead: boolean;
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

export interface CashPurchase {
  id: number;
  datePurchased: string;
  storeName: string;
  componentId: string;
  componentName: string;
  storeProductName: string;
  deliveryUnit: string;
  deliveryPrice: number;
  quantity: number;
  componentUom: string;
  receiptNumber: string;
  receiptFileName: string;
  hasReceiptAttachment: boolean;
  inventoryPurchaseId: number;
  companyId?: number | null;
  locationExternalIds?: string[];
  createdAt: string;
}

export interface CreateCashPurchasePayload {
  datePurchased: string;
  storeName: string;
  componentId: string;
  componentName?: string;
  storeProductName: string;
  deliveryUnit: string;
  deliveryPrice: number;
  quantity: number;
  componentUom: string;
  receiptNumber?: string;
  receiptFileName?: string;
  receiptFileBase64?: string;
  companyId?: number | null;
  locationExternalIds: string[];
}

export interface CreateCashPurchaseResult {
  cashPurchase: CashPurchase;
  inventoryPurchase: InventoryPurchase;
}

export interface OrderTemplateItem {
  id?: number;
  componentId: string;
  componentName: string;
  vendorProductId?: string;
  vendorExternalId?: string;
  vendorName?: string;
  productName?: string;
  quantity: number;
  componentUom: string;
  deliveryUnit?: string;
  sortOrder?: number;
}

export interface OrderTemplate {
  id: number;
  name: string;
  vendorExternalId: string;
  vendorName: string;
  scheduleMode: 'weekday' | 'monthday' | '';
  weekdays: string[];
  monthDays: number[];
  repeatEnabled: boolean;
  companyId?: number | null;
  locationExternalIds?: string[];
  createdAt: string;
  updatedAt: string;
  items: OrderTemplateItem[];
}

export interface UpsertOrderTemplatePayload {
  name: string;
  vendorExternalId?: string;
  vendorName?: string;
  scheduleMode?: 'weekday' | 'monthday' | '';
  weekdays?: string[];
  monthDays?: number[];
  repeatEnabled: boolean;
  companyId?: number | null;
  locationExternalIds: string[];
  items: Omit<OrderTemplateItem, 'id' | 'sortOrder'>[];
}

export interface ProductComponentItem {
  id?: number;
  componentId: string;
  componentName: string;
  componentUom: string;
  componentUomPrice: number;
  quantity: number;
  subtotal: number;
  sortOrder?: number;
}

export interface ProductAlias {
  id: number;
  name: string;
  rrp: number;
  sortOrder?: number;
}

export interface Product {
  id: number;
  productId: string;
  name: string;
  category: string;
  group: string;
  isSubProduct: boolean;
  b2cEnabled: boolean;
  b2bEnabled: boolean;
  b2bPackageUnit?: string;
  totalCost: number;
  packagingCost: number;
  rrp: number;
  previousTotalCost?: number | null;
  previousPackagingCost?: number | null;
  previousRrp?: number | null;
  yieldQuantity: number;
  yieldUom: string;
  expiryPeriodDays: number;
  posEnabled: boolean;
  active: boolean;
  companyId?: number | null;
  locationExternalIds?: string[];
  createdAt: string;
  updatedAt: string;
  items: ProductComponentItem[];
  packagingItems?: ProductComponentItem[];
  aliases?: ProductAlias[];
}

export interface UpsertProductAliasPayload {
  id?: number;
  name: string;
  rrp: number;
}

export interface UpsertProductPayload {
  productId?: string;
  name: string;
  category: string;
  group: string;
  isSubProduct: boolean;
  b2cEnabled: boolean;
  b2bEnabled: boolean;
  rrp?: number;
  yieldQuantity?: number;
  yieldUom?: string;
  expiryPeriodDays?: number;
  posEnabled?: boolean;
  active?: boolean;
  companyId?: number | null;
  locationExternalIds: string[];
  items: Omit<ProductComponentItem, 'id' | 'subtotal' | 'sortOrder'>[];
  packagingItems?: Omit<ProductComponentItem, 'id' | 'subtotal' | 'sortOrder'>[];
  aliases?: UpsertProductAliasPayload[];
}

export interface PatchProductPayload {
  posEnabled?: boolean;
  active?: boolean;
  rrp?: number;
  locationExternalIds?: string[];
}

export interface ProductManagementSummary {
  productId: number;
  batchUnit: string;
  packageUnit?: string;
  batchSize?: number;
  isSubProduct?: boolean;
  inStock: number;
  salesPerDay: number;
  toProduceQty: number;
  producedQty: number;
  expiryDate?: string | null;
  batchLogId?: number | null;
  isSummaryRow?: boolean;
  isPrimaryRow?: boolean;
  batchNumber?: string | null;
  productionDate?: string | null;
  batchQty?: number | null;
}

export interface ProduceBatchPayload {
  locationExternalIds: string[];
  batchQty: number;
  productionDate?: string;
  expiryDate?: string;
  overrideStock?: boolean;
}

export interface PatchProductionBatchPayload {
  batchQty: number;
  productionDate?: string;
  expiryDate?: string;
  overrideStock?: boolean;
}

export interface ProduceBatchShortage {
  locationExternalId: string;
  componentId: string;
  componentName: string;
  requiredQty: number;
  onHandQty: number;
  uom: string;
  isSufficient?: boolean;
}

export class ApiError extends Error {
  shortages?: ProduceBatchShortage[];
  components?: ProduceBatchShortage[];

  constructor(message: string, shortages?: ProduceBatchShortage[], components?: ProduceBatchShortage[]) {
    super(message);
    this.name = 'ApiError';
    this.shortages = shortages;
    this.components = components;
  }
}

export interface ProduceBatchResult {
  productId: number;
  batchUnit: string;
  packageUnit?: string;
  batchSize?: number;
  isSubProduct?: boolean;
  inStock: number;
  salesPerDay: number;
  toProduceQty: number;
}

export interface PatchProductManagementPayload {
  packageUnit?: string;
  inStock?: number;
  salesPerDay?: number;
  locationExternalIds: string[];
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

export type StockCardItemType = 'component' | 'product' | 'sub-product';

export interface StockCardListRow {
  itemType: StockCardItemType;
  itemKey: string;
  group: string;
  name: string;
  inboundQty: number;
  outboundQty: number;
  adjustmentQty: number;
  onHandQty: number;
  averageCogs: number;
  uom: string;
  recipeUom: string;
  inventoryUom: string;
}

export type StockCardEntryType =
  | 'balance_forward'
  | 'purchase'
  | 'cash_purchase'
  | 'transfer_in'
  | 'transfer_out'
  | 'online_order'
  | 'offline_order'
  | 'pos_sale'
  | 'wastage'
  | 'production'
  | 'adjustment_in'
  | 'adjustment_out'
  | 'adjustment'
  | 'inbound'
  | 'outbound';

export interface StockCardLedgerEntry {
  id: number;
  occurredAt: string;
  entryType: StockCardEntryType;
  quantity: number;
  signedQty: number;
  uom: string;
  unitPrice: number;
  reason: string;
  referenceNumber: string;
  fifoDetail: string;
  runningBalance: number;
  averageCogsAfter: number;
  fifoPolicy: string;
}

export interface StockCardDetail {
  itemType: StockCardItemType;
  itemKey: string;
  group: string;
  name: string;
  uom: string;
  recipeUom: string;
  inventoryUom: string;
  balanceForward: number;
  inboundQty: number;
  outboundQty: number;
  adjustmentQty: number;
  onHandQty: number;
  averageCogs: number;
  fifoPolicy: string;
  periodMonth: string;
  periodStart: string;
  periodEnd: string;
  archiveCutoff: string;
  isCurrentMonth: boolean;
  historyRetentionYears: number;
  entries: StockCardLedgerEntry[];
}

export interface ProgressData {
  overallPercent: number;
  completedCount: number;
  totalCount: number;
  lastUpdated: string;
  milestones: { phase: string; items: { id: number; title: string; status: string; progressPercent: number; notes?: string }[] }[];
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
    let shortages: ProduceBatchShortage[] | undefined;
    let components: ProduceBatchShortage[] | undefined;
    try {
      const parsed = JSON.parse(text) as {
        message?: string;
        title?: string;
        shortages?: ProduceBatchShortage[];
        components?: ProduceBatchShortage[];
      };
      message = parsed.message ?? parsed.title ?? message;
      if (Array.isArray(parsed.components) && parsed.components.length > 0) {
        components = parsed.components;
      }
      if (Array.isArray(parsed.shortages) && parsed.shortages.length > 0) {
        shortages = parsed.shortages;
      }
    } catch {
      if (text) message = text;
    }
    if (components?.length || shortages?.length) {
      throw new ApiError(message, shortages, components);
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
  ensureVendorShareToken: (id: number) =>
    fetchJsonWithMethod<PurchaseOrder>(`/api/purchaseorders/${id}/ensure-share-token`, 'POST'),
  createPurchaseOrders: (payload: CreatePurchaseOrdersBatchPayload) =>
    fetchJsonWithMethod<PurchaseOrder[]>('/api/purchaseorders/batch', 'POST', payload),
  approvePurchaseOrder: (id: number, approvedBy: string) =>
    fetchJsonWithMethod<PurchaseOrder>(`/api/purchaseorders/${id}/approve`, 'POST', { approvedBy }),
  receivePurchaseOrder: (id: number, payload: PurchaseOrderWorkflowPayload) =>
    fetchJsonWithMethod<PurchaseOrder>(`/api/purchaseorders/${id}/receive`, 'POST', payload),
  reconcilePurchaseOrder: (id: number, payload: PurchaseOrderWorkflowPayload) =>
    fetchJsonWithMethod<ReconcilePurchaseOrderResult>(`/api/purchaseorders/${id}/reconcile`, 'POST', payload),
  userNotifications: (userId: number, recipientName: string, unreadOnly = false) => {
    const params = new URLSearchParams({
      userId: String(userId),
      recipientName,
      unreadOnly: String(unreadOnly),
    });
    return fetchJson<UserNotification[]>(`/api/notifications?${params}`);
  },
  markNotificationRead: (id: number) =>
    fetchJsonWithMethod<UserNotification>(`/api/notifications/${id}/read`, 'POST'),
  vendorOrderPortal: (token: string) => fetchJson<VendorOrderPortal>(`/api/vendor-orders/${token}`),
  acceptVendorOrder: (token: string, acceptedBy?: string) =>
    fetchJsonWithMethod<VendorOrderPortal>(`/api/vendor-orders/${token}/accept`, 'POST', { acceptedBy }),
  vendorProductPrices: () => fetchJson<VendorProductPriceRow[]>('/api/vendorproducts/prices'),
  inventoryPurchases: (companyId?: number) =>
    fetchJson<InventoryPurchase[]>(`/api/inventory/purchases${companyId ? `?companyId=${companyId}` : ''}`),
  cashPurchases: (companyId?: number) =>
    fetchJson<CashPurchase[]>(`/api/cashpurchases${companyId ? `?companyId=${companyId}` : ''}`),
  createCashPurchase: (payload: CreateCashPurchasePayload) =>
    fetchJsonWithMethod<CreateCashPurchaseResult>('/api/cashpurchases', 'POST', payload),
  orderTemplates: (companyId?: number) =>
    fetchJson<OrderTemplate[]>(`/api/ordertemplates${companyId ? `?companyId=${companyId}` : ''}`),
  orderTemplate: (id: number) => fetchJson<OrderTemplate>(`/api/ordertemplates/${id}`),
  createOrderTemplate: (payload: UpsertOrderTemplatePayload) =>
    fetchJsonWithMethod<OrderTemplate>('/api/ordertemplates', 'POST', payload),
  updateOrderTemplate: (id: number, payload: UpsertOrderTemplatePayload) =>
    fetchJsonWithMethod<OrderTemplate>(`/api/ordertemplates/${id}`, 'PUT', payload),
  deleteOrderTemplate: (id: number) =>
    fetchJsonWithMethod<void>(`/api/ordertemplates/${id}`, 'DELETE'),
  products: (companyId?: number) =>
    fetchJson<Product[]>(`/api/products${companyId ? `?companyId=${companyId}` : ''}`),
  product: (id: number) => fetchJson<Product>(`/api/products/${id}`),
  createProduct: (payload: UpsertProductPayload) =>
    fetchJsonWithMethod<Product>('/api/products', 'POST', payload),
  updateProduct: (id: number, payload: UpsertProductPayload) =>
    fetchJsonWithMethod<Product>(`/api/products/${id}`, 'PUT', payload),
  patchProduct: (id: number, payload: PatchProductPayload) =>
    fetchJsonWithMethod<Product>(`/api/products/${id}`, 'PATCH', payload),
  deleteProduct: (id: number) =>
    fetchJsonWithMethod<void>(`/api/products/${id}`, 'DELETE'),
  productManagement: (companyId: number | undefined, locationIds: string[]) => {
    const params = new URLSearchParams();
    if (companyId) params.set('companyId', String(companyId));
    if (locationIds.length > 0) params.set('locationIds', locationIds.join(','));
    const query = params.toString();
    return fetchJson<ProductManagementSummary[]>(`/api/product-management${query ? `?${query}` : ''}`);
  },
  patchProductManagement: (productId: number, payload: PatchProductManagementPayload) =>
    fetchJsonWithMethod<ProductManagementSummary>(`/api/product-management/${productId}`, 'PATCH', payload),
  markProductToProduce: (productId: number, payload: { locationExternalIds: string[]; batchQty: number; productionDate?: string }) =>
    fetchJsonWithMethod<ProductManagementSummary>(
      `/api/product-management/${productId}/to-produce`,
      'POST',
      payload,
    ),
  produceProductBatches: (productId: number, payload: ProduceBatchPayload) =>
    fetchJsonWithMethod<ProductManagementSummary>(
      `/api/product-management/${productId}/produce`,
      'POST',
      payload,
    ),
  patchProductionBatch: (batchLogId: number, payload: PatchProductionBatchPayload) =>
    fetchJsonWithMethod<ProductManagementSummary>(
      `/api/product-management/batches/${batchLogId}`,
      'PATCH',
      payload,
    ),
  recordProductSale: (productId: number, payload: { locationExternalIds: string[]; quantitySold: number; salesChannel?: 'pos' | 'online' | 'offline' }) =>
    fetchJsonWithMethod<void>(
      `/api/product-management/${productId}/record-sale`,
      'POST',
      payload,
    ),
  stockCards: (
    companyId: number | undefined,
    locationIds: string[],
    options?: { itemType?: string; uomMode?: 'inventory' | 'recipe'; period?: string },
  ) => {
    const params = new URLSearchParams();
    if (companyId) params.set('companyId', String(companyId));
    if (locationIds.length > 0) params.set('locationIds', locationIds.join(','));
    if (options?.itemType) params.set('itemType', options.itemType);
    if (options?.uomMode) params.set('uomMode', options.uomMode);
    if (options?.period) params.set('period', options.period);
    const query = params.toString();
    return fetchJson<StockCardListRow[]>(`/api/stock-cards${query ? `?${query}` : ''}`);
  },
  stockCardDetail: (
    itemType: string,
    itemKey: string,
    companyId: number | undefined,
    locationIds: string[],
    options?: { uomMode?: 'inventory' | 'recipe'; period?: string },
  ) => {
    const params = new URLSearchParams();
    if (companyId) params.set('companyId', String(companyId));
    if (locationIds.length > 0) params.set('locationIds', locationIds.join(','));
    if (options?.uomMode) params.set('uomMode', options.uomMode);
    if (options?.period) params.set('period', options.period);
    const query = params.toString();
    return fetchJson<StockCardDetail>(`/api/stock-cards/${encodeURIComponent(itemType)}/${encodeURIComponent(itemKey)}${query ? `?${query}` : ''}`);
  },
  inventoryAlerts: () => fetchJson<InventoryAlert[]>('/api/inventory/alerts'),
  revenue: (period = 'week') => fetchJson<RevenuePoint[]>(`/api/revenue?period=${period}`),
  progress: () => fetchJson<ProgressData>('/api/progress'),
};
