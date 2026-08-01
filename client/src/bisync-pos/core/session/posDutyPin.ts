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

const QR_REQUIRED_ERROR =
  'Scan the POS QR in Team (/TEAM) to check in first, then enter your PIN.'

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

function buildSession(
  resolved: PosPinEmployee,
  locationExternalId: string,
  locationName: string,
): PosDutySession {
  return {
    employeeId: resolved.employeeId,
    employeeName: resolved.employeeName,
    employeeCode: resolved.employeeCode,
    locationExternalId,
    outletInitial: outletInitialFromLocation(locationName, locationExternalId),
    checkedInAt: new Date().toISOString(),
  }
}

async function hasOpenQrAttendance(employeeId: number): Promise<boolean> {
  const today = clockDate()
  const rows = await hrApi.attendance.list(today, today, employeeId)
  const record = rows[0]
  return Boolean(record?.actualIn) && !record?.actualOut
}

/**
 * Shared terminal PIN after Team QR attendance.
 * PIN alone cannot create a check-in — staff must scan the POS QR in Team first.
 * With an open QR attendance: PIN unlocks POS, or checks out when that holder already unlocked.
 */
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

  // Demo / non-HR PIN cannot satisfy QR attendance.
  if (resolved.employeeId <= 0) {
    return { ok: false, error: QR_REQUIRED_ERROR }
  }

  const current = loadPosDutySession()

  try {
    const qrCheckedIn = await hasOpenQrAttendance(resolved.employeeId)
    if (!qrCheckedIn) {
      return { ok: false, error: QR_REQUIRED_ERROR }
    }

    // Already unlocked as this employee → PIN checks them out (HR + clear unlock).
    if (current?.employeeId === resolved.employeeId) {
      await punchHrAttendance({
        employeeId: resolved.employeeId,
        date: clockDate(),
        timeHhMm: clockHhMm(),
      })
      clearPosDutySession()
      return { ok: true, action: 'check-out', session: null }
    }

    // Open QR attendance: unlock POS without punching again (QR already recorded actualIn).
    const session = buildSession(resolved, opts.locationExternalId, opts.locationName)
    savePosDutySession(session)
    return { ok: true, action: 'check-in', session }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not verify attendance.',
    }
  }
}
