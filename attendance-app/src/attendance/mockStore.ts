import { checkGeofence } from './geofence'
import type {
  AttendanceShift,
  AttendanceStatus,
  OutletAttendancePolicy,
  PunchMethod,
  PunchRequest,
  PunchResult,
} from './types'

const POLICY_KEY = 'bisync_attendance_policies_v1'
const SHIFTS_KEY = 'bisync_attendance_shifts_v1'

const DEFAULT_RADIUS_M = 120
const DEFAULT_METHODS: PunchMethod[] = ['gps', 'qr']

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

function todayPrefix(): string {
  return new Date().toISOString().slice(0, 10)
}

function newId(): string {
  return `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function getMockPolicy(outletId: number): OutletAttendancePolicy | null {
  const map = readJson<Record<string, OutletAttendancePolicy>>(POLICY_KEY, {})
  return map[String(outletId)] ?? null
}

export function ensureMockPolicy(
  outletId: number,
  outletName?: string,
): OutletAttendancePolicy {
  const existing = getMockPolicy(outletId)
  if (existing) {
    if (outletName && existing.outletName !== outletName) {
      const next = { ...existing, outletName }
      saveMockPolicy(next)
      return next
    }
    return existing
  }
  const created: OutletAttendancePolicy = {
    outletId,
    outletName,
    geofence: null,
    allowedMethods: [...DEFAULT_METHODS],
    requireGeofence: true,
  }
  saveMockPolicy(created)
  return created
}

export function saveMockPolicy(policy: OutletAttendancePolicy) {
  const map = readJson<Record<string, OutletAttendancePolicy>>(POLICY_KEY, {})
  map[String(policy.outletId)] = policy
  writeJson(POLICY_KEY, map)
}

export function setMockGeofenceHere(
  outletId: number,
  outletName: string | undefined,
  latitude: number,
  longitude: number,
  radiusMeters = DEFAULT_RADIUS_M,
): OutletAttendancePolicy {
  const policy = ensureMockPolicy(outletId, outletName)
  const next: OutletAttendancePolicy = {
    ...policy,
    outletName: outletName || policy.outletName,
    geofence: {
      latitude,
      longitude,
      radiusMeters,
      capturedAt: new Date().toISOString(),
    },
    requireGeofence: true,
  }
  saveMockPolicy(next)
  return next
}

function allShifts(): AttendanceShift[] {
  return readJson<AttendanceShift[]>(SHIFTS_KEY, [])
}

function saveShifts(shifts: AttendanceShift[]) {
  writeJson(SHIFTS_KEY, shifts)
}

export function getMockStatus(
  staffKey: string,
  outletId: number,
  outletName?: string,
): AttendanceStatus {
  const policy = ensureMockPolicy(outletId, outletName)
  const shifts = allShifts()
  const openShift =
    shifts.find((s) => s.staffKey === staffKey && s.status === 'open') ?? null
  const today = todayPrefix()
  const todayPunches = shifts
    .filter(
      (s) =>
        s.staffKey === staffKey &&
        s.outletId === outletId &&
        s.clockInAt.startsWith(today),
    )
    .sort((a, b) => b.clockInAt.localeCompare(a.clockInAt))
  return { openShift, todayPunches, policy }
}

export function mockPunch(
  staffKey: string,
  staffName: string | undefined,
  outletName: string | undefined,
  req: PunchRequest,
): PunchResult {
  const policy = ensureMockPolicy(req.outletId, outletName)

  if (!policy.allowedMethods.includes(req.method)) {
    throw new Error(
      `Method "${req.method}" is not allowed at this location. Allowed: ${policy.allowedMethods.join(', ')}`,
    )
  }

  if (req.method === 'gps' && policy.requireGeofence) {
    if (!policy.geofence) {
      throw new Error(
        'Geofence is not set for this location. Use “Set geofence here” first (demo), or configure it in Bisync admin.',
      )
    }
    if (!req.geo) {
      throw new Error('GPS location is required to punch at this site.')
    }
    const check = checkGeofence(req.geo, policy.geofence)
    if (!check.inside) {
      throw new Error(
        `You are outside the site geofence (${check.distanceMeters} m away; allowed ${check.radiusMeters} m).`,
      )
    }
  }

  if (req.method === 'qr') {
    const token = (req.qrToken || '').trim()
    if (!token) throw new Error('Scan or enter the site QR code to punch.')
    // Demo accepts any non-empty token; real API will validate rotating codes.
  }

  const shifts = allShifts()
  const open = shifts.find((s) => s.staffKey === staffKey && s.status === 'open')

  if (req.action === 'clockIn') {
    if (open) {
      throw new Error(
        `Already clocked in at ${open.outletName || `outlet ${open.outletId}`}. Clock out first.`,
      )
    }
    const shift: AttendanceShift = {
      id: newId(),
      outletId: req.outletId,
      outletName,
      staffKey,
      staffName,
      clockInAt: new Date().toISOString(),
      clockOutAt: null,
      clockInMethod: req.method,
      clockOutMethod: null,
      clockInGeo: req.geo ?? null,
      clockOutGeo: null,
      status: 'open',
    }
    shifts.unshift(shift)
    saveShifts(shifts)
    return { shift, message: 'Clocked in' }
  }

  if (req.action === 'clockOut') {
    if (!open) throw new Error('You are not clocked in.')
    if (open.outletId !== req.outletId) {
      throw new Error(
        `Open shift is at ${open.outletName || open.outletId}. Switch location or clock out there.`,
      )
    }
    const updated: AttendanceShift = {
      ...open,
      clockOutAt: new Date().toISOString(),
      clockOutMethod: req.method,
      clockOutGeo: req.geo ?? null,
      status: 'closed',
    }
    saveShifts(shifts.map((s) => (s.id === open.id ? updated : s)))
    return { shift: updated, message: 'Clocked out' }
  }

  throw new Error(`Action "${req.action}" is not supported in the demo yet.`)
}

export function clearMockAttendance() {
  localStorage.removeItem(POLICY_KEY)
  localStorage.removeItem(SHIFTS_KEY)
}
