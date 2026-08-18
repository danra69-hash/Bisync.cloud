import { api } from '../../../../api'
import { qrImageUrl } from '../../../core/config/qrTable'

export type PosWaitlistEntry = {
  id: number
  companyId: number
  locationExternalId: string
  name: string
  mobile: string
  pax: number
  status: 'waiting' | 'seated' | 'cancelled' | string
  createdAt: string
  updatedAt: string
}

export const WAITLIST_CHANGED_EVENT = 'bisync-pos-waitlist-changed'

export function buildWaitlistJoinUrl(companyId: number, locationExternalId: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const params = new URLSearchParams({
    c: String(companyId),
    l: locationExternalId,
  })
  return `${origin}/WAITLIST?${params.toString()}`
}

export function waitlistQrImageUrl(companyId: number, locationExternalId: string, size = 180): string {
  return qrImageUrl(buildWaitlistJoinUrl(companyId, locationExternalId), size)
}

export async function fetchWaitingList(
  companyId: number,
  locationExternalId: string,
): Promise<PosWaitlistEntry[]> {
  if (companyId <= 0 || !locationExternalId) return []
  const rows = await api.posWaitlistList(companyId, locationExternalId, false)
  return rows.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
}

export async function joinWaitlist(payload: {
  companyId: number
  locationExternalId: string
  name: string
  mobile: string
  pax: number
}): Promise<PosWaitlistEntry> {
  return api.posWaitlistJoin(payload)
}

export async function markWaitlistSeated(id: number): Promise<PosWaitlistEntry> {
  return api.posWaitlistUpdateStatus(id, 'seated')
}

export async function cancelWaitlistEntry(id: number): Promise<PosWaitlistEntry> {
  return api.posWaitlistUpdateStatus(id, 'cancelled')
}

export function notifyWaitlistChanged() {
  window.dispatchEvent(new Event(WAITLIST_CHANGED_EVENT))
}

export function formatWaitlistJoinedAt(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}
