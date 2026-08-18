import { useCallback, useEffect, useState } from 'react';
import { MillstoneLoader } from '../components/shared/MillstoneLoader';
import { hrApi } from '../modules/hr/api';
import TeamPortal from '../modules/hr/TeamPortal';
import type {
  Employee,
  LeaveBalanceRow,
  LeaveRequest,
  LeaveType,
  PublicHoliday,
  ShiftSchedule,
} from '../modules/hr/types';

function yearBounds(d = new Date()) {
  const y = d.getFullYear();
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}

/** Standalone mobile Team app at /TEAM — no Bisync shell or platform login. */
export function TeamAppPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalanceRow[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [shiftSchedules, setShiftSchedules] = useState<ShiftSchedule[]>([]);
  const [publicHolidays, setPublicHolidays] = useState<PublicHoliday[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshLeave = useCallback(async () => {
    const [reqs, bals] = await Promise.all([
      hrApi.leaveRequests.list(),
      hrApi.leaveBalances.list(),
    ]);
    setLeaveRequests(reqs);
    setLeaveBalances(bals);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const { from, to } = yearBounds();
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const [emps, holidays, schedules, reqs, bals] = await Promise.all([
          hrApi.employees.list(),
          hrApi.holidays.list(),
          hrApi.schedules.list(from, to),
          hrApi.leaveRequests.list(),
          hrApi.leaveBalances.list(),
        ]);
        if (cancelled) return;
        setEmployees(emps);
        setPublicHolidays(holidays);
        setShiftSchedules(schedules);
        setLeaveRequests(reqs);
        setLeaveBalances(bals);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load Team.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmitLeave = async (leave: {
    employeeId: number;
    type: LeaveType;
    startDate: string;
    endDate: string;
    reason?: string;
  }) => {
    await hrApi.leaveRequests.create(leave);
    await refreshLeave();
  };

  if (loading) {
    return <MillstoneLoader layout="screen" size="lg" label="Loading Team…" />;
  }

  if (error) {
    return (
      <div className="team-standalone team-standalone-error">
        <p>{error}</p>
        <button type="button" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="team-standalone">
      <TeamPortal
        employees={employees}
        leaveBalances={leaveBalances}
        leaveRequests={leaveRequests}
        shiftSchedules={shiftSchedules}
        publicHolidays={publicHolidays}
        onSubmitLeave={onSubmitLeave}
      />
    </div>
  );
}
