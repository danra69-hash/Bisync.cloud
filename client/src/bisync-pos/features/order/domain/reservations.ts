import {
  loadFloorPlanLocal,
  persistFloorPlanRemote,
  saveFloorPlanLocal,
} from './floorPlanSync'
import { loadFloorPlan, saveFloorPlan, type FloorTable } from './tables'

export type PosReservation = {
  id: string
  name: string
  mobile: string
  pax: number
  /** Business date `YYYY-MM-DD` */
  date: string
  /** Local time `HH:mm` */
  time: string
  tableId?: string
  tableLabel?: string
  status: 'upcoming' | 'assigned' | 'cancelled'
  createdAt: string
}

export const RESERVATIONS_KEY = 'bisync-pos-reservations-v1'
export const RESERVATIONS_CHANGED_EVENT = 'bisync-pos-reservations-changed'
export const FLOOR_PLAN_CHANGED_EVENT = 'bisync-pos-floor-plan-changed'

function storageKey(companyId: number, locationId: string) {
  if (companyId > 0 && locationId) {
    return `${RESERVATIONS_KEY}:${companyId}:${locationId}`
  }
  return RESERVATIONS_KEY
}

function todayIso(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDaysIso(iso: string, days: number) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, (m || 1) - 1, d || 1)
  dt.setDate(dt.getDate() + days)
  return todayIso(dt)
}

function seedReservations(): PosReservation[] {
  const today = todayIso()
  const tomorrow = addDaysIso(today, 1)
  const now = new Date().toISOString()
  return [
    {
      id: 'rsv-chen',
      name: 'Chen Wei',
      mobile: '012-3456789',
      pax: 4,
      date: today,
      time: '19:30',
      status: 'upcoming',
      createdAt: now,
    },
    {
      id: 'rsv-patel',
      name: 'Aisha Patel',
      mobile: '017-8800123',
      pax: 2,
      date: today,
      time: '20:00',
      status: 'upcoming',
      createdAt: now,
    },
    {
      id: 'rsv-lim',
      name: 'Lim Jia',
      mobile: '011-2223344',
      pax: 6,
      date: tomorrow,
      time: '18:45',
      status: 'upcoming',
      createdAt: now,
    },
  ]
}

export function loadReservations(companyId = 0, locationId = ''): PosReservation[] {
  const key = storageKey(companyId, locationId)
  try {
    const raw = localStorage.getItem(key)
    if (!raw) {
      const seeded = seedReservations()
      localStorage.setItem(key, JSON.stringify(seeded))
      return seeded
    }
    const parsed = JSON.parse(raw) as PosReservation[]
    return Array.isArray(parsed) ? parsed : seedReservations()
  } catch {
    return seedReservations()
  }
}

function persist(companyId: number, locationId: string, rows: PosReservation[]) {
  localStorage.setItem(storageKey(companyId, locationId), JSON.stringify(rows))
  window.dispatchEvent(new Event(RESERVATIONS_CHANGED_EVENT))
}

export function upcomingReservations(
  rows: PosReservation[],
  now = new Date(),
): PosReservation[] {
  const today = todayIso(now)
  return rows
    .filter(r => r.status === 'upcoming' || r.status === 'assigned')
    .filter(r => r.date >= today)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date)
      return a.time.localeCompare(b.time)
    })
}

export function addReservation(
  companyId: number,
  locationId: string,
  input: Omit<PosReservation, 'id' | 'status' | 'createdAt' | 'tableId' | 'tableLabel'>,
): PosReservation {
  const rows = loadReservations(companyId, locationId)
  const next: PosReservation = {
    ...input,
    id: `rsv-${Date.now().toString(36)}`,
    status: 'upcoming',
    createdAt: new Date().toISOString(),
  }
  persist(companyId, locationId, [next, ...rows])
  return next
}

function notifyFloorChanged() {
  window.dispatchEvent(new Event(FLOOR_PLAN_CHANGED_EVENT))
}

/**
 * Assign a reservation to a floor table. Marks the table reserved with time + pax
 * and links the reservation to that table.
 */
export function assignReservationToTable(opts: {
  companyId: number
  locationId: string
  reservationId: string
  table: FloorTable
}): { reservation: PosReservation; table: FloorTable } | null {
  const { companyId, locationId, reservationId, table } = opts
  const rows = loadReservations(companyId, locationId)
  const reservation = rows.find(r => r.id === reservationId)
  if (!reservation) return null

  const plan =
    companyId > 0 && locationId
      ? loadFloorPlanLocal(companyId, locationId)
      : loadFloorPlan()

  const prevTableId = reservation.tableId
  const tables = plan.tables.map(t => {
    if (prevTableId && t.id === prevTableId && t.id !== table.id) {
      return {
        ...t,
        status: 'open' as const,
        reservedTime: undefined,
        reservedName: undefined,
        pax: undefined,
      }
    }
    if (t.id !== table.id) return t
    return {
      ...t,
      status: 'reserved' as const,
      reservedTime: reservation.time,
      reservedName: reservation.name,
      pax: reservation.pax,
      orderId: undefined,
      openedAt: undefined,
    }
  })

  const updatedTable = tables.find(t => t.id === table.id)
  if (!updatedTable) return null

  const nextPlan = { ...plan, tables }
  if (companyId > 0 && locationId) {
    saveFloorPlanLocal(nextPlan, companyId, locationId)
    void persistFloorPlanRemote(nextPlan, companyId, locationId)
  } else {
    saveFloorPlan(nextPlan)
  }
  notifyFloorChanged()

  const nextReservation: PosReservation = {
    ...reservation,
    status: 'assigned',
    tableId: table.id,
    tableLabel: table.label,
  }
  persist(
    companyId,
    locationId,
    rows.map(r => (r.id === reservationId ? nextReservation : r)),
  )

  return { reservation: nextReservation, table: updatedTable }
}

export function formatReservationWhen(r: PosReservation): string {
  const [y, m, d] = r.date.split('-')
  const dateLabel = y && m && d ? `${d}/${m}/${y}` : r.date
  return `${dateLabel} · ${r.time}`
}
