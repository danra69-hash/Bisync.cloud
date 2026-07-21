const API_BASE = import.meta.env.VITE_API_URL ?? '';

const TENANT_COMPANY_KEY = 'bisync.selectedCompanyId';
const TENANT_USER_KEY = 'bisync.currentUserId';

/** Persist UI-selected company so API calls send X-Bisync-Company-Id. */
export function setApiTenantCompanyId(companyId: number | null | undefined) {
  if (companyId == null || companyId <= 0) {
    localStorage.removeItem(TENANT_COMPANY_KEY);
    return;
  }
  localStorage.setItem(TENANT_COMPANY_KEY, String(companyId));
}

function tenantHeaders(extra?: HeadersInit): HeadersInit {
  const headers: Record<string, string> = {};
  const companyId = localStorage.getItem(TENANT_COMPANY_KEY);
  const userId = localStorage.getItem(TENANT_USER_KEY);
  if (companyId) headers['X-Bisync-Company-Id'] = companyId;
  if (userId) headers['X-Bisync-User-Id'] = userId;
  try {
    const devToken = localStorage.getItem('bisync.devConsoleToken');
    if (devToken) headers['X-Bisync-Dev-Console-Token'] = devToken;
  } catch {
    // ignore
  }
  if (extra) {
    const e = new Headers(extra);
    e.forEach((v, k) => {
      headers[k] = v;
    });
  }
  return headers;
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: tenantHeaders() });
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
  businessTypesJson: string;
  vendorPolicyTagsJson: string;
  modulesJson: string;
  modulesOverridden?: boolean;
  profileOverridden?: boolean;
  /** Weekly opening hours + last-order times (JSON). */
  openingHoursJson?: string;
}

export interface Company {
  id: number;
  name: string;
  code?: string;
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
  businessTypesJson: string;
  vendorPolicyTagsJson: string;
  modulesJson: string;
  locationCount?: number;
  /** Outbound SMTP for purchase-order email (per company). */
  smtpHost?: string;
  smtpPort?: number;
  smtpUseSsl?: boolean;
  smtpUsername?: string;
  /** Write-only; leave empty to keep the saved password. */
  smtpPassword?: string;
  smtpFromEmail?: string;
  smtpFromName?: string;
  smtpPasswordSet?: boolean;
  /** auto | microsoft | google | custom */
  smtpProviderMode?: string;
  smtpProviderId?: string;
  smtpProviderLabel?: string;
  smtpProviderTip?: string;
  /** Microsoft Graph (Azure AD) — for microsoft-graph provider mode. */
  graphTenantId?: string;
  graphClientId?: string;
  /** Write-only; leave empty to keep the saved secret. */
  graphClientSecret?: string;
  graphClientSecretSet?: boolean;
}

export interface AccessControlSettings {
  typesJson: string;
  matrixJson: string;
}

export interface CogsAuditIngredientRow {
  itemType: string;
  itemKey: string;
  code: string;
  name: string;
  group: string;
  uom: string;
  openQty: number;
  openVal: number;
  debitQty: number;
  debitVal: number;
  creditQty: number;
  creditCogs: number;
  beforeInvQty: number;
  beforeInvVal: number;
  meDebitQty: number;
  meDebitVal: number;
  meCreditQty: number;
  meCreditCogs: number;
  closeQty: number;
  closeVal: number;
  shortageQty: number;
  shortageVal: number;
  shortageUomPrice: number;
  averageCogs: number;
  onHandAverageCogs: number;
}

export interface CogsAuditSummaryResult {
  periodMonth: string;
  debitSign: string;
  creditSign: string;
  policy: string;
  ingredientCount: number;
  openingValue: number;
  beforeInventoryValue: number;
  creditCogsBeforeInventory: number;
  closingValue: number;
  shortageQty: number;
  shortageValue: number;
  rows: CogsAuditIngredientRow[];
}

export interface CogsAuditLedgerLine {
  seq: number;
  occurredAt: string;
  lineType: string;
  entryType: string;
  refId: string;
  remark: string;
  debitQty: number;
  creditQty: number;
  unitPrice: number;
  fifoValue: number;
  runningQty: number;
  runningValue: number;
  fifoDetail: string;
  fifoPolicy: string;
}

export interface CogsAuditDetailResult {
  itemType: string;
  itemKey: string;
  code: string;
  name: string;
  group: string;
  uom: string;
  periodMonth: string;
  periodStart: string;
  periodEnd: string;
  isCurrentMonth: boolean;
  fifoPolicy: string;
  canvasLineCount: number;
  summary: CogsAuditIngredientRow;
  lines: CogsAuditLedgerLine[];
}

export interface SystemCogsAuditHistoryEntry {
  runId: string;
  companyId: number | null;
  companyName: string;
  locationExternalId: string;
  locationName: string;
  periodMonth: string;
  monthName: string;
  year: number;
  uomMode: string;
  isRevised: boolean;
  createdAtUtc: string;
  revisedAtUtc: string | null;
  trigger: string;
  relativePath: string;
  ingredientCount: number;
  openingValue: number;
  closingValue: number;
  shortageValue: number;
}

export interface SystemCogsAuditHistoryFile {
  entry: SystemCogsAuditHistoryEntry;
  summary: CogsAuditSummaryResult;
}

export type SystemAuditMonthBucket = {
  year: number;
  month: number;
  count: number;
};

export type SystemAuditEventRow = {
  id: number;
  occurredAtUtc: string;
  occurredAtLocal: string;
  timeZoneId: string;
  year: number;
  month: number;
  category: string;
  action: string;
  companyId: number | null;
  companyName: string | null;
  countryCode: string | null;
  locationId: number | null;
  locationExternalId: string | null;
  locationName: string | null;
  databaseBucket: string | null;
  userId: number | null;
  userEmail: string | null;
  userName: string | null;
  entityType: string | null;
  entityKey: string | null;
  summary: string;
  detailsJson: string;
  activityType?: string;
  activityDetail?: string;
  effectedDbBucket?: string | null;
};

export type SystemAuditListResponse = {
  companyId?: number;
  locationId?: number;
  year: number;
  month: number;
  total: number;
  take: number;
  skip: number;
  retentionNote: string;
  rows: SystemAuditEventRow[];
};

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
  preferredLanguage?: string | null;
  phoneCountryCode?: string | null;
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
  requestedBy?: string;
}

export type VendorPaymentTerms = 'cod' | 'prepaid' | 'postpaid';

export interface VendorEngagement {
  id: number;
  externalId: string;
  name: string;
  type: string;
  brn: string;
  engaged: boolean;
  engagementStatus: 'none' | 'pending' | 'approved' | 'rejected' | string;
  linkedCompanyId?: number | null;
  minOrderAmount?: number | null;
  deliveryChargeBelowMin?: number | null;
  paymentTerms?: string;
  engageRequestedAt?: string | null;
  engageRequestedBy?: string;
  engageApprovedAt?: string | null;
  engageApprovedBy?: string;
  contactPerson?: string;
  mobile?: string;
  email?: string;
  companyId?: number | null;
}

export interface ApproveVendorEngagementPayload {
  minOrderAmount: number;
  deliveryChargeBelowMin: number;
  paymentTerms: VendorPaymentTerms | string;
  approvedBy?: string;
}

export interface Vendor {
  id: number;
  companyId?: number | null;
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
  contactsJson: string;
  engaged: boolean;
  engagementStatus?: string;
  linkedCompanyId?: number | null;
  minOrderAmount?: number | null;
  deliveryChargeBelowMin?: number | null;
  paymentTerms?: string;
  engageRequestedAt?: string | null;
  engageRequestedBy?: string;
  engageApprovedAt?: string | null;
  engageApprovedBy?: string;
  productPolicyTag?: VendorProductPolicyTag;
  active?: boolean;
}

export type VendorRatingLevel = 'satisfied' | 'acceptable' | 'poor';

export interface VendorRatingScoreBucket {
  count: number;
  scorePercent: number;
  weight?: number;
}

export interface VendorRatingSummary {
  vendorExternalId: string;
  vendorType: string;
  vendorKind: string;
  overallRating: number | null;
  hasRating: boolean;
  control: string;
  overallMood?: string;
}

