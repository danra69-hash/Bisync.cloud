import { api } from '../api';

export type VendorProductPriceRecord = {
  id: string;
  deliveryPrice: number;
  updatedAt?: string;
};

let serverPriceById: Record<string, number> = {};

export function getServerVendorProductPrices(): Record<string, number> {
  return { ...serverPriceById };
}

export function applyVendorProductPriceUpdates(updates: VendorProductPriceRecord[]): void {
  for (const update of updates) {
    if (!update.id) continue;
    serverPriceById[update.id] = update.deliveryPrice;
  }
}

export async function refreshVendorProductPricesFromApi(): Promise<Record<string, number>> {
  try {
    const rows = await api.vendorProductPrices();
    serverPriceById = Object.fromEntries(rows.map(row => [row.id, row.deliveryPrice]));
  } catch {
    // Keep existing cache when API is unavailable.
  }
  return getServerVendorProductPrices();
}

export function mergeServerVendorProductPrices<T extends { id: string; deliveryPrice: number }>(
  catalog: T[],
): T[] {
  if (Object.keys(serverPriceById).length === 0) return catalog;
  return catalog.map(item => {
    const price = serverPriceById[item.id];
    if (price === undefined) return item;
    return { ...item, deliveryPrice: price };
  });
}
