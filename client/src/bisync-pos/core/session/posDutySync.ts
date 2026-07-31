import { hrApi } from '../../../modules/hr/api'
import { clockDate } from '../../../modules/hr/attendancePunch'
import {
  clearPosDutySession,
  loadPosDutySession,
  type PosDutySession,
} from './posDutySession'

/**
 * Keep register unlock aligned with Team/HR for the employee who last unlocked POS.
 * If that holder checked out on Team (mobile QR), clear the local unlock session.
 * Other staff check-ins/outs are independent and do not rename the shared Check in/out control.
 *
 * Rule: HR `actualOut` set for today for the unlock holder ⇒ clear unlock.
 * Missing attendance / API errors do not kick a local PIN session.
 */
export async function syncPosDutyWithHrAttendance(): Promise<PosDutySession | null> {
  const duty = loadPosDutySession()
  if (!duty) return null

  const today = clockDate()
  const checkedInAt = Date.parse(duty.checkedInAt)
  if (Number.isFinite(checkedInAt)) {
    const dutyDay = clockDate(new Date(checkedInAt))
    if (dutyDay !== today) {
      clearPosDutySession()
      return null
    }
  }

  // Demo PIN session has no HR employee — leave local duty as-is.
  if (duty.employeeId <= 0) return duty

  try {
    const rows = await hrApi.attendance.list(today, today, duty.employeeId)
    const record = rows[0]
    // Team / QR check-out sets actualOut while keeping actualIn (first-in / last-out).
    if (record?.actualOut) {
      clearPosDutySession()
      return null
    }
  } catch {
    /* offline / API error — keep local duty */
  }

  return loadPosDutySession()
}
