import { useCallback, useEffect, useState } from 'react';
import React from 'react';
import { Users, Calendar, FileText, Check, X, Clock, LayoutDashboard, Wallet } from 'lucide-react';
import { hrApi as api } from './api';
import EmployeePortal from './EmployeePortal';
import { PayrollSection } from '../../components/payroll/PayrollSection';
import ShiftScheduleGrid, { initialScheduleWeekStart } from './ShiftScheduleGrid';
import { HrEmployeeConfigSection } from '../../components/admin/HrEmployeeConfigSection';
import type { HrEmployeeConfigTabId } from '../../components/admin/hrConfigTabs';
import type {
  AttendanceRecord, Employee, EmployeeLevel,
  LeaveBalanceRow, LeaveRequest, PublicHoliday, ScheduleType, ShiftSchedule,
} from './types';

// ---------- helpers ----------

const iso = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

// ---------- app ----------

type HrModuleProps = { embedded?: boolean };

export default function HrModule({ embedded = false }: HrModuleProps) {
  const [activeTab, setActiveTab] = useState<'employees' | 'attendance' | 'leave' | 'schedule' | 'portal' | 'payroll'>('employees');
  const [hrConfigTab, setHrConfigTab] = useState<HrEmployeeConfigTabId>('employee');

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalanceRow[]>([]);
  const [shiftSchedules, setShiftSchedules] = useState<ShiftSchedule[]>([]);
  const [publicHolidays, setPublicHolidays] = useState<PublicHoliday[]>([]);
  const [employeeLevels, setEmployeeLevels] = useState<EmployeeLevel[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [attendanceView, setAttendanceView] = useState<'month' | 'week'>('month');
  const [selectedAttendanceEmployee, setSelectedAttendanceEmployee] = useState<Employee | null>(null);

  const [scheduleWeekStart, setScheduleWeekStart] = useState(initialScheduleWeekStart);

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const monthDates = Array.from({ length: daysInMonth }, (_, i) => iso(new Date(currentYear, currentMonth, i + 1)));
  const monthStart = monthDates[0];
  const monthEnd = monthDates[monthDates.length - 1];
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
      const [emps, att, holidays, levels] = await Promise.all([
        api.employees.list(),
        api.attendance.list(monthStart, monthEnd),
        api.holidays.list(),
        api.levels.list(),
      ]);
      setEmployees(emps);
      setAttendance(att);
      setPublicHolidays(holidays);
      setEmployeeLevels(levels);
      await refreshLeave();
      await refreshSchedules();
    });
  }, [run, refreshLeave, refreshSchedules, monthStart, monthEnd]);

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
  });

  // ---------- schedule actions ----------

  const upsertSchedule = (employeeId: number, date: string, type: ScheduleType, startTime?: string) =>
    run(async () => {
      if (type === 'Work' && !startTime) return;
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
    const dates: string[] = [];
    if (attendanceView === 'week') {
      const currentDay = today.getDay();
      const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
      const monday = new Date(today);
      monday.setDate(today.getDate() + mondayOffset);
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        dates.push(iso(d));
      }
    } else {
      const d = new Date(currentYear, currentMonth, 1);
      while (d <= today) {
        dates.push(iso(d));
        d.setDate(d.getDate() + 1);
      }
    }
    return dates;
  };

  const attendanceDates = getAttendanceDates();
  const shiftEmployees = employees.filter(e => employeeIsShift(e));
  const approvedLeaves = leaveRequests.filter(r => r.status === 'Approved');

  const recordFor = (employeeId: number, date: string) =>
    attendance.find(a => a.employeeId === employeeId && a.date === date);

  // ---------- render ----------

  return (
    <>
    <div className={`${embedded ? 'min-h-0' : 'size-full'} bg-herme-cream overflow-auto`}>
      {!embedded && (
        <div className="bg-white border-b border-herme-muted px-8 py-6">
          <h1 className="text-3xl text-herme-ink mb-2">HR Management System</h1>
          <p className="text-gray-600">Manage employees, attendance, and leave requests</p>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className={embedded ? 'px-4' : 'px-8'}>
          <div className="flex gap-4 md:gap-8 overflow-x-auto">
            {([
              ['employees', Users, 'Employee Directory'],
              ['attendance', Calendar, 'Attendance'],
              ['leave', FileText, 'Leave Requests'],
              ['schedule', Clock, 'Schedule'],
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
          <HrEmployeeConfigSection
            tab={hrConfigTab}
            onTabChange={setHrConfigTab}
            onDataChanged={() => {
              void refreshHrConfigData();
              void refreshEmployees();
              void refreshLeave();
            }}
            header={(
              <div>
                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1">Human Resources</p>
                <h2 className="text-lg font-semibold">Employee Directory</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Manage employee records, platform access, holidays, levels, and organizational structure.
                </p>
              </div>
            )}
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
                <div className="text-sm text-gray-600">
                  {today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
              </div>
            </div>

            {/* Shift Employees */}
            <div>
              <h3 className="text-xl text-gray-900 mb-4">Shift Employees</h3>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th rowSpan={2} className="px-4 py-3 text-left text-sm text-gray-700 border-b-2 border-gray-200 sticky left-0 bg-gray-50 z-10">Name</th>
                      {attendanceDates.map((date) => (
                        <th key={date} colSpan={6} className="px-2 py-2 text-center text-sm text-gray-700 border-b border-l border-gray-200">
                          {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </th>
                      ))}
                    </tr>
                    <tr>
                      {attendanceDates.map((date) => (
                        <React.Fragment key={date}>
                          <th className="px-2 py-2 text-center text-xs text-gray-600 border-b border-l border-gray-200">Sched In</th>
                          <th className="px-2 py-2 text-center text-xs text-gray-600 border-b border-gray-200">Act In</th>
                          <th className="px-2 py-2 text-center text-xs text-gray-600 border-b border-gray-200">Sched Out</th>
                          <th className="px-2 py-2 text-center text-xs text-gray-600 border-b border-gray-200">Act Out</th>
                          <th className="px-2 py-2 text-center text-xs text-gray-600 border-b border-gray-200">Hours</th>
                          <th className="px-2 py-2 text-center text-xs text-gray-600 border-b border-gray-200">OT</th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {shiftEmployees.map((employee) => (
                      <tr key={employee.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm sticky left-0 bg-white border-r border-gray-200">
                          <button onClick={() => setSelectedAttendanceEmployee(employee)} className="text-herme hover:text-herme-dark hover:underline">
                            {employee.name}
                          </button>
                        </td>
                        {attendanceDates.map((date) => {
                          const record = recordFor(employee.id, date);
                          if (!record) {
                            return (
                              <React.Fragment key={date}>
                                <td className="px-2 py-3 text-center text-xs text-gray-400 border-l border-gray-200">-</td>
                                <td className="px-2 py-3 text-center text-xs text-gray-400">-</td>
                                <td className="px-2 py-3 text-center text-xs text-gray-400">-</td>
                                <td className="px-2 py-3 text-center text-xs text-gray-400">-</td>
                                <td className="px-2 py-3 text-center text-xs text-gray-400">-</td>
                                <td className="px-2 py-3 text-center text-xs text-gray-400">-</td>
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
                              <td className="px-2 py-3 text-center text-xs text-gray-900 border-l border-gray-200">{si || '-'}</td>
                              <td className="px-2 py-3 text-center text-xs">
                                {record.status === 'Absent' ? <span className="text-red-600">Absent</span> : (
                                  <div className="flex flex-col items-center">
                                    <span className="text-gray-900">{ai || '-'}</span>
                                    {late && <span className="text-red-600">âš </span>}
                                  </div>
                                )}
                              </td>
                              <td className="px-2 py-3 text-center text-xs text-gray-900">{so || '-'}</td>
                              <td className="px-2 py-3 text-center text-xs">
                                {record.status === 'Absent' ? <span className="text-gray-400">-</span> : (
                                  <div className="flex flex-col items-center">
                                    <span className="text-gray-900">{ao || '-'}</span>
                                    {earlyOut && <span className="text-orange-600">âš </span>}
                                  </div>
                                )}
                              </td>
                              <td className="px-2 py-3 text-center text-xs text-gray-900">{hours ? `${hours.actual.toFixed(1)}h` : '-'}</td>
                              <td className="px-2 py-3 text-center text-xs">
                                {hours && hours.overtime > 0 ? <span className="text-herme">{hours.overtime.toFixed(1)}h</span> : <span className="text-gray-400">-</span>}
                              </td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Non-Shift Employees */}
            <div>
              <h3 className="text-xl text-gray-900 mb-4">Non-Shift Employees</h3>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm text-gray-700">Name</th>
                      {attendanceDates.map((date) => (
                        <th key={date} className="px-4 py-3 text-center text-sm text-gray-700">
                          {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {employees.filter(e => !employeeIsShift(e)).map((employee) => (
                      <tr key={employee.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-900">{employee.name}</td>
                        {attendanceDates.map((date) => {
                          const record = recordFor(employee.id, date);
                          return (
                            <td key={date} className="px-4 py-3 text-center text-xs">
                              {record?.status === 'Present' ? <span className="text-green-600">Present</span>
                                : record?.status === 'Absent' ? <span className="text-red-600">Absent</span>
                                : record?.status === 'Late' ? <span className="text-orange-600">Late</span>
                                : record?.status === 'HalfDay' ? <span className="text-herme">Half Day</span>
                                : <span className="text-gray-400">-</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Leave Requests Tab */}
        {activeTab === 'leave' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl text-gray-900">Leave Requests</h2>
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${getStatusColor('Pending')}`}></span>
                  <span className="text-gray-600">Pending: {leaveRequests.filter(r => r.status === 'Pending').length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${getStatusColor('Approved')}`}></span>
                  <span className="text-gray-600">Approved: {leaveRequests.filter(r => r.status === 'Approved').length}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {leaveRequests.map((request) => {
                const balance = leaveBalances.find(b => b.employeeId === request.employeeId);
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
                <div className="overflow-auto flex-1">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-sm text-gray-700">Employee</th>
                        <th className="px-6 py-3 text-center text-sm text-gray-700">RDO</th>
                        <th className="px-6 py-3 text-center text-sm text-gray-700">RPH</th>
                        <th className="px-6 py-3 text-center text-sm text-gray-700">AL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {leaveBalances.map((balance) => (
                        <tr key={balance.employeeId} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm text-gray-900">{balance.employeeName}</td>
                          <td className="px-6 py-4 text-center text-sm text-gray-900">{balance.rdoBalance}</td>
                          <td className="px-6 py-4 text-center text-sm text-gray-900">{balance.rphBalance}</td>
                          <td className="px-6 py-4 text-center text-sm text-gray-900">{balance.alBalance}</td>
                        </tr>
                      ))}
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
                      const leavesOnDate = approvedLeaves.filter(leave => date >= leave.startDate && date <= leave.endDate);
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
          </div>
        )}

        {/* Schedule Tab */}
        {activeTab === 'schedule' && (
          <div>
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-xl text-gray-900">Monthly Shift Schedule</h2>
              <div className="text-xs text-gray-600">{shiftEmployees.length} on shift</div>
            </div>

            {shiftEmployees.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                <p className="text-gray-500">No employees are assigned to shifts. Mark a level as Shift under HR Config â†’ Level & Entitlement.</p>
              </div>
            ) : (
              <ShiftScheduleGrid
                shiftEmployees={shiftEmployees}
                employeeLevels={employeeLevels}
                shiftSchedules={shiftSchedules}
                weekStart={scheduleWeekStart}
                onWeekChange={setScheduleWeekStart}
                onUpsert={upsertSchedule}
                onClear={clearSchedule}
              />
            )}
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

        {activeTab === 'payroll' && <PayrollSection embedded />}
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
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm text-gray-700">Date</th>
                      <th className="px-6 py-3 text-center text-sm text-gray-700">Scheduled In</th>
                      <th className="px-6 py-3 text-center text-sm text-gray-700">Actual In</th>
                      <th className="px-6 py-3 text-center text-sm text-gray-700">Scheduled Out</th>
                      <th className="px-6 py-3 text-center text-sm text-gray-700">Actual Out</th>
                      <th className="px-6 py-3 text-center text-sm text-gray-700">Hours Worked</th>
                      <th className="px-6 py-3 text-center text-sm text-gray-700">Overtime</th>
                      <th className="px-6 py-3 text-center text-sm text-gray-700">Status</th>
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
