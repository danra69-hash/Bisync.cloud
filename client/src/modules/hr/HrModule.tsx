import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import React from 'react';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { useTableSort } from '../../hooks/useTableSort';
import { InfiniteScrollTableSentinel } from '../../components/shared/infiniteScroll';
import { SortableTableHead } from '../../components/shared/SortableTableHead';
import { tableHeaderCls, tableHeaderCompactCls } from '../../components/shared/tableHeaderStyles';
import { sortTableRows, compareSortValues } from '../../utils/tableSort';
import { Users, Calendar, FileText, Check, X, Clock, LayoutDashboard, Wallet, Settings } from 'lucide-react';
import { api as bisyncApi, type AppUser } from '../../api';
import { hrApi as api } from './api';
import EmployeePortal from './EmployeePortal';
import { PayrollSection } from '../../components/payroll/PayrollSection';
import ShiftScheduleGrid, { initialScheduleWeekStart } from './ShiftScheduleGrid';
import { AttendanceDatePicker } from './AttendanceDatePicker';
import { EmployeeTab } from '../../components/admin/EmployeeTab';
import { resolveEmployeeOrg } from '../../components/admin/orgSelectShared';
import { HrEmployeeConfigSection } from '../../components/admin/HrEmployeeConfigSection';
import type { HrConfigTabId } from '../../components/admin/hrConfigTabs';
import type {
  AttendanceRecord, DivisionTreeNode, Employee, EmployeeLevel,
  LeaveBalanceRow, LeaveRequest, PublicHoliday, ScheduleType, ShiftSchedule,
} from './types';

// ---------- helpers ----------

const iso = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const parseIsoLocal = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const formatDayHeader = (s: string) =>
  parseIsoLocal(s).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

const mondayOfWeekFromDate = (date: Date) => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d;
};

/** "09:00:00" -> "09:00" */
const hm = (t?: string | null) => (t ? t.slice(0, 5) : '');

const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

const calcHours = (schedIn: string, schedOut: string, actIn: string, actOut: string) => {
  const scheduled = (toMinutes(schedOut) - toMinutes(schedIn)) / 60;
  const actual = (toMinutes(actOut) - toMinutes(actIn)) / 60;
  return { scheduled, actual, overtime: Math.max(0, actual - scheduled) };
};

const isLate = (schedIn: string, actIn: string) => toMinutes(actIn) > toMinutes(schedIn);
const isEarlyOut = (schedOut: string, actOut: string) => toMinutes(actOut) < toMinutes(schedOut);

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Present': return 'bg-green-100 text-green-800';
    case 'Absent': return 'bg-red-100 text-red-800';
    case 'Late': return 'bg-yellow-100 text-yellow-800';
    case 'HalfDay': return 'bg-herme-soft text-herme-darker';
    case 'Approved': return 'bg-green-100 text-green-800';
    case 'Rejected': return 'bg-red-100 text-red-800';
    case 'Pending': return 'bg-orange-100 text-orange-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getLeaveTypeColor = (type: string) => {
  switch (type) {
    case 'RDO': return 'bg-herme-soft text-herme-darker';
    case 'RPH': return 'bg-purple-100 text-purple-800';
    case 'AL': return 'bg-green-100 text-green-800';
    case 'UPL': return 'bg-gray-100 text-gray-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getLeaveTypeLabel = (type: string) => {
  switch (type) {
    case 'RDO': return 'Replacement Day Off';
    case 'RPH': return 'Replacement Public Holiday';
    case 'AL': return 'Annual Leave';
    case 'UPL': return 'Unpaid Leave';
    default: return type;
  }
};

type AttendanceEmployeeSortColumn = 'name' | `day:${string}`;
type LeaveBalanceSortColumn = 'employee' | 'rdo' | 'rph' | 'al';

const LEAVE_BALANCE_COLUMNS = [
  { key: 'employee' as const, label: 'Employee' },
  { key: 'rdo' as const, label: 'RDO', align: 'center' as const },
  { key: 'rph' as const, label: 'RPH', align: 'center' as const },
  { key: 'al' as const, label: 'AL', align: 'center' as const },
];

// ---------- app ----------

type HrModuleProps = { embedded?: boolean; selectedCompanyId?: number | null };

