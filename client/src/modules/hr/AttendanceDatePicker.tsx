import { useEffect, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const parseIsoLocal = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const mondayOfWeek = (date: Date) => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d;
};

const weekContains = (anchorIso: string, dayIso: string) => {
  const mon = mondayOfWeek(parseIsoLocal(anchorIso));
  const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
  const day = parseIsoLocal(dayIso);
  return day >= mon && day <= sun;
};

type Props = {
  selectedDate: string;
  viewMode: 'week' | 'month';
  viewMonth: number;
  viewYear: number;
  onViewMonthChange: (month: number, year: number) => void;
  onSelect: (iso: string) => void;
  onClose: () => void;
};

export function AttendanceDatePicker({
  selectedDate,
  viewMode,
  viewMonth,
  viewYear,
  onViewMonthChange,
  onSelect,
  onClose,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const todayIso = toIso(new Date());

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [onClose]);

  const cells = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const last = new Date(viewYear, viewMonth + 1, 0);
    const startPad = first.getDay() === 0 ? 6 : first.getDay() - 1;
    const result: (Date | null)[] = Array.from({ length: startPad }, () => null);
    for (let d = 1; d <= last.getDate(); d++) {
      result.push(new Date(viewYear, viewMonth, d));
    }
    return result;
  }, [viewMonth, viewYear]);

  const prevMonth = () => {
    if (viewMonth === 0) onViewMonthChange(11, viewYear - 1);
    else onViewMonthChange(viewMonth - 1, viewYear);
  };

  const nextMonth = () => {
    if (viewMonth === 11) onViewMonthChange(0, viewYear + 1);
    else onViewMonthChange(viewMonth + 1, viewYear);
  };

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-4 w-72"
    >
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={prevMonth} className="p-1 rounded hover:bg-gray-100 text-gray-600">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-medium text-gray-900">
          {new Date(viewYear, viewMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
        <button type="button" onClick={nextMonth} className="p-1 rounded hover:bg-gray-100 text-gray-600">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {DOW.map(d => (
          <div key={d} className="text-center text-[10px] font-medium text-gray-500 py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((cell, i) => {
          if (!cell) return <div key={`pad-${i}`} className="aspect-square" />;
          const cellIso = toIso(cell);
          const isSelected = cellIso === selectedDate;
          const inWeek = viewMode === 'week' && weekContains(selectedDate, cellIso);
          const isToday = cellIso === todayIso;
          return (
            <button
              key={cellIso}
              type="button"
              onClick={() => onSelect(cellIso)}
              className={`aspect-square rounded text-xs font-medium transition-colors ${
                isSelected
                  ? 'bg-herme text-white'
                  : inWeek
                    ? 'bg-herme-light text-herme-dark'
                    : isToday
                      ? 'ring-1 ring-herme text-herme'
                      : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {cell.getDate()}
            </button>
          );
        })}
      </div>

      <p className="text-[10px] text-gray-500 mt-3 text-center leading-relaxed">
        {viewMode === 'week'
          ? 'Pick a day to view that week (Monday–Sunday).'
          : 'Pick a day to view the month through that date.'}
      </p>
    </div>
  );
}
