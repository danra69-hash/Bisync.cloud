import type { Location, LocationConfig, PurchaseOrder } from '../api';

export type DropdownLocation = {
  externalId: string;
  name: string;
  address: string;
};

export function configLocationToDropdown(loc: LocationConfig): DropdownLocation {
  const address = [loc.addressLine1, loc.city, loc.stateProvince, loc.postcode].filter(Boolean).join(', ');
  return { externalId: loc.externalId, name: loc.name, address: address || loc.name };
}

export function filterMetricsByOrg(
  metricsLocations: Location[],
  configLocations: LocationConfig[],
  companyId: number | null,
  selectedLocationIds: string[],
): Location[] {
  let scoped = metricsLocations;

  if (companyId) {
    const allowedExternalIds = new Set(
      configLocations.filter(l => l.companyId === companyId).map(l => l.externalId),
    );
    scoped = metricsLocations.filter(l =>
      l.companyId === companyId || allowedExternalIds.has(l.externalId),
    );
  }

  if (selectedLocationIds.length === 0) return [];
  return scoped.filter(l => selectedLocationIds.includes(l.externalId));
}

export function filterPurchaseOrdersByOrg(
  orders: PurchaseOrder[],
  companyId: number | null,
  selectedLocationIds: string[],
): PurchaseOrder[] {
  if (!companyId || selectedLocationIds.length === 0) return [];

  const selected = new Set(selectedLocationIds);
  return orders.filter(order => {
    if (order.companyId != null && order.companyId !== companyId) return false;
    const orderLocs = order.locationExternalIds ?? [];
    if (orderLocs.length === 0) return false;
    return orderLocs.some(loc => selected.has(loc));
  });
}