export interface VendorRatingDetail {
  vendorExternalId: string;
  vendorName: string;
  vendorType: string;
  vendorKindLabel: string;
  control: string;
  controlNote: string;
  overallRating: number | null;
  overallMood?: string;
  hasRating: boolean;
  updatedAt?: string | null;
  updatedBy?: string;
  delivery?: string | null;
  notes?: string;
  orderAcceptance?: {
    orderCount: number;
    within4Hours: VendorRatingScoreBucket;
    within8Hours: VendorRatingScoreBucket;
    beyond9Hours: VendorRatingScoreBucket;
    averagePercent: number | null;
    mood: string;
  } | null;
  poAcceptance?: {
    orderCount: number;
    withoutChanges: VendorRatingScoreBucket;
    withQuantityOrPriceChange: VendorRatingScoreBucket;
    quantityZeroOutOfStock: VendorRatingScoreBucket;
    averagePercent: number | null;
  } | null;
  productAccuracy?: {
    orderCount: number;
    withoutChanges: VendorRatingScoreBucket;
    changedLinesUnder30Pct: VendorRatingScoreBucket;
    changedLinesOver30Pct: VendorRatingScoreBucket;
    averagePercent: number | null;
  } | null;
  productQuality?: {
    responseCount: number;
    averagePercent: number | null;
    satisfied: number;
    acceptable: number;
    poor: number;
  } | null;
  hygieneCleanliness?: {
    responseCount: number;
    averagePercent: number | null;
    satisfied: number;
    acceptable: number;
    poor: number;
  } | null;
  temperatureReadings?: {
    poNumber: string;
    productName: string;
    vendorProductId: string;
    temperature: number;
    recordedAt?: string | null;
  }[];
}

export interface UpsertVendorRatingPayload {
  delivery: VendorRatingLevel;
  productAccuracy?: VendorRatingLevel;
  productQuality?: VendorRatingLevel;
  hygieneCleanliness?: VendorRatingLevel;
  notes?: string;
  updatedBy?: string;
  companyId?: number;
}

export type VendorProductPolicyTag = 'halal' | 'muslim-friendly' | 'non-halal';

export interface VendorCreatePayload {
  companyId?: number;
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
  productPolicyTag: VendorProductPolicyTag;
}

export interface VendorUpdatePayload {
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
  productPolicyTag: VendorProductPolicyTag;
}

export interface B2bCustomerContact {
  id: string;
  name: string;
  position: string;
  mobile: string;
  email: string;
  isDefault: boolean;
}

export interface B2bPurchaseHistoryLine {
  dateOrdered: string;
  dateDelivered: string;
  productName: string;
  deliveryUom: string;
  rrp: number;
  qtyOrdered: number;
  actualRrp: number;
  totalRevenue: number;
  cogs: number;
  cogsPercent: number;
}

export interface B2bCustomer {
  id: number;
  companyId: number;
  externalId: string;
  companyName: string;
  brn: string;
  address: string;
  city: string;
  state: string;
  postcode: string;
  phone: string;
  fax: string;
  email: string;
  contactsJson: string;
  taggedProductIdsJson: string;
  taggedProductAliasIdsJson: string;
  taggedB2bProductUnitsJson: string;
  purchaseHistoryJson: string;
  active: boolean;
}

export interface UpsertB2bCustomerPayload {
  companyId: number;
  externalId: string;
  companyName: string;
  brn: string;
  address: string;
  city: string;
  state: string;
  postcode: string;
  phone: string;
  fax: string;
  email: string;
  contacts: B2bCustomerContact[];
  taggedProductIds: number[];
  taggedProductAliasIds: number[];
  taggedB2bProductUnits: TaggedB2bProductUnit[];
  purchaseHistory: B2bPurchaseHistoryLine[];
  active: boolean;
}

export interface B2bSalesOrderLine {
  id: number;
  productId: number;
  productAliasId?: number | null;
  productName: string;
  locationExternalId: string;
  quantityOrdered: number;
  quantityLocked?: number;
  uom: string;
  rrp: number;
  status: string;
}

export interface B2bSalesOrder {
  id: number;
  companyId: number;
  orderNumber: string;
  customerExternalId: string;
  customerName: string;
  source: string;
  sourcePurchaseOrderId?: number | null;
  status: string;
  lockPeriodDays: number;
  issuedDate?: string | null;
  lockExpiryDate?: string | null;
  fulfilledDate?: string | null;
  deliveryOrderIssued?: boolean;
  invoiceIssued?: boolean;
  shareToken?: string | null;
  customerAcceptedAt?: string | null;
  customerAcceptedBy?: string | null;
  createdAt: string;
  updatedAt: string;
  lines: B2bSalesOrderLine[];
}

export interface B2bSalesOrderSharePayload {
  order: B2bSalesOrder;
  canAccept?: boolean;
  customerAcceptedAt?: string | null;
  customerAcceptedBy?: string | null;
  company: {
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
    email: string;
  } | null;
  customer: {
    companyName: string;
    brn: string;
    address: string;
    city: string;
    state: string;
    postcode: string;
    phone: string;
    email: string;
    contactsJson: string;
  } | null;
}

export interface CreateB2bSalesOrderPayload {
  companyId: number;
  customerExternalId: string;
  customerName: string;
  source?: string;
  lockPeriodDays: number;
  lines: {
    productId: number;
    productAliasId?: number | null;
    locationExternalId: string;
    quantityOrdered: number;
    uom?: string;
    rrp?: number;
  }[];
}

export interface TaggedB2bProductUnit {
  productId: number;
  aliasId: number | null;
  unitKey: string;
  /** Customer selling price used on sales orders / invoices when > 0. */
  appliedRrp?: number | null;
  /** Discount off published RRP (0–100). Kept in sync with appliedRrp. */
  discountPercent?: number | null;
}

export interface PosDeliveryUnitSelection {
  unitKey: string;
}

export type PosActivityType = 'Dine-in' | 'Take-out' | 'Pick-up' | 'Online Delivery';

export interface PosLoyaltyYearSummary {
  year: number;
  earned: number;
  used: number;
  balance: number;
}

export interface PosCouponYearSummary {
  year: number;
  received: number;
  used: number;
}

