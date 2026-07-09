import type { Company, LocationConfig } from '../api';
import type { NavItem } from './revenueManagement';
import type { AccessModule } from './userAccess';
import { parseStringArrayJson, profilesEquivalent, serializeStringArray } from './companyProfile';

export const PLATFORM_MODULES = [
  { id: 'RMS' as const, label: 'Revenue Management', navItem: 'Revenue Management' as NavItem },
  { id: 'POS' as const, label: 'Point of Sales', navItem: 'Point-of-Sales' as NavItem },
  { id: 'HRM' as const, label: 'Human Resource Management', navItem: 'Human Resources' as NavItem },
  { id: 'Accounting' as const, label: 'Accounting', navItem: 'Accounting' as NavItem },
] as const;

export const LOCATION_PLATFORM_MODULES = PLATFORM_MODULES.filter(module => module.id !== 'Accounting');

const NAV_TO_MODULE = new Map<NavItem, AccessModule>(
  PLATFORM_MODULES.map(module => [module.navItem, module.id]),
);

const MODULE_NAV_ITEMS = new Set<NavItem>(PLATFORM_MODULES.map(module => module.navItem));

export function parseCompanyModules(json: string | null | undefined): AccessModule[] {
  return parseStringArrayJson(json).filter((value): value is AccessModule =>
    PLATFORM_MODULES.some(module => module.id === value),
  );
}

export function validateCompanyModules(modules: AccessModule[]): string | null {
  if (modules.length === 0) return 'Select at least one module under Modules.';
  return null;
}

export function validateLocationModules(
  modules: AccessModule[],
  companyModules: AccessModule[],
): string | null {
  if (modules.length === 0) return null;
  if (modules.some(module => !companyModules.includes(module))) {
    return 'Location modules must be enabled at the company level first.';
  }
  if (modules.includes('Accounting')) {
    return 'Accounting is only available at the company level.';
  }
  return null;
}

export function validateLocationBusinessTypesSubset(
  locationTypes: string[],
  companyTypes: string[],
): string | null {
  if (locationTypes.length === 0) return null;
  if (locationTypes.some(type => !companyTypes.includes(type))) {
    return 'Location business types must be selected from the company Type of Business list.';
  }
  return null;
}

export function modulesFromCompany(company: Pick<Company, 'modulesJson'>): AccessModule[] {
  return parseCompanyModules(company.modulesJson);
}

export function resolveLocationModulesForDisplay(
  location: Pick<LocationConfig, 'modulesJson' | 'profileOverridden'>,
  company?: Pick<Company, 'modulesJson'> | null,
): AccessModule[] {
  const inherits = location.profileOverridden !== true;
  const modulesJson = location.modulesJson ?? (inherits && company ? company.modulesJson : '[]');
  if (inherits && company) return parseCompanyModules(company.modulesJson);
  return parseCompanyModules(modulesJson);
}

export function buildLocationModulesPayload(
  company: Pick<Company, 'modulesJson'>,
  modules: AccessModule[],
  forceInherit: boolean,
) {
  const modulesJson = serializeStringArray(modules);
  const inheritModules = forceInherit || profilesEquivalent(modulesJson, company.modulesJson);
  return {
    modulesJson: inheritModules ? '[]' : modulesJson,
    effectiveModulesJson: inheritModules ? company.modulesJson : modulesJson,
  };
}

export function navItemIsModule(item: NavItem): boolean {
  return MODULE_NAV_ITEMS.has(item);
}

export function moduleForNavItem(item: NavItem): AccessModule | null {
  return NAV_TO_MODULE.get(item) ?? null;
}

export function resolveOrgEnabledModules(
  company: Company | null | undefined,
  configLocations: LocationConfig[],
  selectedCompanyId: number | null,
  selectedLocationExternalIds: string[],
): AccessModule[] {
  if (!selectedCompanyId || !company) return [];

  let enabled = new Set(modulesFromCompany(company));
  if (enabled.size === 0) return [];

  if (selectedLocationExternalIds.length > 0) {
    const selectedLocations = configLocations.filter(
      loc => loc.companyId === selectedCompanyId && selectedLocationExternalIds.includes(loc.externalId),
    );
    if (selectedLocations.length > 0) {
      enabled = new Set(
        [...enabled].filter(module =>
          selectedLocations.every(loc => resolveLocationModulesForDisplay(loc, company).includes(module)),
        ),
      );
    }
  }

  return PLATFORM_MODULES.map(module => module.id).filter(module => enabled.has(module));
}

export function isNavItemEnabled(
  item: NavItem,
  enabledModules: AccessModule[],
): boolean {
  const module = moduleForNavItem(item);
  if (!module) return true;
  return enabledModules.includes(module);
}
