/**
 * Entertainment settlement helpers for POS Config + register.
 * Exception groups/items are NOT allowed unless Include all overrides them.
 */

export type EntertainmentExceptionRule = {
  includeAll?: boolean
  exceptionGroups?: string[]
  exceptionProductIds?: number[]
}

export type EntertainmentCartProduct = {
  id: string | number
  name: string
  group: string
}

function normGroup(value: string | undefined | null): string {
  return (value || '').trim().toLowerCase()
}

/** Returns catalog products on the check that this entertainment type forbids. */
export function findEntertainmentBlockedProducts(
  rule: EntertainmentExceptionRule | null | undefined,
  cartProducts: EntertainmentCartProduct[],
): EntertainmentCartProduct[] {
  if (!rule || rule.includeAll) return []
  const blockedGroups = new Set((rule.exceptionGroups ?? []).map(normGroup).filter(Boolean))
  const blockedIds = new Set(
    (rule.exceptionProductIds ?? [])
      .map(id => Number(id))
      .filter(id => Number.isFinite(id) && id > 0),
  )
  if (blockedGroups.size === 0 && blockedIds.size === 0) return []

  const seen = new Set<string>()
  const blocked: EntertainmentCartProduct[] = []
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
