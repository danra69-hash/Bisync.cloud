import { useEffect, useMemo, useState } from 'react';
import { api, type Company, type LocationConfig } from '../api';
import { resolveOrgHasSupplySideCapability } from '../data/companyProfile';

/**
 * True when the selected company/locations include a supply-side business type
 * (Central Kitchen / Warehouse, Manufacturer, or Distributor).
 * Gates Active Sales and B2B Product surfaces.
 */
export function useOrgSupplyCapability(
  selectedCompanyId: number | null | undefined,
  selectedLocationIds: string[],
): boolean {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [locations, setLocations] = useState<LocationConfig[]>([]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([api.companies(), api.locationsConfig()])
      .then(([companyRows, locationRows]) => {
        if (!cancelled) {
          setCompanies(companyRows);
          setLocations(locationRows);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCompanies([]);
          setLocations([]);
        }
      });
    return () => { cancelled = true; };
  }, []);

  return useMemo(() => {
    const company = companies.find(c => c.id === selectedCompanyId) ?? null;
    return resolveOrgHasSupplySideCapability(company, locations, selectedLocationIds);
  }, [companies, locations, selectedCompanyId, selectedLocationIds]);
}
