import { ApiError } from './client'
import {
  createHrAttendance,
  getHrEmployee,
  listHrAttendance,
  listHrShiftSchedules,
  nowTimeOnly,
  todayDateOnly,
  updateHrAttendance,
  type AttendanceStatusCode,
  type HrAttendanceRecord,
} from './hr'
import { resolveOfficeHoursForDate } from './officeHours'
import { hrRequest } from './hrClient'
import {
  clearMockAttendance,
  getMockStatus,
  mockPunch,
  setMockGeofenceHere,
} from '../attendance/mockStore'
import type {
  AttendanceShift,
  AttendanceStatus,
  OutletAttendancePolicy,
  PunchRequest,
  PunchResult,
} from '../attendance/types'

/**
 * Clock attendance:
 * - VITE_ATTENDANCE_MOCK=true → localStorage demo
 * - else → Bisync.cloud HR module (`/api/attendance`, schedules, employees)
 */
export function isAttendanceMock(): boolean {
  const flag = import.meta.env.VITE_ATTENDANCE_MOCK
  if (flag == null || flag === '') return false
  return flag === 'true' || flag === '1'
}

export type AttendanceStaff = {
  staffKey: string
  staffName?: string
  token: string
  deviceId?: string | null
  /** Bisync.cloud HR employee id (required for live punches). */
  employeeId?: number | null
}

function timeToIsoOnDate(date: string, time?: string | null): string | null {
  if (!time) return null
  const t = time.length === 5 ? `${time}:00` : time
  return new Date(`${date}T${t}`).toISOString()
}

function recordToShift(
  record: HrAttendanceRecord,
  staff: AttendanceStaff,
  outletId: number,
  outletName?: string,
): AttendanceShift {
  const clockInAt =
    timeToIsoOnDate(record.date, record.actualIn) ||
    `${record.date}T00:00:00.000Z`
  const clockOutAt = timeToIsoOnDate(record.date, record.actualOut)
  return {
    id: `hr_att_${record.id}`,
    outletId,
    outletName,
    staffKey: staff.staffKey,
    staffName: staff.staffName,
    clockInAt,
    clockOutAt,
    clockInMethod: 'gps',
    clockOutMethod: clockOutAt ? 'gps' : null,
    clockInGeo: null,
    clockOutGeo: null,
    status: record.actualIn && !record.actualOut ? 'open' : 'closed',
  }
}

function resolveStatus(
  actualIn: string,
  scheduledIn?: string | null,
): AttendanceStatusCode {
  if (scheduledIn && actualIn > scheduledIn) return 'Late'
  return 'Present'
}

async function getHrStatus(
  staff: AttendanceStaff,
  outletId: number,
  outletName?: string,
): Promise<AttendanceStatus> {
  const employeeId = staff.employeeId
  if (employeeId == null) {
    throw new ApiError(
      'No HR employee linked to this session. Sign in with your mobile number.',
    )
  }

  const today = todayDateOnly()
  const [rows, schedules] = await Promise.all([
    listHrAttendance({ from: today, to: today, employeeId }),
    listHrShiftSchedules({ from: today, to: today, employeeId }),
  ])

  const todayRow = rows[0] ?? null
  const todaySchedule = schedules[0] ?? null

  const policy: OutletAttendancePolicy = {
    outletId,
    outletName,
    geofence: null,
    allowedMethods: ['gps', 'qr'],
    // Geofence optional until HR stores site coordinates.
    requireGeofence: false,
  }

  // Soft-restore geofence from local calibration if present.
  try {
    const raw = localStorage.getItem('bisync_attendance_policies_v1')
    if (raw) {
      const map = JSON.parse(raw) as Record<string, OutletAttendancePolicy>
      const saved = map[String(outletId)]
      if (saved?.geofence) {
        policy.geofence = saved.geofence
        policy.requireGeofence = saved.requireGeofence
      }
    }
  } catch {
    /* ignore */
  }

  const openShift =
    todayRow?.actualIn && !todayRow.actualOut
      ? recordToShift(todayRow, staff, outletId, outletName)
      : null

  const todayPunches = todayRow?.actualIn
    ? [recordToShift(todayRow, staff, outletId, outletName)]
    : []

  // Attach schedule hint on policy name for UI consumers.
  if (todaySchedule && policy.outletName) {
    /* keep outletName */
  }
  void todaySchedule

  return { openShift, todayPunches, policy }
}

