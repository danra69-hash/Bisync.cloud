import type { Location, LocationConfig } from '../api';

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

  if (selectedLocationIds.length === 0) return scoped;
  return scoped.filter(l => selectedLocationIds.includes(l.externalId));
}
