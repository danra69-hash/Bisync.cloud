/** Multi-floor floor-plan document helpers (backward-compatible with single-canvas layouts). */

import { cloneJson } from './clonePlan'
import {
  DEFAULT_FLOOR_PLAN,
  MOCK_ZONES,
  normalizeTable,
  type FloorPlanState,
  type FloorTable,
  type FloorZone,
} from './tables'

export type FloorLevel = {
  key: string
  name: string
  sortOrder: number
  tables: FloorTable[]
  zones: FloorZone[]
}

export type FloorPlanDocument = {
  floors: FloorLevel[]
  activeFloorKey: string
  updatedAt?: string
}

const FLOOR_NAME_SEQUENCE = [
  'Ground floor',
  '1st floor',
  '2nd floor',
  '3rd floor',
  '4th floor',
  '5th floor',
  '6th floor',
  '7th floor',
  '8th floor',
  '9th floor',
  '10th floor',
]

export function defaultFloorName(index: number): string {
  return FLOOR_NAME_SEQUENCE[index] ?? `Floor ${index + 1}`
}

export function defaultFloorKey(index: number): string {
  if (index === 0) return 'ground'
  if (index === 1) return '1st'
  if (index === 2) return '2nd'
  if (index === 3) return '3rd'
  return `${index}th`
}

function normalizeZones(zones: FloorZone[] | undefined): FloorZone[] {
  if (!Array.isArray(zones) || zones.length === 0) return cloneJson(MOCK_ZONES)
  return zones.map(zone => {
    const kind =
      zone?.kind === 'bar' || zone?.kind === 'kitchen' || zone?.kind === 'custom'
        ? zone.kind
        : 'custom'
    return {
      id: String(zone?.id || `zone-${Math.random().toString(36).slice(2, 7)}`),
      kind,
      label: String(zone?.label || (kind === 'bar' ? 'Bar' : kind === 'kitchen' ? 'Kitchen' : 'Area')),
      x: Number.isFinite(zone?.x) ? Number(zone.x) : 4,
      y: Number.isFinite(zone?.y) ? Number(zone.y) : 4,
      w: Number.isFinite(zone?.w) ? Number(zone.w) : 16,
      h: Number.isFinite(zone?.h) ? Number(zone.h) : 14,
    }
  })
}

function normalizeLevel(raw: Partial<FloorLevel>, index: number): FloorLevel {
  const tables = Array.isArray(raw.tables)
    ? raw.tables.map(t => normalizeTable(t as FloorTable))
    : []
  return {
    key: String(raw.key || defaultFloorKey(index)).trim() || defaultFloorKey(index),
    name: String(raw.name || defaultFloorName(index)).trim() || defaultFloorName(index),
    sortOrder: Number.isFinite(raw.sortOrder) ? Number(raw.sortOrder) : index,
    tables,
    zones: normalizeZones(raw.zones as FloorZone[] | undefined),
  }
}

export function singleFloorDocument(
  plan: FloorPlanState,
  opts?: { key?: string; name?: string; updatedAt?: string },
): FloorPlanDocument {
  const key = opts?.key || 'ground'
  return {
    floors: [
      {
        key,
        name: opts?.name || 'Ground floor',
        sortOrder: 0,
        tables: plan.tables.map(t => normalizeTable(t)),
        zones: normalizeZones(plan.zones),
      },
    ],
    activeFloorKey: key,
    updatedAt: opts?.updatedAt,
  }
}

