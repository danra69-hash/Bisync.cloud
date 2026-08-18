import type { AppUser } from '../api';
import {
  isTaskAllowedForType,
  type AccessControlMatrix,
} from './accessControlCatalog';
import { hasModule, isSuperAdmin, parseUserAccess } from './userAccess';

/** Access Control matrix row keys for HR Config (Configuration function). */
export const HR_CONFIG_ACCESS_ROW_KEYS = [
  'human-resource-management:configuration:ph-setting',
  'human-resource-management:configuration:level-entitlement',
  'human-resource-management:configuration:pay-structure',
  'human-resource-management:configuration:divisions-department',
] as const;

/** Access Control matrix row keys for Payroll admin pages. */
export const PAYROLL_ACCESS_ROW_KEYS = [
  'human-resource-management:payroll:view-payroll',
  'human-resource-management:payroll:run-payroll',
  'human-resource-management:payroll:approve-payroll',
] as const;

function hasAdminRole(role: string | null | undefined): boolean {
  return /system admin|super admin|company admin|hr admin/i.test(role ?? '');
}

/**
 * True when the logged-in user may open an HR admin PIN page
 * (HR Config or Payroll) for the given Access Control tasks.
 */
export function canAccessHrAdminPage(
  user: AppUser | null | undefined,
  matrix: AccessControlMatrix | null | undefined,
  rowKeys: readonly string[],
): boolean {
  if (!user) return false;
  const access = parseUserAccess(user.accessJson);
  if (isSuperAdmin(access)) return true;
  if (hasAdminRole(user.role)) return true;
  if (!hasModule(access, 'HRM')) return false;

  const typeId = access.accessControlTypeId?.trim();
  if (!typeId || !matrix) return false;
  return rowKeys.some(key => isTaskAllowedForType(matrix, key, typeId));
}
