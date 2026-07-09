import type {
  B2bCustomer,
  B2bCustomerContact,
  B2bPurchaseHistoryLine,
  PosCouponYearSummary,
  PosCustomer,
  PosCustomerActivity,
  PosLoyaltyYearSummary,
  PosReceiptLine,
} from '../api';

export const LOYALTY_UNIT_LABEL = 'Points';

export function createCustomerContactId(): string {
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function blankB2bContact(): B2bCustomerContact {
  return {
    id: createCustomerContactId(),
    name: '',
    position: '',
    mobile: '',
    fax: '',
    isDefault: true,
  };
}

function readString(raw: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'string') return value;
  }
  return '';
}

function readNumber(raw: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const n = parseFloat(value);
      if (Number.isFinite(n)) return n;
    }
  }
  return 0;
}

function readBool(raw: Record<string, unknown>, ...keys: string[]): boolean {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'boolean') return value;
  }
  return false;
}

export function parseB2bCustomerContacts(customer: Pick<B2bCustomer, 'contactsJson'>): B2bCustomerContact[] {
  if (!customer.contactsJson?.trim() || customer.contactsJson === '[]') return [];
  try {
    const parsed = JSON.parse(customer.contactsJson) as Record<string, unknown>[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((c, index) => ({
      id: readString(c, 'id', 'Id') || `saved-${index}`,
      name: readString(c, 'name', 'Name'),
      position: readString(c, 'position', 'Position'),
      mobile: readString(c, 'mobile', 'Mobile'),
      fax: readString(c, 'fax', 'Fax'),
      isDefault: readBool(c, 'isDefault', 'IsDefault'),
    })).filter(c => c.name || c.mobile || c.fax);
  } catch {
    return [];
  }
}

export function parseTaggedProductIds(customer: Pick<B2bCustomer, 'taggedProductIdsJson'>): number[] {
  if (!customer.taggedProductIdsJson?.trim() || customer.taggedProductIdsJson === '[]') return [];
  try {
    const parsed = JSON.parse(customer.taggedProductIdsJson);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(v => Number(v)).filter(n => Number.isFinite(n) && n > 0);
  } catch {
    return [];
  }
}

export function parseB2bPurchaseHistory(customer: Pick<B2bCustomer, 'purchaseHistoryJson'>): B2bPurchaseHistoryLine[] {
  if (!customer.purchaseHistoryJson?.trim() || customer.purchaseHistoryJson === '[]') return [];
  try {
    const parsed = JSON.parse(customer.purchaseHistoryJson) as Record<string, unknown>[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(row => ({
      dateOrdered: readString(row, 'dateOrdered', 'DateOrdered'),
      dateDelivered: readString(row, 'dateDelivered', 'DateDelivered'),
      productName: readString(row, 'productName', 'ProductName'),
      deliveryUom: readString(row, 'deliveryUom', 'DeliveryUom'),
      rrp: readNumber(row, 'rrp', 'Rrp'),
      qtyOrdered: readNumber(row, 'qtyOrdered', 'QtyOrdered'),
      actualRrp: readNumber(row, 'actualRrp', 'ActualRrp'),
      totalRevenue: readNumber(row, 'totalRevenue', 'TotalRevenue'),
      cogs: readNumber(row, 'cogs', 'Cogs'),
      cogsPercent: readNumber(row, 'cogsPercent', 'CogsPercent'),
    }));
  } catch {
    return [];
  }
}

export function filterPurchaseHistoryLastTwoYears(lines: B2bPurchaseHistoryLine[]): B2bPurchaseHistoryLine[] {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 2);
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  return lines
    .filter(line => line.dateOrdered >= cutoffIso || line.dateDelivered >= cutoffIso)
    .sort((a, b) => b.dateOrdered.localeCompare(a.dateOrdered));
}

export function parsePosLoyaltySummary(customer: Pick<PosCustomer, 'loyaltySummaryJson'>): PosLoyaltyYearSummary[] {
  if (!customer.loyaltySummaryJson?.trim() || customer.loyaltySummaryJson === '[]') return [];
  try {
    const parsed = JSON.parse(customer.loyaltySummaryJson) as Record<string, unknown>[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(row => ({
      year: readNumber(row, 'year', 'Year'),
      earned: readNumber(row, 'earned', 'Earned'),
      used: readNumber(row, 'used', 'Used'),
      balance: readNumber(row, 'balance', 'Balance'),
    })).filter(row => row.year > 0).sort((a, b) => b.year - a.year);
  } catch {
    return [];
  }
}

export function parsePosCouponSummary(customer: Pick<PosCustomer, 'couponSummaryJson'>): PosCouponYearSummary[] {
  if (!customer.couponSummaryJson?.trim() || customer.couponSummaryJson === '[]') return [];
  try {
    const parsed = JSON.parse(customer.couponSummaryJson) as Record<string, unknown>[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(row => ({
      year: readNumber(row, 'year', 'Year'),
      received: readNumber(row, 'received', 'Received'),
      used: readNumber(row, 'used', 'Used'),
    })).filter(row => row.year > 0).sort((a, b) => b.year - a.year);
  } catch {
    return [];
  }
}

export function parsePosActivityHistory(customer: Pick<PosCustomer, 'activityHistoryJson'>): PosCustomerActivity[] {
  if (!customer.activityHistoryJson?.trim() || customer.activityHistoryJson === '[]') return [];
  try {
    const parsed = JSON.parse(customer.activityHistoryJson) as Record<string, unknown>[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(row => {
      const receiptRaw = row.receiptLines ?? row.ReceiptLines;
      let receiptLines: PosReceiptLine[] = [];
      if (Array.isArray(receiptRaw)) {
        receiptLines = receiptRaw.map(line => {
          const r = line as Record<string, unknown>;
          return {
            itemName: readString(r, 'itemName', 'ItemName'),
            qty: readNumber(r, 'qty', 'Qty'),
            unitPrice: readNumber(r, 'unitPrice', 'UnitPrice'),
            lineTotal: readNumber(r, 'lineTotal', 'LineTotal'),
          };
        });
      }
      return {
        activityDate: readString(row, 'activityDate', 'ActivityDate'),
        activityLocation: readString(row, 'activityLocation', 'ActivityLocation'),
        activityType: readString(row, 'activityType', 'ActivityType'),
        checkNo: readString(row, 'checkNo', 'CheckNo'),
        totalSpending: readNumber(row, 'totalSpending', 'TotalSpending'),
        pointsEarned: readNumber(row, 'pointsEarned', 'PointsEarned'),
        pointsUsed: readNumber(row, 'pointsUsed', 'PointsUsed'),
        pointsBalance: readNumber(row, 'pointsBalance', 'PointsBalance'),
        couponUsed: readString(row, 'couponUsed', 'CouponUsed') || undefined,
        receiptLines,
      };
    }).sort((a, b) => b.activityDate.localeCompare(a.activityDate));
  } catch {
    return [];
  }
}

export function filterActivitiesByYear(activities: PosCustomerActivity[], year: number): PosCustomerActivity[] {
  return activities.filter(a => a.activityDate.startsWith(String(year)));
}

export function getDefaultContact(contacts: B2bCustomerContact[]): B2bCustomerContact | null {
  if (contacts.length === 0) return null;
  return contacts.find(c => c.isDefault) ?? contacts[0];
}

export function formatCustomerAddress(parts: {
  address?: string;
  city?: string;
  state?: string;
  postcode?: string;
}): string {
  return [parts.address, parts.city, parts.state, parts.postcode].filter(Boolean).join(', ');
}

export function nextB2bCustomerExternalId(existing: B2bCustomer[]): string {
  const max = existing.reduce((acc, c) => {
    const n = parseInt(c.externalId.replace(/^B2BC-/i, ''), 10);
    return Number.isFinite(n) ? Math.max(acc, n) : acc;
  }, 0);
  return `B2BC-${String(max + 1).padStart(3, '0')}`;
}

export function nextPosCustomerExternalId(existing: PosCustomer[]): string {
  const max = existing.reduce((acc, c) => {
    const n = parseInt(c.externalId.replace(/^POSC-/i, ''), 10);
    return Number.isFinite(n) ? Math.max(acc, n) : acc;
  }, 0);
  return `POSC-${String(max + 1).padStart(3, '0')}`;
}

export function b2bCustomerToPayload(
  customer: B2bCustomer,
  contacts: B2bCustomerContact[],
  taggedProductIds: number[],
  purchaseHistory: B2bPurchaseHistoryLine[],
): import('../api').UpsertB2bCustomerPayload {
  return {
    companyId: customer.companyId,
    externalId: customer.externalId,
    companyName: customer.companyName,
    brn: customer.brn,
    address: customer.address,
    city: customer.city,
    state: customer.state,
    postcode: customer.postcode,
    phone: customer.phone,
    fax: customer.fax,
    email: customer.email,
    contacts,
    taggedProductIds,
    purchaseHistory,
    active: customer.active,
  };
}

export function posCustomerToPayload(
  customer: PosCustomer,
  loyaltySummary: PosLoyaltyYearSummary[],
  couponSummary: PosCouponYearSummary[],
  activityHistory: PosCustomerActivity[],
): import('../api').UpsertPosCustomerPayload {
  return {
    companyId: customer.companyId,
    externalId: customer.externalId,
    name: customer.name,
    address: customer.address,
    city: customer.city,
    state: customer.state,
    postcode: customer.postcode,
    phone: customer.phone,
    fax: customer.fax,
    email: customer.email,
    loyaltySummary,
    couponSummary,
    activityHistory,
    active: customer.active,
  };
}
