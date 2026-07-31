import { orgClockHhMm, orgTodayYmd } from '../../../utils/countryTimeZones'

export type PosDutySession = {
  employeeId: number
  employeeName: string
  employeeCode: string
  locationExternalId: string
  outletInitial: string
  checkedInAt: string
}

const KEY = 'bisync-pos-duty-session'
export const POS_DUTY_SESSION_EVENT = 'bisync-pos-duty-session-changed'

export function loadPosDutySession(): PosDutySession | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PosDutySession
    if (
      !parsed
      || typeof parsed.employeeId !== 'number'
      || !parsed.employeeName
      || !parsed.locationExternalId
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function savePosDutySession(session: PosDutySession) {
  localStorage.setItem(KEY, JSON.stringify(session))
  // Clear legacy soft-lock flag from earlier builds.
  try {
    localStorage.removeItem('bisync-pos-register-locked')
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(POS_DUTY_SESSION_EVENT))
}

export function clearPosDutySession() {
  localStorage.removeItem(KEY)
  try {
    localStorage.removeItem('bisync-pos-register-locked')
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(POS_DUTY_SESSION_EVENT))
}

/** QR payload uses org/cloud business date + wall clock (not browser local). */
export function buildCheckInQrPayload(
  outletInitial: string,
  at = new Date(),
  timeZoneId?: string | null,
): string {
  const ymd = orgTodayYmd(timeZoneId, at)
  const hm = orgClockHhMm(at, timeZoneId)
  return `${outletInitial}/${ymd}/${hm}`
}
