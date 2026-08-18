import type { PurchaseOrder } from '../api';

export function isPurchaseOrderVendorAccepted(order: Pick<PurchaseOrder, 'status' | 'vendorAcceptedAt'>): boolean {
  return Boolean(order.vendorAcceptedAt) || order.status === 'Accepted';
}

export function resolvePurchaseOrderStatusLabel(
  order: Pick<PurchaseOrder, 'status' | 'documentType' | 'vendorAcceptedAt' | 'isPreCommitted'>,
): string {
  const status = order.status?.trim() ?? '';
  if (status === 'Expired') return 'Expired';
  if (
    status === 'Partially Delivered'
    || status === 'Received'
    || status === 'Reconciled'
    || status === 'Committed'
    || status === 'Commitment Closed'
  ) {
    return status;
  }
  if (isPurchaseOrderVendorAccepted(order)) return 'Accepted';
  if (order.documentType === 'PR') return `PR · ${order.status}`;
  return order.status;
}

export function purchaseOrderStatusBadgeClass(statusLabel: string): string {
  const normalized = statusLabel.toLowerCase();
  if (normalized === 'accepted') return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400';
  if (normalized.includes('pending')) return 'bg-amber-500/15 text-amber-700 dark:text-amber-400';
  if (normalized === 'partially delivered') {
    return 'bg-orange-500/15 text-orange-700 dark:text-orange-400';
  }
  if (normalized === 'committed') {
    return 'bg-teal-500/15 text-teal-700 dark:text-teal-400';
  }
  if (normalized === 'commitment closed' || normalized === 'expired') {
    return 'bg-muted text-muted-foreground';
  }
  if (normalized === 'open' || normalized === 'confirmed' || normalized === 'in transit') {
    return 'bg-primary/15 text-primary';
  }
  if (normalized === 'received') return 'bg-blue-500/15 text-blue-700 dark:text-blue-400';
  if (normalized === 'reconciled') return 'bg-slate-500/15 text-slate-700 dark:text-slate-300';
  return 'bg-muted text-muted-foreground';
}
