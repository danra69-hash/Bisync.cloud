import type { MoneyCents } from '../../../core/types/money'
import type { OrderCharges } from '../../register/domain/types'

/** Line shown on the customer-facing pre-payment display. */
export type CustomerDisplayLine = {
  name: string
  note?: string
  quantityLabel: string
  unitPriceCents: MoneyCents
  lineTotalCents: MoneyCents
}

export type CustomerDisplaySnapshot = {
  checkNumber: number
  dining: string
  tableLabel: string
  cover: number
  lines: CustomerDisplayLine[]
  charges: OrderCharges
  subtotalCents: MoneyCents
  grandTotalCents: MoneyCents
  updatedAt: string
}

export const CDS_SNAPSHOT_KEY = 'bisync-pos-cds-snapshot-v1'
export const CDS_SNAPSHOT_EVENT = 'bisync-pos-cds-snapshot-changed'

export function loadCustomerDisplaySnapshot(): CustomerDisplaySnapshot | null {
  try {
    const raw = localStorage.getItem(CDS_SNAPSHOT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CustomerDisplaySnapshot
    if (!parsed || !Array.isArray(parsed.lines)) return null
    return parsed
  } catch {
    return null
  }
}

export function publishCustomerDisplaySnapshot(snapshot: CustomerDisplaySnapshot | null): void {
  if (!snapshot || snapshot.lines.length === 0) {
    localStorage.removeItem(CDS_SNAPSHOT_KEY)
  } else {
    localStorage.setItem(CDS_SNAPSHOT_KEY, JSON.stringify(snapshot))
  }
  window.dispatchEvent(new Event(CDS_SNAPSHOT_EVENT))
}

export function clearCustomerDisplaySnapshot(): void {
  publishCustomerDisplaySnapshot(null)
}
