export type TenderType =
  | 'card-emv'
  | 'tap'
  | 'qr'
  | 'cash'
  | 'gift-card'
  | 'entertainment'
  | string

export type SplitMethod = 'even' | 'by-seat' | 'by-item'

export type PaymentLine = {
  tender: TenderType
  amountCents: number
  paymentTypeCode?: string
  paymentTypeName?: string
}

/** Remaining balance after applied tender lines (never negative). */
export function remainingAfterPayments(
  dueCents: number,
  lines: Array<{ amountCents: number }>,
): number {
  const paid = lines.reduce((sum, line) => sum + Math.max(0, line.amountCents), 0)
  return Math.max(0, dueCents - paid)
}

/** Built-in labels used when POS Config payment types are empty. */
export const TENDER_LABEL: Record<string, string> = {
  'card-emv': 'EMV Chip',
  tap: 'Tap to Pay',
  qr: 'QR Pay',
  cash: 'Cash',
  'gift-card': 'Gift Card',
  entertainment: 'Entertainment',
}

export const DEFAULT_PAYMENT_TENDERS: Array<{ code: string; name: string }> = [
  { code: 'CASH', name: 'Cash' },
  { code: 'CARD-EMV', name: 'EMV Chip' },
  { code: 'TAP', name: 'Tap to Pay' },
  { code: 'QR', name: 'QR Pay' },
  { code: 'GIFT-CARD', name: 'Gift Card' },
]

/** Normalize POS Config / API payment codes for comparison. */
export function normalizePaymentCode(code: string | null | undefined): string {
  return (code || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')
}

/** UI behavior for a payment type code. */
export function paymentTenderBehavior(
  code: string | null | undefined,
): 'cash' | 'entertainment' | 'other' {
  const key = normalizePaymentCode(code)
  if (key === 'cash') return 'cash'
  if (
    key === 'entertainment'
    || key === 'duty-meals'
    || key === 'duty-meal'
    || key === 'compliment'
    || key === 'comp'
    || key === 'non-revenue'
  ) {
    return 'entertainment'
  }
  return 'other'
}

/**
 * Method string stored on PosPayments / EOD.
 * Maps common POS Config codes onto buckets the EOD summary already understands.
 */
export function paymentMethodForApi(code: string | null | undefined): string {
  const key = normalizePaymentCode(code)
  if (!key) return 'cash'
  if (key === 'cash') return 'cash'
  if (key === 'card-emv' || key === 'card' || key === 'credit-card' || key === 'emv' || key === 'emv-chip') {
    return 'credit-card'
  }
  if (key === 'tap' || key === 'tap-to-pay') return 'credit-card'
  if (key === 'qr' || key === 'qr-pay') return 'qr-pay'
  if (key === 'gift-card' || key === 'giftcard') return 'gift-card'
  if (paymentTenderBehavior(key) === 'entertainment') return 'entertainment'
  return key
}

/** Stable tender key used in PaymentModal selection state. */
export function paymentTenderKey(code: string | null | undefined): string {
  const key = normalizePaymentCode(code)
  return key || 'cash'
}

export function paymentTypeLabel(
  code: string | null | undefined,
  name?: string | null,
): string {
  const trimmed = (name || '').trim()
  if (trimmed) return trimmed
  const key = paymentTenderKey(code)
  return TENDER_LABEL[key] || (code || '').trim() || 'Payment'
}
