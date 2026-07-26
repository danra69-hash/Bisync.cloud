import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  formatMonthTitle,
  getMonthSchedule,
  monthGridCells,
  parseDateKey,
  startOfMonth,
  toDateKey,
} from '../../attendance/schedule'
import type { ScheduledShift } from '../../attendance/scheduleTypes'
import { useAuth } from '../../auth/AuthProvider'

type Props = {
  outletId: number
  outletName?: string
}

function CalendarIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 11h18" />
    </svg>
  )
}

export function MonthScheduleCard({ outletId, outletName }: Props) {
  const { session } = useAuth()
  const employeeId = session?.employeeId ?? null
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()))
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const pickerId = useId()
  const todayKey = toDateKey(new Date())

  const scheduleQuery = useQuery({
    queryKey: ['hr-month-schedule', toDateKey(month), outletId, outletName, employeeId],
    queryFn: () => getMonthSchedule(month, outletId, outletName, employeeId),
  })

  const schedule = scheduleQuery.data
  const shiftsByDate = useMemo(() => {
    const map = new Map<string, ScheduledShift[]>()
    for (const day of schedule?.days ?? []) map.set(day.date, day.shifts)
    return map
  }, [schedule?.days])

  const cells = useMemo(() => monthGridCells(month), [month])
  const monthTitle = formatMonthTitle(month)
  const isThisMonth =
    month.getFullYear() === new Date().getFullYear() &&
    month.getMonth() === new Date().getMonth()

  const selectedShifts = shiftsByDate.get(selectedDate) ?? []
  const selectedInView =
    !!schedule &&
    selectedDate >= schedule.monthStart &&
    selectedDate <= schedule.monthEnd

  useEffect(() => {
    if (isThisMonth) setSelectedDate(todayKey)
  }, [isThisMonth, todayKey, month])

  useEffect(() => {
    if (!pickerOpen) return
    function onDoc(e: MouseEvent) {
      if (!pickerRef.current?.contains(e.target as Node)) setPickerOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPickerOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [pickerOpen])

  function goPrevMonth() {
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))
  }

  function goNextMonth() {
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))
  }

  function goThisMonth() {
    const now = new Date()
    setMonth(startOfMonth(now))
    setSelectedDate(toDateKey(now))
    setPickerOpen(false)
  }

  function onPickMonth(value: string) {
    if (!value) return
    const [y, m] = value.split('-').map(Number)
    if (!y || !m) return
    setMonth(new Date(y, m - 1, 1))
    setPickerOpen(false)
  }

  const monthInputValue = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`

  return (
    <div className="card clock-schedule">
      <div className="clock-schedule-head">
        <div>
          <h3 style={{ margin: 0 }}>Schedule</h3>
          <p className="muted" style={{ margin: '2px 0 0' }}>
            {isThisMonth ? 'This month' : monthTitle}
            {employeeId != null ? ' · HR' : ''}
          </p>
        </div>

        <div className="clock-month-nav">
          <button
            type="button"
            className="btn btn-secondary clock-month-nav-btn"
            aria-label="Previous month"
            onClick={goPrevMonth}
          >
            ‹
          </button>
          <div className="clock-month-picker" ref={pickerRef}>
            <button
              type="button"
              className="btn btn-secondary clock-month-picker-btn"
              aria-expanded={pickerOpen}
              aria-controls={pickerId}
              onClick={() => setPickerOpen((v) => !v)}
            >
              <CalendarIcon />
              <span>Month</span>
            </button>
            {pickerOpen && (
              <div
                id={pickerId}
                className="clock-month-picker-panel"
                role="dialog"
                aria-label="Choose month"
              >
                <p className="clock-month-picker-title">{monthTitle}</p>
                <label className="clock-month-date-field">
                  <span className="muted">Jump to month</span>
                  <input
                    type="month"
                    value={monthInputValue}
                    onChange={(e) => onPickMonth(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: 8 }}
                  onClick={goThisMonth}
                >
                  This month
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            className="btn btn-secondary clock-month-nav-btn"
            aria-label="Next month"
            onClick={goNextMonth}
          >
            ›
          </button>
        </div>
      </div>

      {!isThisMonth && (
        <p className="muted clock-schedule-range">{monthTitle}</p>
      )}

      {scheduleQuery.isError && (
        <p className="clock-feedback is-error" role="alert">
          {(scheduleQuery.error as Error)?.message ||
            'Could not load schedule from HR'}
        </p>
      )}

      <div className="clock-month-calendar">
        <div className="clock-month-dows" aria-hidden>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <span key={`${d}-${i}`}>{d}</span>
          ))}
        </div>
        <div className="clock-month-grid" role="grid" aria-label={monthTitle}>
          {cells.map((cell) => {
            const key = toDateKey(cell)
            const inMonth = cell.getMonth() === month.getMonth()
            const shifts = inMonth ? shiftsByDate.get(key) ?? [] : []
            const isToday = key === todayKey
            const isSelected = key === selectedDate
            const hasShift = shifts.length > 0
            const first = shifts[0]
            const label = !inMonth
              ? ''
              : !hasShift
                ? 'Off'
                : first.startTime && first.endTime
                  ? `${first.startTime}–${first.endTime}`
                  : first.roleLabel || '—'

            return (
              <button
                key={key}
                type="button"
                role="gridcell"
                disabled={!inMonth}
                className={[
                  'clock-month-cell',
                  inMonth ? '' : 'is-outside',
                  isToday ? 'is-today' : '',
                  isSelected ? 'is-selected' : '',
                  hasShift ? 'has-shift' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => inMonth && setSelectedDate(key)}
              >
                <span className="clock-month-cell-day">{cell.getDate()}</span>
                {inMonth && (
                  <span className="clock-month-cell-shift">{label}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {selectedInView && (
        <div className="clock-month-detail">
          <p className="clock-month-detail-date">
            {parseDateKey(selectedDate).toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            })}
            {selectedDate === todayKey ? ' · Today' : ''}
          </p>
          {selectedShifts.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              Off
            </p>
          ) : (
            <ul className="clock-month-detail-list">
              {selectedShifts.map((s) => (
                <li key={s.id}>
                  <span className="clock-schedule-time">
                    {s.startTime && s.endTime
                      ? `${s.startTime} – ${s.endTime}`
                      : s.roleLabel || '—'}
                  </span>
                  {s.startTime && s.endTime ? (
                    <span className="muted">{s.roleLabel || 'Shift'}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
