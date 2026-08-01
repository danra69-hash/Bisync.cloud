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
/** One-time wipe of demo / residual table orders from earlier builds. */
export const FLOOR_ORDERS_RESET_KEY = 'bisync-pos-floor-orders-reset-v1'

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

/** Default layout — all tables open (no demo orders / reservations). */
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
    status: 'open',
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
    status: 'open',
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
    status: 'open',
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
    status: 'open',
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
    status: 'open',
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
  return tables.map((table) => {
    const status = normalizeStatus(table.status)
    const withStatus = { ...table, status }
    const withReserve =
      status === 'reserved'
        ? {
            ...withStatus,
            reservedTime: table.reservedTime ?? '19:00',
            reservedName: table.reservedName,
          }
        : withStatus
    return normalizeTable(withReserve)
  })
}

/** Clear every open order / reservation residue from tables (keeps layout). */
export function clearAllTableOrders(plan: FloorPlanState): FloorPlanState {
  return {
    ...plan,
    tables: plan.tables.map((table) =>
      normalizeTable({
        id: table.id,
        label: table.label,
        seats: table.seats,
        status: 'open',
        section: table.section,
        shape: table.shape,
        x: table.x,
        y: table.y,
        w: table.w,
        h: table.h,
      }),
    ),
  }
}

function readStoredFloorPlan(): FloorPlanState | null {
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
  return null
}

export function loadFloorPlan(): FloorPlanState {
  const stored = readStoredFloorPlan()
  const base = stored ?? structuredClone(DEFAULT_FLOOR_PLAN)

  try {
    if (!localStorage.getItem(FLOOR_ORDERS_RESET_KEY)) {
      const cleared = clearAllTableOrders(base)
      saveFloorPlan(cleared)
      localStorage.setItem(FLOOR_ORDERS_RESET_KEY, '1')
      return cleared
    }
  } catch {
    /* ignore storage failures */
  }

  return base
}

export function saveFloorPlan(plan: FloorPlanState) {
  localStorage.setItem(FLOOR_STORAGE_KEY, JSON.stringify(plan))
}

/** Active dine-in table attached to the register check (Floor Plan → Register). */
export const ACTIVE_REGISTER_SESSION_KEY = 'bisync-pos-active-register-session'

export type ActiveRegisterSession = {
  tableId: string
  tableLabel: string
  openedAt?: string
}

export function loadActiveRegisterSession(): ActiveRegisterSession | null {
  try {
    const raw = localStorage.getItem(ACTIVE_REGISTER_SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ActiveRegisterSession
    if (!parsed?.tableId || !parsed?.tableLabel) return null
    return parsed
  } catch {
    return null
  }
}

export function setActiveRegisterSession(session: ActiveRegisterSession) {
  localStorage.setItem(ACTIVE_REGISTER_SESSION_KEY, JSON.stringify(session))
}

export function clearActiveRegisterSession() {
  localStorage.removeItem(ACTIVE_REGISTER_SESSION_KEY)
}

/** Release an ordered table back to free/open (no order). */
export function releaseFloorTable(tableId: string): FloorTable | null {
  const plan = loadFloorPlan()
  let released: FloorTable | null = null
  const tables = plan.tables.map((table) => {
    if (table.id !== tableId) return table
    released = normalizeTable({
      ...table,
      status: 'open',
      pax: undefined,
      openedAt: undefined,
      orderId: undefined,
      serverName: undefined,
    })
    return released
  })
  if (!released) return null
  saveFloorPlan({ ...plan, tables })
  return released
}

/** Keep table occupied after an order is fired to Bar/Kitchen. */
export function markFloorTableOrdered(tableId: string, orderId: string): FloorTable | null {
  const plan = loadFloorPlan()
  let updated: FloorTable | null = null
  const tables = plan.tables.map((table) => {
    if (table.id !== tableId) return table
    updated = normalizeTable({
      ...table,
      status: 'ordered',
      orderId,
      openedAt: table.openedAt || new Date().toISOString(),
    })
    return updated
  })
  if (!updated) return null
  saveFloorPlan({ ...plan, tables })
  return updated
}

/** Move an occupied check from one table to another on the floor plan. */
export function transferFloorTable(
  fromTableId: string,
  toTableId: string,
  orderId?: string,
): { from: FloorTable | null; to: FloorTable | null } {
  const plan = loadFloorPlan()
  const fromTable = plan.tables.find(t => t.id === fromTableId) ?? null
  const toTable = plan.tables.find(t => t.id === toTableId) ?? null
  if (!fromTable || !toTable) return { from: null, to: null }

  const openedAt = fromTable.openedAt || new Date().toISOString()
  const nextOrderId = orderId ?? fromTable.orderId
  let fromUpdated: FloorTable | null = null
  let toUpdated: FloorTable | null = null

  const tables = plan.tables.map((table) => {
    if (table.id === fromTableId) {
      fromUpdated = normalizeTable({
        ...table,
        status: 'open',
        pax: undefined,
        openedAt: undefined,
        orderId: undefined,
        serverName: undefined,
      })
      return fromUpdated
    }
    if (table.id === toTableId) {
      toUpdated = normalizeTable({
        ...table,
        status: 'ordered',
        pax: fromTable.pax ?? table.pax,
        openedAt,
        orderId: nextOrderId,
        serverName: fromTable.serverName ?? table.serverName,
        reservedTime: undefined,
        reservedName: undefined,
      })
      return toUpdated
    }
    return table
  })

  saveFloorPlan({ ...plan, tables })
  return { from: fromUpdated, to: toUpdated }
}
