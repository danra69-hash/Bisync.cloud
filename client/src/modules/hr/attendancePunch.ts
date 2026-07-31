import { hrApi } from './api';
import type { AttendanceRecord, ShiftSchedule } from './types';

function timeOnly(hhmm: string): string {
  return hhmm.length === 5 ? `${hhmm}:00` : hhmm;
}

function toMinutes(t: string) {
  const [h, m] = t.slice(0, 5).split(':').map(Number);
  return h * 60 + m;
}

/** Record or update today's HR attendance from a Team/POS punch clock. */
export async function punchHrAttendance(opts: {
  employeeId: number;
  date: string;
  timeHhMm: string;
  shiftSchedules?: ShiftSchedule[];
}): Promise<AttendanceRecord> {
  const { employeeId, date, timeHhMm, shiftSchedules = [] } = opts;
  const stamp = timeOnly(timeHhMm.slice(0, 5));
  const sched = shiftSchedules.find(s => s.employeeId === employeeId && s.date === date && s.type === 'Work');
  const scheduledIn = sched?.startTime ? timeOnly(sched.startTime.slice(0, 5)) : null;
  const scheduledOut = sched?.endTime ? timeOnly(sched.endTime.slice(0, 5)) : null;

  const rows = await hrApi.attendance.list(date, date, employeeId);
  let record = rows[0] ?? null;

  const late =
    scheduledIn != null
    && toMinutes(stamp) > toMinutes(scheduledIn);

  if (!record || !record.actualIn) {
    const status = late ? 'Late' : 'Present';
    if (record) {
      return hrApi.attendance.update(record.id, {
        employeeId,
        date,
        status,
        scheduledIn: record.scheduledIn ?? scheduledIn,
        scheduledOut: record.scheduledOut ?? scheduledOut,
        actualIn: stamp,
        actualOut: record.actualOut ?? null,
      });
    }
    return hrApi.attendance.create({
      employeeId,
      date,
      status,
      scheduledIn,
      scheduledOut,
      actualIn: stamp,
      actualOut: null,
    });
  }

  if (!record.actualOut) {
    return hrApi.attendance.update(record.id, {
      employeeId,
      date,
      status: record.status === 'Late' ? 'Late' : 'Present',
      scheduledIn: record.scheduledIn ?? scheduledIn,
      scheduledOut: record.scheduledOut ?? scheduledOut,
      actualIn: record.actualIn,
      actualOut: stamp,
    });
  }

  throw new Error('Already checked in and out for today.');
}

export function clockHhMm(d = new Date()) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function clockDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
