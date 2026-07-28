import type { Product } from '../api';
import {
  collectProductPosUnitRows,
  parsePosDeliveryUnits,
  type ProductPosUnitRow,
} from './productPosUnits';

/**
 * Company scoping for POS catalog surfaces.
 * Location selection gates the Point-of-Sales module and where sales post;
 * product locationExternalIds do not hide menu/test-tap tiles (those are
 * inventory/assignment metadata, not the POS sell list).
 */
export function productMatchesPosOrgScope(
  product: Product,
  companyId: number | null,
  _locationIds: string[] = [],
): boolean {
  if (companyId == null) return false;
  if (product.companyId != null && product.companyId !== companyId) return false;
  return true;
}

/**
 * Products that belong on the POS Menu / Test Tap sell list:
 * finished B2C goods with POS enabled and a positive RRP.
 * (B2C + RRP builds are auto-enabled for POS on create/save/backfill.)
 */
export function isPosMenuProduct(product: Product): boolean {
  if (product.isSubProduct) return false;
  if (product.active === false) return false;
  if (!product.b2cEnabled) return false;
  if (!product.posEnabled) return false;
  return Number(product.rrp ?? 0) > 0;
}

export function productMatchesPosMenu(
  product: Product,
  companyId: number | null,
  locationIds: string[] = [],
): boolean {
  return isPosMenuProduct(product) && productMatchesPosOrgScope(product, companyId, locationIds);
}

/** True when the product is assigned to the selected location (or unscoped). */
export function productAssignedToSelectedLocations(
  product: Product,
  locationIds: string[],
): boolean {
  if (locationIds.length === 0) return true;
  const scoped = product.locationExternalIds ?? [];
  if (scoped.length === 0) return true;
  return scoped.some(id => locationIds.includes(id));
}

/** Selected POS sell-unit rows (with RRP) for a product; falls back to the standard product RRP. */
export function listSelectedPosMenuUnits(
  product: Product,
  catalogProducts: Product[] = [],
): ProductPosUnitRow[] {
  const available = collectProductPosUnitRows(product, catalogProducts);
  const selectedKeys = new Set(parsePosDeliveryUnits(product).map(unit => unit.unitKey));
  const selected = available.filter(row => selectedKeys.has(row.unitKey));
  if (selected.length > 0) return selected;
  if (Number(product.rrp ?? 0) > 0) {
    return available.filter(row => row.unitKey === 'b2c-retail').slice(0, 1);
  }
  return [];
}

/** Primary sell price for POS tiles / cart — first selected unit RRP, else product RRP. */
export function resolvePosMenuRrp(
  product: Product,
  catalogProducts: Product[] = [],
): number {
  const units = listSelectedPosMenuUnits(product, catalogProducts);
  if (units.length > 0 && units[0].rrp > 0) return units[0].rrp;
  return Number(product.rrp ?? 0);
}
