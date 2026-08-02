import type { CartLine, OrderCharges, Product } from './types'
import { loadKitchenTickets } from '../../boh/domain/kitchenTickets'

export const OPEN_CHECKS_KEY = 'bisync-pos-open-checks-v1'

export const EMPTY_OPEN_CHARGES: OrderCharges = {
  discountCents: 0,
  serviceCents: 0,
  taxRegularCents: 0,
  taxAlcoholCents: 0,
}

export type OpenCheck = {
  tableId: string
  tableLabel: string
  orderId: string
  checkNumber: number
  lines: CartLine[]
  charges: OrderCharges
  dining: string
  cover: number
  /** Quantity already sent to KDS, keyed by stable line identity. */
  firedQtyByLine: Record<string, number>
  /** ISO timestamp of first fire for each line identity. */
  firedAtByLine?: Record<string, string>
  updatedAt: string
}

/** Fired lines older than this require Void (reason + permission + stock depletion). */
export const VOID_AFTER_MS = 5 * 60 * 1000

export function mergeFiredAtByLine(
  previous: Record<string, string> | undefined,
  firedQtyBefore: Record<string, number>,
  nextFiredQty: Record<string, number>,
  firedAtIso = new Date().toISOString(),
): Record<string, string> {
  const next: Record<string, string> = { ...(previous ?? {}) }
  for (const [id, qty] of Object.entries(nextFiredQty)) {
    if (qty <= 0) {
      delete next[id]
      continue
    }
    const was = firedQtyBefore[id] ?? 0
    if (was <= 0 && !next[id]) {
      next[id] = firedAtIso
    }
  }
  for (const id of Object.keys(next)) {
    if ((nextFiredQty[id] ?? 0) <= 0) delete next[id]
  }
  return next
}

export function minutesSinceFire(firedAtIso: string | undefined, now = Date.now()): number | null {
  if (!firedAtIso) return null
  const ms = now - Date.parse(firedAtIso)
  if (!Number.isFinite(ms) || ms < 0) return 0
  return ms / 60_000
}

export function removalModeForFireAge(
  firedAtIso: string | undefined,
  now = Date.now(),
): 'unfired' | 'cancel' | 'void' {
  if (!firedAtIso) return 'unfired'
  const ms = now - Date.parse(firedAtIso)
  if (!Number.isFinite(ms) || ms < 0) return 'cancel'
  return ms >= VOID_AFTER_MS ? 'void' : 'cancel'
}

function readAll(): OpenCheck[] {
  try {
    const raw = localStorage.getItem(OPEN_CHECKS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as OpenCheck[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(checks: OpenCheck[]) {
  localStorage.setItem(OPEN_CHECKS_KEY, JSON.stringify(checks))
}

export function lineIdentity(line: CartLine): string {
  return line.lineKey ?? `pid:${line.productId}`
}

export function loadOpenCheckForTable(tableId: string): OpenCheck | null {
  if (!tableId) return null
  return readAll().find(c => c.tableId === tableId) ?? null
}

export function loadOpenCheckByOrderId(orderId: string): OpenCheck | null {
  if (!orderId) return null
  return readAll().find(c => c.orderId === orderId) ?? null
}

export function upsertOpenCheck(check: OpenCheck): OpenCheck {
  const next: OpenCheck = {
    ...check,
    updatedAt: new Date().toISOString(),
  }
  const all = readAll()
  const idx = all.findIndex(c => c.tableId === next.tableId)
  if (idx >= 0) all[idx] = next
  else all.push(next)
  writeAll(all)
  return next
}

export function removeOpenCheckForTable(tableId: string): void {
  if (!tableId) return
  writeAll(readAll().filter(c => c.tableId !== tableId))
}

/**
 * Build cart lines that still need to be fired to KDS (quantity deltas only).
 * Updates firedQtyByLine to match the current cart after a successful fire.
 */
export function takeUnfiredLines(
  lines: CartLine[],
  firedQtyByLine: Record<string, number>,
): { toFire: CartLine[]; nextFiredQtyByLine: Record<string, number> } {
  const nextFired: Record<string, number> = {}
  const toFire: CartLine[] = []

  for (const line of lines) {
    const id = lineIdentity(line)
    const already = Math.max(0, firedQtyByLine[id] ?? 0)
    const qty = line.quantity
    nextFired[id] = qty
    const delta = qty - already
    if (delta > 0) {
      toFire.push({ ...line, quantity: delta })
    }
  }

  return { toFire, nextFiredQtyByLine: nextFired }
}

/** Parse `chk-1234` style floor order ids. */
export function checkNumberFromOrderId(orderId?: string | null): number | null {
  if (!orderId) return null
  const match = /^chk-(\d+)$/i.exec(orderId.trim())
  if (!match) return null
  const n = Number(match[1])
  return Number.isFinite(n) ? n : null
}

/**
 * Best-effort rebuild of cart lines from KDS tickets when an open check was never
 * persisted (tables ordered before open-check storage existed).
 */
export function recoverOpenCheckFromKitchen(
  tableId: string,
  tableLabel: string,
  orderId: string,
  products: Product[],
): OpenCheck | null {
  const checkNumber = checkNumberFromOrderId(orderId)
  if (checkNumber == null) return null

  const tickets = loadKitchenTickets().filter(
    t => t.checkNumber === checkNumber && t.status === 'open',
  )
  if (tickets.length === 0) return null

  const byName = new Map(products.map(p => [p.name.trim().toLowerCase(), p]))
  const lines: CartLine[] = []
  const firedQtyByLine: Record<string, number> = {}
  const firedAtByLine: Record<string, string> = {}

  for (const ticket of tickets) {
    for (const item of ticket.items) {
      const product = byName.get(item.name.trim().toLowerCase())
      if (!product) continue
      const note = (item.detail ?? '').trim() || undefined
      const existing = lines.find(
        l => l.productId === product.id && (l.note ?? '') === (note ?? ''),
      )
      if (existing) {
        existing.quantity += item.quantity
      } else {
        lines.push({
          productId: product.id,
          quantity: item.quantity,
          ...(note ? { note } : {}),
        })
      }
      const id = lineIdentity({
        productId: product.id,
        quantity: item.quantity,
        ...(note ? { note } : {}),
      })
      firedQtyByLine[id] = (firedQtyByLine[id] ?? 0) + item.quantity
      if (!firedAtByLine[id] || ticket.createdAt < firedAtByLine[id]) {
        firedAtByLine[id] = ticket.createdAt
      }
    }
  }

  if (lines.length === 0) return null

  return upsertOpenCheck({
    tableId,
    tableLabel,
    orderId,
    checkNumber,
    lines,
    charges: { ...EMPTY_OPEN_CHARGES },
    dining: 'dine-in',
    cover: 2,
    firedQtyByLine,
    firedAtByLine,
    updatedAt: new Date().toISOString(),
  })
}
