import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { InfiniteScrollTableSentinel } from '../../components/shared/infiniteScroll';
import { TableScrollContainer } from '../../components/shared/TableScrollContainer';
import { Copy, Save } from 'lucide-react';
import type {
  Employee,
  EmployeeLevel,
  LeaveRequest,
  ScheduleBatchChange,
  ScheduleLeaveType,
  ShiftSchedule,
} from './types';

const LEAVE_OPTIONS: { value: ScheduleLeaveType; label: string }[] = [
  { value: 'DO', label: 'DO' },
  { value: 'RDO', label: 'RDO' },
  { value: 'AL', label: 'AL' },
  { value: 'RPH', label: 'RPH' },
  { value: 'UPL', label: 'UPL' },
];

const hm = (t?: string | null) => (t ? t.slice(0, 5) : '');

type CellDraft =
  | { kind: 'empty' }
  | { kind: 'work'; timeIn: string }
  | { kind: 'leave'; leaveType: ScheduleLeaveType };

type Props = {
  shiftEmployees: Employee[];
  employeeLevels: EmployeeLevel[];
  shiftSchedules: ShiftSchedule[];
  approvedLeaveRequests: LeaveRequest[];
  weekDates: string[];
  onSave: (changes: ScheduleBatchChange[]) => Promise<void>;
};

function cellKey(employeeId: number, date: string) {
  return `${employeeId}:${date}`;
}

function dateInLeaveRange(date: string, start: string, end: string) {
  return date >= start && date <= end;
}

function shiftHours(employee: Employee, levels: EmployeeLevel[]) {
  const level = employee.employeeLevel ?? levels.find((l) => l.id === employee.employeeLevelId);
  return level?.workingHoursPerDay ?? employee.workingHoursPerDay ?? 8;
}

function levelName(employee: Employee, levels: EmployeeLevel[]) {
  const level = employee.employeeLevel ?? levels.find((l) => l.id === employee.employeeLevelId);
  return level?.levelName ?? '—';
}

function levelRank(employee: Employee, levels: EmployeeLevel[]) {
  const level = employee.employeeLevel ?? levels.find((l) => l.id === employee.employeeLevelId);
  return level?.id ?? 0;
}

function addHours(time: string, hours: number) {
  const [h, m] = time.split(':').map(Number);
  const mins = h * 60 + m + Math.round(hours * 60);
  const eh = Math.floor(mins / 60) % 24;
  const em = mins % 60;
  return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
}

const MINUTE_OPTIONS = ['00', '30'] as const;

const SCHEDULE_HOURS = Array.from({ length: 15 }, (_, i) =>
  String(9 + i).padStart(2, '0'),
);

function parseTimeIn(timeIn: string): { hour: string; minute: string } {
  if (!timeIn) return { hour: '', minute: '' };
  const [h, m] = timeIn.split(':');
  return { hour: h, minute: m === '30' ? '30' : '00' };
}

function formatTimeIn(hour: string, minute: string) {
  return `${hour}:${minute}`;
}

