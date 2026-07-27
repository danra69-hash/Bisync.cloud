import { isAttendanceMock } from './api/attendance'

/** Clock product shell (HR-wired or local mock) — hide RMS order chrome. */
export function isClockProduct(): boolean {
  if (isAttendanceMock()) return true
  return import.meta.env.VITE_CLOCK_MODE !== 'false'
}
