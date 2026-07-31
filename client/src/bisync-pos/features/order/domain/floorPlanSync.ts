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

function normalizeTables(tables: FloorTable[]): FloorTable[] {
  return tables.map(t => normalizeTable(t))
}

function scopedKey(companyId: number, locationExternalId: string) {
  return `${FLOOR_STORAGE_KEY}:${companyId}:${locationExternalId}`
}

export function parseFloorPlanJson(raw: string | null | undefined): FloorPlanState | null {
  if (!raw?.trim()) return null
  try {
    const parsed = JSON.parse(raw) as FloorPlanState
    if (!parsed?.tables?.length) return null
    return {
      tables: normalizeTables(parsed.tables),
      zones:
        Array.isArray(parsed.zones) && parsed.zones.length > 0
          ? parsed.zones
          : structuredClone(MOCK_ZONES),
    }
  } catch {
    return null
  }
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
        return {
          tables: normalizeTables(tables),
          zones: structuredClone(MOCK_ZONES),
        }
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
    const scoped = parseFloorPlanJson(localStorage.getItem(key))
    if (scoped) return scoped
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
) {
  const key = scopedKey(companyId, locationExternalId)
  localStorage.setItem(key, JSON.stringify(plan))
  // Keep legacy key in sync so older helpers still see the active location plan.
  saveFloorPlan(plan)
}

/**
 * Resolve the floor plan for a location:
 * - prefer server when it has tables
 * - else upload local/custom layout to server
 * - else fall back to default demo layout and seed the server
 */
export async function syncFloorPlan(
  companyId: number,
  locationExternalId: string,
): Promise<FloorPlanState> {
  const local = loadFloorPlanLocal(companyId, locationExternalId)

  try {
    const remote = await api.posFloorPlan(companyId, locationExternalId)
    const serverPlan = parseFloorPlanJson(remote.layoutJson)
    if (serverPlan) {
      saveFloorPlanLocal(serverPlan, companyId, locationExternalId)
      return serverPlan
    }

    // Server empty — promote local browser layout (including any custom edit).
    await api.posFloorPlanUpsert({
      companyId,
      locationExternalId,
      layoutJson: JSON.stringify(local),
    })
    return local
  } catch {
    return local.tables.length > 0 ? local : structuredClone(DEFAULT_FLOOR_PLAN)
  }
}

export async function persistFloorPlanRemote(
  plan: FloorPlanState,
  companyId: number,
  locationExternalId: string,
): Promise<void> {
  saveFloorPlanLocal(plan, companyId, locationExternalId)
  try {
    await api.posFloorPlanUpsert({
      companyId,
      locationExternalId,
      layoutJson: JSON.stringify(plan),
    })
  } catch {
    /* offline — local cache still updated */
  }
}
