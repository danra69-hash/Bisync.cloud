import { qrImageUrl } from '../bisync-pos/core/config/qrTable'
import type { PosDeviceType } from './posDevices'

/** Standalone POS station entry points (no platform login). */
export type PosStationEntry = 'pos' | 'kds' | 'bds' | 'cds'

export const POS_STATION_ENTRIES: { entry: PosStationEntry; path: string; label: string }[] = [
  { entry: 'pos', path: '/POS', label: 'POS' },
  { entry: 'kds', path: '/KDS', label: 'KDS' },
  { entry: 'bds', path: '/BDS', label: 'BDS' },
  { entry: 'cds', path: '/CDS', label: 'CDS' },
]

const DEVICE_TYPE_ENTRY: Partial<Record<PosDeviceType, PosStationEntry>> = {
  posMain: 'pos',
  posOrderStation: 'pos',
  kitchenDisplay: 'kds',
  barDisplay: 'bds',
  kiosk: 'pos',
}

export function stationPathForEntry(entry: PosStationEntry): string {
  return POS_STATION_ENTRIES.find(e => e.entry === entry)?.path ?? '/POS'
}

export function stationEntryForDeviceType(deviceType: string): PosStationEntry | null {
  return DEVICE_TYPE_ENTRY[deviceType as PosDeviceType] ?? null
}

/** Absolute URL for opening a station on a phone / tablet / external browser. */
export function buildPosStationUrl(
  entry: PosStationEntry,
  companyId: number,
  locationExternalId: string,
  origin = typeof window !== 'undefined' ? window.location.origin : '',
): string {
  const path = stationPathForEntry(entry)
  const params = new URLSearchParams({
    c: String(companyId),
    l: locationExternalId,
  })
  return `${origin}${path}?${params.toString()}`
}

export function posStationQrImageUrl(
  entry: PosStationEntry,
  companyId: number,
  locationExternalId: string,
  size = 220,
): string {
  return qrImageUrl(buildPosStationUrl(entry, companyId, locationExternalId), size)
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through */
  }
  try {
    const el = document.createElement('textarea')
    el.value = text
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.left = '-9999px'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    return ok
  } catch {
    return false
  }
}
