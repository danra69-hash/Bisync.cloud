import type { PosPromotion } from '../../../../api'

export const PREPAID_NOTE_PREFIX = 'PREPAID|'

export function encodePrepaidNote(
  promotionId: number,
  customerMobile: string,
  customerName: string,
): string {
  return `${PREPAID_NOTE_PREFIX}${promotionId}|${customerMobile.trim()}|${customerName.trim()}`
}

export function parsePrepaidNote(note?: string | null): {
  promotionId: number
  customerMobile: string
  customerName: string
} | null {
  if (!note?.startsWith(PREPAID_NOTE_PREFIX)) return null
  const parts = note.slice(PREPAID_NOTE_PREFIX.length).split('|')
  if (parts.length < 3) return null
  const promotionId = Number(parts[0])
  if (!Number.isFinite(promotionId) || promotionId <= 0) return null
  return {
    promotionId,
    customerMobile: parts[1] ?? '',
    customerName: parts.slice(2).join('|'),
  }
}

export function findActivePrepaidPromotionForProduct(
  promotions: PosPromotion[],
  productId: string | number,
): PosPromotion | null {
  const pid = Number(productId)
  if (!Number.isFinite(pid) || pid <= 0) return null
  return promotions.find(p =>
    (p.promotionKind === 'prepaid' || p.promotionKind === 'Pre-paid')
    && p.active
    && p.status !== 'Inactive'
    && Array.isArray(p.products)
    && p.products.some(line => line.productId === pid),
  ) ?? null
}
