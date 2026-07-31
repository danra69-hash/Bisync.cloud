import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type Company } from '../api';
import { MillstoneLoader } from '../components/shared/MillstoneLoader';
import { OrgCountryProvider } from '../context/OrgCountryContext';
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
import { orgTodayYmd, resolveOrgTimeZoneId } from '../utils/countryTimeZones';

function yearBounds(timeZoneId?: string | null) {
  const y = Number(orgTodayYmd(timeZoneId).slice(0, 4));
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}

/** Standalone mobile Team app at /TEAM — no Bisync shell or platform login. */
export function TeamAppPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalanceRow[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [shiftSchedules, setShiftSchedules] = useState<ShiftSchedule[]>([]);
  const [publicHolidays, setPublicHolidays] = useState<PublicHoliday[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const orgCompany = useMemo(
    () => companies.find(c => /weissbrau/i.test(c.name)) ?? companies[0] ?? null,
    [companies],
  );
  const orgCountryCode = orgCompany?.countryCode ?? 'MY';
  const orgTimeZoneId = resolveOrgTimeZoneId(
    orgCountryCode,
    orgCompany?.stateProvince,
    orgCompany?.timeZoneId,
  );

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
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const companyRows = await api.companies().catch(() => [] as Company[]);
        if (cancelled) return;
        setCompanies(companyRows);
        const preferred = companyRows.find(c => /weissbrau/i.test(c.name)) ?? companyRows[0] ?? null;
        const tz = resolveOrgTimeZoneId(
          preferred?.countryCode ?? 'MY',
          preferred?.stateProvince,
          preferred?.timeZoneId,
        );
        const { from, to } = yearBounds(tz);
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
    <OrgCountryProvider countryCode={orgCountryCode} timeZoneId={orgTimeZoneId}>
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
    </OrgCountryProvider>
  );
}
