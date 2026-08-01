import { api } from '../../../../api'
import {
  DEFAULT_FLOOR_PLAN,
  FLOOR_STORAGE_KEY,
  FLOOR_STORAGE_KEY_LEGACY,
  loadFloorPlan,
  MOCK_ZONES,
  normalizeTable,
  saveFloorPlan,
  type FloorPlanState,
  type FloorTable,
} from './tables'

type StoredFloorPlan = FloorPlanState & {
  /** ISO timestamp of last local write / successful sync. */
  updatedAt?: string
}

function normalizeTables(tables: FloorTable[]): FloorTable[] {
  return tables.map(t => normalizeTable(t))
}

function scopedKey(companyId: number, locationExternalId: string) {
  return `${FLOOR_STORAGE_KEY}:${companyId}:${locationExternalId}`
}

function scopedMetaKey(companyId: number, locationExternalId: string) {
  return `${FLOOR_STORAGE_KEY}:meta:${companyId}:${locationExternalId}`
}

function toPlan(tables: FloorTable[], zones: FloorPlanState['zones']): FloorPlanState {
  return {
    tables: normalizeTables(tables),
    zones:
      Array.isArray(zones) && zones.length > 0
        ? zones
        : structuredClone(MOCK_ZONES),
  }
}

export function parseFloorPlanJson(raw: string | null | undefined): FloorPlanState | null {
  if (!raw?.trim()) return null
  try {
    const parsed = JSON.parse(raw) as StoredFloorPlan
    if (!parsed?.tables?.length) return null
    return toPlan(parsed.tables, parsed.zones)
  } catch {
    return null
  }
}

function parseStored(raw: string | null | undefined): { plan: FloorPlanState; updatedAt: string | null } | null {
  if (!raw?.trim()) return null
  try {
    const parsed = JSON.parse(raw) as StoredFloorPlan
    if (!parsed?.tables?.length) return null
    return {
      plan: toPlan(parsed.tables, parsed.zones),
      updatedAt: typeof parsed.updatedAt === 'string' && parsed.updatedAt.trim()
        ? parsed.updatedAt
        : null,
    }
  } catch {
    return null
  }
}

function readLocalUpdatedAt(companyId: number, locationExternalId: string): string | null {
  try {
    const meta = localStorage.getItem(scopedMetaKey(companyId, locationExternalId))
    if (meta?.trim()) return meta.trim()
  } catch {
    /* ignore */
  }
  return null
}

function writeLocalUpdatedAt(
  companyId: number,
  locationExternalId: string,
  updatedAt: string,
) {
  try {
    localStorage.setItem(scopedMetaKey(companyId, locationExternalId), updatedAt)
  } catch {
    /* ignore */
  }
}

function parseTime(value: string | null | undefined): number {
  if (!value) return 0
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : 0
}

function readLegacyUnscoped(): FloorPlanState | null {
  try {
    const raw = localStorage.getItem(FLOOR_STORAGE_KEY)
    if (raw) {
      const parsed = parseFloorPlanJson(raw)
      if (parsed) return parsed
    }
    const legacy = localStorage.getItem(FLOOR_STORAGE_KEY_LEGACY)
    if (legacy) {
      const tables = JSON.parse(legacy) as FloorTable[]
      if (Array.isArray(tables) && tables.length > 0) {
        return toPlan(tables, structuredClone(MOCK_ZONES))
      }
    }
  } catch {
    /* ignore */
  }
  return null
}

/** Local cache for a company/location, migrating the old global key once. */
export function loadFloorPlanLocal(companyId: number, locationExternalId: string): FloorPlanState {
  const key = scopedKey(companyId, locationExternalId)
  try {
    const scoped = parseStored(localStorage.getItem(key))
    if (scoped) return scoped.plan
  } catch {
    /* ignore */
  }

  const migrated = readLegacyUnscoped() ?? loadFloorPlan()
  saveFloorPlanLocal(migrated, companyId, locationExternalId)
  return migrated
}

