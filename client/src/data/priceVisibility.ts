/** Unit-price visibility for Revenue Management (Access Control + per-user RMS). */

import {
  isTaskAllowedForType,
  type AccessControlMatrix,
} from './accessControlCatalog';
import { isSuperAdmin, parseUserAccess, type UserAccess } from './userAccess';

/** RMS task id / Access Control matrix task id. When ticked, prices are hidden. */
export const RMS_HIDE_PRICES_TASK = 'hidePrices';

/** Matrix row key from ACCESS_CONTROL_ROWS (Revenue Management → Policies → hidePrices). */
export const RMS_HIDE_PRICES_ROW_KEY = 'revenue-management:policies:hidePrices';

/**
 * True when the user's Access Control level (or per-user RMS tick) has Price Hide Policy enabled.
 * Super-admins always see prices.
 */
export function shouldHideUnitPrices(
  access: UserAccess | string | null | undefined,
  matrix?: AccessControlMatrix | null,
): boolean {
  const normalized = parseUserAccess(access);
  if (isSuperAdmin(normalized)) return false;

  const typeId = normalized.accessControlTypeId?.trim();
  if (matrix && typeId && isTaskAllowedForType(matrix, RMS_HIDE_PRICES_ROW_KEY, typeId)) {
    return true;
  }

  // Per-user RMS task tick (Users tab) — restriction, not a capability.
  return !!normalized.rms?.tasks?.[RMS_HIDE_PRICES_TASK];
}

/** Display helper: show em dash when prices are hidden. */
export function formatPriceOrHidden(
  hide: boolean,
  format: () => string,
): string {
  if (hide) return '—';
  return format();
}