/** Parse layout JSON from API / localStorage into a multi-floor document. */
export function parseFloorPlanDocument(raw: string | null | undefined): FloorPlanDocument | null {
  if (!raw?.trim()) return null
  try {
    const parsed = JSON.parse(raw) as {
      floors?: Partial<FloorLevel>[]
      activeFloorKey?: string
      tables?: FloorTable[]
      zones?: FloorZone[]
      updatedAt?: string
    }

    if (Array.isArray(parsed.floors) && parsed.floors.length > 0) {
      const floors = parsed.floors
        .map((f, i) => normalizeLevel(f, i))
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      const active =
        floors.find(f => f.key === parsed.activeFloorKey)?.key
        ?? floors[0].key
      return {
        floors,
        activeFloorKey: active,
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : undefined,
      }
    }

    if (Array.isArray(parsed.tables) && parsed.tables.length > 0) {
      return singleFloorDocument(
        {
          tables: parsed.tables.map(t => normalizeTable(t)),
          zones: normalizeZones(parsed.zones),
        },
        { updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : undefined },
      )
    }
    return null
  } catch {
    return null
  }
}

export function activeFloorLevel(doc: FloorPlanDocument): FloorLevel {
  return (
    doc.floors.find(f => f.key === doc.activeFloorKey)
    ?? doc.floors[0]
    ?? normalizeLevel({}, 0)
  )
}

export function documentToActivePlan(doc: FloorPlanDocument): FloorPlanState {
  const floor = activeFloorLevel(doc)
  return { tables: floor.tables, zones: floor.zones }
}

/** Serialize for API LayoutJson (includes floors when multi-floor). */
export function serializeFloorPlanDocument(doc: FloorPlanDocument): string {
  const floors = [...doc.floors]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((f, i) => normalizeLevel(f, i))

  if (floors.length <= 1) {
    const only = floors[0] ?? normalizeLevel(DEFAULT_FLOOR_PLAN, 0)
    return JSON.stringify({
      tables: only.tables,
      zones: only.zones,
    })
  }

  return JSON.stringify({
    version: 2,
    floors,
    activeFloorKey: doc.activeFloorKey || floors[0].key,
  })
}

export function replaceActiveFloor(
  doc: FloorPlanDocument,
  plan: FloorPlanState,
): FloorPlanDocument {
  const key = doc.activeFloorKey || doc.floors[0]?.key || 'ground'
  return {
    ...doc,
    floors: doc.floors.map(f =>
      f.key === key
        ? {
            ...f,
            tables: plan.tables.map(t => normalizeTable(t)),
            zones: normalizeZones(plan.zones),
          }
        : f,
    ),
  }
}

export function setActiveFloorKey(doc: FloorPlanDocument, key: string): FloorPlanDocument {
  if (!doc.floors.some(f => f.key === key)) return doc
  return { ...doc, activeFloorKey: key }
}

export function addFloorLevel(doc: FloorPlanDocument, name?: string): FloorPlanDocument {
  const index = doc.floors.length
  let key = defaultFloorKey(index)
  let n = index
  while (doc.floors.some(f => f.key === key)) {
    n += 1
    key = `floor-${n}`
  }
  const floor: FloorLevel = {
    key,
    name: (name || defaultFloorName(index)).trim() || defaultFloorName(index),
    sortOrder: index,
    tables: [],
    zones: cloneJson(MOCK_ZONES),
  }
  return {
    ...doc,
    floors: [...doc.floors, floor],
    activeFloorKey: key,
  }
}

export function renameFloorLevel(
  doc: FloorPlanDocument,
  key: string,
  name: string,
): FloorPlanDocument {
  const nextName = name.trim()
  if (!nextName) return doc
  return {
    ...doc,
    floors: doc.floors.map(f => (f.key === key ? { ...f, name: nextName } : f)),
  }
}

export function removeFloorLevel(doc: FloorPlanDocument, key: string): FloorPlanDocument {
  if (doc.floors.length <= 1) return doc
  const floors = doc.floors
    .filter(f => f.key !== key)
    .map((f, i) => ({ ...f, sortOrder: i }))
  return {
    ...doc,
    floors,
    activeFloorKey: floors.some(f => f.key === doc.activeFloorKey)
      ? doc.activeFloorKey
      : floors[0].key,
  }
}

export function emptyFloorPlanDocument(): FloorPlanDocument {
  return singleFloorDocument(cloneJson(DEFAULT_FLOOR_PLAN))
}
