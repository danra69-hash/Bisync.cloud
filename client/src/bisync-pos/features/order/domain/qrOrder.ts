import { api } from '../../../../api'
import { qrImageUrl } from '../../../core/config/qrTable'

export type PosQrOrderItem = {
  productId: number
  name: string
  quantity: number
  detail?: string
  unitPrice: number
}

export type PosQrOrder = {
  id: number
  companyId: number
  locationExternalId: string
  tableLabel: string
  guestName: string
  status: string
  items: PosQrOrderItem[]
  totalValue: number
  createdAt: string
  updatedAt: string
}

export type PosQrMenuItem = {
  id: number
  productId: string
  name: string
  category: string
  group: string
  rrp: number
}

export const QR_ORDER_CHANGED_EVENT = 'bisync-pos-qr-order-changed'

export function buildQrOrderUrl(companyId: number, locationExternalId: string, tableLabel?: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const params = new URLSearchParams({
    c: String(companyId),
    l: locationExternalId,
  })
  const table = (tableLabel ?? '').trim()
  if (table) params.set('t', table)
  return `${origin}/QR?${params.toString()}`
}

export function qrOrderImageUrl(
  companyId: number,
  locationExternalId: string,
  size = 220,
  tableLabel?: string,
): string {
  return qrImageUrl(buildQrOrderUrl(companyId, locationExternalId, tableLabel), size)
}

function normalizeItems(raw: unknown): PosQrOrderItem[] {
  if (!Array.isArray(raw)) return []
  return raw.map(item => {
    const row = item as Record<string, unknown>
    return {
      productId: Number(row.productId) || 0,
      name: String(row.name ?? ''),
      quantity: Number(row.quantity) || 0,
      detail: String(row.detail ?? ''),
      unitPrice: Number(row.unitPrice) || 0,
    }
  }).filter(i => i.productId > 0 && i.name && i.quantity > 0)
}

export async function fetchQrOrderMenu(
  companyId: number,
  locationExternalId: string,
): Promise<PosQrMenuItem[]> {
  return api.posQrOrderMenu(companyId, locationExternalId)
}

export async function fetchOpenQrOrders(
  companyId: number,
  locationExternalId: string,
): Promise<PosQrOrder[]> {
  const rows = await api.posQrOrderList(companyId, locationExternalId, false)
  return rows.map(r => ({
    ...r,
    items: normalizeItems(r.items),
  }))
}

export async function placeQrOrder(payload: {
  companyId: number
  locationExternalId: string
  tableLabel?: string
  guestName?: string
  items: PosQrOrderItem[]
}): Promise<PosQrOrder> {
  const row = await api.posQrOrderPlace(payload)
  return { ...row, items: normalizeItems(row.items) }
}

export async function markQrOrderSent(id: number): Promise<PosQrOrder> {
  const row = await api.posQrOrderUpdateStatus(id, 'sent')
  return { ...row, items: normalizeItems(row.items) }
}

export async function cancelQrOrder(id: number): Promise<PosQrOrder> {
  const row = await api.posQrOrderUpdateStatus(id, 'cancelled')
  return { ...row, items: normalizeItems(row.items) }
}

export function notifyQrOrderChanged() {
  window.dispatchEvent(new Event(QR_ORDER_CHANGED_EVENT))
}

export function formatQrOrderTime(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}
