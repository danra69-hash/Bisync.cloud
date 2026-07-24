import type { CreateOrderLine } from './createOrder';

export type CreateOrderPrefillItem = {
  componentId?: string;
  name?: string;
  quantity?: number;
};

function normalizeName(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Match prefill items onto create-order lines (componentId first, then name). */
export function buildOrderQtyFromPrefill(
  items: CreateOrderPrefillItem[],
  lines: CreateOrderLine[],
): Record<string, string> {
  const updates: Record<string, string> = {};
  const usedKeys = new Set<string>();

  for (const item of items) {
    const byId = item.componentId
      ? lines.find(line => line.component.componentId === item.componentId && !usedKeys.has(line.key))
      : undefined;
    const byName = !byId && item.name
      ? lines.find(line => normalizeName(line.component.name) === normalizeName(item.name) && !usedKeys.has(line.key))
      : undefined;
    const line = byId ?? byName;
    if (!line) continue;

    const qty = item.quantity
      ?? (line.suggestedDeliveryUnits != null && line.suggestedDeliveryUnits > 0
        ? line.suggestedDeliveryUnits
        : 1);
    updates[line.key] = String(qty);
    usedKeys.add(line.key);
  }

  return updates;
}
