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
/** UI request to open the Staff PIN pad (e.g. from Home lock overlay). */
export const POS_OPEN_STAFF_PIN_EVENT = 'bisync-pos-open-staff-pin'

export function requestOpenStaffPinPad() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(POS_OPEN_STAFF_PIN_EVENT))
}

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

export function buildCheckInQrPayload(outletInitial: string, at = new Date()): string {
  const y = at.getFullYear()
  const m = String(at.getMonth() + 1).padStart(2, '0')
  const d = String(at.getDate()).padStart(2, '0')
  const hh = String(at.getHours()).padStart(2, '0')
  const mm = String(at.getMinutes()).padStart(2, '0')
  return `${outletInitial}/${y}-${m}-${d}/${hh}:${mm}`
}
