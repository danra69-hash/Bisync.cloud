/** Cash denomination ladder in minor units (cents). */
export const CASH_DENOMS_CENTS = [10000, 5000, 2000, 1000, 500, 100, 50, 20, 10] as const

export type CashCountQtys = Record<string, number>

export type PosEodSession = {
  id: number
  companyId: number
  locationExternalId: string
  externalId: string
  businessDate: string
  cashConfirmed: boolean
  cashExpectedCents: number
  cashCountedCents: number
  cashCountQtysJson: string
  creditQrConfirmed: boolean
  nonRevenueConfirmed: boolean
  voidsConfirmed: boolean
  discountConfirmed: boolean
  dayClosed: boolean
  closedAt?: string | null
  updatedAt: string
  allConfirmed: boolean
  cashVarianceCents: number
}

export type PosEodSummary = {
  businessDate: string
  openChecks: number
  closedChecks: number
  grossSalesCents: number
  netSalesCents: number
  discountCents: number
  taxCents: number
  voidCents: number
  cashExpectedCents: number
  creditQrCents: number
  nonRevenueCents: number
  tipsOwedCents: number
}

export type PosEodBundle = {
  session: PosEodSession
  summary: PosEodSummary
  alreadyClosed?: boolean
  closed?: boolean
}

export function parseCashCountQtys(json: string | null | undefined): CashCountQtys {
  try {
    const parsed = JSON.parse(json || '{}') as CashCountQtys
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed
  } catch {
    return {}
  }
}

export function cashCountTotalCents(qtys: CashCountQtys): number {
  return Object.entries(qtys).reduce((sum, [denom, qty]) => {
    const d = Number(denom)
    const q = Number(qty)
    if (!Number.isFinite(d) || !Number.isFinite(q) || q <= 0) return sum
    return sum + d * Math.floor(q)
  }, 0)
}

export function denomLabel(cents: number): string {
  if (cents >= 100) return String(cents / 100)
  return (cents / 100).toFixed(2)
}
