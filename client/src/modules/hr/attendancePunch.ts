import { hrApi } from './api';
import type { AttendanceRecord, ShiftSchedule } from './types';
import { resolveOfficeHoursForDate } from '../../data/companyBusinessHours';

function timeOnly(hhmm: string): string {
  return hhmm.length === 5 ? `${hhmm}:00` : hhmm;
}

function toMinutes(t: string) {
  const [h, m] = t.slice(0, 5).split(':').map(Number);
  return h * 60 + m;
}

export type AttendancePunchAction = 'check-in' | 'check-out';

export type AttendancePunchResult = {
  record: AttendanceRecord;
  action: AttendancePunchAction;
};

/**
 * Record or update today's HR attendance from a Team/POS punch clock.
 *
 * Multiple in/out cycles are allowed in one day (lunch, meetings, coffee, etc.):
 * - First punch → check-in (keeps earliest actualIn)
 * - While in → check-out (sets / updates actualOut)
 * - After a completed out → check-in again (clears actualOut; original actualIn kept)
 * - Later outs update actualOut to the latest departure (first-in / last-out for the day)
 *
 * Expected times:
 * - Shift staff → Work row on ShiftSchedule
 * - Admin / non-shift staff → company Business Hours (office)
 */
export async function punchHrAttendance(opts: {
  employeeId: number;
  date: string;
  timeHhMm: string;
  shiftSchedules?: ShiftSchedule[];
  /** When false/undefined and no shift Work row, use company office hours. */
  isShiftEmployee?: boolean;
  /** Company BusinessHoursJson for admin staff late/expected times. */
  businessHoursJson?: string | null;
}): Promise<AttendancePunchResult> {
  const {
    employeeId,
    date,
    timeHhMm,
    shiftSchedules = [],
    isShiftEmployee = false,
    businessHoursJson = null,
  } = opts;
  const stamp = timeOnly(timeHhMm.slice(0, 5));
  const sched = shiftSchedules.find(s => s.employeeId === employeeId && s.date === date && s.type === 'Work');

  let scheduledIn: string | null = sched?.startTime ? timeOnly(sched.startTime.slice(0, 5)) : null;
  let scheduledOut: string | null = sched?.endTime ? timeOnly(sched.endTime.slice(0, 5)) : null;

  if (!sched && !isShiftEmployee) {
    const office = resolveOfficeHoursForDate(businessHoursJson, date);
    if (office && !office.closed) {
      scheduledIn = office.openFrom ? timeOnly(office.openFrom) : null;
      scheduledOut = office.openTo ? timeOnly(office.openTo) : null;
    }
  }

  const rows = await hrApi.attendance.list(date, date, employeeId);
  let record = rows[0] ?? null;

  const late =
    scheduledIn != null
    && toMinutes(stamp) > toMinutes(scheduledIn);

  // First check-in of the day (or legacy row with no actualIn yet).
  if (!record || !record.actualIn) {
    const status = late ? 'Late' : 'Present';
    if (record) {
      const updated = await hrApi.attendance.update(record.id, {
        employeeId,
        date,
        status,
        scheduledIn: record.scheduledIn ?? scheduledIn,
        scheduledOut: record.scheduledOut ?? scheduledOut,
        actualIn: stamp,
        actualOut: null,
      });
      return { record: updated, action: 'check-in' };
    }
    const created = await hrApi.attendance.create({
      employeeId,
      date,
      status,
      scheduledIn,
      scheduledOut,
      actualIn: stamp,
      actualOut: null,
    });
    return { record: created, action: 'check-in' };
  }

  // Currently out (or already completed a prior cycle) → check back in for the next stint.
  // Keep the day's first actualIn; clear actualOut so the open period is visible.
  if (record.actualOut) {
    const updated = await hrApi.attendance.update(record.id, {
      employeeId,
      date,
      status: record.status === 'Late' ? 'Late' : 'Present',
      scheduledIn: record.scheduledIn ?? scheduledIn,
      scheduledOut: record.scheduledOut ?? scheduledOut,
      actualIn: record.actualIn,
      actualOut: null,
    });
    return { record: updated, action: 'check-in' };
  }

  // Currently in → check out (latest departure of the day).
  const updated = await hrApi.attendance.update(record.id, {
    employeeId,
    date,
    status: record.status === 'Late' ? 'Late' : 'Present',
    scheduledIn: record.scheduledIn ?? scheduledIn,
    scheduledOut: record.scheduledOut ?? scheduledOut,
    actualIn: record.actualIn,
    actualOut: stamp,
  });
  return { record: updated, action: 'check-out' };
}

export function clockHhMm(d = new Date()) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function clockDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
