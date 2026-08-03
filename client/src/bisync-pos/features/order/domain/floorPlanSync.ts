import { api } from '../../../../api'
import {
  DEFAULT_FLOOR_PLAN,
  FLOOR_STORAGE_KEY,
  FLOOR_STORAGE_KEY_LEGACY,
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

/** True when the plan matches the stock demo layout (ids + labels), not a custom save. */
export function isStockDefaultFloorPlan(plan: FloorPlanState | null | undefined): boolean {
  if (!plan?.tables?.length) return false
  const stock = DEFAULT_FLOOR_PLAN.tables
  if (plan.tables.length !== stock.length) return false
  const byId = new Map(stock.map(t => [t.id, t]))
  return plan.tables.every(t => {
    const s = byId.get(t.id)
    if (!s) return false
    return (
      t.label === s.label
      && t.seats === s.seats
      && t.section === s.section
      && t.shape === s.shape
      && Math.abs(t.x - s.x) < 0.01
      && Math.abs(t.y - s.y) < 0.01
      && Math.abs(t.w - s.w) < 0.01
      && Math.abs(t.h - s.h) < 0.01
    )
  })
}

type LocalPeek = {
  plan: FloorPlanState
  updatedAt: string | null
  /** True only when a scoped key already existed for this company/location. */
  hadScoped: boolean
}

function peekFloorPlanLocal(companyId: number, locationExternalId: string): LocalPeek {
  const key = scopedKey(companyId, locationExternalId)
  try {
    const scoped = parseStored(localStorage.getItem(key))
    if (scoped) {
      return {
        plan: scoped.plan,
        updatedAt: scoped.updatedAt || readLocalUpdatedAt(companyId, locationExternalId),
        hadScoped: true,
      }
    }
  } catch {
    /* ignore */
  }

  const migrated = readLegacyUnscoped() ?? structuredClone(DEFAULT_FLOOR_PLAN)
  return {
    plan: migrated,
    updatedAt: null,
    hadScoped: false,
  }
}

/**
 * Local cache for a company/location.
 * Cold miss returns default/legacy WITHOUT writing a "now" stamp — sync must prefer DB.
 */
export function loadFloorPlanLocal(companyId: number, locationExternalId: string): FloorPlanState {
  return peekFloorPlanLocal(companyId, locationExternalId).plan
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
 * DB wins when local is a cold default/migration. Local only pushes when it was an
 * intentional scoped save with a newer timestamp than the server.
 */
export async function syncFloorPlan(
  companyId: number,
  locationExternalId: string,
): Promise<FloorPlanState> {
  const peeked = peekFloorPlanLocal(companyId, locationExternalId)
  const local = peeked.plan

  try {
    const remote = await api.posFloorPlan(companyId, locationExternalId)
    const serverPlan = parseFloorPlanJson(remote.layoutJson)
    const remoteUpdatedAt = remote.updatedAt

    if (serverPlan) {
      const localMs = parseTime(peeked.updatedAt)
      const remoteMs = parseTime(remoteUpdatedAt)
      const localIsStockDefault = isStockDefaultFloorPlan(local)
      const remoteIsStockDefault = isStockDefaultFloorPlan(serverPlan)

      // Never let a cold-cache default / unstamped migration overwrite a real DB layout.
      // Also recover a custom scoped local over a stock remote that was stamped "newer"
      // by the previous clobber bug.
      const canPushLocal =
        peeked.hadScoped
        && localMs > 0
        && !plansLookEqual(local, serverPlan)
        && (
          (!localIsStockDefault && remoteIsStockDefault)
          || (localMs > remoteMs && !(localIsStockDefault && !remoteIsStockDefault))
        )

      if (canPushLocal) {
        await api.posFloorPlanUpsert({
          companyId,
          locationExternalId,
          layoutJson: JSON.stringify(local),
        })
        const stamp = new Date().toISOString()
        saveFloorPlanLocal(local, companyId, locationExternalId, stamp)
        return local
      }

      // Remote wins (or equal / cold local) — keep DB as source of truth.
      saveFloorPlanLocal(
        serverPlan,
        companyId,
        locationExternalId,
        remoteUpdatedAt || new Date().toISOString(),
      )
      return serverPlan
    }

    // Server empty — seed only from an intentional scoped save, or first-time stock/legacy.
    // Do not invent a fresh "now" stamp on cold display-only defaults before this write;
    // the upsert response stamp becomes the authoritative cache time.
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

/**
 * Patch one table's runtime status on the authoritative plan for this location.
 * Fetches remote first so a cold stock cache cannot overwrite a custom cloud layout.
 */
export async function persistFloorTablePatch(
  companyId: number,
  locationExternalId: string,
  tableId: string,
  patch: Partial<FloorTable> | ((table: FloorTable) => Partial<FloorTable>),
): Promise<FloorPlanState> {
  const peeked = peekFloorPlanLocal(companyId, locationExternalId)
  let base = peeked.plan

  try {
    const remote = await api.posFloorPlan(companyId, locationExternalId)
    const serverPlan = parseFloorPlanJson(remote.layoutJson)
    if (serverPlan) {
      const localIsStock = isStockDefaultFloorPlan(base)
      const remoteIsStock = isStockDefaultFloorPlan(serverPlan)
      const localMs = parseTime(peeked.updatedAt)
      const remoteMs = parseTime(remote.updatedAt)
      if (
        !peeked.hadScoped
        || (localIsStock && !remoteIsStock)
        || (remoteMs >= localMs && !(remoteIsStock && !localIsStock && peeked.hadScoped))
      ) {
        base = serverPlan
      }
    }
  } catch {
    /* offline — patch peeked local */
  }

  const next: FloorPlanState = {
    ...base,
    tables: base.tables.map(t => {
      if (t.id !== tableId) return t
      const delta = typeof patch === 'function' ? patch(t) : patch
      return normalizeTable({ ...t, ...delta })
    }),
  }
  await persistFloorPlanRemote(next, companyId, locationExternalId)
  return next
}
