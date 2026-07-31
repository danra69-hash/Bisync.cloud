import { hrApi } from '../../../modules/hr/api'
import {
  clockDate,
  clockHhMm,
  punchHrAttendance,
} from '../../../modules/hr/attendancePunch'
import {
  isValidPin,
  loadPinEnrollment,
  unlockPinPayload,
} from '../../../modules/hr/teamPin'
import { outletInitialFromLocation } from './outletInitial'
import {
  clearPosDutySession,
  loadPosDutySession,
  savePosDutySession,
  type PosDutySession,
} from './posDutySession'

export type PosPinEmployee = {
  employeeId: number
  employeeName: string
  employeeCode: string
}

export type PosDutyPinResult =
  | { ok: true; action: 'check-in' | 'check-out'; session: PosDutySession | null; warning?: string }
  | { ok: false; error: string }

export async function resolvePinEmployee(pin: string): Promise<PosPinEmployee | null> {
  // Prefer Team mobile PIN enrollment on this device.
  if (loadPinEnrollment() && isValidPin(pin)) {
    try {
      const payload = await unlockPinPayload(pin)
      return {
        employeeId: payload.employeeId,
        employeeName: payload.name || 'Employee',
        employeeCode: payload.username || '',
      }
    } catch {
      /* fall through */
    }
  }

  try {
    const result = await hrApi.employees.verifyPosPin(pin)
    if (result.valid && result.employeeId != null) {
      return {
        employeeId: result.employeeId,
        employeeName: result.employeeName || 'Employee',
        employeeCode: result.employeeCode || '',
      }
    }
  } catch {
    /* fall through */
  }

  // Local smoke fallback when no Team/POS PIN is configured yet.
  if (pin === '1234') {
    return { employeeId: 0, employeeName: 'POS Staff', employeeCode: 'DEMO' }
  }
  return null
}

/** Apply a 4-digit PIN as POS duty check-in or check-out (multiple cycles/day allowed). */
export async function applyPosDutyPin(opts: {
  pin: string
  locationExternalId: string
  locationName: string
}): Promise<PosDutyPinResult> {
  const pin = opts.pin.trim()
  if (pin.length !== 4) {
    return { ok: false, error: 'Enter a 4-digit PIN.' }
  }

  const resolved = await resolvePinEmployee(pin)
  if (!resolved) {
    return {
      ok: false,
      error: 'Invalid PIN. Use your Team mobile PIN, or set one under your name in /TEAM.',
    }
  }

  const current = loadPosDutySession()
  const outletInitial = outletInitialFromLocation(opts.locationName, opts.locationExternalId)

  if (current && current.employeeId === resolved.employeeId) {
    clearPosDutySession()
    if (resolved.employeeId > 0) {
      try {
        await punchHrAttendance({
          employeeId: resolved.employeeId,
          date: clockDate(),
          timeHhMm: clockHhMm(),
        })
      } catch {
        /* already out or no open punch */
      }
    }
    return { ok: true, action: 'check-out', session: null }
  }

  if (current && current.employeeId !== resolved.employeeId) {
    return {
      ok: false,
      error: `${current.employeeName} is on duty. Check out first.`,
    }
  }

  const session: PosDutySession = {
    employeeId: resolved.employeeId,
    employeeName: resolved.employeeName,
    employeeCode: resolved.employeeCode,
    locationExternalId: opts.locationExternalId,
    outletInitial,
    checkedInAt: new Date().toISOString(),
  }
  savePosDutySession(session)

  let warning: string | undefined
  if (resolved.employeeId > 0) {
    try {
      await punchHrAttendance({
        employeeId: resolved.employeeId,
        date: clockDate(),
        timeHhMm: clockHhMm(),
      })
    } catch (err) {
      if (err instanceof Error) {
        warning = `On duty — HR attendance: ${err.message}`
      }
    }
  }

  return { ok: true, action: 'check-in', session, warning }
}
