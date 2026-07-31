import type { CartLine, Product, ProductDepartment } from '../../register/domain/types'
import { summarizeSaleDetail } from '../../register/domain/saleDetail'

export type KitchenStation = 'Bar' | 'Kitchen'

export type KitchenTicketItem = {
  name: string
  quantity: number
  /** Combination / swap / weight detail for station prep (e.g. beers in a 4+1 Bucket). */
  detail?: string
}

export type KitchenTicket = {
  id: string
  checkNumber: number
  station: KitchenStation
  tableLabel: string
  dining: string
  items: KitchenTicketItem[]
  createdAt: string
  status: 'open' | 'bumped'
}

export const KDS_TICKETS_KEY = 'bisync-pos-kds-tickets-v1'
export const KDS_TICKETS_EVENT = 'bisync-pos-kds-tickets-changed'

/** Beverage → Bar; Food / Retail → Kitchen. */
export function stationForDepartment(department: ProductDepartment): KitchenStation {
  return department === 'Beverage' ? 'Bar' : 'Kitchen'
}

export function loadKitchenTickets(): KitchenTicket[] {
  try {
    const raw = localStorage.getItem(KDS_TICKETS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as KitchenTicket[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function persist(tickets: KitchenTicket[]) {
  localStorage.setItem(KDS_TICKETS_KEY, JSON.stringify(tickets))
  window.dispatchEvent(new Event(KDS_TICKETS_EVENT))
}

export function bumpKitchenTicket(id: string): void {
  const next = loadKitchenTickets().map(t =>
    t.id === id ? { ...t, status: 'bumped' as const } : t,
  )
  persist(next)
}

function lineDetail(line: CartLine): string {
  const fromNote = (line.note ?? '').trim()
  if (fromNote) return fromNote
  if (line.saleDetail) return summarizeSaleDetail(line.saleDetail).trim()
  return ''
}

/**
 * Split cart lines into Bar / Kitchen tickets and enqueue them for the KDS board.
 * Returns the tickets that were created (empty when the cart had nothing to fire).
 */
export function fireCartToStations(opts: {
  lines: CartLine[]
  products: Product[]
  checkNumber: number
  tableLabel: string
  dining: string
}): KitchenTicket[] {
  const byId = new Map(opts.products.map(p => [p.id, p]))
  const buckets: Record<KitchenStation, KitchenTicketItem[]> = {
    Bar: [],
    Kitchen: [],
  }

  for (const line of opts.lines) {
    const product = byId.get(line.productId)
    if (!product) continue
    const station = stationForDepartment(product.department)
    const detail = lineDetail(line)
    const existing = buckets[station].find(
      i => i.name === product.name && (i.detail || '') === detail,
    )
    if (existing) {
      existing.quantity += line.quantity
    } else {
      buckets[station].push({
        name: product.name,
        quantity: line.quantity,
        ...(detail ? { detail } : {}),
      })
    }
  }

  const createdAt = new Date().toISOString()
  const created: KitchenTicket[] = []
  for (const station of ['Bar', 'Kitchen'] as const) {
    const items = buckets[station]
    if (items.length === 0) continue
    created.push({
      id: `kds-${opts.checkNumber}-${station.toLowerCase()}-${Date.now()}`,
      checkNumber: opts.checkNumber,
      station,
      tableLabel: opts.tableLabel || '—',
      dining: opts.dining || 'dine-in',
      items,
      createdAt,
      status: 'open',
    })
  }

  if (created.length === 0) return []
  persist([...created, ...loadKitchenTickets()].slice(0, 80))
  return created
}

export function ticketAgeLabel(iso: string, now = Date.now()): string {
  const ms = now - Date.parse(iso)
  if (!Number.isFinite(ms) || ms < 0) return '0m'
  const mins = Math.floor(ms / 60_000)
  if (mins < 1) return '0m'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  return `${hours}h ${mins % 60}m`
}

/** Absolute fire time for station dockets (e.g. "18:05"). */
export function ticketTimestampLabel(iso: string): string {
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return '—'
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms))
}
