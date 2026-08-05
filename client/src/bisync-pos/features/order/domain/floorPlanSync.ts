import { api } from '../../../../api'
import { cloneJson } from './clonePlan'
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
import {
  documentToActivePlan,
  emptyFloorPlanDocument,
  parseFloorPlanDocument,
  replaceActiveFloor,
  serializeFloorPlanDocument,
  singleFloorDocument,
  type FloorPlanDocument,
} from './multiFloor'

function scopedKey(companyId: number, locationExternalId: string) {
  return `${FLOOR_STORAGE_KEY}:${companyId}:${locationExternalId}`
}

function scopedMetaKey(companyId: number, locationExternalId: string) {
  return `${FLOOR_STORAGE_KEY}:meta:${companyId}:${locationExternalId}`
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

function readLegacyUnscoped(): FloorPlanDocument | null {
  try {
    const raw = localStorage.getItem(FLOOR_STORAGE_KEY)
    if (raw) {
      const parsed = parseFloorPlanDocument(raw)
      if (parsed) return parsed
    }
    const legacy = localStorage.getItem(FLOOR_STORAGE_KEY_LEGACY)
    if (legacy) {
      const tables = JSON.parse(legacy) as FloorTable[]
      if (Array.isArray(tables) && tables.length > 0) {
        return singleFloorDocument({
          tables: tables.map(t => normalizeTable(t)),
          zones: cloneJson(MOCK_ZONES),
        })
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

function isStockDefaultDocument(doc: FloorPlanDocument | null | undefined): boolean {
  if (!doc || doc.floors.length !== 1) return false
  return isStockDefaultFloorPlan(documentToActivePlan(doc))
}

type LocalPeek = {
  doc: FloorPlanDocument
  updatedAt: string | null
  /** True only when a scoped key already existed for this company/location. */
  hadScoped: boolean
}

function peekFloorPlanLocal(companyId: number, locationExternalId: string): LocalPeek {
  const key = scopedKey(companyId, locationExternalId)
  try {
    const raw = localStorage.getItem(key)
    const scoped = parseFloorPlanDocument(raw)
    if (scoped) {
      return {
        doc: scoped,
        updatedAt: scoped.updatedAt || readLocalUpdatedAt(companyId, locationExternalId),
        hadScoped: true,
      }
    }
  } catch {
    /* ignore */
  }

  const migrated = readLegacyUnscoped() ?? emptyFloorPlanDocument()
  return {
    doc: migrated,
    updatedAt: null,
    hadScoped: false,
  }
}

export function loadFloorPlanDocumentLocal(
  companyId: number,
  locationExternalId: string,
): FloorPlanDocument {
  return peekFloorPlanLocal(companyId, locationExternalId).doc
}

/**
 * Local cache for a company/location (active floor only).
 * Cold miss returns default/legacy WITHOUT writing a "now" stamp — sync must prefer DB.
 */
export function loadFloorPlanLocal(companyId: number, locationExternalId: string): FloorPlanState {
  return documentToActivePlan(peekFloorPlanLocal(companyId, locationExternalId).doc)
}

export function saveFloorPlanDocumentLocal(
  doc: FloorPlanDocument,
  companyId: number,
  locationExternalId: string,
  updatedAt?: string | null,
) {
  const key = scopedKey(companyId, locationExternalId)
  const stamp = updatedAt?.trim() || new Date().toISOString()
  const payload = {
    ...JSON.parse(serializeFloorPlanDocument(doc)),
    // Keep floors + active key in local cache even when API serializes single-floor as legacy.
    floors: doc.floors,
    activeFloorKey: doc.activeFloorKey,
    updatedAt: stamp,
  }
  localStorage.setItem(key, JSON.stringify(payload))
  writeLocalUpdatedAt(companyId, locationExternalId, stamp)
  saveFloorPlan(documentToActivePlan(doc))
}

export function saveFloorPlanLocal(
  plan: FloorPlanState,
  companyId: number,
  locationExternalId: string,
  updatedAt?: string | null,
) {
  const peeked = peekFloorPlanLocal(companyId, locationExternalId)
  const next = replaceActiveFloor(peeked.doc, plan)
  saveFloorPlanDocumentLocal(next, companyId, locationExternalId, updatedAt)
}

function docsLookEqual(a: FloorPlanDocument, b: FloorPlanDocument): boolean {
  try {
    return serializeFloorPlanDocument(a) === serializeFloorPlanDocument(b)
  } catch {
    return false
  }
}

/**
 * Force-pull the server floor plan onto this device (activation / Admin Reload).
 * Never uploads local stock/demo back to the server.
 */
export async function pullFloorPlanFromServer(
  companyId: number,
  locationExternalId: string,
): Promise<FloorPlanState> {
  const remote = await api.posFloorPlan(companyId, locationExternalId)
  const serverDoc = parseFloorPlanDocument(remote.layoutJson)
  if (serverDoc) {
    const stamped = {
      ...serverDoc,
      updatedAt: remote.updatedAt || new Date().toISOString(),
    }
    saveFloorPlanDocumentLocal(
      stamped,
      companyId,
      locationExternalId,
      stamped.updatedAt,
    )
    return documentToActivePlan(stamped)
  }
  const peeked = peekFloorPlanLocal(companyId, locationExternalId)
  if (peeked.hadScoped && !isStockDefaultDocument(peeked.doc)) {
    return documentToActivePlan(peeked.doc)
  }
  return cloneJson(DEFAULT_FLOOR_PLAN)
}

export async function pullFloorPlanDocumentFromServer(
  companyId: number,
  locationExternalId: string,
): Promise<FloorPlanDocument> {
  const remote = await api.posFloorPlan(companyId, locationExternalId)
  const serverDoc = parseFloorPlanDocument(remote.layoutJson)
  if (serverDoc) {
    const stamped = {
      ...serverDoc,
      updatedAt: remote.updatedAt || new Date().toISOString(),
    }
    saveFloorPlanDocumentLocal(stamped, companyId, locationExternalId, stamped.updatedAt)
    return stamped
  }
  const peeked = peekFloorPlanLocal(companyId, locationExternalId)
  if (peeked.hadScoped && !isStockDefaultDocument(peeked.doc)) return peeked.doc
  return emptyFloorPlanDocument()
}

/**
 * Resolve the floor plan for a location.
 * DB wins when local is a cold default/migration. Local only pushes when it was an
 * intentional scoped save with a newer timestamp than the server.
 * Stock/demo layouts are never uploaded to the server.
 */
export async function syncFloorPlan(
  companyId: number,
  locationExternalId: string,
): Promise<FloorPlanState> {
  const peeked = peekFloorPlanLocal(companyId, locationExternalId)
  const localDoc = peeked.doc
  const local = documentToActivePlan(localDoc)

  try {
    const remote = await api.posFloorPlan(companyId, locationExternalId)
    const serverDoc = parseFloorPlanDocument(remote.layoutJson)
    const remoteUpdatedAt = remote.updatedAt

    if (serverDoc) {
      const localMs = parseTime(peeked.updatedAt)
      const remoteMs = parseTime(remoteUpdatedAt)
      const localIsStockDefault = isStockDefaultDocument(localDoc)
      const remoteIsStockDefault = isStockDefaultDocument(serverDoc)
      const serverPlan = documentToActivePlan(serverDoc)

      const canPushLocal =
        peeked.hadScoped
        && localMs > 0
        && !localIsStockDefault
        && !docsLookEqual(localDoc, serverDoc)
        && (
          remoteIsStockDefault
          || localMs > remoteMs
        )

      if (canPushLocal) {
        await api.posFloorPlanUpsert({
          companyId,
          locationExternalId,
          layoutJson: serializeFloorPlanDocument(localDoc),
        })
        const stamp = new Date().toISOString()
        saveFloorPlanDocumentLocal(localDoc, companyId, locationExternalId, stamp)
        return local
      }

      saveFloorPlanDocumentLocal(
        { ...serverDoc, updatedAt: remoteUpdatedAt || new Date().toISOString() },
        companyId,
        locationExternalId,
        remoteUpdatedAt || new Date().toISOString(),
      )
      return serverPlan
    }

    if (peeked.hadScoped && !isStockDefaultDocument(localDoc) && local.tables.length > 0) {
      const uploaded = await api.posFloorPlanUpsert({
        companyId,
        locationExternalId,
        layoutJson: serializeFloorPlanDocument(localDoc),
      })
      saveFloorPlanDocumentLocal(
        localDoc,
        companyId,
        locationExternalId,
        uploaded.updatedAt || new Date().toISOString(),
      )
      return local
    }

    return local.tables.length > 0 ? local : cloneJson(DEFAULT_FLOOR_PLAN)
  } catch {
    return local.tables.length > 0 ? local : cloneJson(DEFAULT_FLOOR_PLAN)
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
  const peeked = peekFloorPlanLocal(companyId, locationExternalId)
  const doc = replaceActiveFloor(peeked.doc, plan)
  return persistFloorPlanDocumentRemote(doc, companyId, locationExternalId)
}

export async function persistFloorPlanDocumentRemote(
  doc: FloorPlanDocument,
  companyId: number,
  locationExternalId: string,
): Promise<boolean> {
  const active = documentToActivePlan(doc)
  const totalTables = doc.floors.reduce((n, f) => n + f.tables.length, 0)
  if ((doc.floors.length <= 1 && isStockDefaultFloorPlan(active)) || totalTables === 0) {
    return false
  }
  const stamp = new Date().toISOString()
  saveFloorPlanDocumentLocal(doc, companyId, locationExternalId, stamp)
  try {
    const saved = await api.posFloorPlanUpsert({
      companyId,
      locationExternalId,
      layoutJson: serializeFloorPlanDocument(doc),
    })
    saveFloorPlanDocumentLocal(
      doc,
      companyId,
      locationExternalId,
      saved.updatedAt || stamp,
    )
    return true
  } catch {
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
  let baseDoc = peeked.doc

  try {
    const remote = await api.posFloorPlan(companyId, locationExternalId)
    const serverDoc = parseFloorPlanDocument(remote.layoutJson)
    if (serverDoc) {
      const localIsStock = isStockDefaultDocument(baseDoc)
      const remoteIsStock = isStockDefaultDocument(serverDoc)
      const localMs = parseTime(peeked.updatedAt)
      const remoteMs = parseTime(remote.updatedAt)
      if (
        !peeked.hadScoped
        || (localIsStock && !remoteIsStock)
        || (remoteMs >= localMs && !(remoteIsStock && !localIsStock && peeked.hadScoped))
      ) {
        // Prefer the floor that contains the table id when multi-floor.
        const floorWithTable = serverDoc.floors.find(f => f.tables.some(t => t.id === tableId))
        baseDoc = floorWithTable
          ? { ...serverDoc, activeFloorKey: floorWithTable.key }
          : serverDoc
      }
    }
  } catch {
    /* offline — patch peeked local */
  }

  // If table is on another floor, switch active before patch.
  const owning = baseDoc.floors.find(f => f.tables.some(t => t.id === tableId))
  if (owning && owning.key !== baseDoc.activeFloorKey) {
    baseDoc = { ...baseDoc, activeFloorKey: owning.key }
  }

  const base = documentToActivePlan(baseDoc)
  const nextPlan: FloorPlanState = {
    ...base,
    tables: base.tables.map(t => {
      if (t.id !== tableId) return t
      const delta = typeof patch === 'function' ? patch(t) : patch
      return normalizeTable({ ...t, ...delta })
    }),
  }
  const nextDoc = replaceActiveFloor(baseDoc, nextPlan)
  await persistFloorPlanDocumentRemote(nextDoc, companyId, locationExternalId)
  return nextPlan
}

/** Re-export parse helper used by tests / callers expecting plan-only JSON. */
export function parseFloorPlanJson(raw: string | null | undefined): FloorPlanState | null {
  const doc = parseFloorPlanDocument(raw)
  return doc ? documentToActivePlan(doc) : null
}
