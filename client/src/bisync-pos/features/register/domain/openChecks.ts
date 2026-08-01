import type { CartLine, OrderCharges } from './types'

export type OpenTableCheck = {
  tableId: string
  tableLabel: string
  checkNumber: number
  cover: number
  dining: string
  lines: CartLine[]
  charges: OrderCharges
  updatedAt: string
}

const OPEN_CHECKS_KEY = 'bisync-pos-open-checks-v1'

function loadAll(): Record<string, OpenTableCheck> {
  try {
    const raw = localStorage.getItem(OPEN_CHECKS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, OpenTableCheck>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function persist(all: Record<string, OpenTableCheck>) {
  localStorage.setItem(OPEN_CHECKS_KEY, JSON.stringify(all))
}

export function loadOpenCheck(tableId: string): OpenTableCheck | null {
  return loadAll()[tableId] ?? null
}

export function saveOpenCheck(check: OpenTableCheck): void {
  const all = loadAll()
  if (check.lines.length === 0) {
    delete all[check.tableId]
  } else {
    all[check.tableId] = { ...check, updatedAt: new Date().toISOString() }
  }
  persist(all)
}

export function clearOpenCheck(tableId: string): void {
  const all = loadAll()
  delete all[tableId]
  persist(all)
}

/** Append lines onto a target table check (creates one if needed). */
export function appendLinesToOpenCheck(opts: {
  tableId: string
  tableLabel: string
  lines: CartLine[]
  checkNumber?: number
  cover?: number
  dining?: string
  charges?: OrderCharges
}): OpenTableCheck {
  const existing = loadOpenCheck(opts.tableId)
  const emptyCharges: OrderCharges = {
    discountCents: 0,
    serviceCents: 0,
    taxRegularCents: 0,
    taxAlcoholCents: 0,
  }
  const next: OpenTableCheck = {
    tableId: opts.tableId,
    tableLabel: opts.tableLabel,
    checkNumber: existing?.checkNumber ?? opts.checkNumber ?? Math.floor(1000 + Math.random() * 9000),
    cover: existing?.cover ?? opts.cover ?? 1,
    dining: existing?.dining ?? opts.dining ?? 'dine-in',
    lines: [...(existing?.lines ?? []), ...opts.lines],
    charges: existing?.charges ?? opts.charges ?? emptyCharges,
    updatedAt: new Date().toISOString(),
  }
  saveOpenCheck(next)
  return next
}
