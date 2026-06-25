import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, GripVertical, Trash2 } from 'lucide-react';
import type { Employee, EmployeeLevel, ScheduleType, ShiftSchedule } from './types';

const SLOT_MINUTES = 30;
const SCHEDULE_START_MIN = 9 * 60;
const SCHEDULE_END_MIN = 24 * 60;
const MIN_ROW_HEIGHT = 12;
const MAX_ROW_HEIGHT = 20;
const CHROME_HEIGHT = 260;

const LEAVE_TYPES: { value: ScheduleType; label: string }[] = [
  { value: 'DO', label: 'DO — Day Off' },
  { value: 'RDO', label: 'RDO — Replacement Day Off' },
  { value: 'AL', label: 'AL — Annual Leave' },
  { value: 'RPH', label: 'RPH — Replacement Public Holiday' },
  { value: 'UPL', label: 'UPL — Unpaid Leave' },
];

const BAR_COLORS = [
  'bg-herme border-herme-dark',
  'bg-blue-600 border-blue-700',
  'bg-violet-600 border-violet-700',
  'bg-teal-600 border-teal-700',
  'bg-orange-600 border-orange-700',
  'bg-rose-600 border-rose-700',
  'bg-cyan-600 border-cyan-700',
  'bg-indigo-600 border-indigo-700',
];

const LEAVE_BADGE: Record<string, string> = {
  DO: 'bg-gray-200 text-gray-800',
  RDO: 'bg-herme-soft text-herme-darker',
  AL: 'bg-green-100 text-green-800',
  RPH: 'bg-purple-100 text-purple-800',
  UPL: 'bg-gray-100 text-gray-600',
};

const hm = (t?: string | null) => (t ? t.slice(0, 5) : '');

const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

function timeSlots(): string[] {
  const slots: string[] = [];
  for (let m = SCHEDULE_START_MIN; m <= SCHEDULE_END_MIN; m += SLOT_MINUTES) {
    const h = Math.floor(m / 60) % 24;
    const min = m % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
  }
  return slots;
}

function formatSlotLabel(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const hour = h % 24;
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function mondayOfWeek(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

function weekDatesFrom(mondayIso: string): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${mondayIso}T12:00:00`);
    d.setDate(d.getDate() + i);
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${y}-${mo}-${da}`;
  });
}

function shiftHours(employee: Employee, levels: EmployeeLevel[]): number {
  const level = employee.employeeLevel ?? levels.find((l) => l.id === employee.employeeLevelId);
  return level?.workingHoursPerDay ?? employee.workingHoursPerDay ?? 8;
}

function barMetrics(startTime: string, hours: number, rowHeight: number) {
  const startMin = toMinutes(startTime);
  const clampedStart = Math.max(startMin, SCHEDULE_START_MIN);
  const endMin = startMin + hours * 60;
  const visibleEnd = Math.min(endMin, SCHEDULE_END_MIN);
  const top = ((clampedStart - SCHEDULE_START_MIN) / SLOT_MINUTES) * rowHeight;
  const height = Math.max(((visibleEnd - clampedStart) / SLOT_MINUTES) * rowHeight, rowHeight);
  return { top, height };
}

function maxStartMinutes(hours: number) {
  return SCHEDULE_END_MIN - hours * 60;
}

function snapTop(top: number, hours: number, rowHeight: number) {
  const maxTop = ((maxStartMinutes(hours) - SCHEDULE_START_MIN) / SLOT_MINUTES) * rowHeight;
  const snapped = Math.round(top / rowHeight) * rowHeight;
  return Math.min(Math.max(snapped, 0), Math.max(maxTop, 0));
}