export default function HrModule({ embedded = false, selectedCompanyId = null }: HrModuleProps) {
  const [activeTab, setActiveTab] = useState<'employees' | 'attendance' | 'leave' | 'schedule' | 'hrconfig' | 'portal' | 'payroll'>('employees');
  const [hrConfigTab, setHrConfigTab] = useState<HrConfigTabId>('ph');

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [platformUsers, setPlatformUsers] = useState<AppUser[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalanceRow[]>([]);
  const [shiftSchedules, setShiftSchedules] = useState<ShiftSchedule[]>([]);
  const [publicHolidays, setPublicHolidays] = useState<PublicHoliday[]>([]);
  const [employeeLevels, setEmployeeLevels] = useState<EmployeeLevel[]>([]);
  const [orgTree, setOrgTree] = useState<DivisionTreeNode[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [attendanceView, setAttendanceView] = useState<'month' | 'week'>('week');
  const [attendanceAnchorDate, setAttendanceAnchorDate] = useState(() => iso(new Date()));
  const [attendanceCalendarOpen, setAttendanceCalendarOpen] = useState(false);
  const [attendanceCalendarMonth, setAttendanceCalendarMonth] = useState(() => new Date().getMonth());
  const [attendanceCalendarYear, setAttendanceCalendarYear] = useState(() => new Date().getFullYear());
  const [selectedAttendanceEmployee, setSelectedAttendanceEmployee] = useState<Employee | null>(null);
  const shiftAttendanceScrollRef = useRef<HTMLDivElement>(null);
  const nonShiftAttendanceScrollRef = useRef<HTMLDivElement>(null);

  const [scheduleWeekStart, setScheduleWeekStart] = useState(initialScheduleWeekStart);
  const [scheduleDepartmentId, setScheduleDepartmentId] = useState<number | null>(null);

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const monthDates = Array.from({ length: daysInMonth }, (_, i) => iso(new Date(currentYear, currentMonth, i + 1)));
  const yearStart = `${currentYear}-01-01`;
  const yearEnd = `${currentYear}-12-31`;

  const run = useCallback(async (action: () => Promise<void>) => {
    try {
      setError(null);
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const refreshEmployees = useCallback(async () => {
    setEmployees(await api.employees.list());
  }, []);
  const refreshLeave = useCallback(async () => {
    const [reqs, bals] = await Promise.all([api.leaveRequests.list(), api.leaveBalances.list()]);
    setLeaveRequests(reqs);
    setLeaveBalances(bals);
  }, []);
  const refreshSchedules = useCallback(async () => setShiftSchedules(await api.schedules.list(yearStart, yearEnd)), [yearStart, yearEnd]);

  const refreshHrConfigData = useCallback(async () => {
    setEmployeeLevels(await api.levels.list());
    setPublicHolidays(await api.holidays.list());
  }, []);

  useEffect(() => {
    run(async () => {
      const [emps, users, holidays, levels, tree] = await Promise.all([
        api.employees.list(),
        bisyncApi.users().catch(() => [] as AppUser[]),
        api.holidays.list(),
        api.levels.list(),
        api.org.tree(),
      ]);
      setEmployees(emps);
      setPlatformUsers(users);
      setPublicHolidays(holidays);
      setEmployeeLevels(levels);
      setOrgTree(tree);
      await refreshLeave();
      await refreshSchedules();
    });
  }, [run, refreshLeave, refreshSchedules]);

  const attendanceFetchRange = useMemo(() => {
    const anchor = parseIsoLocal(attendanceAnchorDate);
    if (attendanceView === 'week') {
      const monday = mondayOfWeekFromDate(anchor);
      const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
      return { start: iso(monday), end: iso(sunday) };
    }
    const start = iso(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
    return { start, end: attendanceAnchorDate };
  }, [attendanceAnchorDate, attendanceView]);

  useEffect(() => {
    run(async () => {
      setAttendance(await api.attendance.list(attendanceFetchRange.start, attendanceFetchRange.end));
    });
  }, [run, attendanceFetchRange.start, attendanceFetchRange.end]);

  const employeeName = (id: number) => employees.find(e => e.id === id)?.name ?? `#${id}`;
  const employeeIsShift = (employee: Employee) => {
    const level = employee.employeeLevel ?? employeeLevels.find(l => l.id === employee.employeeLevelId);
    if (level) return level.isShift;
    return employee.isShiftEmployee;
  };

  // ---------- leave actions ----------

  const handlePortalSubmitLeave = (leave: { employeeId: number; type: import('./types').LeaveType; startDate: string; endDate: string; reason?: string }) =>
    run(async () => {
      await api.leaveRequests.create(leave);
      await refreshLeave();
    });

  const updateLeaveStatus = (id: number, status: 'approved' | 'rejected') => run(async () => {
    if (status === 'approved') await api.leaveRequests.approve(id);
    else await api.leaveRequests.reject(id);
    await refreshLeave();
    await refreshSchedules();
  });

  // ---------- schedule actions ----------

  const upsertSchedule = (employeeId: number, date: string, type: ScheduleType, startTime?: string) =>
    run(async () => {
      if (type === 'Work' && !startTime) return;
      if (type === 'Work') {
        const scheduledLeave = shiftSchedules.find(s => s.employeeId === employeeId && s.date === date && s.type !== 'Work');
        const approvedLeave = companyApprovedLeaves.some(r =>
          r.employeeId === employeeId && date >= r.startDate && date <= r.endDate);
        if (scheduledLeave || approvedLeave) {
          setError('Cannot place a shift while the employee is on leave for this date.');
          return;
        }
      }
      await api.schedules.upsert({ employeeId, date, type, startTime: startTime ? `${startTime}:00` : null });
      await refreshSchedules();
    });

  const clearSchedule = (employeeId: number, date: string) =>
    run(async () => {
      const schedule = shiftSchedules.find((s) => s.employeeId === employeeId && s.date === date);
      if (schedule) {
        await api.schedules.remove(schedule.id);
        await refreshSchedules();
      }
    });

  // ---------- derived ----------

  const getAttendanceDates = () => {
    const anchor = parseIsoLocal(attendanceAnchorDate);
    const dates: string[] = [];
    if (attendanceView === 'week') {
      const monday = mondayOfWeekFromDate(anchor);
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
        dates.push(iso(d));
      }
    } else {
      const d = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      const end = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
      while (d <= end) {
        dates.push(iso(d));
        d.setDate(d.getDate() + 1);
      }
    }
    return dates;
  };

  const attendanceDates = getAttendanceDates();
  const attendanceWeekView = attendanceView === 'week';

  const scrollAttendanceTablesRight = useCallback(() => {
    for (const el of [shiftAttendanceScrollRef.current, nonShiftAttendanceScrollRef.current]) {
      if (el) el.scrollLeft = el.scrollWidth;
    }
  }, []);

  useEffect(() => {
    if (activeTab !== 'attendance') setAttendanceCalendarOpen(false);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'attendance' && attendanceView === 'month') {
      requestAnimationFrame(() => scrollAttendanceTablesRight());
    }
  }, [activeTab, attendanceView, attendanceDates.length, scrollAttendanceTablesRight]);

  const platformUserFor = useCallback(
    (employee: Employee) =>
      platformUsers.find(u => u.employeeId === employee.id)
      ?? platformUsers.find(u => u.email.toLowerCase() === employee.email.toLowerCase()),
    [platformUsers],
  );

  const companyEmployees = useMemo(() => {
    if (!selectedCompanyId) return [];
    return employees.filter(employee => platformUserFor(employee)?.companyId === selectedCompanyId);
  }, [employees, platformUsers, selectedCompanyId, platformUserFor]);

  useEffect(() => {
    if (selectedAttendanceEmployee && !companyEmployees.some(e => e.id === selectedAttendanceEmployee.id)) {
      setSelectedAttendanceEmployee(null);
    }
  }, [companyEmployees, selectedAttendanceEmployee]);

  const shiftEmployees = companyEmployees.filter(e => employeeIsShift(e));
  const nonShiftEmployees = companyEmployees.filter(e => !employeeIsShift(e));

  const {
    sortColumn: shiftAttendanceSortColumn,
    sortDirection: shiftAttendanceSortDirection,
    toggleSort: toggleShiftAttendanceSort,
    resetSort: resetShiftAttendanceSort,
  } = useTableSort<AttendanceEmployeeSortColumn>();
  const {
    sortColumn: nonShiftAttendanceSortColumn,
    sortDirection: nonShiftAttendanceSortDirection,
    toggleSort: toggleNonShiftAttendanceSort,
    resetSort: resetNonShiftAttendanceSort,
  } = useTableSort<AttendanceEmployeeSortColumn>();
  const {
    sortColumn: leaveBalanceSortColumn,
    sortDirection: leaveBalanceSortDirection,
    toggleSort: toggleLeaveBalanceSort,
    resetSort: resetLeaveBalanceSort,
  } = useTableSort<LeaveBalanceSortColumn>();

  useEffect(() => {
    resetShiftAttendanceSort();
    resetNonShiftAttendanceSort();
  }, [
    selectedCompanyId,
    attendanceView,
    attendanceAnchorDate,
    resetShiftAttendanceSort,
    resetNonShiftAttendanceSort,
  ]);

  useEffect(() => {
    resetLeaveBalanceSort();
  }, [selectedCompanyId, resetLeaveBalanceSort]);

  const shiftAttendanceDaySort = shiftAttendanceSortColumn?.startsWith('day:')
    ? shiftAttendanceSortColumn.slice(4)
    : null;
  const nonShiftAttendanceDaySort = nonShiftAttendanceSortColumn?.startsWith('day:')
    ? nonShiftAttendanceSortColumn.slice(4)
    : null;

  const shiftAttendanceSortAccessors = useMemo(
    () => ({
      name: (employee: Employee) => employee.name,
      ...(shiftAttendanceDaySort
        ? {
            [`day:${shiftAttendanceDaySort}`]: (employee: Employee) => {
              const record = attendance.find(a => a.employeeId === employee.id && a.date === shiftAttendanceDaySort);
              if (!record) return '';
              const si = hm(record.scheduledIn);
              const so = hm(record.scheduledOut);
              const ai = hm(record.actualIn);
              const ao = hm(record.actualOut);
              if (si && so && ai && ao) return calcHours(si, so, ai, ao).actual;
              return record.status;
            },
          }
        : {}),
    }),
    [shiftAttendanceDaySort, attendance],
  );

  const nonShiftAttendanceSortAccessors = useMemo(
    () => ({
      name: (employee: Employee) => employee.name,
      ...(nonShiftAttendanceDaySort
        ? {
            [`day:${nonShiftAttendanceDaySort}`]: (employee: Employee) => {
              const record = attendance.find(a => a.employeeId === employee.id && a.date === nonShiftAttendanceDaySort);
              return record?.status ?? '';
            },
          }
        : {}),
    }),
    [nonShiftAttendanceDaySort, attendance],
  );

  const sortedShiftEmployees = useMemo(
    () =>
      sortTableRows(
        shiftEmployees,
        shiftAttendanceSortColumn,
        shiftAttendanceSortDirection,
        shiftAttendanceSortAccessors,
        { tieBreaker: (a, b) => compareSortValues(a.name, b.name) },
      ),
    [shiftEmployees, shiftAttendanceSortColumn, shiftAttendanceSortDirection, shiftAttendanceSortAccessors],
  );
  const sortedNonShiftEmployees = useMemo(
    () =>
      sortTableRows(
        nonShiftEmployees,
        nonShiftAttendanceSortColumn,
        nonShiftAttendanceSortDirection,
        nonShiftAttendanceSortAccessors,
        { tieBreaker: (a, b) => compareSortValues(a.name, b.name) },
      ),
    [nonShiftEmployees, nonShiftAttendanceSortColumn, nonShiftAttendanceSortDirection, nonShiftAttendanceSortAccessors],
  );

  const companyEmployeeIds = useMemo(
    () => new Set(companyEmployees.map(e => e.id)),
    [companyEmployees],
  );

  const companyLeaveRequests = useMemo(
    () => leaveRequests.filter(r => companyEmployeeIds.has(r.employeeId)),
    [leaveRequests, companyEmployeeIds],
  );

  const companyLeaveBalances = useMemo(
    () => leaveBalances.filter(b => companyEmployeeIds.has(b.employeeId)),
    [leaveBalances, companyEmployeeIds],
  );

  const sortedCompanyLeaveBalances = useMemo(
    () =>
      sortTableRows(
        companyLeaveBalances,
        leaveBalanceSortColumn,
        leaveBalanceSortDirection,
        {
          employee: row => row.employeeName,
          rdo: row => row.rdoBalance,
          rph: row => row.rphBalance,
          al: row => row.alBalance,
        },
        { tieBreaker: (a, b) => compareSortValues(a.employeeName, b.employeeName) },
      ),
    [companyLeaveBalances, leaveBalanceSortColumn, leaveBalanceSortDirection],
  );

  const shiftEmployeesScroll = useInfiniteScrollSlice(sortedShiftEmployees, { scrollRootRef: shiftAttendanceScrollRef });
  const nonShiftEmployeesScroll = useInfiniteScrollSlice(sortedNonShiftEmployees, { scrollRootRef: nonShiftAttendanceScrollRef });
  const leaveBalanceScrollRef = useRef<HTMLDivElement>(null);
  const leaveBalancesScroll = useInfiniteScrollSlice(sortedCompanyLeaveBalances, { scrollRootRef: leaveBalanceScrollRef });
  const shiftAttendanceColSpan = 1 + attendanceDates.length * 4;
  const nonShiftAttendanceColSpan = 1 + attendanceDates.length;

  const companyApprovedLeaves = useMemo(
    () => companyLeaveRequests.filter(r => r.status === 'Approved'),
    [companyLeaveRequests],
  );

  const saveScheduleBatch = (changes: import('./types').ScheduleBatchChange[]) =>
    run(async () => {
      for (const change of changes) {
        if (change.action === 'clear') {
          const schedule = shiftSchedules.find(
            (s) => s.employeeId === change.employeeId && s.date === change.date,
          );
          if (schedule) await api.schedules.remove(schedule.id);
          continue;
        }

        if (change.type === 'Work') {
          const scheduledLeave = shiftSchedules.find(
            (s) =>
              s.employeeId === change.employeeId &&
              s.date === change.date &&
              s.type !== 'Work',
          );
          const approvedLeave = companyApprovedLeaves.some(
            (r) =>
              r.employeeId === change.employeeId &&
              change.date >= r.startDate &&
              change.date <= r.endDate,
          );
          if (scheduledLeave || approvedLeave) {
            setError('Cannot place a shift while the employee is on leave for this date.');
            return;
          }
        }

        await api.schedules.upsert({
          employeeId: change.employeeId,
          date: change.date,
          type: change.type,
          startTime: change.startTime ? `${change.startTime}:00` : null,
        });
      }
      await refreshSchedules();
    });

  const companyShiftSchedules = useMemo(
    () => shiftSchedules.filter(s => companyEmployeeIds.has(s.employeeId)),
    [shiftSchedules, companyEmployeeIds],
  );

  const scheduleDepartments = useMemo(() => {
    const departments = orgTree.flatMap(d => d.departments);
    return [...departments].sort((a, b) => a.name.localeCompare(b.name));
  }, [orgTree]);

  const employeeInDepartment = useCallback((employee: Employee, departmentId: number | null) => {
    if (!departmentId) return true;
    return resolveEmployeeOrg(employee, orgTree).departmentId === departmentId;
  }, [orgTree]);

  const scheduleShiftEmployees = useMemo(
    () => shiftEmployees.filter(e => employeeInDepartment(e, scheduleDepartmentId)),
    [shiftEmployees, scheduleDepartmentId, employeeInDepartment],
  );

  const scheduleShiftSchedules = useMemo(
    () => companyShiftSchedules.filter(s => {
      const employee = employees.find(e => e.id === s.employeeId);
      return employee ? employeeInDepartment(employee, scheduleDepartmentId) : false;
    }),
    [companyShiftSchedules, employees, scheduleDepartmentId, employeeInDepartment],
  );

  useEffect(() => {
    setScheduleDepartmentId(null);
  }, [selectedCompanyId]);

  const recordFor = (employeeId: number, date: string) =>
    attendance.find(a => a.employeeId === employeeId && a.date === date);

  const openAttendanceCalendar = () => {
    const anchor = parseIsoLocal(attendanceAnchorDate);
    setAttendanceCalendarMonth(anchor.getMonth());
    setAttendanceCalendarYear(anchor.getFullYear());
    setAttendanceCalendarOpen(true);
  };

  const handleAttendanceDateSelect = (date: string) => {
    setAttendanceAnchorDate(date);
    setAttendanceCalendarOpen(false);
  };

  const attendanceDateLabel = parseIsoLocal(attendanceAnchorDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // ---------- render ----------

  return (
    <>
    <div className={`${embedded ? 'flex-1 min-h-[calc(100vh-5.5rem)]' : 'size-full'} bg-herme-cream overflow-auto flex flex-col`}>
      {!embedded && (
        <div className="bg-white border-b border-herme-muted px-8 py-6">
          <h1 className="text-3xl text-herme-ink mb-2">HR Management System</h1>
          <p className="text-gray-600">Manage employees, attendance, and leave requests</p>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className={embedded ? 'px-4' : 'px-8'}>
          <div className="flex gap-4 md:gap-8 ">
            {([
              ['employees', Users, 'Employee Directory'],
              ['attendance', Calendar, 'Attendance'],
              ['leave', FileText, 'Leave Requests'],
              ['schedule', Clock, 'Schedule'],
              ['hrconfig', Settings, 'HR Config'],
              ['portal', LayoutDashboard, 'Employee Portal'],
              ['payroll', Wallet, 'Payroll'],
            ] as const).map(([tab, Icon, label]) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-2 px-4 py-4 border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-herme text-herme'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className={`${embedded ? 'mx-4' : 'mx-8'} mt-4 px-4 py-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm flex justify-between`}>
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">Ã—</button>
        </div>
      )}

      <div className={embedded ? 'p-4' : 'p-8'}>
        {/* Employees Tab */}
        {activeTab === 'employees' && (
          <EmployeeTab
            selectedCompanyId={selectedCompanyId}
            onDataChanged={() => {
              void refreshHrConfigData();
              void refreshEmployees();
              void refreshLeave();
            }}
          />
        )}

        {activeTab === 'hrconfig' && (
          <HrEmployeeConfigSection
            tab={hrConfigTab}
            onTabChange={setHrConfigTab}
            selectedCompanyId={selectedCompanyId}
            onDataChanged={() => {
              void refreshHrConfigData();
              void refreshEmployees();
              void refreshLeave();
            }}
          />
        )}

        {/* Attendance Tab */}
        {activeTab === 'attendance' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl text-gray-900">Attendance</h2>
              <div className="flex items-center gap-4">
                <div className="flex gap-2">
                  <button
                    onClick={() => setAttendanceView('week')}
                    className={`px-4 py-2 rounded-lg text-sm transition-colors ${attendanceView === 'week' ? 'bg-herme text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                  >
                    Week to Date
                  </button>
                  <button
                    onClick={() => setAttendanceView('month')}
                    className={`px-4 py-2 rounded-lg text-sm transition-colors ${attendanceView === 'month' ? 'bg-herme text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                  >
                    Month to Date
                  </button>
                </div>
                <div className="relative">
                  <button
                    type="button"
                    onClick={openAttendanceCalendar}
                    className="text-sm text-gray-600 hover:text-herme border-b border-dotted border-gray-400 hover:border-herme transition-colors"
                  >
                    {attendanceDateLabel}
                  </button>
                  {attendanceCalendarOpen && (
                    <AttendanceDatePicker
                      selectedDate={attendanceAnchorDate}
                      viewMode={attendanceView}
                      viewMonth={attendanceCalendarMonth}
                      viewYear={attendanceCalendarYear}
                      onViewMonthChange={(month, year) => {
                        setAttendanceCalendarMonth(month);
                        setAttendanceCalendarYear(year);
                      }}
                      onSelect={handleAttendanceDateSelect}
                      onClose={() => setAttendanceCalendarOpen(false)}
                    />
                  )}
                </div>
              </div>
            </div>

            {selectedCompanyId && (
            <>
            {/* Shift Employees */}
            <div>
              <h3 className="text-xl text-gray-900 mb-4">Shift Employees</h3>
              <div
                ref={shiftAttendanceScrollRef}
                className={`bg-white rounded-lg shadow-sm border border-gray-200 ${attendanceWeekView ? '' : ''}`}
              >
                <table className="w-full table-fixed">
                  <thead className="bg-gray-50">
                    <tr>
                      <SortableTableHead
                        rowSpan={2}
                        label="Name"
                        column="name"
                        sortColumn={shiftAttendanceSortColumn}
                        sortDirection={shiftAttendanceSortDirection}
                        onSort={toggleShiftAttendanceSort}
                        className={`px-2 py-2 text-xs text-gray-700 border-b-2 border-r border-gray-200 ${attendanceWeekView ? 'w-[11%]' : 'sticky left-0 z-10 bg-gray-50'}`}
                      />
                      {attendanceDates.map((date) => (
                        <SortableTableHead
                          key={date}
                          colSpan={4}
                          label={formatDayHeader(date)}
                          column={`day:${date}`}
                          sortColumn={shiftAttendanceSortColumn}
                          sortDirection={shiftAttendanceSortDirection}
                          onSort={toggleShiftAttendanceSort}
                          className={`px-0.5 py-1.5 text-center text-[11px] text-gray-700 border-b border-l border-gray-200 ${attendanceWeekView ? '' : ''}`}
                          align="center"
                        />
                      ))}
                    </tr>
                    <tr>
                      {attendanceDates.map((date) => (
                        <React.Fragment key={date}>
                          <th className={tableHeaderCompactCls('center', 'px-0.5 border-b border-l border-gray-200 text-gray-600')}>In</th>
                          <th className={tableHeaderCompactCls('center', 'px-0.5 border-b border-gray-200 text-gray-600')}>Out</th>
                          <th className={tableHeaderCompactCls('center', 'px-0.5 border-b border-gray-200 text-gray-600')}>Hrs</th>
                          <th className={tableHeaderCompactCls('center', 'px-0.5 border-b border-gray-200 text-gray-600')}>OT</th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {shiftEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={1 + attendanceDates.length * 4} className="px-4 py-6 text-center text-sm text-gray-500">
                          No shift employees for this company.
                        </td>
                      </tr>
                    ) : shiftEmployeesScroll.visibleItems.map((employee) => (
                      <tr key={employee.id} className="hover:bg-gray-50">
                        <td className={`px-2 py-2 text-xs text-gray-900 border-r border-gray-200 truncate ${attendanceWeekView ? '' : 'sticky left-0 z-10 bg-white'}`}>
                          <button onClick={() => setSelectedAttendanceEmployee(employee)} className="text-herme hover:text-herme-dark hover:underline text-left truncate max-w-full">
                            {employee.name}
                          </button>
                        </td>
                        {attendanceDates.map((date) => {
                          const record = recordFor(employee.id, date);
                          if (!record) {
                            return (
                              <React.Fragment key={date}>
                                <td className="px-0.5 py-1.5 text-center text-xs text-gray-400 border-l border-gray-200">-</td>
                                <td className="px-0.5 py-1.5 text-center text-xs text-gray-400">-</td>
                                <td className="px-0.5 py-1.5 text-center text-xs text-gray-400">-</td>
                                <td className="px-0.5 py-1.5 text-center text-xs text-gray-400">-</td>
                              </React.Fragment>
                            );
                          }
                          const si = hm(record.scheduledIn), so = hm(record.scheduledOut);
                          const ai = hm(record.actualIn), ao = hm(record.actualOut);
                          const hours = si && so && ai && ao ? calcHours(si, so, ai, ao) : null;
                          const late = si && ai ? isLate(si, ai) : false;
                          const earlyOut = so && ao ? isEarlyOut(so, ao) : false;
                          return (
                            <React.Fragment key={date}>
                              <td className="px-0.5 py-1.5 text-center text-xs border-l border-gray-200 leading-tight">
                                {record.status === 'Absent' ? (
                                  <span className="text-red-600">Absent</span>
                                ) : (
                                  <>
                                    <div className="text-gray-500">{si || '-'}</div>
                                    <div className={late ? 'text-red-600' : 'text-gray-900'}>{ai || '-'}</div>
                                  </>
                                )}
                              </td>
                              <td className="px-0.5 py-1.5 text-center text-xs leading-tight">
                                {record.status === 'Absent' ? (
                                  <span className="text-gray-400">-</span>
                                ) : (
                                  <>
                                    <div className="text-gray-500">{so || '-'}</div>
                                    <div className={earlyOut ? 'text-orange-600' : 'text-gray-900'}>{ao || '-'}</div>
                                  </>
                                )}
                              </td>
                              <td className="px-0.5 py-1.5 text-center text-xs text-gray-900">{hours ? `${hours.actual.toFixed(1)}` : '-'}</td>
                              <td className="px-0.5 py-1.5 text-center text-xs">
                                {hours && hours.overtime > 0 ? <span className="text-herme">{hours.overtime.toFixed(1)}</span> : <span className="text-gray-400">-</span>}
                              </td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    ))}
                    <InfiniteScrollTableSentinel colSpan={shiftAttendanceColSpan} hasMore={shiftEmployeesScroll.hasMore} onLoadMore={shiftEmployeesScroll.loadMore} nextPageSize={shiftEmployeesScroll.nextPageSize} sentinelRef={shiftEmployeesScroll.sentinelRef} totalCount={shiftEmployeesScroll.totalCount} visibleCount={shiftEmployeesScroll.visibleCount} />
                  </tbody>
                </table>
              </div>
            </div>

            {/* Non-Shift Employees */}
            <div>
              <h3 className="text-xl text-gray-900 mb-4">Non-Shift Employees</h3>
              <div
                ref={nonShiftAttendanceScrollRef}
                className={`bg-white rounded-lg shadow-sm border border-gray-200 ${attendanceWeekView ? '' : ''}`}
              >
                <table className="w-full table-fixed">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <SortableTableHead
                        label="Name"
                        column="name"
                        sortColumn={nonShiftAttendanceSortColumn}
                        sortDirection={nonShiftAttendanceSortDirection}
                        onSort={toggleNonShiftAttendanceSort}
                        className={`px-2 py-2 text-xs text-gray-700 border-r border-gray-200 ${attendanceWeekView ? 'w-[11%]' : 'sticky left-0 z-10 bg-gray-50'}`}
                      />
                      {attendanceDates.map((date) => (
                        <SortableTableHead
                          key={date}
                          label={formatDayHeader(date)}
                          column={`day:${date}`}
                          sortColumn={nonShiftAttendanceSortColumn}
                          sortDirection={nonShiftAttendanceSortDirection}
                          onSort={toggleNonShiftAttendanceSort}
                          className={`px-0.5 py-2 text-center text-[11px] text-gray-700 border-l border-gray-200 ${attendanceWeekView ? '' : ''}`}
                          align="center"
                        />
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {nonShiftEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={1 + attendanceDates.length} className="px-4 py-6 text-center text-sm text-gray-500">
                          No non-shift employees for this company.
                        </td>
                      </tr>
                    ) : nonShiftEmployeesScroll.visibleItems.map((employee) => (
                      <tr key={employee.id} className="hover:bg-gray-50">
                        <td className={`px-2 py-2 text-xs text-gray-900 border-r border-gray-200 truncate ${attendanceWeekView ? '' : 'sticky left-0 z-10 bg-white'}`}>{employee.name}</td>
                        {attendanceDates.map((date) => {
                          const record = recordFor(employee.id, date);
                          return (
                            <td key={date} className="px-0.5 py-2 text-center text-xs border-l border-gray-200">
                              {record?.status === 'Present' ? <span className="text-green-600">P</span>
                                : record?.status === 'Absent' ? <span className="text-red-600">A</span>
                                : record?.status === 'Late' ? <span className="text-orange-600">L</span>
                                : record?.status === 'HalfDay' ? <span className="text-herme">½</span>
                                : <span className="text-gray-400">-</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    <InfiniteScrollTableSentinel colSpan={nonShiftAttendanceColSpan} hasMore={nonShiftEmployeesScroll.hasMore} onLoadMore={nonShiftEmployeesScroll.loadMore} nextPageSize={nonShiftEmployeesScroll.nextPageSize} sentinelRef={nonShiftEmployeesScroll.sentinelRef} totalCount={nonShiftEmployeesScroll.totalCount} visibleCount={nonShiftEmployeesScroll.visibleCount} />
                  </tbody>
                </table>
              </div>
            </div>
            </>
            )}
          </div>
        )}

        {/* Leave Requests Tab */}
        {activeTab === 'leave' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl text-gray-900">Leave Requests</h2>
              {selectedCompanyId && (
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${getStatusColor('Pending')}`}></span>
                  <span className="text-gray-600">Pending: {companyLeaveRequests.filter(r => r.status === 'Pending').length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${getStatusColor('Approved')}`}></span>
                  <span className="text-gray-600">Approved: {companyLeaveRequests.filter(r => r.status === 'Approved').length}</span>
                </div>
              </div>
              )}
            </div>

            {selectedCompanyId && (
            <>
            <div className="space-y-4">
              {companyLeaveRequests.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-500">
                  No leave requests for this company.
                </div>
              ) : companyLeaveRequests.map((request) => {
                const balance = companyLeaveBalances.find(b => b.employeeId === request.employeeId);
                const days = Math.ceil((new Date(request.endDate).getTime() - new Date(request.startDate).getTime()) / 86400000) + 1;
                return (
                  <div key={request.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg text-gray-900">{employeeName(request.employeeId)}</h3>
                          <span className={`inline-flex px-3 py-1 rounded-full text-xs ${getStatusColor(request.status)}`}>{request.status}</span>
                          <span className={`inline-flex px-3 py-1 rounded-full text-xs ${getLeaveTypeColor(request.type)}`}>{getLeaveTypeLabel(request.type)}</span>
                        </div>
                        <div className="grid grid-cols-4 gap-4 mb-3">
                          <div>
                            <span className="text-sm text-gray-600">Start Date:</span>
                            <span className="ml-2 text-sm text-gray-900">{request.startDate}</span>
                          </div>
                          <div>
                            <span className="text-sm text-gray-600">End Date:</span>
                            <span className="ml-2 text-sm text-gray-900">{request.endDate}</span>
                          </div>
                          <div>
                            <span className="text-sm text-gray-600">Days Requested:</span>
                            <span className="ml-2 text-sm text-gray-900">{days} day{days > 1 ? 's' : ''}</span>
                          </div>
                          {balance && request.type !== 'UPL' && (
                            <div>
                              <span className="text-sm text-gray-600">Balance:</span>
                              <span className="ml-2 text-sm text-gray-900">
                                {request.type === 'RDO' && `${balance.rdoBalance} days`}
                                {request.type === 'RPH' && `${balance.rphBalance} days`}
                                {request.type === 'AL' && `${balance.alBalance} days`}
                              </span>
                            </div>
                          )}
                        </div>
                        {request.type === 'UPL' && request.reason && (
                          <div>
                            <span className="text-sm text-gray-600">Reason:</span>
                            <p className="text-sm text-gray-900 mt-1">{request.reason}</p>
                          </div>
                        )}
                      </div>
                      {request.status === 'Pending' && (
                        <div className="flex gap-2 ml-4">
                          <button onClick={() => updateLeaveStatus(request.id, 'approved')} className="flex items-center gap-1 bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition-colors">
                            <Check className="w-4 h-4" />
                            Approve
                          </button>
                          <button onClick={() => updateLeaveStatus(request.id, 'rejected')} className="flex items-center gap-1 bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 transition-colors">
                            <X className="w-4 h-4" />
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* Leave Balance Summary */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col">
                <h3 className="text-lg text-gray-900 mb-4">Leave Balance Summary</h3>
                <div ref={leaveBalanceScrollRef} className="overflow-auto flex-1 max-h-[calc(100vh-12rem)]">
                  <table className="w-full table-fixed">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        {LEAVE_BALANCE_COLUMNS.map(column => (
                          <SortableTableHead
                            key={column.key}
                            label={column.label}
                            column={column.key}
                            sortColumn={leaveBalanceSortColumn}
                            sortDirection={leaveBalanceSortDirection}
                            onSort={toggleLeaveBalanceSort}
                            className={`px-6 py-3 text-sm text-gray-700 ${column.align === 'center' ? 'text-center' : 'text-left'}`}
                            align={column.align === 'center' ? 'center' : 'left'}
                          />
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {leaveBalancesScroll.visibleItems.map((balance) => (
                        <tr key={balance.employeeId} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm text-gray-900">{balance.employeeName}</td>
                          <td className="px-6 py-4 text-center text-sm text-gray-900">{balance.rdoBalance}</td>
                          <td className="px-6 py-4 text-center text-sm text-gray-900">{balance.rphBalance}</td>
                          <td className="px-6 py-4 text-center text-sm text-gray-900">{balance.alBalance}</td>
                        </tr>
                      ))}
                      <InfiniteScrollTableSentinel colSpan={4} hasMore={leaveBalancesScroll.hasMore} onLoadMore={leaveBalancesScroll.loadMore} nextPageSize={leaveBalancesScroll.nextPageSize} sentinelRef={leaveBalancesScroll.sentinelRef} totalCount={leaveBalancesScroll.totalCount} visibleCount={leaveBalancesScroll.visibleCount} />
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Calendar View */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col">
                <h3 className="text-lg text-gray-900 mb-4">
                  Leave Calendar - {new Date(currentYear, currentMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h3>
                <div className="flex gap-4 mb-4 text-xs flex-wrap">
                  {(['RDO', 'RPH', 'AL', 'UPL'] as const).map(t => (
                    <div key={t} className="flex items-center gap-2">
                      <span className={`w-4 h-4 rounded border ${getLeaveTypeColor(t)}`}></span>
                      <span className="text-gray-600">{t}</span>
                    </div>
                  ))}
                </div>
                <div className="flex-1 overflow-auto">
                  <div className="grid grid-cols-7 gap-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                      <div key={day} className="text-center text-sm text-gray-700 py-2">{day}</div>
                    ))}
                    {Array.from({ length: new Date(currentYear, currentMonth, 1).getDay() }).map((_, i) => (
                      <div key={`empty-${i}`} className="aspect-square"></div>
                    ))}
                    {monthDates.map((date) => {
                      const leavesOnDate = companyApprovedLeaves.filter(leave => date >= leave.startDate && date <= leave.endDate);
                      return (
                        <div key={date} className="aspect-square border border-gray-200 rounded p-1 hover:bg-gray-50">
                          <div className="text-sm text-gray-900 mb-1">{new Date(date).getDate()}</div>
                          <div className="space-y-1">
                            {leavesOnDate.map((leave) => (
                              <div
                                key={leave.id}
                                className={`text-xs px-1 rounded truncate ${getLeaveTypeColor(leave.type)}`}
                                title={`${employeeName(leave.employeeId)} - ${getLeaveTypeLabel(leave.type)}`}
                              >
                                {employeeName(leave.employeeId).split(' ')[0]} ({leave.type})
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            </>
            )}
          </div>
        )}

        {/* Schedule Tab */}
        {activeTab === 'schedule' && (
          <div>
            <div className="mb-3">
              <h2 className="text-xl text-gray-900">Monthly Shift Schedule</h2>
            </div>

            {selectedCompanyId && (shiftEmployees.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                <p className="text-gray-500">No shift employees for this company. Mark a level as Shift under HR Config → Level & Entitlement.</p>
              </div>
            ) : (
              <ShiftScheduleGrid
                shiftEmployees={scheduleShiftEmployees}
                employeeLevels={employeeLevels}
                shiftSchedules={scheduleShiftSchedules}
                approvedLeaveRequests={companyApprovedLeaves}
                weekStart={scheduleWeekStart}
                onWeekChange={setScheduleWeekStart}
                onUpsert={upsertSchedule}
                onClear={clearSchedule}
                onSaveBatch={saveScheduleBatch}
                departments={scheduleDepartments}
                selectedDepartmentId={scheduleDepartmentId}
                onDepartmentChange={setScheduleDepartmentId}
              />
            ))}
          </div>
        )}


        {activeTab === 'portal' && (
          <EmployeePortal
            employees={employees}
            leaveBalances={leaveBalances}
            leaveRequests={leaveRequests}
            shiftSchedules={shiftSchedules}
            publicHolidays={publicHolidays}
            onSubmitLeave={handlePortalSubmitLeave}
          />
        )}

        {activeTab === 'payroll' && <PayrollSection embedded selectedCompanyId={selectedCompanyId} />}
      </div>
    </div>

    {/* Attendance Detail Modal */}
    {selectedAttendanceEmployee && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 flex justify-between items-start z-10">
            <div>
              <h2 className="text-2xl text-gray-900">{selectedAttendanceEmployee.name}</h2>
              <p className="text-gray-600">{selectedAttendanceEmployee.position} - {selectedAttendanceEmployee.department}</p>
              <p className="text-sm text-gray-500">{attendanceView === 'week' ? 'Week to Date' : 'Month to Date'} Attendance Detail</p>
            </div>
            <button onClick={() => setSelectedAttendanceEmployee(null)} className="text-gray-400 hover:text-gray-600 text-2xl">Ã—</button>
          </div>

          <div className="p-8 space-y-6">
            <div>
              <h3 className="text-xl text-gray-900 mb-4">Summary</h3>
              <div className="grid grid-cols-4 gap-4">
                {(() => {
                  const records = attendance.filter(a => a.employeeId === selectedAttendanceEmployee.id && attendanceDates.includes(a.date));
                  const presentDays = records.filter(r => r.status === 'Present' || r.status === 'Late').length;
                  const absentDays = records.filter(r => r.status === 'Absent').length;
                  const lateDays = records.filter(r => hm(r.scheduledIn) && hm(r.actualIn) && isLate(hm(r.scheduledIn), hm(r.actualIn))).length;
                  let totalHours = 0, totalOvertime = 0;
                  records.forEach(r => {
                    const si = hm(r.scheduledIn), so = hm(r.scheduledOut), ai = hm(r.actualIn), ao = hm(r.actualOut);
                    if (si && so && ai && ao) {
                      const h = calcHours(si, so, ai, ao);
                      totalHours += h.actual;
                      totalOvertime += h.overtime;
                    }
                  });
                  return (
                    <>
                      <div className="bg-herme-light rounded-lg shadow-sm border border-herme-muted p-4">
                        <div className="text-sm text-herme-dark mb-1">Total Days</div>
                        <div className="text-3xl text-herme-darker">{records.length}</div>
                      </div>
                      <div className="bg-green-50 rounded-lg shadow-sm border border-green-200 p-4">
                        <div className="text-sm text-green-700 mb-1">Present</div>
                        <div className="text-3xl text-green-900">{presentDays}</div>
                      </div>
                      <div className="bg-red-50 rounded-lg shadow-sm border border-red-200 p-4">
                        <div className="text-sm text-red-700 mb-1">Absent</div>
                        <div className="text-3xl text-red-900">{absentDays}</div>
                      </div>
                      <div className="bg-orange-50 rounded-lg shadow-sm border border-orange-200 p-4">
                        <div className="text-sm text-orange-700 mb-1">Late Days</div>
                        <div className="text-3xl text-orange-900">{lateDays}</div>
                      </div>
                      <div className="bg-purple-50 rounded-lg shadow-sm border border-purple-200 p-4">
                        <div className="text-sm text-purple-700 mb-1">Total Hours</div>
                        <div className="text-3xl text-purple-900">{totalHours.toFixed(1)}h</div>
                      </div>
                      <div className="bg-indigo-50 rounded-lg shadow-sm border border-indigo-200 p-4">
                        <div className="text-sm text-indigo-700 mb-1">Overtime Hours</div>
                        <div className="text-3xl text-indigo-900">{totalOvertime.toFixed(1)}h</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg shadow-sm border border-gray-200 p-4">
                        <div className="text-sm text-gray-700 mb-1">Avg Hours/Day</div>
                        <div className="text-3xl text-gray-900">{presentDays > 0 ? (totalHours / presentDays).toFixed(1) : '0'}h</div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            <div>
              <h3 className="text-xl text-gray-900 mb-4">Detailed Attendance Records</h3>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-auto">
                <table className="w-full table-fixed">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className={tableHeaderCls('left', 'px-6 text-gray-700')}>Date</th>
                      <th className={tableHeaderCls('center', 'px-6 text-gray-700')}>Scheduled In</th>
                      <th className={tableHeaderCls('center', 'px-6 text-gray-700')}>Actual In</th>
                      <th className={tableHeaderCls('center', 'px-6 text-gray-700')}>Scheduled Out</th>
                      <th className={tableHeaderCls('center', 'px-6 text-gray-700')}>Actual Out</th>
                      <th className={tableHeaderCls('center', 'px-6 text-gray-700')}>Hours Worked</th>
                      <th className={tableHeaderCls('center', 'px-6 text-gray-700')}>Overtime</th>
                      <th className={tableHeaderCls('center', 'px-6 text-gray-700')}>Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {attendanceDates.map((date) => {
                      const record = recordFor(selectedAttendanceEmployee.id, date);
                      const dateLabel = new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                      if (!record) {
                        return (
                          <tr key={date} className="hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm text-gray-900">{dateLabel}</td>
                            <td className="px-6 py-4 text-center text-sm text-gray-400" colSpan={7}>No record</td>
                          </tr>
                        );
                      }
                      const si = hm(record.scheduledIn), so = hm(record.scheduledOut), ai = hm(record.actualIn), ao = hm(record.actualOut);
                      const hours = si && so && ai && ao ? calcHours(si, so, ai, ao) : null;
                      const late = si && ai ? isLate(si, ai) : false;
                      const earlyOut = so && ao ? isEarlyOut(so, ao) : false;
                      return (
                        <tr key={date} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm text-gray-900">{dateLabel}</td>
                          <td className="px-6 py-4 text-center text-sm text-gray-900">{si || '-'}</td>
                          <td className="px-6 py-4 text-center text-sm">
                            {record.status === 'Absent' ? <span className="text-red-600">Absent</span> : (
                              <div className="flex items-center justify-center gap-2">
                                <span className="text-gray-900">{ai || '-'}</span>
                                {late && <span className="text-red-600 text-xs">âš  Late</span>}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center text-sm text-gray-900">{so || '-'}</td>
                          <td className="px-6 py-4 text-center text-sm">
                            {record.status === 'Absent' ? <span className="text-gray-400">-</span> : (
                              <div className="flex items-center justify-center gap-2">
                                <span className="text-gray-900">{ao || '-'}</span>
                                {earlyOut && <span className="text-orange-600 text-xs">âš  Early</span>}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center text-sm text-gray-900">{hours ? `${hours.actual.toFixed(2)}h` : '-'}</td>
                          <td className="px-6 py-4 text-center text-sm">
                            {hours && hours.overtime > 0 ? <span className="text-herme">{hours.overtime.toFixed(2)}h</span> : <span className="text-gray-400">-</span>}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex px-3 py-1 rounded-full text-xs ${getStatusColor(record.status)}`}>{record.status}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
