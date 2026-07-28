export type TableStatus = 'open' | 'ordered' | 'reserved'

export type TableShape = 'square' | 'round' | 'oval' | 'rect'

export type ZoneKind = 'bar' | 'kitchen' | 'custom'

/** Positions are % of the floor canvas so layouts scale. */
export type FloorTable = {
  id: string
  label: string
  seats: number
  status: TableStatus
  serverName?: string
  orderId?: string
  /** Local time `HH:mm` when status is reserved */
  reservedTime?: string
  reservedName?: string
  /** Guests for dynamic QR session */
  pax?: number
  openedAt?: string
  section: string
  shape: TableShape
  x: number
  y: number
  w: number
  h: number
}

export type FloorZone = {
  id: string
  kind: ZoneKind
  label: string
  x: number
  y: number
  w: number
  h: number
}

export type FloorPlanState = {
  tables: FloorTable[]
  zones: FloorZone[]
}

export const FLOOR_STORAGE_KEY = 'bisync-pos-floor-plan-v2'
/** Legacy key from table-only layouts */
export const FLOOR_STORAGE_KEY_LEGACY = 'bisync-pos-floor-plan'

export const MOCK_ZONES: FloorZone[] = [
  {
    id: 'zone-bar',
    kind: 'bar',
    label: 'Bar',
    x: 4,
    y: 4,
    w: 18,
    h: 12,
  },
  {
    id: 'zone-kitchen',
    kind: 'kitchen',
    label: 'Kitchen',
    x: 74,
    y: 82,
    w: 22,
    h: 14,
  },
]

export const MOCK_FLOOR: FloorTable[] = [
  {
    id: 't1',
    label: 'T1',
    seats: 2,
    status: 'open',
    section: 'Patio',
    shape: 'round',
    x: 8,
    y: 20,
    w: 14,
    h: 14,
  },
  {
    id: 't2',
    label: 'T2',
    seats: 4,
    status: 'ordered',
    serverName: 'Maya',
    orderId: '20',
    section: 'Main',
    shape: 'square',
    x: 28,
    y: 10,
    w: 14,
    h: 20,
  },
  {
    id: 't3',
    label: 'T3',
    seats: 4,
    status: 'ordered',
    serverName: 'Leo',
    orderId: '18',
    section: 'Main',
    shape: 'square',
    x: 48,
    y: 10,
    w: 14,
    h: 20,
  },
  {
    id: 't4',
    label: 'T4',
    seats: 6,
    status: 'ordered',
    serverName: 'Maya',
    orderId: '15',
    section: 'Main',
    shape: 'rect',
    x: 68,
    y: 8,
    w: 18,
    h: 24,
  },
  {
    id: 't5',
    label: 'T5',
    seats: 2,
    status: 'reserved',
    reservedTime: '19:30',
    reservedName: 'Chen',
    section: 'Bar',
    shape: 'oval',
    x: 10,
    y: 45,
    w: 12,
    h: 18,
  },
  {
    id: 't6',
    label: 'T6',
    seats: 8,
    status: 'open',
    section: 'Private',
    shape: 'rect',
    x: 35,
    y: 42,
    w: 22,
    h: 28,
  },
  {
    id: 't7',
    label: 'T7',
    seats: 4,
    status: 'ordered',
    serverName: 'Sam',
    orderId: '21',
    section: 'Patio',
    shape: 'square',
    x: 65,
    y: 48,
    w: 14,
    h: 20,
  },
  {
    id: 't8',
    label: 'T8',
    seats: 2,
    status: 'open',
    section: 'Bar',
    shape: 'round',
    x: 10,
    y: 72,
    w: 12,
    h: 12,
  },
]

export const DEFAULT_FLOOR_PLAN: FloorPlanState = {
  tables: MOCK_FLOOR,
  zones: MOCK_ZONES,
}

export const TABLE_STATUS_LABEL: Record<TableStatus, string> = {
  open: 'Open',
  ordered: 'Ordered',
  reserved: 'Reserved',
}

