import { useEffect, useMemo, useState } from 'react';
import { api, type Company, type LocationConfig } from '../api';
import {
  resolveOrgHasB2bProductCapability,
  resolveOrgHasSupplySideCapability,
} from '../data/companyProfile';

export type OrgBusinessCapabilities = {
  hasSupplyCapability: boolean;
  hasB2bProductCapability: boolean;
};

/**
 * Resolves Active Sales vs B2B Product capability from company/location business types.
 * - Active Sales: Central Kitchen / Warehouse, Manufacturer, Distributor
 * - B2B products: Central Kitchen / Warehouse, Manufacturer
 */
export function useOrgBusinessCapabilities(
  selectedCompanyId: number | null | undefined,
  selectedLocationIds: string[],
): OrgBusinessCapabilities {
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
    return {
      hasSupplyCapability: resolveOrgHasSupplySideCapability(company, locations, selectedLocationIds),
      hasB2bProductCapability: resolveOrgHasB2bProductCapability(company, locations, selectedLocationIds),
    };
  }, [companies, locations, selectedCompanyId, selectedLocationIds]);
}

/** @deprecated Prefer useOrgBusinessCapabilities — kept for call sites that only need Active Sales. */
export function useOrgSupplyCapability(
  selectedCompanyId: number | null | undefined,
  selectedLocationIds: string[],
): boolean {
  return useOrgBusinessCapabilities(selectedCompanyId, selectedLocationIds).hasSupplyCapability;
}

/** Central Kitchen / Warehouse or Manufacturer — B2B product editor and B2B Product tab. */
export function useOrgB2bProductCapability(
  selectedCompanyId: number | null | undefined,
  selectedLocationIds: string[],
): boolean {
  return useOrgBusinessCapabilities(selectedCompanyId, selectedLocationIds).hasB2bProductCapability;
}