function offsetWeekDates(weekDates: string[], dayDelta: number): string[] {
  return weekDates.map((date) => {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() + dayDelta);
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${y}-${mo}-${da}`;
  });
}

function dayHasScheduleEntry(
  employeeId: number,
  date: string,
  shiftSchedules: ShiftSchedule[],
  approvedLeaveRequests: LeaveRequest[],
): boolean {
  const schedule = shiftSchedules.find((s) => s.employeeId === employeeId && s.date === date);
  if (schedule) return true;
  return !!approvedLeaveFor(employeeId, date, approvedLeaveRequests);
}

function hasFullWeekCoverage(
  employeeId: number,
  dates: string[],
  shiftSchedules: ShiftSchedule[],
  approvedLeaveRequests: LeaveRequest[],
): boolean {
  return dates.every((date) =>
    dayHasScheduleEntry(employeeId, date, shiftSchedules, approvedLeaveRequests),
  );
}

function isCellFixed(cell: CellDraft, locked: boolean): boolean {
  if (locked) return true;
  if (cell.kind === 'leave') return true;
  if (cell.kind === 'work') {
    const { hour, minute } = parseTimeIn(cell.timeIn);
    return !!hour && !!minute;
  }
  return false;
}

function cellBackgroundClass(cell: CellDraft, locked: boolean): string {
  if (locked || cell.kind === 'leave') {
    return 'bg-gray-200/90 ring-1 ring-inset ring-gray-300';
  }
  if (!isCellFixed(cell, locked)) {
    return 'bg-amber-100/90 ring-1 ring-inset ring-amber-200';
  }
  if (cell.kind === 'work') {
    const { hour, minute } = parseTimeIn(cell.timeIn);
    const startMinutes = Number(hour) * 60 + Number(minute);
    if (startMinutes < 12 * 60) {
      return 'bg-green-100/90 ring-1 ring-inset ring-green-200';
    }
    return 'bg-blue-100/90 ring-1 ring-inset ring-blue-200';
  }
  return 'bg-white';
}

function approvedLeaveFor(
  employeeId: number,
  date: string,
  approvedLeaveRequests: LeaveRequest[],
) {
  return approvedLeaveRequests.find(
    (r) =>
      r.employeeId === employeeId &&
      r.status === 'Approved' &&
      dateInLeaveRange(date, r.startDate, r.endDate),
  );
}

function isApprovedLeaveLocked(
  employeeId: number,
  date: string,
  approvedLeaveRequests: LeaveRequest[],
) {
  return !!approvedLeaveFor(employeeId, date, approvedLeaveRequests);
}

function serverCellDraft(
  employeeId: number,
  date: string,
  shiftSchedules: ShiftSchedule[],
  approvedLeaveRequests: LeaveRequest[],
): CellDraft {
  const schedule = shiftSchedules.find((s) => s.employeeId === employeeId && s.date === date);
  if (schedule?.type === 'Work' && schedule.startTime) {
    const { hour, minute } = parseTimeIn(hm(schedule.startTime));
    if (!hour) return { kind: 'empty' };
    return { kind: 'work', timeIn: formatTimeIn(hour, minute) };
  }
  if (schedule && schedule.type !== 'Work') {
    return { kind: 'leave', leaveType: schedule.type };
  }
  const approved = approvedLeaveFor(employeeId, date, approvedLeaveRequests);
  if (approved) return { kind: 'leave', leaveType: approved.type };
  return { kind: 'empty' };
}

function buildDraftMap(
  employees: Employee[],
  weekDates: string[],
  shiftSchedules: ShiftSchedule[],
  approvedLeaveRequests: LeaveRequest[],
): Record<string, CellDraft> {
  const draft: Record<string, CellDraft> = {};
  for (const employee of employees) {
    for (const date of weekDates) {
      draft[cellKey(employee.id, date)] = serverCellDraft(
        employee.id,
        date,
        shiftSchedules,
        approvedLeaveRequests,
      );
    }
  }
  return draft;
}

function serializeCell(cell: CellDraft): string {
  if (cell.kind === 'empty') return '';
  if (cell.kind === 'work') return `W:${cell.timeIn}`;
  return `L:${cell.leaveType}`;
}

function buildChanges(
  draft: Record<string, CellDraft>,
  baseline: Record<string, CellDraft>,
): ScheduleBatchChange[] {
  const changes: ScheduleBatchChange[] = [];
  const keys = new Set([...Object.keys(draft), ...Object.keys(baseline)]);
  for (const key of keys) {
    const current = draft[key] ?? { kind: 'empty' as const };
    const base = baseline[key] ?? { kind: 'empty' as const };
    if (serializeCell(current) === serializeCell(base)) continue;

    const colon = key.indexOf(':');
    const employeeId = Number(key.slice(0, colon));
    const date = key.slice(colon + 1);

    if (current.kind === 'empty') {
      changes.push({ action: 'clear', employeeId, date });
    } else if (current.kind === 'work') {
      changes.push({ action: 'upsert', employeeId, date, type: 'Work', startTime: current.timeIn });
    } else {
      changes.push({ action: 'upsert', employeeId, date, type: current.leaveType });
    }
  }
  return changes;
}

export default function ShiftScheduleType2View({
  shiftEmployees,
  employeeLevels,
  shiftSchedules,
  approvedLeaveRequests,
  weekDates,
  onSave,
}: Props) {
  const sortedEmployees = useMemo(
    () =>
      [...shiftEmployees].sort((a, b) => {
        const rankDiff = levelRank(b, employeeLevels) - levelRank(a, employeeLevels);
        if (rankDiff !== 0) return rankDiff;
        return a.name.localeCompare(b.name);
      }),
    [shiftEmployees, employeeLevels],
  );

  const serverDraft = useMemo(
    () => buildDraftMap(sortedEmployees, weekDates, shiftSchedules, approvedLeaveRequests),
    [sortedEmployees, weekDates, shiftSchedules, approvedLeaveRequests],
  );

  const [draft, setDraft] = useState<Record<string, CellDraft>>(serverDraft);
  const [saving, setSaving] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const scrollRootRef = useRef<HTMLDivElement>(null);
  const scheduleColSpan = 3 + weekDates.length;
  const {
    visibleItems: pagedSortedEmployees,
    hasMore,
    sentinelRef,
    totalCount,
    visibleCount,
  } = useInfiniteScrollSlice(sortedEmployees, { scrollRootRef });

  useEffect(() => {
    setDraft(serverDraft);
  }, [serverDraft]);

  useEffect(() => {
    setCopyMessage(null);
  }, [weekDates]);

  const lastWeekDates = useMemo(() => offsetWeekDates(weekDates, -7), [weekDates]);

  const unfixedByDate = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const date of weekDates) {
      const hasUnfixed = sortedEmployees.some((employee) => {
        const cell = draft[cellKey(employee.id, date)] ?? { kind: 'empty' as const };
        const locked = isApprovedLeaveLocked(employee.id, date, approvedLeaveRequests);
        return !isCellFixed(cell, locked);
      });
      map.set(date, hasUnfixed);
    }
    return map;
  }, [draft, sortedEmployees, weekDates, approvedLeaveRequests]);

  const setCell = useCallback((employeeId: number, date: string, cell: CellDraft) => {
    const key = cellKey(employeeId, date);
    setDraft((prev) => ({ ...prev, [key]: cell }));
  }, []);

  const handleSave = async () => {
    const changes = buildChanges(draft, serverDraft);
    if (changes.length === 0) return;
    setSaving(true);
    try {
      await onSave(changes);
      setCopyMessage(null);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLastWeek = () => {
    let copiedEmployees = 0;
    let skippedEmployees = 0;

    setDraft((prev) => {
      const next = { ...prev };
      for (const employee of sortedEmployees) {
        if (!hasFullWeekCoverage(employee.id, lastWeekDates, shiftSchedules, approvedLeaveRequests)) {
          skippedEmployees++;
          continue;
        }
        copiedEmployees++;
        for (let i = 0; i < weekDates.length; i++) {
          const currentDate = weekDates[i];
          if (isApprovedLeaveLocked(employee.id, currentDate, approvedLeaveRequests)) continue;
          next[cellKey(employee.id, currentDate)] = serverCellDraft(
            employee.id,
            lastWeekDates[i],
            shiftSchedules,
            approvedLeaveRequests,
          );
        }
      }
      return next;
    });

    if (copiedEmployees === 0) {
      setCopyMessage('No employees copied — none had a full schedule last week.');
    } else if (skippedEmployees > 0) {
      setCopyMessage(
        `Copied ${copiedEmployees} employee(s). ${skippedEmployees} skipped (incomplete last week — enter manually). Click Save to apply.`,
      );
    } else {
      setCopyMessage(`Copied ${copiedEmployees} employee(s) from last week. Click Save to apply.`);
    }
  };

  return (
    <TableScrollContainer ref={scrollRootRef} className="bg-white rounded-lg border border-gray-200 max-h-[calc(100vh-12rem)] overflow-y-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50">
        <div>
          <p className="text-sm font-medium text-gray-900">Type 2 schedule</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Enter time in or a leave type per day. Amber = incomplete, grey = leave, green = morning shift, blue = afternoon shift.
          </p>
          {copyMessage && (
            <p className="text-xs text-herme-dark mt-1">{copyMessage}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopyLastWeek}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            Copy last week
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-herme hover:bg-herme-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {sortedEmployees.length === 0 ? (
        <p className="text-xs text-gray-500 py-8 text-center">No shift workers in this department.</p>
      ) : (
        <table className="w-full table-fixed text-xs">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left font-medium text-gray-600 px-3 py-2 truncate w-[12%]">
                Employee
              </th>
              <th className="text-left font-medium text-gray-600 px-3 py-2 truncate w-[10%]">
                Position
              </th>
              <th className="text-left font-medium text-gray-600 px-3 py-2 truncate w-[8%] border-r border-gray-200">
                Level
              </th>
              {weekDates.map((date) => {
                const d = new Date(`${date}T12:00:00`);
                const dayUnfixed = unfixedByDate.get(date);
                return (
                  <th
                    key={date}
                    className={`text-center font-medium text-gray-600 px-2 py-2  ${
                      dayUnfixed ? 'bg-amber-100 text-amber-950' : ''
                    }`}
                  >
                    <div>{d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                    <div className="text-xs text-gray-400 font-normal">{d.getDate()}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pagedSortedEmployees.map((employee) => (
              <tr key={employee.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                <td className="px-3 py-2 font-medium text-gray-900 sticky left-0 bg-white z-10">
                  {employee.name}
                </td>
                <td className="px-3 py-2 text-gray-700 sticky left-[120px] bg-white z-10">
                  {employee.position || '—'}
                </td>
                <td className="px-3 py-2 text-gray-600 sticky left-[220px] bg-white z-10 border-r border-gray-100">
                  {levelName(employee, employeeLevels)}
                </td>
                {weekDates.map((date) => {
                  const key = cellKey(employee.id, date);
                  const cell = draft[key] ?? { kind: 'empty' as const };
                  const locked = isApprovedLeaveLocked(employee.id, date, approvedLeaveRequests);
                  const approved = approvedLeaveFor(employee.id, date, approvedLeaveRequests);
                  const hours = shiftHours(employee, employeeLevels);
                  const timeOut =
                    cell.kind === 'work' && cell.timeIn ? addHours(cell.timeIn, hours) : '';
                  const { hour: timeHour, minute: timeMinute } =
                    cell.kind === 'work' ? parseTimeIn(cell.timeIn) : { hour: '', minute: '' };

                  return (
                    <td
                      key={date}
                      className={`px-1.5 py-1.5 align-top ${cellBackgroundClass(cell, locked)}`}
                    >
                      {locked ? (
                        <div className="px-1.5 py-1 text-center text-xs text-gray-700">
                          {approved?.type ?? '—'}
                          <div className="text-xs text-gray-500 mt-0.5">Approved</div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex gap-0.5">
                            <select
                              value={timeHour}
                              onChange={(e) => {
                                const hour = e.target.value;
                                if (!hour) {
                                  setCell(employee.id, date, { kind: 'empty' });
                                  return;
                                }
                                const minute = timeMinute || '00';
                                setCell(employee.id, date, {
                                  kind: 'work',
                                  timeIn: formatTimeIn(hour, minute),
                                });
                              }}
                              disabled={cell.kind === 'leave'}
                              className="flex-1 min-w-0 rounded border border-gray-300 px-0.5 py-0.5 text-xs bg-white disabled:bg-gray-50 disabled:text-gray-400 focus:outline-none focus:ring-1 focus:ring-herme"
                              aria-label="Time in hour"
                            >
                              <option value="">Hr</option>
                              {SCHEDULE_HOURS.map((hour) => (
                                <option key={hour} value={hour}>
                                  {Number(hour)}
                                </option>
                              ))}
                            </select>
                            <select
                              value={timeMinute}
                              onChange={(e) => {
                                const minute = e.target.value;
                                if (!minute || !timeHour) {
                                  if (!timeHour) return;
                                  setCell(employee.id, date, { kind: 'empty' });
                                  return;
                                }
                                setCell(employee.id, date, {
                                  kind: 'work',
                                  timeIn: formatTimeIn(timeHour, minute),
                                });
                              }}
                              disabled={cell.kind === 'leave' || !timeHour}
                              className="w-10 shrink-0 rounded border border-gray-300 px-0.5 py-0.5 text-xs bg-white disabled:bg-gray-50 disabled:text-gray-400 focus:outline-none focus:ring-1 focus:ring-herme"
                              aria-label="Time in minute"
                            >
                              <option value="">—</option>
                              {MINUTE_OPTIONS.map((minute) => (
                                <option key={minute} value={minute}>
                                  :{minute}
                                </option>
                              ))}
                            </select>
                          </div>
                          {timeOut && (
                            <div className="text-xs text-gray-500 text-center">Out {timeOut}</div>
                          )}
                          <select
                            value={cell.kind === 'leave' ? cell.leaveType : ''}
                            onChange={(e) => {
                              const value = e.target.value as ScheduleLeaveType | '';
                              if (value) setCell(employee.id, date, { kind: 'leave', leaveType: value });
                              else setCell(employee.id, date, { kind: 'empty' });
                            }}
                            disabled={cell.kind === 'work'}
                            className="w-full rounded border border-gray-300 px-1 py-0.5 text-xs bg-white disabled:bg-gray-50 disabled:text-gray-400 focus:outline-none focus:ring-1 focus:ring-herme"
                          >
                            <option value="">Leave —</option>
                            {LEAVE_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            <InfiniteScrollTableSentinel colSpan={scheduleColSpan} hasMore={hasMore} sentinelRef={sentinelRef} totalCount={totalCount} visibleCount={visibleCount} />
          </tbody>
        </table>
      )}
    </TableScrollContainer>
  );
}
