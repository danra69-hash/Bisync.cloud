import type { AccessModule } from './userAccess';
import type { NavItem } from './revenueManagement';

/** Platform-level Go live targets on Dev Console overview. */
export type PlatformGoLiveModuleId = AccessModule | 'SystemConfig';

export const PLATFORM_GO_LIVE_MODULES: {
  id: PlatformGoLiveModuleId;
  label: string;
  navItem: NavItem | null;
}[] = [
  { id: 'RMS', label: 'Revenue Management', navItem: 'Revenue Management' },
  { id: 'POS', label: 'Point-of-Sales', navItem: 'Point-of-Sales' },
  { id: 'HRM', label: 'Human Resources', navItem: 'Human Resources' },
  { id: 'Accounting', label: 'Accounting', navItem: 'Accounting' },
  { id: 'SystemConfig', label: 'System Configuration', navItem: 'System Configuration' },
];

export type ModulesGoLiveMap = Partial<Record<PlatformGoLiveModuleId, boolean>>;

export function isPlatformModuleLive(
  moduleId: PlatformGoLiveModuleId,
  modulesGoLive: ModulesGoLiveMap | null | undefined,
): boolean {
  if (!modulesGoLive) return true; // fail-open until policy loads
  return Boolean(modulesGoLive[moduleId]);
}

export function isNavItemPlatformLive(
  item: NavItem,
  modulesGoLive: ModulesGoLiveMap | null | undefined,
): boolean {
  const match = PLATFORM_GO_LIVE_MODULES.find(m => m.navItem === item);
  if (!match) return true;
  return isPlatformModuleLive(match.id, modulesGoLive);
}

export function filterAccessModulesByPlatformGoLive(
  modules: AccessModule[],
  modulesGoLive: ModulesGoLiveMap | null | undefined,
): AccessModule[] {
  if (!modulesGoLive) return modules;
  return modules.filter(m => isPlatformModuleLive(m, modulesGoLive));
}
