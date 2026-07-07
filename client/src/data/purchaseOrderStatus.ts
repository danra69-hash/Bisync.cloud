import type { PurchaseOrder } from '../api';

export function isPurchaseOrderVendorAccepted(order: Pick<PurchaseOrder, 'status' | 'vendorAcceptedAt'>): boolean {
  return Boolean(order.vendorAcceptedAt) || order.status === 'Accepted';
}

export function resolvePurchaseOrderStatusLabel(
  order: Pick<PurchaseOrder, 'status' | 'documentType' | 'vendorAcceptedAt'>,
): string {
  if (isPurchaseOrderVendorAccepted(order)) return 'Accepted';
  if (order.documentType === 'PR') return `PR · ${order.status}`;
  return order.status;
}

export function purchaseOrderStatusBadgeClass(statusLabel: string): string {
  const normalized = statusLabel.toLowerCase();
  if (normalized === 'accepted') return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400';
  if (normalized.includes('pending')) return 'bg-amber-500/15 text-amber-700 dark:text-amber-400';
  if (normalized === 'open' || normalized === 'confirmed' || normalized === 'in transit') {
    return 'bg-primary/15 text-primary';
  }
  if (normalized === 'received') return 'bg-blue-500/15 text-blue-700 dark:text-blue-400';
  return 'bg-muted text-muted-foreground';
}
