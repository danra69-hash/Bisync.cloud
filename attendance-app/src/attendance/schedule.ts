import {
  listHrLeaveRequests,
  listHrShiftSchedules,
  sliceTime,
  type HrLeaveRequest,
  type HrShiftSchedule,
} from '../api/hr'
import { isAttendanceMock } from '../api/attendance'
import type { MonthSchedule, ScheduleDay, ScheduledShift } from './scheduleTypes'

export function addDays(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() + n)
  return x
}

export function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export function formatMonthTitle(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export function monthGridCells(month: Date): Date[] {
  const first = startOfMonth(month)
  const startPad = (first.getDay() + 6) % 7
  const gridStart = addDays(first, -startPad)
  const cells: Date[] = []
  for (let i = 0; i < 42; i++) cells.push(addDays(gridStart, i))
  return cells
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

function buildDemoDayShifts(
  date: Date,
  outletId: number,
  outletName?: string,
): ScheduledShift[] {
  const dateKey = toDateKey(date)
  const dow = (date.getDay() + 6) % 7
  const shifts: ScheduledShift[] = []
  if (dow < 5) {
    const morning = (outletId + dow + date.getDate()) % 2 === 0
    shifts.push({
      id: `sch_${dateKey}_${outletId}`,
      date: dateKey,
      outletId,
      outletName,
      startTime: morning ? '09:00' : '13:00',
      endTime: morning ? '17:00' : '21:00',
      roleLabel: morning ? 'Floor' : 'Close',
    })
  } else if (dow === 5) {
    shifts.push({
      id: `sch_${dateKey}_${outletId}`,
      date: dateKey,
      outletId,
      outletName,
      startTime: '10:00',
      endTime: '16:00',
      roleLabel: 'Weekend',
    })
  }
  return shifts
}

export function buildDemoMonthSchedule(
  month: Date,
  outletId: number,
  outletName?: string,
): MonthSchedule {
  const first = startOfMonth(month)
  const year = first.getFullYear()
  const monthIndex = first.getMonth()
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const days: ScheduleDay[] = []
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, monthIndex, day)
    const dow = (date.getDay() + 6) % 7
    days.push({
      date: toDateKey(date),
      weekday: WEEKDAYS[dow],
      shifts: buildDemoDayShifts(date, outletId, outletName),
    })
  }
  return {
    year,
    month: monthIndex,
    monthStart: toDateKey(first),
    monthEnd: toDateKey(new Date(year, monthIndex, daysInMonth)),
    days,
  }
}

function leaveOnDate(leaves: HrLeaveRequest[], dateKey: string): HrLeaveRequest | null {
  return (
    leaves.find(
      (lr) =>
        (lr.status === 'Approved' || lr.status === 'Pending') &&
        dateKey >= lr.startDate &&
        dateKey <= lr.endDate,
    ) || null
  )
}

function scheduleToShifts(
  dateKey: string,
  schedules: HrShiftSchedule[],
  leaves: HrLeaveRequest[],
  outletId: number,
  outletName?: string,
): ScheduledShift[] {
  const leave = leaveOnDate(leaves, dateKey)
  if (leave) {
    return [
      {
        id: `leave_${leave.id}_${dateKey}`,
        date: dateKey,
        outletId,
        outletName,
        startTime: '',
        endTime: '',
        roleLabel: `${leave.type}${leave.status === 'Pending' ? ' (pending)' : ''}`,
      },
    ]
  }

  const daySchedules = schedules.filter((s) => s.date === dateKey)
  if (daySchedules.length === 0) return []

  return daySchedules.map((s) => {
    if (s.type !== 'Work') {
      return {
        id: `sch_${s.id}`,
        date: dateKey,
        outletId,
        outletName,
        startTime: '',
        endTime: '',
        roleLabel: s.type,
      }
    }
    return {
      id: `sch_${s.id}`,
      date: dateKey,
      outletId,
      outletName,
      startTime: sliceTime(s.startTime),
      endTime: sliceTime(s.endTime),
      roleLabel: 'Work',
    }
  })
}

export async function getMonthSchedule(
  month: Date,
  outletId: number,
  outletName: string | undefined,
  employeeId?: number | null,
): Promise<MonthSchedule> {
  if (isAttendanceMock() || employeeId == null) {
    return buildDemoMonthSchedule(month, outletId, outletName)
  }

  const first = startOfMonth(month)
  const year = first.getFullYear()
  const monthIndex = first.getMonth()
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const monthStart = toDateKey(first)
  const monthEnd = toDateKey(new Date(year, monthIndex, daysInMonth))

  const [schedules, leaves] = await Promise.all([
    listHrShiftSchedules({
      from: monthStart,
      to: monthEnd,
      employeeId,
    }),
    listHrLeaveRequests(employeeId),
  ])

  const days: ScheduleDay[] = []
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, monthIndex, day)
    const dateKey = toDateKey(date)
    const dow = (date.getDay() + 6) % 7
    days.push({
      date: dateKey,
      weekday: WEEKDAYS[dow],
      shifts: scheduleToShifts(
        dateKey,
        schedules,
        leaves,
        outletId,
        outletName,
      ),
    })
  }

  return { year, month: monthIndex, monthStart, monthEnd, days }
}
