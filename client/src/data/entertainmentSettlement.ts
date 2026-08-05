/**
 * Shared exception helpers for entertainment / discount PosConfig types.
 * Exception groups/items are NOT allowed unless Include all overrides them.
 */

export type PosConfigExceptionRule = {
  includeAll?: boolean
  exceptionGroups?: string[]
  exceptionProductIds?: number[]
}

export type PosConfigCartProduct = {
  id: string | number
  name: string
  group: string
}

function normGroup(value: string | undefined | null): string {
  return (value || '').trim().toLowerCase()
}

/** Returns catalog products on the check that this config type forbids. */
export function findPosConfigBlockedProducts(
  rule: PosConfigExceptionRule | null | undefined,
  cartProducts: PosConfigCartProduct[],
): PosConfigCartProduct[] {
  if (!rule || rule.includeAll) return []
  const blockedGroups = new Set((rule.exceptionGroups ?? []).map(normGroup).filter(Boolean))
  const blockedIds = new Set(
    (rule.exceptionProductIds ?? [])
      .map(id => Number(id))
      .filter(id => Number.isFinite(id) && id > 0),
  )
  if (blockedGroups.size === 0 && blockedIds.size === 0) return []

  const seen = new Set<string>()
  const blocked: PosConfigCartProduct[] = []
  for (const product of cartProducts) {
    const numericId = Number(product.id)
    const key = String(product.id)
    if (seen.has(key)) continue
    const byId = Number.isFinite(numericId) && blockedIds.has(numericId)
    const byGroup = blockedGroups.has(normGroup(product.group))
    if (byId || byGroup) {
      seen.add(key)
      blocked.push(product)
    }
  }
  return blocked
}

/** @deprecated Prefer findPosConfigBlockedProducts */
export const findEntertainmentBlockedProducts = findPosConfigBlockedProducts
export type EntertainmentExceptionRule = PosConfigExceptionRule
export type EntertainmentCartProduct = PosConfigCartProduct

/** Build PosPayment.Purpose: CODE · Employee — reason */
export function formatEntertainmentPurpose(
  typeCode: string,
  employeeName: string,
  reason: string,
): string {
  const code = (typeCode || 'ENT').trim().toUpperCase() || 'ENT'
  const employee = employeeName.trim()
  const why = reason.trim()
  const raw = `${code} · ${employee} — ${why}`
  return raw.length > 240 ? raw.slice(0, 240) : raw
}

/** Discount cents from subtotal and configured percentage (capped at subtotal). */
export function discountCentsFromPercent(subtotalCents: number, percentage: number): number {
  const sub = Math.max(0, Math.round(subtotalCents))
  const pct = Math.min(100, Math.max(0, Number(percentage) || 0))
  return Math.min(sub, Math.round((sub * pct) / 100))
}

/** Optional audit label for a discount apply. */
export function formatDiscountLabel(
  typeCode: string,
  percentage: number,
  reason?: string,
): string {
  const code = (typeCode || 'DISC').trim().toUpperCase() || 'DISC'
  const pct = Math.min(100, Math.max(0, Number(percentage) || 0))
  const why = (reason || '').trim()
  const base = `${code} ${pct}%`
  const raw = why ? `${base}: ${why}` : base
  return raw.length > 200 ? raw.slice(0, 200) : raw
}
