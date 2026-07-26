import { hrRequest } from './hrClient'

export type AttendanceStatusCode = 'Present' | 'Absent' | 'Late' | 'HalfDay'
export type LeaveType = 'RDO' | 'RPH' | 'AL' | 'UPL'
export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected'
export type ScheduleType = 'Work' | 'DO' | 'RDO' | 'AL' | 'RPH' | 'UPL'

export type HrEmployee = {
  id: number
  employeeCode: string
  name: string
  email: string
  mobile?: string
  department?: string
  divisionId?: number | null
  departmentId?: number | null
  position?: string
  active?: boolean
  bisyncEnabled?: boolean
  isShiftEmployee?: boolean
  workingHoursPerDay?: number
  checkinMethod?: string
}

export type HrAttendanceRecord = {
  id: number
  employeeId: number
  date: string
  status: AttendanceStatusCode
  scheduledIn?: string | null
  scheduledOut?: string | null
  actualIn?: string | null
  actualOut?: string | null
}

export type HrAttendanceRequest = {
  employeeId: number
  date: string
  status: AttendanceStatusCode
  scheduledIn?: string | null
  scheduledOut?: string | null
  actualIn?: string | null
  actualOut?: string | null
}

export type HrLeaveRequest = {
  id: number
  employeeId: number
  type: LeaveType
  startDate: string
  endDate: string
  status: LeaveStatus
  reason?: string | null
}

export type HrShiftSchedule = {
  id: number
  employeeId: number
  date: string
  startTime?: string | null
  endTime?: string | null
  type: ScheduleType
}

export type HrDepartment = {
  id: number
  name: string
  divisionId: number
}

/** Standard employee portal password in Bisync.cloud HR (first login). */
export const HR_STANDARD_PASSWORD = 'Pass@123'

export async function listHrEmployees(): Promise<HrEmployee[]> {
  return hrRequest<HrEmployee[]>('employees')
}

export async function getHrEmployee(id: number): Promise<HrEmployee> {
  return hrRequest<HrEmployee>(`employees/${id}`)
}

/**
 * Digits for mobile match. Handles MY-style local vs international:
 * `0121112233` and `+60 12-111 2233` both → `121112233`.
 */
export function normalizeMobile(value: string): string {
  let digits = value.replace(/\D/g, '')
  if (!digits) return ''

  // Common country codes used in Bisync HR seed data (MY default).
  for (const cc of ['60', '65', '62', '66', '84', '63']) {
    if (digits.startsWith(cc) && digits.length > cc.length + 7) {
      digits = digits.slice(cc.length)
      break
    }
  }
  if (digits.startsWith('0')) digits = digits.slice(1)
  return digits
}

export async function findHrEmployeeByLogin(
  username: string,
): Promise<HrEmployee | null> {
  const mobileKey = normalizeMobile(username)
  if (!mobileKey) return null

  const list = await listHrEmployees()
  return (
    list.find((e) => {
      if (e.active === false) return false
      const empMobile = normalizeMobile(e.mobile || '')
      if (!empMobile) return false
      return (
        empMobile === mobileKey ||
        empMobile.endsWith(mobileKey) ||
        mobileKey.endsWith(empMobile)
      )
    }) || null
  )
}

export async function listHrAttendance(params: {
  from: string
  to: string
  employeeId?: number
}): Promise<HrAttendanceRecord[]> {
  const q = new URLSearchParams({ from: params.from, to: params.to })
  if (params.employeeId != null) q.set('employeeId', String(params.employeeId))
  return hrRequest<HrAttendanceRecord[]>(`attendance?${q}`)
}

export async function createHrAttendance(
  body: HrAttendanceRequest,
): Promise<HrAttendanceRecord> {
  return hrRequest<HrAttendanceRecord>('attendance', {
    method: 'POST',
    body,
  })
}

export async function updateHrAttendance(
  id: number,
  body: HrAttendanceRequest,
): Promise<HrAttendanceRecord> {
  return hrRequest<HrAttendanceRecord>(`attendance/${id}`, {
    method: 'PUT',
    body,
  })
}

export async function listHrLeaveRequests(employeeId?: number): Promise<HrLeaveRequest[]> {
  const q =
    employeeId != null ? `?employeeId=${employeeId}` : ''
  return hrRequest<HrLeaveRequest[]>(`leave-requests${q}`)
}

export async function listHrShiftSchedules(params: {
  from: string
  to: string
  employeeId?: number
}): Promise<HrShiftSchedule[]> {
  const q = new URLSearchParams({ from: params.from, to: params.to })
  if (params.employeeId != null) q.set('employeeId', String(params.employeeId))
  return hrRequest<HrShiftSchedule[]>(`shift-schedules?${q}`)
}

export async function listHrDepartments(): Promise<HrDepartment[]> {
  return hrRequest<HrDepartment[]>('departments')
}

/** Local time as ASP.NET TimeOnly-friendly `HH:mm:ss`. */
export function nowTimeOnly(): string {
  const d = new Date()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

export function todayDateOnly(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function sliceTime(value?: string | null): string {
  if (!value) return ''
  return value.length >= 5 ? value.slice(0, 5) : value
}