async function resolveAdminOfficeSchedule(
  employeeId: number,
  date: string,
): Promise<{ scheduledIn: string | null; scheduledOut: string | null }> {
  try {
    const employee = await getHrEmployee(employeeId)
    if (employee.isShiftEmployee) {
      return { scheduledIn: null, scheduledOut: null }
    }
    // Link employee → platform user → company office hours.
    type UserRow = { employeeId?: number | null; companyId?: number | null }
    type CompanyRow = { id: number; businessHoursJson?: string }
    const [users, companies] = await Promise.all([
      hrRequest<UserRow[]>('users').catch(() => [] as UserRow[]),
      hrRequest<CompanyRow[]>('companies').catch(() => [] as CompanyRow[]),
    ])
    const user = users.find((u) => u.employeeId === employeeId)
    const company =
      (user?.companyId != null ? companies.find((c) => c.id === user.companyId) : null)
      ?? companies[0]
      ?? null
    const office = resolveOfficeHoursForDate(company?.businessHoursJson, date)
    if (!office || office.closed) {
      return { scheduledIn: null, scheduledOut: null }
    }
    return {
      scheduledIn: office.openFrom ? (office.openFrom.length === 5 ? `${office.openFrom}:00` : office.openFrom) : null,
      scheduledOut: office.openTo ? (office.openTo.length === 5 ? `${office.openTo}:00` : office.openTo) : null,
    }
  } catch {
    return { scheduledIn: null, scheduledOut: null }
  }
}

async function punchHr(
  staff: AttendanceStaff,
  outletName: string | undefined,
  req: PunchRequest,
): Promise<PunchResult> {
  const employeeId = staff.employeeId
  if (employeeId == null) {
    throw new ApiError('No HR employee linked to this session.')
  }

  const today = todayDateOnly()
  const punchTime = nowTimeOnly()
  const [rows, schedules] = await Promise.all([
    listHrAttendance({ from: today, to: today, employeeId }),
    listHrShiftSchedules({ from: today, to: today, employeeId }),
  ])
  const existing = rows[0] ?? null
  const schedule = schedules.find((s) => s.type === 'Work') ?? null
  let scheduledIn = schedule?.startTime ?? null
  let scheduledOut = schedule?.endTime ?? null

  if (!schedule) {
    const office = await resolveAdminOfficeSchedule(employeeId, today)
    scheduledIn = office.scheduledIn
    scheduledOut = office.scheduledOut
  }

  if (req.action === 'clockIn') {
    if (existing?.actualIn && !existing.actualOut) {
      throw new ApiError('Already clocked in for today. Clock out first.')
    }
    if (existing?.actualIn && existing.actualOut) {
      throw new ApiError('Attendance for today is already complete.')
    }

    const status = resolveStatus(punchTime, scheduledIn)
    const body = {
      employeeId,
      date: today,
      status,
      scheduledIn,
      scheduledOut,
      actualIn: punchTime,
      actualOut: null,
    }

    let record: HrAttendanceRecord
    if (existing) {
      record = await updateHrAttendance(existing.id, {
        ...body,
        actualOut: existing.actualOut ?? null,
      })
    } else {
      try {
        record = await createHrAttendance(body)
      } catch (err) {
        if (err instanceof Error && /already exists|409|Conflict/i.test(err.message)) {
          const again = await listHrAttendance({
            from: today,
            to: today,
            employeeId,
          })
          const row = again[0]
          if (!row) throw err
          record = await updateHrAttendance(row.id, {
            ...body,
            actualOut: row.actualOut ?? null,
          })
        } else {
          throw err
        }
      }
    }

    return {
      shift: recordToShift(record, staff, req.outletId, outletName),
      message: status === 'Late' ? 'Clocked in (late)' : 'Clocked in',
    }
  }

  if (req.action === 'clockOut') {
    if (!existing?.actualIn) {
      throw new ApiError('You are not clocked in.')
    }
    if (existing.actualOut) {
      throw new ApiError('Already clocked out for today.')
    }
    const record = await updateHrAttendance(existing.id, {
      employeeId,
      date: today,
      status: existing.status,
      scheduledIn: existing.scheduledIn ?? scheduledIn,
      scheduledOut: existing.scheduledOut ?? scheduledOut,
      actualIn: existing.actualIn,
      actualOut: punchTime,
    })
    return {
      shift: recordToShift(record, staff, req.outletId, outletName),
      message: 'Clocked out',
    }
  }

  throw new ApiError(`Action "${req.action}" is not supported yet.`)
}

export async function getAttendanceStatus(
  staff: AttendanceStaff,
  outletId: number,
  outletName?: string,
): Promise<AttendanceStatus> {
  if (isAttendanceMock()) {
    return getMockStatus(staff.staffKey, outletId, outletName)
  }
  return getHrStatus(staff, outletId, outletName)
}

export async function punchAttendance(
  staff: AttendanceStaff,
  outletName: string | undefined,
  req: PunchRequest,
): Promise<PunchResult> {
  const body: PunchRequest = {
    ...req,
    deviceId: req.deviceId ?? staff.deviceId ?? null,
  }

  if (isAttendanceMock()) {
    return mockPunch(staff.staffKey, staff.staffName, outletName, body)
  }

  return punchHr(staff, outletName, body)
}

/** Demo / local geofence pin (also used as soft overlay in HR mode). */
export async function calibrateOutletGeofence(
  _staff: AttendanceStaff,
  outletId: number,
  outletName: string | undefined,
  latitude: number,
  longitude: number,
  radiusMeters = 120,
): Promise<OutletAttendancePolicy> {
  return setMockGeofenceHere(
    outletId,
    outletName,
    latitude,
    longitude,
    radiusMeters,
  )
}

export function resetAttendanceDemo() {
  clearMockAttendance()
}
