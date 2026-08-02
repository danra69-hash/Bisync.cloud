import { api } from '../../../../api'
import {
  isTaskAllowedForType,
  parseAccessControlMatrix,
} from '../../../../data/accessControlCatalog'
import { parseUserAccess } from '../../../../data/userAccess'
import { hrApi } from '../../../../modules/hr/api'
import type { Employee } from '../../../../modules/hr/types'
import { ROLE_PERMISSIONS } from '../../boh/domain/permissions'
import { resolvePinEmployee } from '../../../core/session/posDutyPin'

/** Access Control matrix row for POS cashier voids / discounts. */
export const VOID_ACCESS_ROW_KEY = 'point-of-sales:cashier:discounts-voids'

function textLooksLikeManager(value: string | null | undefined): boolean {
  const s = (value || '').toLowerCase()
  return /manager|owner|supervisor|director|gm\b|admin/.test(s)
}

/** Fallback when Access Control matrix has no grant for the linked user. */
export function employeeCanVoidFallback(
  employee: Pick<Employee, 'position' | 'department' | 'employeeLevel'>,
): boolean {
  if (ROLE_PERMISSIONS.manager.includes('void') || ROLE_PERMISSIONS.manager.includes('void-large')) {
    if (textLooksLikeManager(employee.position)) return true
    if (textLooksLikeManager(employee.department)) return true
    if (textLooksLikeManager(employee.employeeLevel?.levelName)) return true
  }
  return false
}

/**
 * Verify a 4-digit authorizer PIN belongs to someone allowed to void.
 * Prefer Access Control matrix (Discounts & Voids); fall back to manager-like title.
 * Demo / non-HR PIN is never accepted for void.
 */
export async function authorizeVoidPin(pin: string): Promise<
  | { ok: true; employeeId: number; employeeName: string }
  | { ok: false; error: string }
> {
  const trimmed = pin.trim()
  if (trimmed.length !== 4) {
    return { ok: false, error: 'Enter a 4-digit authorizer PIN.' }
  }

  const resolved = await resolvePinEmployee(trimmed)
  if (!resolved || resolved.employeeId <= 0) {
    return { ok: false, error: 'Invalid authorizer PIN. Only permitted staff can void.' }
  }

  try {
    const [employees, users, accessControl] = await Promise.all([
      hrApi.employees.list(),
      api.users().catch(() => [] as Awaited<ReturnType<typeof api.users>>),
      api.accessControl().catch(() => null),
    ])

    const match = employees.find(e => e.id === resolved.employeeId)
    if (!match) {
      return { ok: false, error: 'Could not verify void permission for this PIN.' }
    }

    const linkedUser = users.find(u => u.employeeId === match.id && u.active)
    if (linkedUser && accessControl) {
      const matrix = parseAccessControlMatrix(accessControl.matrixJson)
      const typeId = parseUserAccess(linkedUser.accessJson).accessControlTypeId?.trim()
      if (typeId && isTaskAllowedForType(matrix, VOID_ACCESS_ROW_KEY, typeId)) {
        return {
          ok: true,
          employeeId: match.id,
          employeeName: match.name,
        }
      }
      // Linked user exists but matrix denies — still allow manager-title fallback
      // only when matrix has no row configured for this type at all.
      const rowConfigured = Object.keys(matrix[VOID_ACCESS_ROW_KEY] ?? {}).length > 0
      if (rowConfigured && typeId && !isTaskAllowedForType(matrix, VOID_ACCESS_ROW_KEY, typeId)) {
        return {
          ok: false,
          error: `${match.name} is not permitted to void (Access Control). Ask a manager.`,
        }
      }
    }

    if (!employeeCanVoidFallback(match)) {
      return {
        ok: false,
        error: `${match.name} is not permitted to void. Ask a manager.`,
      }
    }
    return {
      ok: true,
      employeeId: match.id,
      employeeName: match.name,
    }
  } catch {
    return { ok: false, error: 'Unable to verify void permission right now.' }
  }
}
