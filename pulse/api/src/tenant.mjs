/** Tenant helpers — company / location scoping (no DB drivers). */

import { ROLE_MODULES } from './domain.mjs';

export const COMPANY_WIDE_ROLES = new Set(['superuser', 'management', 'admin', 'accounting']);

export function isCompanyWideRole(role) {
  return COMPANY_WIDE_ROLES.has(role);
}

export function modulesForRole(role) {
  return ROLE_MODULES[role] ?? [];
}

/**
 * Build SQL WHERE fragments for company (+ optional location) filters.
 * @returns {{ clause: string, params: any[], next: number }}
 */
export function tenantWhere(alias, companyId, locationId, startIndex = 1, locationColumn = 'location_id') {
  const params = [companyId];
  let clause = `${alias ? `${alias}.` : ''}company_id = $${startIndex}`;
  let next = startIndex + 1;
  if (locationId) {
    clause += ` AND ${alias ? `${alias}.` : ''}${locationColumn} = $${next}`;
    params.push(locationId);
    next += 1;
  }
  return { clause, params, next };
}
