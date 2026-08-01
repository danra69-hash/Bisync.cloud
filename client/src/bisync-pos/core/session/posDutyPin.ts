import { hrApi } from '../../../modules/hr/api'
import { clockDate } from '../../../modules/hr/attendancePunch'
import {
  isValidPin,
  loadPinEnrollment,
  unlockPinPayload,
} from '../../../modules/hr/teamPin'
import { outletInitialFromLocation } from './outletInitial'
import {
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
  | { ok: true; action: 'unlock'; session: PosDutySession; warning?: string }
  | { ok: false; error: string }

const QR_REQUIRED_ERROR =
  'Scan the POS QR in Team (/TEAM) to check in first, then enter your PIN to unlock POS.'

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
  const current = loadPosDutySession()
  return {
    employeeId: resolved.employeeId,
    employeeName: resolved.employeeName,
    employeeCode: resolved.employeeCode,
    locationExternalId,
    outletInitial: outletInitialFromLocation(locationName, locationExternalId),
    // Keep original unlock time when the same person re-enters PIN.
    checkedInAt:
      current?.employeeId === resolved.employeeId && current.checkedInAt
        ? current.checkedInAt
        : new Date().toISOString(),
  }
}

async function hasOpenQrAttendance(employeeId: number): Promise<boolean> {
  const today = clockDate()
  const rows = await hrApi.attendance.list(today, today, employeeId)
  const record = rows[0]
  return Boolean(record?.actualIn) && !record?.actualOut
}

/**
 * POS PIN unlock only — never records HR attendance.
 *
 * Attendance check-in/out is QR-only via Team. While that employee has an open
 * QR check-in, PIN may unlock (or keep unlocked) POS ordering freely.
 * QR check-out clears unlock via syncPosDutyWithHrAttendance.
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

  try {
    const qrCheckedIn = await hasOpenQrAttendance(resolved.employeeId)
    if (!qrCheckedIn) {
      return { ok: false, error: QR_REQUIRED_ERROR }
    }

    const session = buildSession(resolved, opts.locationExternalId, opts.locationName)
    savePosDutySession(session)
    return { ok: true, action: 'unlock', session }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not verify attendance.',
    }
  }
}