export interface PosReceiptLine {
  itemName: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface PosCustomerActivity {
  activityDate: string;
  activityLocation: string;
  activityType: PosActivityType | string;
  checkNo: string;
  totalSpending: number;
  pointsEarned: number;
  pointsUsed: number;
  pointsBalance: number;
  couponUsed?: string | null;
  receiptLines?: PosReceiptLine[];
}

export interface PosCustomer {
  id: number;
  companyId: number;
  externalId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  postcode: string;
  phone: string;
  fax: string;
  email: string;
  loyaltySummaryJson: string;
  couponSummaryJson: string;
  activityHistoryJson: string;
  active: boolean;
}

export interface UpsertPosCustomerPayload {
  companyId: number;
  externalId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  postcode: string;
  phone: string;
  fax: string;
  email: string;
  loyaltySummary: PosLoyaltyYearSummary[];
  couponSummary: PosCouponYearSummary[];
  activityHistory: PosCustomerActivity[];
  active: boolean;
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
  halalCertNo?: string;
  productExpiryDate?: string | null;
  receivedTemperature?: number | null;
}

export interface PurchaseOrder {
  id: number;
  poNumber: string;
  vendorName: string;
  vendorExternalId?: string;
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
  vendorDoNumber?: string | null;
  vendorInvoiceNumber?: string | null;
  productQualityRating?: string | null;
  productQualityComment?: string | null;
  hygieneRating?: string | null;
  hygieneComment?: string | null;
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
  vendorExternalId?: string;
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
  halalCertNo?: string;
  productExpiryDate?: string;
  receivedTemperature?: number | null;
}

export interface PurchaseOrderWorkflowPayload {
  items: PurchaseOrderLineWorkflowPayload[];
  vendorDoNumber?: string;
  vendorInvoiceNumber?: string;
  productQualityRating?: string;
  productQualityComment?: string;
  hygieneRating?: string;
  hygieneComment?: string;
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
  transferId?: number | null;
  type: string;
  title: string;
  body: string;
  createdAt: string;
  readAt?: string | null;
  isRead: boolean;
}

export interface VendorOrderPortalItem {
  id?: number;
  name: string;
  deliveryPackage: string;
  quantity: number;
  unitPrice: number;
  issuedUnitPrice?: number;
}

export interface QuoteLineVendorResponse {
  deliveryUnitText: string;
  rrp: number;
  notes?: string;
}

export interface QuoteRequestLineView {
  id: number;
  kind: 'principal' | 'other' | string;
  sortOrder: number;
  componentId?: number | null;
  componentExternalId: string;
  componentName: string;
  specification?: string;
  principalUom: string;
  requestedQty: number;
  vendorResponses: Record<string, QuoteLineVendorResponse>;
}

export interface QuoteRequestVendorView {
  id: number;
  vendorId?: number | null;
  vendorExternalId: string;
  vendorName: string;
  contactPerson: string;
  email: string;
  mobile: string;
  isNewVendor: boolean;
  shareToken: string;
  status: string;
  submittedAt?: string | null;
  submittedBy?: string;
}

export interface QuoteRequestCompanyView {
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
  countryCode?: string;
}

export interface QuoteRequestLocationView {
  name: string;
  externalId: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateProvince: string;
  postcode: string;
}

export interface QuoteRequestDetail {
  id: number;
  rfqNumber: string;
  companyId: number;
  locationIds: string[];
  status: string;
  notes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  company: QuoteRequestCompanyView | null;
  locations: QuoteRequestLocationView[];
  vendors: QuoteRequestVendorView[];
  lines: QuoteRequestLineView[];
}

export interface QuoteRequestSummary {
  id: number;
  rfqNumber: string;
  companyId: number;
  locationIds: string[];
  status: string;
  notes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  vendorCount: number;
  lineCount: number;
  submittedCount: number;
  vendors: {
    id: number;
    vendorExternalId: string;
    vendorName: string;
    status: string;
    submittedAt?: string | null;
    shareToken: string;
  }[];
  lines?: {
    id: number;
    kind: string;
    componentId?: number | null;
    componentName: string;
    specification?: string;
    principalUom: string;
    requestedQty: number;
    vendorResponses: Record<string, QuoteLineVendorResponse>;
  }[];
}

export interface CreateQuoteRequestPayload {
  companyId: number;
  locationExternalIds: string[];
  notes?: string;
  createdBy?: string;
  vendors: {
    vendorId?: number | null;
    vendorExternalId?: string;
    vendorName: string;
    contactPerson: string;
    email: string;
    mobile: string;
    isNewVendor: boolean;
  }[];
  lines: {
    kind: 'principal' | 'other';
    componentId?: number | null;
    componentExternalId?: string;
    componentName: string;
    specification?: string;
    principalUom?: string;
    requestedQty?: number;
  }[];
}

export interface VendorRfqPortalLine {
  id: number;
  kind: string;
  componentName: string;
  specification?: string;
  deliveryUnitText: string;
  rrp: number;
  responseNotes: string;
}

export interface VendorRfqPortal {
  rfqId: number;
  rfqNumber: string;
  status: string;
  submittedAt?: string | null;
  submittedBy?: string;
  canSubmit: boolean;
  notes: string;
  company: QuoteRequestCompanyView | null;
  locations: QuoteRequestLocationView[];
  lines: VendorRfqPortalLine[];
}

export interface SubmitVendorRfqPayload {
  submittedBy?: string;
  responses: {
    lineId: number;
    deliveryUnitText: string;
    rrp: number;
    notes?: string;
  }[];
}

export interface SampleRequestSummary {
  id: number;
  requestNumber: string;
  templateType?: string;
  companyId: number;
  dateRequested: string;
  contactPersonName: string;
  companyRequested: string;
  customerName: string;
  vendorExternalId?: string;
  projectName: string;
  projectScope?: string;
  requestType?: string;
  expectedSalesAmountPerYear?: number;
  productCategory?: string;
  productGroup?: string;
  productPolicyTag?: string;
  quantityRequested?: number;
  quantityUom?: string;
  shareToken: string;
  vendorAcceptedAt?: string | null;
  status: string;
  createdAt: string;
  updatedAt?: string;
}

export interface SampleRequestProductSample {
  name: string;
  description: string;
}

export interface SampleRequestDetail {
  id: number;
  requestNumber: string;
  templateType?: string;
  companyId: number;
  dateRequested: string;
  contactEmployeeId?: number | null;
  contactPersonName: string;
  companyRequested: string;
  customerExternalId: string;
  customerName: string;
  vendorExternalId?: string;
  vendorAddress?: string;
  vendorContactPerson?: string;
  vendorContactMobile?: string;
  vendorContactEmail?: string;
  ingredientComponentId?: string;
  productPolicyTag?: string;
  vendorAcceptedAt?: string | null;
  vendorAcceptedBy?: string;
  canAccept?: boolean;
  isNewCustomer: boolean;
  projectScope: 'new' | 'ongoing' | string;
  requestType: 'new_submission' | 'repeat' | 'modification' | string;
  modificationDetails: string;
  projectName: string;
  deliveryUnit: string;
  expectedQtyPerYear: number;
  expectedPrice: number;
  expectedSalesAmountPerYear: number;
  productCategory: string;
  productGroup: string;
  productSamples: SampleRequestProductSample[];
  waterSoluble: boolean;
  oilSoluble: boolean;
  flavourNatural: boolean;
  flavourNaturalIdentical: boolean;
  flavourArtificial: boolean;
  quantityRequested: number;
  quantityUom: string;
  targetProducts: string;
  gmoStatus: string;
  allergenStatus: string;
  allergenFreeFromDetail: string;
  mcpdHvpFreeDetail: string;
  halalCertified: boolean;
  halalCompliantAccepted: boolean;
  countryRdSite: string;
  countryManufacturing: string;
  countryInUse: string;
  regulatoryRequirement: string;
  regulatoryRequirementDetail: string;
  customerDeadline?: string | null;
  shareToken: string;
  status: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSampleRequestPayload {
  templateType?: string;
  companyId: number;
  dateRequested: string;
  contactEmployeeId?: number | null;
  contactPersonName: string;
  companyRequested: string;
  customerExternalId?: string;
  customerName: string;
  isNewCustomer?: boolean;
  vendorExternalId?: string;
  vendorAddress?: string;
  vendorContactPerson?: string;
  vendorContactMobile?: string;
  vendorContactEmail?: string;
  ingredientComponentId?: string;
  productPolicyTag?: string;
  projectScope?: 'new' | 'ongoing';
  requestType?: 'new_submission' | 'repeat' | 'modification';
  modificationDetails?: string;
  projectName?: string;
  deliveryUnit?: string;
  expectedQtyPerYear?: number;
  expectedPrice?: number;
  productCategory?: string;
  productGroup?: string;
  productSamples: SampleRequestProductSample[];
  waterSoluble?: boolean;
  oilSoluble?: boolean;
  flavourNatural?: boolean;
  flavourNaturalIdentical?: boolean;
  flavourArtificial?: boolean;
  quantityRequested?: number;
  quantityUom?: string;
  targetProducts?: string;
  gmoStatus?: string;
  allergenStatus?: string;
  allergenFreeFromDetail?: string;
  mcpdHvpFreeDetail?: string;
  halalCertified?: boolean;
  halalCompliantAccepted?: boolean;
  countryRdSite?: string;
  countryManufacturing?: string;
  countryInUse?: string;
  regulatoryRequirement?: string;
  regulatoryRequirementDetail?: string;
  customerDeadline?: string | null;
  createdBy?: string;
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
  allowLineAdjustments?: boolean;
  vendorExternalId?: string;
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

export interface RevMgmtConfigResponse {
  companyId: number;
  configKey: string;
  state: unknown;
  seeded?: boolean;
  updatedAt?: string;
}

export interface VendorProductCatalogRow {
  id: string;
  group: string;
  vendorExternalId: string;
  vendorName: string;
  productName: string;
  specification: string;
  imageUrl?: string;
  deliveryPrice: number;
  delivery: {
    orderUnit: string;
    orderQty: number;
    packUnit: string;
    packQty: number;
    unitUnit: string;
    unitQty: number;
  };
  productPolicyTag?: string;
  isPrivate?: boolean;
  privateLocationIds?: string[];
  active?: boolean;
  updatedAt?: string;
}

export interface VendorProductCatalogUpsert {
  id?: string;
  vendorExternalId: string;
  vendorName: string;
  productName: string;
  group: string;
  specification: string;
  imageUrl?: string;
  deliveryPrice: number;
  deliveryJson: string;
  productPolicyTag?: string;
  isPrivate?: boolean;
  privateLocationIds?: string[];
  active?: boolean;
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
  splitSourceType?: string;
  splitSourceId?: number;
  splitLineKey?: string;
  splitParentComponentId?: string;
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

export interface WastageEntry {
  id: number;
  companyId?: number | null;
  locationExternalId: string;
  source: 'manual' | 'pos' | string;
  itemType: 'component' | 'product' | 'sub-product' | string;
  itemKey: string;
  itemName: string;
  quantity: number;
  uom: string;
  wastedDate: string;
  reason: string;
  posCheckNo?: string | null;
  unitPrice?: number;
  totalValue?: number;
  sourceReferenceType?: string;
  sourceReferenceId?: number;
  splitUseLineKey?: string;
  isSplitUse?: boolean;
  isPos: boolean;
  createdAt: string;
}

export interface CreateWastagePayload {
  companyId?: number | null;
  locationExternalId: string;
  itemType: 'component' | 'product' | 'sub-product';
  itemKey: string;
  itemName?: string;
  quantity: number;
  uom: string;
  wastedDate: string;
  reason: string;
}

export interface CreatePosWastagePayload {
  companyId?: number | null;
  locationExternalId: string;
  productId: number;
  quantity: number;
  checkNo?: string;
  reason?: string;
  wastedDate?: string;
}

export interface TransferEntry {
  id: number;
  companyId?: number | null;
  fromLocationExternalId: string;
  toLocationExternalId: string;
  itemType: 'component' | 'product' | 'sub-product' | string;
  itemKey: string;
  itemName: string;
  quantity: number;
  uom: string;
  unitPrice?: number;
  totalValue?: number;
  transferDate: string;
  status: 'pending' | 'received' | 'rejected' | 'cancelled' | string;
  initiatedBy?: string;
  receivedBy?: string;
  receivedAt?: string | null;
  receivedQuantity?: number | null;
  rejectedBy?: string;
  rejectedAt?: string | null;
  createdAt: string;
}

export interface CreateTransferPayload {
  companyId?: number | null;
  fromLocationExternalId: string;
  toLocationExternalId: string;
  itemType: 'component' | 'product' | 'sub-product';
  itemKey: string;
  itemName?: string;
  quantity: number;
  uom: string;
  transferDate: string;
  initiatedBy?: string;
}

export interface ReceiveTransferPayload {
  companyId?: number | null;
  receivedBy?: string;
  receivedQuantity?: number;
  receivedDate?: string;
}

export interface RejectTransferPayload {
  companyId?: number | null;
  rejectedBy?: string;
}

export interface TransferAvailableQty {
  availableQty: number;
  uom: string;
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
  b2bSalesConfigJson?: string;
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
  b2bSalesConfigJson?: string;
  totalCost: number;
  packagingCost: number;
  rrp: number;
  previousTotalCost?: number | null;
  previousPackagingCost?: number | null;
  previousRrp?: number | null;
  yieldQuantity: number;
  yieldUom: string;
  yieldAltUnitsJson?: string;
  expiryPeriodDays: number;
  activationPeriodHours: number;
  orderLockPeriodDays?: number;
  parStock: number;
  parStockUom: string;
  posEnabled: boolean;
  posDeliveryUnitsJson?: string;
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
  b2bSalesConfigJson?: string;
}

export interface UpsertProductPayload {
  productId?: string;
  name: string;
  category: string;
  group: string;
  isSubProduct: boolean;
  b2cEnabled: boolean;
  b2bEnabled: boolean;
  b2bPackageUnit?: string;
  b2bSalesConfigJson?: string;
  rrp?: number;
  yieldQuantity?: number;
  yieldUom?: string;
  yieldAltUnitsJson?: string;
  expiryPeriodDays?: number;
  activationPeriodHours?: number;
  orderLockPeriodDays?: number;
  parStock?: number;
  parStockUom?: string;
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
  posDeliveryUnits?: PosDeliveryUnitSelection[];
  active?: boolean;
  rrp?: number;
  parStock?: number;
  parStockUom?: string;
  yieldAltUnitsJson?: string;
  locationExternalIds?: string[];
}

export interface ProductManagementSummary {
  productId: number;
  batchUnit: string;
  packageUnit?: string;
  batchSize?: number;
  isSubProduct?: boolean;
  inStock: number;
  onOrderQty?: number;
  orderLockPeriodDays?: number;
  lockExpiryDate?: string | null;
  onOrderLocks?: { quantity: number; lockExpiryDate: string }[];
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
  incubationQty?: number | null;
  incubationTimeLeft?: string | null;
  dateRequested?: string | null;
}

export interface SalesDataSummary {
  totalQuantity: number;
  totalValue: number;
  lineCount: number;
  productCount: number;
  customerCount: number;
}

export interface SalesDataRow {
  date: string;
  category: string;
  group: string;
  productName: string;
  uom: string;
  productType: string;
  salesChannel: string;
  qtySold: number;
  rrp: number;
  totalValue: number;
  customerName: string;
  customerExternalId: string;
  productId?: number | null;
}

export interface SalesDataResult {
  month: string;
  viewBy: 'product' | 'customer';
  summary: SalesDataSummary;
  rows: SalesDataRow[];
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
  taggedComponents?: VendorTaggedComponent[];
  code?: string;

  constructor(
    message: string,
    shortages?: ProduceBatchShortage[],
    components?: ProduceBatchShortage[],
    taggedComponents?: VendorTaggedComponent[],
    code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
    this.shortages = shortages;
    this.components = components;
    this.taggedComponents = taggedComponents;
    this.code = code;
  }
}

export interface VendorTaggedComponent {
  id: number;
  componentId: string;
  name: string;
  taggedVendorProductIds: string[];
  taggedVendorProductNames: string[];
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
  orderLockPeriodDays?: number;
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
  companyId?: number | null;
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
  createdAt?: string;
  updatedAt?: string;
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
  onHandAverageCogs: number;
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
  | 'outbound'
  | 'split_use'
  | 'split_use_in';

export interface StockCardLedgerEntry {
  id: number;
  occurredAt: string;
  entryType: StockCardEntryType;
  quantity: number;
  signedQty: number;
  uom: string;
  unitPrice: number;
  subtotal: number;
  reason: string;
  referenceNumber: string;
  fifoDetail: string;
  runningBalance: number;
  averageCogsAfter: number;
  fifoPolicy: string;
  splitIndex?: number;
  isShortage?: boolean;
  isCogsBackfilled?: boolean;
  isNegativeBalance?: boolean;
}

export interface StockCardOnHandLayer {
  quantity: number;
  unitPrice: number;
}

export interface StockCardAsOfSnapshot {
  asOfDate: string;
  locationExternalId: string;
  uom: string;
  onHandQty: number;
  layers: StockCardOnHandLayer[];
  suggestedAdjustmentInUnitPrice: number;
}

export interface CreateStockAdjustmentPayload {
  companyId?: number;
  locationIds: string;
  locationExternalId: string;
  uomMode?: 'inventory' | 'recipe';
  adjustmentDate: string;
  quantity: number;
  direction: 'in' | 'out';
  reason: string;
  inboundUom?: string;
  inboundUnitPrice?: number;
}

export type InventoryCountSessionType = 'spot' | 'full';

export interface InventoryCountSessionLine {
  itemType: StockCardItemType;
  itemKey: string;
  itemName: string;
  groupName: string;
  uom: string;
  systemQty: number;
  countedQty: number | null;
  varianceQty: number | null;
  variancePct: number | null;
  systemUnitPrice?: number | null;
  systemValue?: number;
  actualValue?: number | null;
  varianceValue?: number | null;
}

export interface InventoryCountSession {
  id: number;
  sessionType: InventoryCountSessionType;
  status: string;
  periodMonth: string;
  uomMode: 'inventory' | 'recipe';
  itemTypeFilter: string;
  groupFilter: string;
  countDate: string;
  effectiveDate: string;
  adjustmentsAppliedAt: string | null;
  savedAt: string;
  savedBy: string;
  confirmDeadlineAt: string | null;
  confirmedAt: string | null;
  confirmedBy: string;
  isAutoConfirmed: boolean;
  canSave: boolean;
  canConfirm: boolean;
  isReadOnly: boolean;
  lines: InventoryCountSessionLine[];
}

export interface SaveInventoryCountPayload {
  sessionType: InventoryCountSessionType;
  companyId?: number;
  locationIds: string;
  periodMonth: string;
  uomMode: 'inventory' | 'recipe';
  itemTypeFilter: string;
  groupFilter: string;
  countDate: string;
  savedBy: string;
  lines: {
    itemType: string;
    itemKey: string;
    itemName: string;
    groupName: string;
    uom: string;
    systemQty: number;
    countedQty: number | null;
  }[];
}

export interface InventoryCountSessionSummary {
  id: number;
  sessionType: InventoryCountSessionType;
  status: string;
  periodMonth: string;
  uomMode: 'inventory' | 'recipe';
  itemTypeFilter: string;
  groupFilter: string;
  countDate: string;
  effectiveDate: string;
  savedAt: string;
  savedBy: string;
  confirmDeadlineAt: string | null;
  confirmedAt: string | null;
  confirmedBy: string;
  isAutoConfirmed: boolean;
  canConfirm: boolean;
  lineCount: number;
  totalVarianceQty: number;
  variancePct: number | null;
}

export interface InventoryCountHistoryLine {
  sessionId: number;
  lineId: number;
  sessionType: InventoryCountSessionType;
  status: string;
  locationLabel: string;
  locationIds: string[];
  savedAt: string;
  confirmedAt: string | null;
  effectiveDate: string;
  periodMonth: string;
  itemName: string;
  category: string;
  uom: string;
  systemQty: number;
  countedQty: number | null;
  varianceQty: number | null;
  systemValue: number;
  actualValue: number | null;
  varianceValue: number | null;
  canConfirm: boolean;
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
  onHandAverageCogs: number;
  onHandLayers?: StockCardOnHandLayer[];
  fifoPolicy: string;
  periodMonth: string;
  periodStart: string;
  periodEnd: string;
  archiveCutoff: string;
  isCurrentMonth: boolean;
  historyRetentionYears: number;
  hasNegativeStock?: boolean;
  inventoryCarryForwardDate?: string | null;
  entries: StockCardLedgerEntry[];
}

export interface ProgressData {
  overallPercent: number;
  completedCount: number;
  totalCount: number;
  lastUpdated: string;
  milestones: { phase: string; items: { id: number; title: string; status: string; progressPercent: number; notes?: string }[] }[];
}

function parseApiErrorText(text: string, fallback: string): string {
  const trimmed = text.trim();
  if (!trimmed) return fallback;

  const firstLine = trimmed.split(/\r?\n/)[0]?.trim() ?? '';
  if (
    trimmed.length > 240
    || firstLine.includes('Exception')
    || /\sat\s[\w.]+/.test(trimmed)
    || firstLine.startsWith('Microsoft.')
  ) {
    return fallback;
  }

  return firstLine || fallback;
}

async function fetchJsonWithMethod<T>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: tenantHeaders(body ? { 'Content-Type': 'application/json' } : undefined),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    const fallback = `API error ${res.status}: ${path}`;
    let message = fallback;
    let shortages: ProduceBatchShortage[] | undefined;
    let components: ProduceBatchShortage[] | undefined;
    let taggedComponents: VendorTaggedComponent[] | undefined;
    let code: string | undefined;
    try {
      const parsed = JSON.parse(text) as {
        message?: string;
        title?: string;
        code?: string;
        shortages?: ProduceBatchShortage[];
        components?: ProduceBatchShortage[];
        taggedComponents?: VendorTaggedComponent[];
      };
      message = parsed.message ?? parsed.title ?? (parsed as { error?: string }).error ?? message;
      code = parsed.code;
      if (Array.isArray(parsed.components) && parsed.components.length > 0) {
        components = parsed.components;
      }
      if (Array.isArray(parsed.shortages) && parsed.shortages.length > 0) {
        shortages = parsed.shortages;
      }
      if (Array.isArray(parsed.taggedComponents) && parsed.taggedComponents.length > 0) {
        taggedComponents = parsed.taggedComponents;
      }
    } catch {
      message = parseApiErrorText(text, fallback);
    }
    if (components?.length || shortages?.length || taggedComponents?.length) {
      throw new ApiError(message, shortages, components, taggedComponents, code);
    }
    throw new Error(message);
  }
  // 204 / empty bodies (e.g. record-sale) must not call res.json()
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T;
  }
  const text = await res.text();
  if (!text.trim()) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}

export const api = {
  health: () => fetchJson<{ status: string }>('/api/health'),
  locations: () => fetchJson<Location[]>('/api/locations'),
  locationsConfig: () => fetchJson<LocationConfig[]>('/api/locations/config'),
  createLocationConfig: (data: Omit<LocationConfig, 'id' | 'externalId' | 'companyName' | 'countryCode' | 'principalContactName' | 'profileOverridden'>) =>
    fetchJsonWithMethod<LocationConfig>('/api/locations/config', 'POST', data),
  updateLocationConfig: (id: number, data: Omit<LocationConfig, 'id' | 'externalId' | 'companyName' | 'countryCode' | 'principalContactName' | 'profileOverridden'>) =>
    fetchJsonWithMethod<LocationConfig>(`/api/locations/${id}/config`, 'PUT', data),
  companies: () => fetchJson<Company[]>('/api/companies'),
  createCompany: (data: Omit<Company, 'id' | 'locationCount'>) => fetchJsonWithMethod<Company>('/api/companies', 'POST', data),
  updateCompany: (id: number, data: Company) => fetchJsonWithMethod<Company>(`/api/companies/${id}`, 'PUT', data),
  testCompanyOutboundEmail: (
    id: number,
    payload: {
      toEmail: string;
      smtpFromEmail?: string;
      smtpPassword?: string;
      smtpFromName?: string;
      smtpUsername?: string;
      smtpProviderMode?: string;
      smtpHost?: string;
      smtpPort?: number;
      smtpUseSsl?: boolean;
      graphTenantId?: string;
      graphClientId?: string;
      graphClientSecret?: string;
    },
  ) =>
    fetchJsonWithMethod<{ sent: boolean; to: string; message: string; provider?: string; smtpProviderMode?: string }>(
      `/api/companies/${id}/outbound-email/test`,
      'POST',
      payload,
    ),
  users: () => fetchJson<AppUser[]>('/api/users'),
  login: (email: string, password: string) =>
    fetchJsonWithMethod<AppUser>('/api/auth/login', 'POST', { email, password }),
  register: (data: {
    surname: string;
    givenName: string;
    email: string;
    mobile: string;
    password: string;
    confirmPassword: string;
    preferredLanguage?: string;
    phoneCountryCode?: string;
  }) =>
    fetchJsonWithMethod<{ message: string; email: string; activationUrl: string; preferredLanguage?: string }>(
      '/api/auth/register',
      'POST',
      data,
    ),
  registrationPolicy: () =>
    fetchJson<{
      demoMode: boolean;
      goLive: boolean;
      registrationRestricted: boolean;
      allowedEmailDomains: string[];
    }>('/api/auth/registration-policy'),
  geoHint: () => fetchJson<{ countryCode: string; source: string }>('/api/auth/geo-hint'),
  confirmActivation: (token: string) =>
    fetchJsonWithMethod<{ message: string; email: string }>(
      '/api/auth/confirm-activation',
      'POST',
      { token },
    ),
  completeCompanyOnboarding: (userId: number, company: Omit<Company, 'id' | 'locationCount'>) =>
    fetchJsonWithMethod<AppUser>('/api/auth/complete-company-onboarding', 'POST', {
      userId,
      company,
    }),
  completeLocationOnboarding: (
    userId: number,
    location: {
      name: string;
      addressLine1: string;
      addressLine2: string;
      city: string;
      stateProvince: string;
      postcode: string;
    },
  ) =>
    fetchJsonWithMethod<AppUser>('/api/auth/complete-location-onboarding', 'POST', {
      userId,
      location,
    }),
  provisionCompanyDb: (userIdOrCompany: { userId?: number; companyId?: number }) =>
    fetchJsonWithMethod<{
      companyId: number;
      alreadyProvisioned: boolean;
      provisioned: boolean;
      skippedByFeatureFlag: boolean;
      databaseName: string;
      archiveDatabaseName: string;
      message: string;
    }>('/api/auth/provision-company-db', 'POST', {
      userId: userIdOrCompany.userId,
      companyId: userIdOrCompany.companyId,
    }),
  availableEmployees: () => fetchJson<AvailableEmployee[]>('/api/users/available-employees'),
  createUser: (data: UserUpsert) => fetchJsonWithMethod<AppUser>('/api/users', 'POST', data),
  updateUser: (id: number, data: UserUpsert) => fetchJsonWithMethod<AppUser>(`/api/users/${id}`, 'PUT', data),
  menu: (category?: string) => fetchJson<MenuItem[]>(`/api/menu${category ? `?category=${category}` : ''}`),
  vendors: (engaged?: boolean, companyId?: number) => {
    const params = new URLSearchParams();
    if (engaged !== undefined) params.set('engaged', String(engaged));
    if (companyId) params.set('companyId', String(companyId));
    const query = params.toString();
    return fetchJson<Vendor[]>(`/api/vendors${query ? `?${query}` : ''}`);
  },
  createVendor: (data: VendorCreatePayload) => fetchJsonWithMethod<Vendor>('/api/vendors', 'POST', data),
  updateVendor: (externalId: string, data: VendorUpdatePayload) =>
    fetchJsonWithMethod<Vendor>(`/api/vendors/${externalId}`, 'PUT', data),
  setVendorActive: (externalId: string, active: boolean, companyId?: number | null) =>
    fetchJsonWithMethod<Vendor>(`/api/vendors/${encodeURIComponent(externalId)}/set-active`, 'POST', {
      active,
      companyId: companyId ?? undefined,
    }),
  vendorTaggedComponents: (externalId: string, companyId?: number | null) =>
    fetchJson<{
      vendorExternalId: string;
      vendorName: string;
      taggedComponents: VendorTaggedComponent[];
    }>(`/api/vendors/${encodeURIComponent(externalId)}/tagged-components${companyId ? `?companyId=${companyId}` : ''}`),
  untagVendorComponents: (externalId: string, payload?: { companyId?: number | null; componentIds?: number[] }) =>
    fetchJsonWithMethod<{
      untagged: number;
      remaining: VendorTaggedComponent[];
    }>(`/api/vendors/${encodeURIComponent(externalId)}/untag-components`, 'POST', {
      companyId: payload?.companyId ?? undefined,
      componentIds: payload?.componentIds,
    }),
  vendorRatingSummaries: () => fetchJson<VendorRatingSummary[]>('/api/vendor-ratings'),
  vendorRating: (vendorExternalId: string) =>
    fetchJson<VendorRatingDetail>(`/api/vendor-ratings/${encodeURIComponent(vendorExternalId)}`),
  upsertVendorRating: (vendorExternalId: string, data: UpsertVendorRatingPayload) =>
    fetchJsonWithMethod<VendorRatingDetail>(
      `/api/vendor-ratings/${encodeURIComponent(vendorExternalId)}`,
      'PUT',
      data,
    ),
  b2bCustomers: (companyId?: number) =>
    fetchJson<B2bCustomer[]>(`/api/b2b-customers${companyId ? `?companyId=${companyId}` : ''}`),
  createB2bCustomer: (data: UpsertB2bCustomerPayload) =>
    fetchJsonWithMethod<B2bCustomer>('/api/b2b-customers', 'POST', data),
  updateB2bCustomer: (externalId: string, data: UpsertB2bCustomerPayload) =>
    fetchJsonWithMethod<B2bCustomer>(`/api/b2b-customers/${externalId}`, 'PUT', data),
  b2bSalesOrders: (companyId?: number) =>
    fetchJson<B2bSalesOrder[]>(`/api/b2b-sales-orders${companyId ? `?companyId=${companyId}` : ''}`),
  b2bSalesOrder: (id: number) =>
    fetchJson<B2bSalesOrder>(`/api/b2b-sales-orders/${id}`),
  b2bSalesOrderByShareToken: (token: string) =>
    fetchJson<B2bSalesOrderSharePayload>(`/api/b2b-sales-orders/share/${encodeURIComponent(token)}`),
  acceptB2bSalesOrderByShareToken: (token: string, acceptedBy?: string) =>
    fetchJsonWithMethod<B2bSalesOrderSharePayload>(
      `/api/b2b-sales-orders/share/${encodeURIComponent(token)}/accept`,
      'POST',
      { acceptedBy },
    ),
  createB2bSalesOrder: (data: CreateB2bSalesOrderPayload) =>
    fetchJsonWithMethod<B2bSalesOrder>('/api/b2b-sales-orders', 'POST', data),
  issueB2bSalesOrder: (id: number) =>
    fetchJsonWithMethod<B2bSalesOrder>(`/api/b2b-sales-orders/${id}/issue`, 'POST'),
  markB2bSalesOrderLineReadyToShip: (orderId: number, lineId: number) =>
    fetchJsonWithMethod<B2bSalesOrder>(
      `/api/b2b-sales-orders/${orderId}/lines/${lineId}/ready-to-ship`,
      'POST',
    ),
  ensureB2bSalesOrderShareToken: (id: number) =>
    fetchJsonWithMethod<B2bSalesOrder>(`/api/b2b-sales-orders/${id}/ensure-share-token`, 'POST'),
  posCustomers: (companyId?: number) =>
    fetchJson<PosCustomer[]>(`/api/pos-customers${companyId ? `?companyId=${companyId}` : ''}`),
  createPosCustomer: (data: UpsertPosCustomerPayload) =>
    fetchJsonWithMethod<PosCustomer>('/api/pos-customers', 'POST', data),
  updatePosCustomer: (externalId: string, data: UpsertPosCustomerPayload) =>
    fetchJsonWithMethod<PosCustomer>(`/api/pos-customers/${externalId}`, 'PUT', data),
  engageVendor: (externalId: string, data: EngageVendorPayload) =>
    fetchJsonWithMethod<Vendor>(`/api/vendors/${externalId}/engage`, 'POST', data),
  pendingVendorEngagements: (companyId: number) =>
    fetchJson<VendorEngagement[]>(`/api/vendors/engagements/pending?companyId=${companyId}`),
  approveVendorEngagement: (externalId: string, data: ApproveVendorEngagementPayload) =>
    fetchJsonWithMethod<VendorEngagement>(`/api/vendors/${externalId}/approve-engagement`, 'POST', data),
  rejectVendorEngagement: (externalId: string, data?: { rejectedBy?: string; reason?: string }) =>
    fetchJsonWithMethod<VendorEngagement>(`/api/vendors/${externalId}/reject-engagement`, 'POST', data ?? {}),
  ingredients: (companyId?: number) =>
    fetchJson<Ingredient[]>(`/api/ingredients${companyId ? `?companyId=${companyId}` : ''}`),
  createIngredient: (data: Omit<Ingredient, 'id'>) => fetchJsonWithMethod<Ingredient>('/api/ingredients', 'POST', data),
  updateIngredient: (id: number, data: Ingredient) => fetchJsonWithMethod<Ingredient>(`/api/ingredients/${id}`, 'PUT', data),
  purchaseOrders: () => fetchJson<PurchaseOrder[]>('/api/purchaseorders'),
  activePurchaseOrders: (companyId?: number) =>
    fetchJson<PurchaseOrder[]>(`/api/purchaseorders/active${companyId ? `?companyId=${companyId}` : ''}`),
  inboundSalesOrders: (companyId: number) =>
    fetchJson<PurchaseOrder[]>(`/api/purchaseorders/inbound-sales?companyId=${companyId}`),
  vendorApprovePurchaseOrder: (
    id: number,
    payload: {
      acceptedBy?: string;
      lines?: { id: number; quantity?: number; unitPrice?: number }[];
    },
  ) => fetchJsonWithMethod<PurchaseOrder>(`/api/purchaseorders/${id}/vendor-approve`, 'POST', payload),
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
  acceptVendorOrder: (
    token: string,
    acceptedBy?: string,
    lines?: { id: number; quantity?: number; unitPrice?: number }[],
  ) =>
    fetchJsonWithMethod<VendorOrderPortal>(`/api/vendor-orders/${token}/accept`, 'POST', {
      acceptedBy,
      lines,
    }),
  quoteRequests: (companyId?: number) =>
    fetchJson<QuoteRequestSummary[]>(`/api/quote-requests${companyId ? `?companyId=${companyId}` : ''}`),
  quoteRequest: (id: number) => fetchJson<QuoteRequestDetail>(`/api/quote-requests/${id}`),
  createQuoteRequest: (data: CreateQuoteRequestPayload) =>
    fetchJsonWithMethod<QuoteRequestDetail>('/api/quote-requests', 'POST', data),
  vendorRfqPortal: (token: string) => fetchJson<VendorRfqPortal>(`/api/vendor-rfq/${token}`),
  submitVendorRfq: (token: string, data: SubmitVendorRfqPayload) =>
    fetchJsonWithMethod<VendorRfqPortal>(`/api/vendor-rfq/${token}/submit`, 'POST', data),
  sampleRequests: (companyId?: number) =>
    fetchJson<SampleRequestSummary[]>(`/api/sample-requests${companyId ? `?companyId=${companyId}` : ''}`),
  sampleRequest: (id: number) => fetchJson<SampleRequestDetail>(`/api/sample-requests/${id}`),
  createSampleRequest: (data: CreateSampleRequestPayload) =>
    fetchJsonWithMethod<SampleRequestDetail>('/api/sample-requests', 'POST', data),
  sampleRequestByShareToken: (token: string) =>
    fetchJson<SampleRequestDetail>(`/api/sample-requests/share/${encodeURIComponent(token)}`),
  acceptSampleRequest: (token: string, acceptedBy?: string) =>
    fetchJsonWithMethod<SampleRequestDetail>(
      `/api/sample-requests/share/${encodeURIComponent(token)}/accept`,
      'POST',
      { acceptedBy },
    ),
  vendorProductPrices: () => fetchJson<VendorProductPriceRow[]>('/api/vendorproducts/prices'),
  vendorProductCatalog: (vendorExternalId?: string) =>
    fetchJson<VendorProductCatalogRow[]>(
      `/api/vendorproducts/catalog${vendorExternalId ? `?vendorExternalId=${encodeURIComponent(vendorExternalId)}` : ''}`,
    ),
  createVendorProductCatalog: (payload: VendorProductCatalogUpsert) =>
    fetchJsonWithMethod<VendorProductCatalogRow>('/api/vendorproducts/catalog', 'POST', payload),
  updateVendorProductCatalog: (externalId: string, payload: Partial<VendorProductCatalogUpsert>) =>
    fetchJsonWithMethod<VendorProductCatalogRow>(`/api/vendorproducts/catalog/${encodeURIComponent(externalId)}`, 'PUT', payload),
  deactivateVendorProductCatalog: (externalId: string) =>
    fetchJsonWithMethod<void>(`/api/vendorproducts/catalog/${encodeURIComponent(externalId)}/deactivate`, 'POST'),
  reactivateVendorProductCatalog: (externalId: string) =>
    fetchJsonWithMethod<void>(`/api/vendorproducts/catalog/${encodeURIComponent(externalId)}/reactivate`, 'POST'),
  revMgmtConfig: (companyId: number, configKey: string) =>
    fetchJson<RevMgmtConfigResponse>(`/api/rev-mgmt/config/${companyId}/${encodeURIComponent(configKey)}`),
  updateRevMgmtConfig: (companyId: number, configKey: string, stateJson: string) =>
    fetchJsonWithMethod<RevMgmtConfigResponse>(
      `/api/rev-mgmt/config/${companyId}/${encodeURIComponent(configKey)}`,
      'PUT',
      { stateJson },
    ),
  inventoryPurchases: (companyId?: number) =>
    fetchJson<InventoryPurchase[]>(`/api/inventory/purchases${companyId ? `?companyId=${companyId}` : ''}`),
  cashPurchases: (companyId?: number) =>
    fetchJson<CashPurchase[]>(`/api/cashpurchases${companyId ? `?companyId=${companyId}` : ''}`),
  createCashPurchase: (payload: CreateCashPurchasePayload) =>
    fetchJsonWithMethod<CreateCashPurchaseResult>('/api/cashpurchases', 'POST', payload),
  wastageEntries: (
    companyId: number | undefined,
    locationIds: string[],
    opts?: { month?: string; date?: string; itemType?: string },
  ) => {
    const params = new URLSearchParams();
    if (companyId) params.set('companyId', String(companyId));
    if (locationIds.length > 0) params.set('locationIds', locationIds.join(','));
    if (opts?.date) params.set('date', opts.date);
    else if (opts?.month) params.set('month', opts.month);
    if (opts?.itemType && opts.itemType !== 'all') params.set('itemType', opts.itemType);
    const query = params.toString();
    return fetchJson<WastageEntry[]>(`/api/wastage${query ? `?${query}` : ''}`);
  },
  wastageReasons: (companyId?: number, q?: string) => {
    const params = new URLSearchParams();
    if (companyId) params.set('companyId', String(companyId));
    if (q?.trim()) params.set('q', q.trim());
    const query = params.toString();
    return fetchJson<string[]>(`/api/wastage/reasons${query ? `?${query}` : ''}`);
  },
  wastageValue: (opts: {
    companyId: number;
    locationExternalId: string;
    itemType: string;
    itemKey: string;
    quantity: number;
    uom: string;
    wastedDate: string;
  }) => {
    const params = new URLSearchParams();
    params.set('companyId', String(opts.companyId));
    params.set('locationExternalId', opts.locationExternalId);
    params.set('itemType', opts.itemType);
    params.set('itemKey', opts.itemKey);
    params.set('quantity', String(opts.quantity));
    params.set('uom', opts.uom);
    params.set('wastedDate', opts.wastedDate);
    return fetchJson<{ unitPrice: number; totalValue: number; uom: string; wastedDate: string }>(
      `/api/wastage/value?${params.toString()}`,
    );
  },
  createWastage: (payload: CreateWastagePayload) =>
    fetchJsonWithMethod<WastageEntry>('/api/wastage', 'POST', payload),
  createPosWastage: (payload: CreatePosWastagePayload) =>
    fetchJsonWithMethod<WastageEntry>('/api/wastage/pos', 'POST', payload),
  transfers: (companyId: number | undefined, locationIds: string[], month?: string) => {
    const params = new URLSearchParams();
    if (companyId) params.set('companyId', String(companyId));
    if (locationIds.length > 0) params.set('locationIds', locationIds.join(','));
    if (month) params.set('month', month);
    const query = params.toString();
    return fetchJson<TransferEntry[]>(`/api/transfers${query ? `?${query}` : ''}`);
  },
  pendingInboundTransfers: (companyId: number | undefined, locationIds: string[]) => {
    const params = new URLSearchParams();
    if (companyId) params.set('companyId', String(companyId));
    if (locationIds.length > 0) params.set('locationIds', locationIds.join(','));
    const query = params.toString();
    return fetchJson<TransferEntry[]>(`/api/transfers/pending-inbound${query ? `?${query}` : ''}`);
  },
  transferAvailable: (
    companyId: number | undefined,
    itemType: string,
    itemKey: string,
    locationExternalId: string,
    uom: string,
  ) => {
    const params = new URLSearchParams();
    if (companyId) params.set('companyId', String(companyId));
    params.set('itemType', itemType);
    params.set('itemKey', itemKey);
    params.set('locationExternalId', locationExternalId);
    params.set('uom', uom);
    return fetchJson<TransferAvailableQty>(`/api/transfers/available?${params.toString()}`);
  },
  createTransfer: (payload: CreateTransferPayload) =>
    fetchJsonWithMethod<TransferEntry>('/api/transfers', 'POST', payload),
  receiveTransfer: (id: number, payload: ReceiveTransferPayload) =>
    fetchJsonWithMethod<TransferEntry>(`/api/transfers/${id}/receive`, 'POST', payload),
  rejectTransfer: (id: number, payload: RejectTransferPayload) =>
    fetchJsonWithMethod<TransferEntry>(`/api/transfers/${id}/reject`, 'POST', payload),
  cancelTransfer: (id: number, companyId: number, rejectedBy?: string) =>
    fetchJsonWithMethod<TransferEntry>(`/api/transfers/${id}/cancel`, 'POST', { companyId, rejectedBy }),
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
  productManagement: (companyId: number | undefined, locationIds: string[], view?: 'b2b' | 'sub-product') => {
    const params = new URLSearchParams();
    if (companyId) params.set('companyId', String(companyId));
    if (locationIds.length > 0) params.set('locationIds', locationIds.join(','));
    if (view) params.set('view', view);
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
  salesData: (
    companyId: number | undefined,
    locationIds: string[],
    month: string,
    viewBy: 'product' | 'customer',
  ) => {
    const params = new URLSearchParams();
    if (companyId) params.set('companyId', String(companyId));
    if (locationIds.length > 0) params.set('locationIds', locationIds.join(','));
    params.set('month', month);
    params.set('viewBy', viewBy);
    return fetchJson<SalesDataResult>(`/api/sales-data?${params.toString()}`);
  },
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
  stockCardAsOf: (
    itemType: string,
    itemKey: string,
    companyId: number | undefined,
    locationIds: string[],
    locationExternalId: string,
    asOfDate: string,
    options?: { uomMode?: 'inventory' | 'recipe' },
  ) => {
    const params = new URLSearchParams();
    if (companyId) params.set('companyId', String(companyId));
    if (locationIds.length > 0) params.set('locationIds', locationIds.join(','));
    params.set('locationExternalId', locationExternalId);
    params.set('asOfDate', asOfDate);
    if (options?.uomMode) params.set('uomMode', options.uomMode);
    const query = params.toString();
    return fetchJson<StockCardAsOfSnapshot>(
      `/api/stock-cards/${encodeURIComponent(itemType)}/${encodeURIComponent(itemKey)}/as-of?${query}`,
    );
  },
  createStockAdjustment: (
    itemType: string,
    itemKey: string,
    payload: CreateStockAdjustmentPayload,
  ) =>
    fetchJsonWithMethod<{ success: boolean }>(
      `/api/stock-cards/${encodeURIComponent(itemType)}/${encodeURIComponent(itemKey)}/adjustments`,
      'POST',
      payload,
    ),
  activeInventoryCount: async (
    sessionType: InventoryCountSessionType,
    companyId: number | undefined,
    locationIds: string[],
    period: string,
    uomMode: 'inventory' | 'recipe',
  ) => {
    const params = new URLSearchParams();
    params.set('sessionType', sessionType);
    if (companyId) params.set('companyId', String(companyId));
    if (locationIds.length > 0) params.set('locationIds', locationIds.join(','));
    params.set('period', period);
    params.set('uomMode', uomMode);
    const res = await fetch(`${API_BASE}/api/inventory-counts/active?${params.toString()}`, {
      headers: tenantHeaders(),
    });
    if (!res.ok) throw new Error(`API error ${res.status}: /api/inventory-counts/active`);
    const text = await res.text();
    if (!text.trim()) return null;
    return JSON.parse(text) as InventoryCountSession | null;
  },
  saveInventoryCount: (payload: SaveInventoryCountPayload) =>
    fetchJsonWithMethod<{ success: boolean; session: InventoryCountSession }>(
      '/api/inventory-counts/save',
      'POST',
      payload,
    ),
  confirmInventoryCount: (sessionId: number, confirmedBy: string, effectiveDate: string) =>
    fetchJsonWithMethod<{ success: boolean; session: InventoryCountSession }>(
      `/api/inventory-counts/${sessionId}/confirm`,
      'POST',
      { confirmedBy, effectiveDate },
    ),
  inventoryCountHistoryLines: (
    sessionType: InventoryCountSessionType | undefined,
    companyId: number | undefined,
    locationIds: string[],
    periodMonth?: string,
    category?: string,
  ) => {
    const params = new URLSearchParams();
    if (sessionType) params.set('sessionType', sessionType);
    if (companyId) params.set('companyId', String(companyId));
    if (locationIds.length > 0) params.set('locationIds', locationIds.join(','));
    if (periodMonth) params.set('periodMonth', periodMonth);
    if (category && category !== 'All') params.set('category', category);
    return fetchJson<InventoryCountHistoryLine[]>(`/api/inventory-counts/history/lines?${params.toString()}`);
  },
  inventoryCountHistory: (
    sessionType: InventoryCountSessionType | undefined,
    companyId: number | undefined,
    locationIds: string[],
  ) => {
    const params = new URLSearchParams();
    if (sessionType) params.set('sessionType', sessionType);
    if (companyId) params.set('companyId', String(companyId));
    if (locationIds.length > 0) params.set('locationIds', locationIds.join(','));
    return fetchJson<InventoryCountSessionSummary[]>(`/api/inventory-counts/history?${params.toString()}`);
  },
  getInventoryCountSession: (
    sessionId: number,
    companyId: number | undefined,
    locationIds: string[],
  ) => {
    const params = new URLSearchParams();
    if (companyId) params.set('companyId', String(companyId));
    if (locationIds.length > 0) params.set('locationIds', locationIds.join(','));
    return fetchJson<InventoryCountSession>(`/api/inventory-counts/${sessionId}?${params.toString()}`);
  },
  inventoryAlerts: () => fetchJson<InventoryAlert[]>('/api/inventory/alerts'),
  accessControl: () => fetchJson<AccessControlSettings>('/api/access-control'),
  updateAccessControl: (data: AccessControlSettings) =>
    fetchJsonWithMethod<AccessControlSettings>('/api/access-control', 'PUT', data),
  cogsAuditPeriods: (companyId?: number) => {
    const params = new URLSearchParams();
    if (companyId) params.set('companyId', String(companyId));
    const query = params.toString();
    return fetchJson<string[]>(`/api/cogs-audit/periods${query ? `?${query}` : ''}`);
  },
  cogsAuditSummary: (
    companyId: number | undefined,
    locationIds: string[],
    options?: { period?: string; uomMode?: 'inventory' | 'recipe'; itemType?: string },
  ) => {
    const params = new URLSearchParams();
    if (companyId) params.set('companyId', String(companyId));
    if (locationIds.length > 0) params.set('locationIds', locationIds.join(','));
    if (options?.period) params.set('period', options.period);
    if (options?.uomMode) params.set('uomMode', options.uomMode);
    if (options?.itemType) params.set('itemType', options.itemType);
    return fetchJson<CogsAuditSummaryResult>(`/api/cogs-audit/summary?${params.toString()}`);
  },
  cogsAuditDetail: (
    itemType: string,
    itemKey: string,
    companyId: number | undefined,
    locationIds: string[],
    options?: { period?: string; uomMode?: 'inventory' | 'recipe' },
  ) => {
    const params = new URLSearchParams();
    if (companyId) params.set('companyId', String(companyId));
    if (locationIds.length > 0) params.set('locationIds', locationIds.join(','));
    if (options?.period) params.set('period', options.period);
    if (options?.uomMode) params.set('uomMode', options.uomMode);
    return fetchJson<CogsAuditDetailResult>(
      `/api/cogs-audit/detail/${encodeURIComponent(itemType)}/${encodeURIComponent(itemKey)}?${params.toString()}`,
    );
  },
  cogsAuditSystemHistory: (take = 100) =>
    fetchJson<SystemCogsAuditHistoryEntry[]>(`/api/cogs-audit/system/history?take=${take}`),
  cogsAuditSystemHistoryOpen: (runId: string) =>
    fetchJson<SystemCogsAuditHistoryFile>(`/api/cogs-audit/system/history/${encodeURIComponent(runId)}`),
  systemAuditMonths: (params: { companyId?: number; locationId?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.companyId != null) q.set('companyId', String(params.companyId));
    if (params.locationId != null) q.set('locationId', String(params.locationId));
    const qs = q.toString();
    return fetchJson<SystemAuditMonthBucket[]>(`/api/system-audit/months${qs ? `?${qs}` : ''}`);
  },
  systemAuditEvents: (params: {
    companyId: number;
    locationId: number;
    year: number;
    month: number;
    take?: number;
    skip?: number;
  }) => {
    const q = new URLSearchParams();
    q.set('companyId', String(params.companyId));
    q.set('locationId', String(params.locationId));
    q.set('year', String(params.year));
    q.set('month', String(params.month));
    if (params.take != null) q.set('take', String(params.take));
    if (params.skip != null) q.set('skip', String(params.skip));
    return fetchJson<SystemAuditListResponse>(`/api/system-audit?${q.toString()}`);
  },
  recordLogoutAudit: (payload: { userId?: number; companyId?: number | null; reason?: string } = {}) =>
    fetchJsonWithMethod<{ recorded: boolean }>('/api/system-audit/logout', 'POST', payload),
  revenue: (period = 'week') => fetchJson<RevenuePoint[]>(`/api/revenue?period=${period}`),
  progress: () => fetchJson<ProgressData>('/api/progress'),
};