export function saveFloorPlanLocal(
  plan: FloorPlanState,
  companyId: number,
  locationExternalId: string,
  updatedAt?: string | null,
) {
  const key = scopedKey(companyId, locationExternalId)
  const stamp = updatedAt?.trim() || new Date().toISOString()
  const payload: StoredFloorPlan = {
    tables: plan.tables,
    zones: plan.zones,
    updatedAt: stamp,
  }
  localStorage.setItem(key, JSON.stringify(payload))
  writeLocalUpdatedAt(companyId, locationExternalId, stamp)
  // Keep legacy key in sync so older helpers still see the active location plan.
  saveFloorPlan(plan)
}

function plansLookEqual(a: FloorPlanState, b: FloorPlanState): boolean {
  try {
    return JSON.stringify({ tables: a.tables, zones: a.zones })
      === JSON.stringify({ tables: b.tables, zones: b.zones })
  } catch {
    return false
  }
}

/**
 * Resolve the floor plan for a location.
 * Prefer whichever side has the newer updatedAt so a just-saved local layout
 * is not clobbered by a stale GET before PUT finishes.
 * Empty server rows are seeded from local (custom or default) so DB stays populated.
 */
export async function syncFloorPlan(
  companyId: number,
  locationExternalId: string,
): Promise<FloorPlanState> {
  const local = loadFloorPlanLocal(companyId, locationExternalId)
  const localUpdatedAt = readLocalUpdatedAt(companyId, locationExternalId)

  try {
    const remote = await api.posFloorPlan(companyId, locationExternalId)
    const serverPlan = parseFloorPlanJson(remote.layoutJson)
    const remoteUpdatedAt = remote.updatedAt

    if (serverPlan) {
      const localMs = parseTime(localUpdatedAt)
      const remoteMs = parseTime(remoteUpdatedAt)
      // Local newer (e.g. save in flight / offline edit) → keep local and push to DB.
      if (localMs > remoteMs && !plansLookEqual(local, serverPlan)) {
        await api.posFloorPlanUpsert({
          companyId,
          locationExternalId,
          layoutJson: JSON.stringify(local),
        })
        const stamp = new Date().toISOString()
        saveFloorPlanLocal(local, companyId, locationExternalId, stamp)
        return local
      }
      // Remote wins (or equal) — keep DB as source of truth.
      saveFloorPlanLocal(
        serverPlan,
        companyId,
        locationExternalId,
        remoteUpdatedAt || new Date().toISOString(),
      )
      return serverPlan
    }

    // Server empty — promote local browser layout into DB so it remains persisted.
    const uploaded = await api.posFloorPlanUpsert({
      companyId,
      locationExternalId,
      layoutJson: JSON.stringify(local),
    })
    saveFloorPlanLocal(
      local,
      companyId,
      locationExternalId,
      uploaded.updatedAt || new Date().toISOString(),
    )
    return local
  } catch {
    return local.tables.length > 0 ? local : structuredClone(DEFAULT_FLOOR_PLAN)
  }
}

/**
 * Persist layout to localStorage and DB.
 * Returns true only when the remote upsert succeeds.
 */
export async function persistFloorPlanRemote(
  plan: FloorPlanState,
  companyId: number,
  locationExternalId: string,
): Promise<boolean> {
  const stamp = new Date().toISOString()
  saveFloorPlanLocal(plan, companyId, locationExternalId, stamp)
  try {
    const saved = await api.posFloorPlanUpsert({
      companyId,
      locationExternalId,
      layoutJson: JSON.stringify(plan),
    })
    saveFloorPlanLocal(
      plan,
      companyId,
      locationExternalId,
      saved.updatedAt || stamp,
    )
    return true
  } catch {
    // Local cache still holds the layout; sync will retry upload when online.
    return false
  }
}