const LEGACY_STATUS_MAP: Record<string, TableStatus> = {
  open: 'open',
  ordered: 'ordered',
  reserved: 'reserved',
  seated: 'ordered',
  'waiting-food': 'ordered',
  paying: 'ordered',
}

export function normalizeStatus(status: string): TableStatus {
  return LEGACY_STATUS_MAP[status] ?? 'open'
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export function nextTableLabel(tables: FloorTable[]): string {
  const nums = tables
    .map((t) => Number(t.label.replace(/\D/g, '')))
    .filter((n) => Number.isFinite(n))
  const max = nums.length ? Math.max(...nums) : 0
  return `T${max + 1}`
}

export function createTable(
  tables: FloorTable[],
  partial?: Partial<FloorTable>,
): FloorTable {
  const label = partial?.label ?? nextTableLabel(tables)
  const shape = partial?.shape ?? 'square'
  const defaults =
    shape === 'rect'
      ? { w: 18, h: 24 }
      : shape === 'oval'
        ? { w: 12, h: 18 }
        : shape === 'round'
          ? { w: 14, h: 14 }
          : { w: 14, h: 20 }
  return normalizeTable({
    id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label,
    seats: partial?.seats ?? 4,
    status: partial?.status ?? 'open',
    section: partial?.section ?? 'Main',
    shape,
    x: partial?.x ?? 40,
    y: partial?.y ?? 40,
    w: partial?.w ?? defaults.w,
    h: partial?.h ?? defaults.h,
  })
}

export function createZone(
  zones: FloorZone[],
  kind: ZoneKind = 'custom',
): FloorZone {
  const defaults: Record<ZoneKind, { label: string; w: number; h: number }> = {
    bar: { label: 'Bar', w: 18, h: 12 },
    kitchen: { label: 'Kitchen', w: 22, h: 14 },
    custom: { label: `Area ${zones.length + 1}`, w: 16, h: 14 },
  }
  const d = defaults[kind]
  return {
    id: `zone-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    label: d.label,
    x: 40,
    y: 40,
    w: d.w,
    h: d.h,
  }
}

/** Round tables stay circular — equal size fields; CSS uses aspect-ratio: 1. */
export function normalizeTable(table: FloorTable): FloorTable {
  if (table.shape !== 'round') return table
  const size = Math.max(8, table.w || table.h || 14)
  return {
    ...table,
    w: clamp(size, 8, 100 - table.x),
    h: clamp(size, 8, 100 - table.y),
  }
}

export function formatReservedLabel(table: FloorTable): string | null {
  if (table.status !== 'reserved') return null
  if (!table.reservedTime) return 'Reserved'
  return table.reservedName
    ? `${table.reservedTime} · ${table.reservedName}`
    : `Reserved ${table.reservedTime}`
}

function normalizeTables(tables: FloorTable[]): FloorTable[] {
  const defaults = new Map(MOCK_FLOOR.map((t) => [t.id, t]))
  return tables.map((table) => {
    const fallback = defaults.get(table.id)
    const status = normalizeStatus(table.status)
    const withStatus = { ...table, status }
    const withReserve =
      status === 'reserved'
        ? {
            ...withStatus,
            reservedTime: table.reservedTime ?? fallback?.reservedTime ?? '19:00',
            reservedName: table.reservedName ?? fallback?.reservedName,
          }
        : withStatus
    return normalizeTable(withReserve)
  })
}

export function loadFloorPlan(): FloorPlanState {
  try {
    const raw = localStorage.getItem(FLOOR_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as FloorPlanState
      if (parsed?.tables?.length) {
        return {
          tables: normalizeTables(parsed.tables),
          zones:
            Array.isArray(parsed.zones) && parsed.zones.length > 0
              ? parsed.zones
              : structuredClone(MOCK_ZONES),
        }
      }
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
    /* fall through */
  }
  return structuredClone(DEFAULT_FLOOR_PLAN)
}

export function saveFloorPlan(plan: FloorPlanState) {
  localStorage.setItem(FLOOR_STORAGE_KEY, JSON.stringify(plan))
}
