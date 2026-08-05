import type { Location, LocationConfig, PurchaseOrder } from '../api';

export type DropdownLocation = {
  externalId: string;
  name: string;
  address: string;
  stateProvince?: string;
  countryCode?: string;
  timeZoneId?: string;
  physicalSiteKey?: string;
  conceptLabel?: string;
  conceptSortOrder?: number;
};

export function configLocationToDropdown(loc: LocationConfig): DropdownLocation {
  const address = [loc.addressLine1, loc.city, loc.stateProvince, loc.postcode].filter(Boolean).join(', ');
  return {
    externalId: loc.externalId,
    name: loc.name,
    address: address || loc.name,
    stateProvince: loc.stateProvince,
    countryCode: loc.countryCode,
    timeZoneId: loc.timeZoneId,
    physicalSiteKey: (loc.physicalSiteKey || '').trim() || undefined,
    conceptLabel: (loc.conceptLabel || '').trim() || loc.name,
    conceptSortOrder: loc.conceptSortOrder ?? 0,
  };
}

/** Group locations that share a physical site key (multi-concept venues). */
export function physicalSiteGroups(locations: DropdownLocation[]): Array<{
  siteKey: string;
  label: string;
  locationIds: string[];
}> {
  const map = new Map<string, DropdownLocation[]>();
  for (const loc of locations) {
    const key = (loc.physicalSiteKey || '').trim();
    if (!key) continue;
    const list = map.get(key) ?? [];
    list.push(loc);
    map.set(key, list);
  }
  return [...map.entries()]
    .filter(([, members]) => members.length > 1)
    .map(([siteKey, members]) => {
      const sorted = [...members].sort(
        (a, b) => (a.conceptSortOrder ?? 0) - (b.conceptSortOrder ?? 0) || a.name.localeCompare(b.name),
      );
      const brands = sorted.map(m => m.conceptLabel || m.name).join(' + ');
      return {
        siteKey,
        label: `${brands} (combined)`,
        locationIds: sorted.map(m => m.externalId),
      };
    });
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
