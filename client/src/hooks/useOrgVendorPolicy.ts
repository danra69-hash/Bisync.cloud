import { useEffect, useMemo, useState } from 'react';
import { api, type Company, type LocationConfig } from '../api';
import {
  resolveOrgVendorPolicyTags,
  type CompanyVendorPolicyTag,
} from '../data/vendorPolicyRules';

export function useOrgVendorPolicy(
  selectedCompanyId: number | null | undefined,
  selectedLocationIds: string[],
): CompanyVendorPolicyTag[] {
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
    return resolveOrgVendorPolicyTags(company, locations, selectedLocationIds);
  }, [companies, locations, selectedCompanyId, selectedLocationIds]);
}
