import { hrApi } from '../../../modules/hr/api'
import { clockDate } from '../../../modules/hr/attendancePunch'
import {
  clearPosDutySession,
  loadPosDutySession,
  type PosDutySession,
} from './posDutySession'

/**
 * Keep POS unlock aligned with Team QR attendance for the unlock holder.
 * PIN never punches attendance — only QR check-out (actualOut) clears unlock.
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
    // Match unlock window (±1 day) so timezone skew cannot leave POS unlocked
    // after Team QR check-out, or clear early when the device date differs.
    const from = clockDate(new Date(Date.now() - 86_400_000))
    const to = clockDate(new Date(Date.now() + 86_400_000))
    const rows = await hrApi.attendance.list(from, to, duty.employeeId)
    const open = rows.some(r => Boolean(r?.actualIn) && !r?.actualOut)
    const checkedOutToday = rows.some(
      r => r.date === today && Boolean(r.actualIn) && Boolean(r.actualOut),
    )
    // Team / QR check-out sets actualOut while keeping actualIn (first-in / last-out).
    if (!open && checkedOutToday) {
      clearPosDutySession()
      return null
    }
  } catch {
    /* offline / API error — keep local duty */
  }

  return loadPosDutySession()
}
