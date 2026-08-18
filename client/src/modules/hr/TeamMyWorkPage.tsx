import { CalendarDays, ChevronLeft, ChevronRight, Camera } from 'lucide-react';
import type { AttendanceRecord, Employee, LeaveBalanceRow, LeaveRequest } from './types';

type DayInfo = { type: string; label: string };

type Props = {
  employee: Employee;
  todayInfo: DayInfo;
  todayAttendance: AttendanceRecord | null;
  nowLabel: string;
  checkLabel: string;
  checkBusy: boolean;
  onStartScanner: () => void;
  leaveBalance: LeaveBalanceRow | null | undefined;
  carryForward: number;
  leaveRequests: LeaveRequest[];
  onOpenLeaveRequest: () => void;
  calYear: number;
  calMonth: number;
  onCalPrev: () => void;
  onCalNext: () => void;
  monthLabel: string;
  monthCells: (Date | null)[];
  getDayInfo: (dateStr: string, emp: Employee) => DayInfo;
  todayKey: string;
  fmt: (d: Date) => string;
  dowLabels: string[];
};

export function TeamMyWorkPage({
  employee,
  todayInfo,
  todayAttendance,
  nowLabel,
  checkLabel,
  checkBusy,
  onStartScanner,
  leaveBalance,
  carryForward,
  leaveRequests,
  onOpenLeaveRequest,
  calYear,
  calMonth,
  onCalPrev,
  onCalNext,
  monthLabel,
  monthCells,
  getDayInfo,
  todayKey,
  fmt,
  dowLabels,
}: Props) {
  const checkedIn = Boolean(todayAttendance?.actualIn);
  const checkedOut = Boolean(todayAttendance?.actualOut);
  const pendingMine = leaveRequests.filter(
    r => r.employeeId === employee.id && r.status === 'Pending',
  );

  return (
    <div className="team-my-work">
      <section className="team-card team-landing-box">
        <header className="team-landing-box-head">
          <h3>My Work</h3>
        </header>

        <div className="team-landing-clock">
          <div>
            <p className="team-muted" style={{ margin: 0, fontSize: 11, fontWeight: 700 }}>
              {todayInfo.label}
            </p>
            <p className="team-clock-time">{nowLabel}</p>
            <p className="team-muted" style={{ margin: '4px 0 0', fontSize: 11 }}>
              {checkedIn
                ? checkedOut
                  ? `In ${todayAttendance?.actualIn ?? '—'} · Out ${todayAttendance?.actualOut ?? '—'}`
                  : `On duty · In ${todayAttendance?.actualIn ?? '—'}`
                : 'Not checked in yet'}
            </p>
          </div>
          <button
            type="button"
            className="team-punch-btn"
            disabled={checkBusy}
            onClick={onStartScanner}
          >
            <Camera size={16} />
            {checkBusy ? '…' : checkLabel}
          </button>
        </div>
      </section>

      <section className="team-card">
        <div className="team-month-head">
          <h3>
            <CalendarDays size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />
            Schedule
          </h3>
          <div className="team-month-nav">
            <button type="button" aria-label="Previous month" onClick={onCalPrev}>
              <ChevronLeft size={14} />
            </button>
            <button type="button" aria-label="Next month" onClick={onCalNext}>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
        <p className="team-muted" style={{ margin: '0 0 8px', fontWeight: 700 }}>{monthLabel}</p>
        <div className="team-month-dows">
          {dowLabels.map((d, i) => <span key={`${d}-${i}`}>{d}</span>)}
        </div>
        <div className="team-month-grid">
          {monthCells.map((cell, idx) => {
            if (!cell) return <div key={`${calYear}-${calMonth}-e-${idx}`} className="team-month-cell is-empty" />;
            const dateStr = fmt(cell);
            const info = getDayInfo(dateStr, employee);
            const isToday = dateStr === todayKey;
            return (
              <div key={`${calYear}-${calMonth}-${idx}`} className={`team-month-cell${isToday ? ' is-today' : ''}`}>
                <span className="day">{cell.getDate()}</span>
                <span className="shift">{info.label}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="team-card">
        <h3>Outstanding leave — {new Date().getFullYear()}</h3>
        <div className="team-leave-row">
          <span>Annual leave</span>
          <strong>
            {leaveBalance?.alBalance ?? 0}
            {carryForward > 0 ? <em> ({carryForward})</em> : null}
          </strong>
        </div>
        <p className="team-muted" style={{ margin: '0 0 6px', fontSize: 10 }}>
          Annual leave is pro-rated for the join year
          {carryForward > 0 ? '; bracket = carry-forward from previous year' : ''}
        </p>
        <div className="team-leave-row">
          <span>RDO</span>
          <strong style={{ fontSize: 15 }}>{leaveBalance?.rdoBalance ?? 0}</strong>
        </div>
        <div className="team-leave-row">
          <span>RPH</span>
          <strong style={{ fontSize: 15 }}>{leaveBalance?.rphBalance ?? 0}</strong>
        </div>
        {pendingMine.length > 0 ? (
          <p className="team-muted" style={{ margin: '8px 0 0', fontSize: 11 }}>
            {pendingMine.length} pending leave request{pendingMine.length === 1 ? '' : 's'}
          </p>
        ) : null}
        <button
          type="button"
          className="team-btn team-btn-primary"
          style={{ marginTop: 12 }}
          onClick={onOpenLeaveRequest}
        >
          Leave request
        </button>
      </section>
    </div>
  );
}