function topToSlotTime(topPx: number, rowHeight: number): string {
  const slotIndex = Math.round(topPx / rowHeight);
  const minutes = SCHEDULE_START_MIN + slotIndex * SLOT_MINUTES;
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

type BarDragState = {
  employeeId: number;
  date: string;
  hours: number;
  pointerId: number;
  originTop: number;
  originPointerY: number;
  draftTop: number;
};

export function initialScheduleWeekStart(): string {
  return mondayOfWeek(new Date());
}

type Props = {
  shiftEmployees: Employee[];
  employeeLevels: EmployeeLevel[];
  shiftSchedules: ShiftSchedule[];
  weekStart: string;
  onWeekChange: (mondayIso: string) => void;
  onUpsert: (employeeId: number, date: string, type: ScheduleType, startTime?: string) => void;
  onClear: (employeeId: number, date: string) => void;
};

export default function ShiftScheduleGrid({
  shiftEmployees,
  employeeLevels,
  shiftSchedules,
  weekStart,
  onWeekChange,
  onUpsert,
  onClear,
}: Props) {
  const [dragEmployeeId, setDragEmployeeId] = useState<number | null>(null);
  const [dragPreview, setDragPreview] = useState<{ employeeId: number; date: string; top: number } | null>(null);
  const barDragRef = useRef<BarDragState | null>(null);
  const slots = useMemo(() => timeSlots(), []);
  const weekDates = useMemo(() => weekDatesFrom(weekStart), [weekStart]);
  const [rowHeight, setRowHeight] = useState(16);
  const gridHeight = slots.length * rowHeight;

  useEffect(() => {
    const updateRowHeight = () => {
      const available = window.innerHeight - CHROME_HEIGHT;
      const next = Math.floor(available / slots.length);
      setRowHeight(Math.max(MIN_ROW_HEIGHT, Math.min(MAX_ROW_HEIGHT, next)));
    };
    updateRowHeight();
    window.addEventListener('resize', updateRowHeight);
    return () => window.removeEventListener('resize', updateRowHeight);
  }, [slots.length]);

  const scheduleFor = (employeeId: number, date: string) =>
    shiftSchedules.find((s) => s.employeeId === employeeId && s.date === date);

  const workSchedulesForDay = (date: string) =>
    shiftSchedules.filter((s) => s.date === date && s.type === 'Work' && s.startTime);

  const employeeColor = (id: number) => BAR_COLORS[id % BAR_COLORS.length];

  const shiftWeek = (delta: number) => {
    const d = new Date(`${weekStart}T12:00:00`);
    d.setDate(d.getDate() + delta * 7);
    onWeekChange(mondayOfWeek(d));
  };

  const handleDrop = (employeeId: number, date: string, slotTime: string) => {
    onUpsert(employeeId, date, 'Work', slotTime);
    setDragEmployeeId(null);
  };

  const startBarDrag = useCallback((
    e: React.PointerEvent,
    employeeId: number,
    date: string,
    hours: number,
    top: number,
  ) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    barDragRef.current = {
      employeeId,
      date,
      hours,
      pointerId: e.pointerId,
      originTop: top,
      originPointerY: e.clientY,
      draftTop: top,
    };
    setDragPreview({ employeeId, date, top });
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = barDragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;
      const delta = e.clientY - drag.originPointerY;
      const draftTop = snapTop(drag.originTop + delta, drag.hours, rowHeight);
      drag.draftTop = draftTop;
      setDragPreview({ employeeId: drag.employeeId, date: drag.date, top: draftTop });
    };

    const onEnd = (e: PointerEvent) => {
      const drag = barDragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;
      const startTime = topToSlotTime(drag.draftTop, rowHeight);
      onUpsert(drag.employeeId, drag.date, 'Work', startTime);
      barDragRef.current = null;
      setDragPreview(null);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onEnd);
    document.addEventListener('pointercancel', onEnd);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onEnd);
      document.removeEventListener('pointercancel', onEnd);
    };
  }, [onUpsert, rowHeight]);

  const weekLabel = (() => {
    const start = new Date(`${weekDates[0]}T12:00:00`);
    const end = new Date(`${weekDates[6]}T12:00:00`);
    const sameMonth = start.getMonth() === end.getMonth();
    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = end.toLocaleDateString('en-US', {
      month: sameMonth ? undefined : 'short',
      day: 'numeric',
      year: 'numeric',
    });
    return `${startStr} – ${endStr}`;
  })();

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => shiftWeek(-1)}
            className="p-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700"
            aria-label="Previous week"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-gray-900 min-w-[160px] text-center">{weekLabel}</span>
          <button
            type="button"
            onClick={() => shiftWeek(1)}
            className="p-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700"
            aria-label="Next week"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onWeekChange(initialScheduleWeekStart())}
            className="text-xs text-herme hover:text-herme-dark px-1.5 py-0.5"
          >
            This week
          </button>
        </div>
        <p className="text-xs text-gray-500">Drop on a slot or drag bars vertically</p>
      </div>

      {/* Shift workers — compact horizontal strip */}
      <div className="bg-white rounded-lg border border-gray-200 px-2 py-1.5">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide shrink-0">Shift workers</span>
          {shiftEmployees.map((employee) => (
            <div
              key={employee.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('employeeId', String(employee.id));
                e.dataTransfer.effectAllowed = 'move';
                setDragEmployeeId(employee.id);
              }}
              onDragEnd={() => setDragEmployeeId(null)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md border cursor-grab active:cursor-grabbing text-xs select-none shrink-0 ${
                dragEmployeeId === employee.id
                  ? 'border-herme ring-1 ring-herme/30 bg-herme-light'
                  : 'border-gray-200 bg-gray-50 hover:border-herme-muted'
              }`}
            >
              <GripVertical className="w-3 h-3 text-gray-400 shrink-0" />
              <span className="font-medium text-gray-900 whitespace-nowrap">{employee.name}</span>
              <span className="text-[10px] text-gray-500">{shiftHours(employee, employeeLevels)}h</span>
            </div>
          ))}
        </div>
      </div>

      {/* Weekly time grid */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <div className="min-w-[640px]">
          {/* Day headers with leave controls */}
          <div className="grid grid-cols-[52px_repeat(7,1fr)] border-b border-gray-200 bg-gray-50">
            <div className="px-1 py-1.5 text-[10px] text-gray-400 border-r border-gray-200">Time</div>
            {weekDates.map((date) => {
              const d = new Date(`${date}T12:00:00`);
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
              const hasLeaveForDay = shiftSchedules.some((s) => s.date === date && s.type !== 'Work');
              const withoutWork = shiftEmployees.filter((emp) => {
                const s = scheduleFor(emp.id, date);
                return !s || s.type !== 'Work';
              });
              return (
                <div
                  key={date}
                  className={`px-1 py-1 text-center border-r border-gray-200 last:border-r-0 ${
                    hasLeaveForDay ? 'bg-gray-300' : (isWeekend ? 'bg-gray-100' : '')
                  }`}
                >
                  <div className="text-xs font-medium text-gray-900 leading-tight">
                    {d.toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                  <div className="text-[10px] text-gray-500">{d.getDate()}</div>
                  <div className="mt-1 border-t border-gray-200/80 pt-1 space-y-0.5 max-h-16 overflow-y-auto text-left">
                    {withoutWork.length === 0 ? (
                      <span className="text-[9px] text-gray-400 block text-center">OK</span>
                    ) : (
                      withoutWork.map((employee) => {
                        const schedule = scheduleFor(employee.id, date);
                        const leaveType = schedule && schedule.type !== 'Work' ? schedule.type : '';
                        return (
                          <div key={employee.id} className="flex items-center gap-0.5">
                            <span className="text-[9px] text-gray-600 truncate max-w-[40%]" title={employee.name}>
                              {employee.name.split(' ')[0]}
                            </span>
                            <select
                              value={leaveType}
                              onChange={(e) => {
                                const type = e.target.value as ScheduleType | '';
                                if (type) onUpsert(employee.id, date, type);
                                else onClear(employee.id, date);
                              }}
                              className={`flex-1 min-w-0 px-0.5 py-0 border border-gray-300 rounded text-[9px] bg-white focus:outline-none focus:ring-1 focus:ring-herme ${
                                leaveType ? LEAVE_BADGE[leaveType] ?? '' : ''
                              }`}
                            >
                              <option value="">—</option>
                              {LEAVE_TYPES.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.value}</option>
                              ))}
                            </select>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-[52px_repeat(7,1fr)]">
            {/* Time labels */}
            <div className="border-r border-gray-200 bg-gray-50">
              {slots.map((slot) => (
                <div
                  key={slot}
                  className="px-1 text-[9px] text-gray-500 border-b border-gray-100 flex items-start leading-none"
                  style={{ height: rowHeight }}
                >
                  {slot.endsWith(':00') ? formatSlotLabel(slot) : ''}
                </div>
              ))}
            </div>

            {/* Day columns */}
            {weekDates.map((date) => {
                const d = new Date(`${date}T12:00:00`);
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                const hasLeaveForDay = shiftSchedules.some((s) => s.date === date && s.type !== 'Work');
                const workBars = workSchedulesForDay(date);

                return (
                  <div
                    key={date}
                    className={`relative border-r border-gray-200 last:border-r-0 ${
                      hasLeaveForDay ? 'bg-gray-200/80' : (isWeekend ? 'bg-gray-50/60' : '')
                    }`}
                    style={{ height: gridHeight }}
                  >
                    {/* Half-hour slot drop targets */}
                    {slots.map((slot) => (
                      <div
                        key={slot}
                        className="absolute left-0 right-0 border-b border-gray-100 hover:bg-herme-light/40 transition-colors"
                        style={{
                          top: ((toMinutes(slot) - SCHEDULE_START_MIN) / SLOT_MINUTES) * rowHeight,
                          height: rowHeight,
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const raw = e.dataTransfer.getData('employeeId');
                          const employeeId = Number(raw);
                          if (employeeId) handleDrop(employeeId, date, slot);
                        }}
                      />
                    ))}

                    {/* Work shift bars */}
                    {workBars.map((schedule) => {
                      const employee = shiftEmployees.find((e) => e.id === schedule.employeeId);
                      if (!employee || !schedule.startTime) return null;
                      const hours = shiftHours(employee, employeeLevels);
                      const { top, height } = barMetrics(hm(schedule.startTime), hours, rowHeight);
                      const isDragging = dragPreview?.employeeId === employee.id && dragPreview.date === date;
                      const displayTop = isDragging ? dragPreview.top : top;
                      const draftStart = isDragging ? topToSlotTime(dragPreview.top, rowHeight) : hm(schedule.startTime);
                      const draftEndMin = toMinutes(draftStart) + hours * 60;
                      const draftEndH = Math.floor(draftEndMin / 60) % 24;
                      const draftEndM = draftEndMin % 60;
                      const draftEnd = `${String(draftEndH).padStart(2, '0')}:${String(draftEndM).padStart(2, '0')}`;
                      const endTime = isDragging ? draftEnd : hm(schedule.endTime);
                      return (
                        <div
                          key={schedule.id}
                          onPointerDown={(e) => startBarDrag(e, employee.id, date, hours, top)}
                          className={`group absolute left-0.5 right-0.5 rounded border text-white shadow-sm cursor-grab overflow-hidden z-10 select-none touch-none ${
                            isDragging ? 'cursor-grabbing ring-1 ring-white/60 shadow-md z-20' : ''
                          } ${employeeColor(employee.id)}`}
                          style={{ top: displayTop, height: Math.max(height, rowHeight), fontSize: rowHeight < 16 ? 9 : 11 }}
                          title={`${employee.name}: ${draftStart} – ${endTime}`}
                        >
                          <div className="flex items-center justify-between gap-0.5 px-1 py-0.5 min-h-0 h-full">
                            <div className="min-w-0 flex-1 leading-tight">
                              <div className="font-semibold truncate">{employee.name}</div>
                              {height >= rowHeight * 2 && (
                                <div className="opacity-90 truncate" style={{ fontSize: rowHeight < 16 ? 8 : 9 }}>
                                  {draftStart}–{endTime}
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                onClear(employee.id, date);
                              }}
                              className="shrink-0 p-px rounded bg-black/25 hover:bg-red-600 text-white transition-colors"
                              title="Delete shift"
                              aria-label={`Delete shift for ${employee.name}`}
                            >
                              <Trash2 style={{ width: rowHeight < 16 ? 10 : 12, height: rowHeight < 16 ? 10 : 12 }} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

          </div>
        </div>
      </div>
  );
}
