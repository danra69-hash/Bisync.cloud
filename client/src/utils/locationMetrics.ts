import type { Location, PurchaseOrder } from '../api';

export type DashboardActivityMode = 'covers' | 'purchaseOrders';

export type PeriodTotals = {
  today: number;
  todayPrev: number;
  wtd: number;
  wtdPrev: number;
  mtd: number;
  mtdPrev: number;
};

export type DashboardMetrics = {
  sales: PeriodTotals;
  activity: PeriodTotals;
  aov: PeriodTotals;
  activityMode: DashboardActivityMode;
};

export function filterLocations(locations: Location[], selectedIds: string[]): Location[] {
  if (selectedIds.length === 0) return locations;
  return locations.filter(l => selectedIds.includes(l.externalId));
}

function sum(locations: Location[], pick: (l: Location) => number): number {
  return locations.reduce((s, l) => s + pick(l), 0);
}

function safeAov(sales: number, divisor: number): number {
  return divisor > 0 ? sales / divisor : 0;
}

/** Local calendar yyyy-MM-dd (matches PurchaseOrder.orderDate). */
export function formatLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Monday-start week containing `date`. */
export function startOfWeekMonday(date: Date): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = copy.getDay();
  const diff = day === 0 ? 6 : day - 1;
  copy.setDate(copy.getDate() - diff);
  return copy;
}

function addYears(date: Date, years: number): Date {
  return new Date(date.getFullYear() + years, date.getMonth(), date.getDate());
}

function orderDateKey(order: PurchaseOrder): string | null {
  const raw = order.orderDate?.trim();
  if (!raw) return null;
  return raw.slice(0, 10);
}

function countOrdersInRange(orders: PurchaseOrder[], fromKey: string, toKey: string): number {
  return orders.reduce((count, order) => {
    const key = orderDateKey(order);
    if (!key) return count;
    return key >= fromKey && key <= toKey ? count + 1 : count;
  }, 0);
}

/** Count POs for today / WTD / MTD and the same windows last year. */
export function countPurchaseOrdersByPeriod(
  orders: PurchaseOrder[],
  referenceDate = new Date(),
): PeriodTotals {
  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const todayKey = formatLocalDateKey(today);
  const weekStart = startOfWeekMonday(today);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const todayLy = addYears(today, -1);
  const weekStartLy = addYears(weekStart, -1);
  const monthStartLy = addYears(monthStart, -1);
  const todayLyKey = formatLocalDateKey(todayLy);

  return {
    today: countOrdersInRange(orders, todayKey, todayKey),
    todayPrev: countOrdersInRange(orders, todayLyKey, todayLyKey),
    wtd: countOrdersInRange(orders, formatLocalDateKey(weekStart), todayKey),
    wtdPrev: countOrdersInRange(orders, formatLocalDateKey(weekStartLy), todayLyKey),
    mtd: countOrdersInRange(orders, formatLocalDateKey(monthStart), todayKey),
    mtdPrev: countOrdersInRange(orders, formatLocalDateKey(monthStartLy), todayLyKey),
  };
}

export function filterPurchaseOrdersForOrg(
  orders: PurchaseOrder[],
  companyId: number | null,
  locationIds: string[],
): PurchaseOrder[] {
  return orders.filter(order => {
    if (companyId != null && order.companyId != null && order.companyId !== companyId) {
      return false;
    }
    if (locationIds.length > 0 && order.locationExternalIds && order.locationExternalIds.length > 0) {
      return order.locationExternalIds.some(id => locationIds.includes(id));
    }
    return true;
  });
}

/** @deprecated Prefer aggregateDashboardMetrics — kept for callers that only need today sales/covers. */
export function aggregateLocationMetrics(locations: Location[]) {
  const metrics = aggregateDashboardMetrics(locations, [], 'covers');
  return {
    totalSales: metrics.sales.today,
    totalSalesPrev: metrics.sales.todayPrev,
    totalCovers: metrics.activity.today,
    totalCoversPrev: metrics.activity.todayPrev,
    aov: metrics.aov.today,
    aovPrev: metrics.aov.todayPrev,
  };
}

/**
 * Dashboard KPI aggregation.
 * - Sales: location sales Today / WTD / MTD vs prior year fields.
 * - Activity: covers (restaurant) or PO counts (CK / warehouse / distribution).
 * - AOV: sales per cover, or sales per PO for supply-side.
 */
export function aggregateDashboardMetrics(
  locations: Location[],
  purchaseOrders: PurchaseOrder[],
  activityMode: DashboardActivityMode,
  referenceDate = new Date(),
): DashboardMetrics {
  const sales: PeriodTotals = {
    today: sum(locations, l => l.salesToday),
    todayPrev: sum(locations, l => l.salesPrevToday),
    wtd: sum(locations, l => l.salesWtd),
    wtdPrev: sum(locations, l => l.salesPrevWtd),
    mtd: sum(locations, l => l.salesMtd),
    mtdPrev: sum(locations, l => l.salesPrevMtd),
  };

  const covers: PeriodTotals = {
    today: sum(locations, l => l.coversToday),
    todayPrev: sum(locations, l => l.coversPrevToday),
    wtd: sum(locations, l => l.coversWtd),
    wtdPrev: sum(locations, l => l.coversPrevWtd),
    mtd: sum(locations, l => l.coversMtd),
    mtdPrev: sum(locations, l => l.coversPrevMtd),
  };

  const activity = activityMode === 'purchaseOrders'
    ? countPurchaseOrdersByPeriod(purchaseOrders, referenceDate)
    : covers;

  const aov: PeriodTotals = {
    today: safeAov(sales.today, activity.today),
    todayPrev: safeAov(sales.todayPrev, activity.todayPrev),
    wtd: safeAov(sales.wtd, activity.wtd),
    wtdPrev: safeAov(sales.wtdPrev, activity.wtdPrev),
    mtd: safeAov(sales.mtd, activity.mtd),
    mtdPrev: safeAov(sales.mtdPrev, activity.mtdPrev),
  };

  return { sales, activity, aov, activityMode };
}
