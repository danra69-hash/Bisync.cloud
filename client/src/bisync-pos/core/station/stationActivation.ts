import { parseUserAccess, isSuperAdmin, hasModule } from '../../../data/userAccess'
import type { AppUser } from '../../../api'
import { idbGet, idbSet, idbDelete } from '../offline/idbStore'

const ACTIVATION_KEY = 'station-activation'
/** Mirror for fast sync reads before IndexedDB resolves. */
const LS_ACTIVATION = 'bisync-pos-station-activation-v1'

export type StationActivation = {
  companyId: number
  companyName: string
  locationExternalId: string
  locationName: string
  activatedByUserId: number
  activatedByEmail: string
  activatedByName: string
  activatedAt: string
  /** Shared room id for LAN peer messaging between POS / KDS / CDS on this location. */
  lanRoomId: string
  catalogDownloadedAt?: string | null
}

export function canActivatePosStation(user: AppUser): boolean {
  const access = parseUserAccess(user.accessJson)
  if (isSuperAdmin(access)) return true
  const role = (user.role || '').trim().toLowerCase()
  if (role === 'company admin' || role === 'system admin' || role === 'super admin' || role === 'super user') {
    return hasModule(access, 'POS') || isSuperAdmin(access) || role === 'system admin' || role === 'company admin'
  }
  // Super platform owner email always may activate.
  if (user.email?.toLowerCase() === 'dra@cubevalue.com') return true
  return false
}

export function readActivationSync(): StationActivation | null {
  try {
    const raw = localStorage.getItem(LS_ACTIVATION)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StationActivation
    if (!parsed?.companyId || !parsed?.locationExternalId) return null
    return parsed
  } catch {
    return null
  }
}

export async function loadStationActivation(): Promise<StationActivation | null> {
  const fromIdb = await idbGet<StationActivation>(ACTIVATION_KEY)
  if (fromIdb?.companyId && fromIdb.locationExternalId) {
    try {
      localStorage.setItem(LS_ACTIVATION, JSON.stringify(fromIdb))
    } catch {
      /* ignore */
    }
    return fromIdb
  }
  return readActivationSync()
}

export async function saveStationActivation(activation: StationActivation): Promise<void> {
  await idbSet(ACTIVATION_KEY, activation)
  try {
    localStorage.setItem(LS_ACTIVATION, JSON.stringify(activation))
    localStorage.setItem('bisync-pos-standalone-company', String(activation.companyId))
    localStorage.setItem('bisync-pos-standalone-location', activation.locationExternalId)
    localStorage.setItem('bisync.selectedCompanyId', String(activation.companyId))
  } catch {
    /* ignore */
  }
}

export async function clearStationActivation(): Promise<void> {
  await idbDelete(ACTIVATION_KEY)
  try {
    localStorage.removeItem(LS_ACTIVATION)
  } catch {
    /* ignore */
  }
}

export function makeLanRoomId(companyId: number, locationExternalId: string): string {
  return `pos-lan:${companyId}:${locationExternalId}`
}
