import { useCallback, useEffect, useState } from 'react';
import React from 'react';
import { Users, Calendar, FileText, Plus, Minus, Edit2, Trash2, Check, X, Clock, Settings, LayoutDashboard } from 'lucide-react';
import { hrApi as api, toEmployeeRequest } from './api';
import { api as bisyncApi, type AppUser } from '../../api';
import { parseUserAccess } from '../../data/userAccess';
import EmployeePortal from './EmployeePortal';
import ShiftScheduleGrid, { initialScheduleWeekStart } from './ShiftScheduleGrid';
import type {
  AttendanceRecord, CompanySetting, CountryOption, DivisionTreeNode, Employee, EmployeeLevel,
  CheckinMethod,
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

const initials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase();

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

const DEFAULT_POS_PIN = '1234';

const CHECKIN_METHODS: CheckinMethod[] = ['POS', 'Biometrics', 'AccessTag'];

const checkinMethodLabel = (method: CheckinMethod) => {
  switch (method) {
    case 'POS': return 'POS';
    case 'Biometrics': return 'Biometrics';
    case 'AccessTag': return 'Access Tag';
  }
};

const emptyEmployeeForm = {
  name: '', email: '', mobile: '', position: '', joinDate: '',
  divisionId: null as number | null,
  departmentId: null as number | null,
  fingerprintEnrolled: false, faceRecognitionEnrolled: false,
  posEnabled: false, bisyncEnabled: false,
  active: true,
  checkinMethod: 'Biometrics' as CheckinMethod,
  employeeLevelId: null as number | null,
  reportsToId: null as number | null,
};

const emptyLevelForm = {
  levelName: '', annualLeaveDays: 0, sickLeaveDays: 0, overtimeEligible: false,
  workingHoursPerDay: 8, breakHoursPerShift: 1, publicHolidayEligible: false,
  isShift: false,
};

const emptyDivisionForm = { name: '', code: '' };
const emptyDepartmentForm = { name: '', divisionId: 0 };

// ---------- app ----------

type HrModuleProps = { embedded?: boolean };

export default function HrModule({ embedded = false }: HrModuleProps) {
  const [activeTab, setActiveTab] = useState<'employees' | 'attendance' | 'leave' | 'schedule' | 'admin' | 'portal'>('employees');

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [platformUsers, setPlatformUsers] = useState<AppUser[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalanceRow[]>([]);
  const [shiftSchedules, setShiftSchedules] = useState<ShiftSchedule[]>([]);
  const [publicHolidays, setPublicHolidays] = useState<PublicHoliday[]>([]);
  const [employeeLevels, setEmployeeLevels] = useState<EmployeeLevel[]>([]);
  const [setting, setSetting] = useState<CompanySetting | null>(null);
  const [countryOptions, setCountryOptions] = useState<CountryOption[]>([]);
  const [changingCountry, setChangingCountry] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [attendanceView, setAttendanceView] = useState<'month' | 'week'>('month');
  const [selectedAttendanceEmployee, setSelectedAttendanceEmployee] = useState<Employee | null>(null);

  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [detailDraft, setDetailDraft] = useState<Employee | null>(null);
  const [formData, setFormData] = useState({ ...emptyEmployeeForm });

  const [showLevelForm, setShowLevelForm] = useState(false);
  const [editingLevel, setEditingLevel] = useState<EmployeeLevel | null>(null);
  const [levelFormData, setLevelFormData] = useState({ ...emptyLevelForm });

  const [holidaysExpanded, setHolidaysExpanded] = useState(false);
  const [orgTree, setOrgTree] = useState<DivisionTreeNode[]>([]);
  const [showDivisionForm, setShowDivisionForm] = useState(false);
  const [editingDivision, setEditingDivision] = useState<DivisionTreeNode | null>(null);
  const [divisionFormData, setDivisionFormData] = useState({ ...emptyDivisionForm });
  const [showDepartmentForm, setShowDepartmentForm] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<{ id: number; name: string; divisionId: number } | null>(null);
  const [departmentFormData, setDepartmentFormData] = useState({ ...emptyDepartmentForm });
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

  useEffect(() => {
    if (activeTab !== 'admin' || countryOptions.length > 0) return;
    run(async () => setCountryOptions(await api.settings.countries()));
  }, [activeTab, countryOptions.length, run]);

  const refreshEmployees = useCallback(async () => {
    const [emps, users] = await Promise.all([
      api.employees.list(),
      bisyncApi.users().catch(() => [] as AppUser[]),
    ]);
    setEmployees(emps);
    setPlatformUsers(users);
  }, []);
  const refreshHolidays = useCallback(async () => setPublicHolidays(await api.holidays.list()), []);
  const refreshOrgTree = useCallback(async () => setOrgTree(await api.org.tree()), []);
  const refreshLeave = useCallback(async () => {
    const [reqs, bals] = await Promise.all([api.leaveRequests.list(), api.leaveBalances.list()]);
    setLeaveRequests(reqs);
    setLeaveBalances(bals);
  }, []);
  const refreshSchedules = useCallback(async () => setShiftSchedules(await api.schedules.list(yearStart, yearEnd)), [yearStart, yearEnd]);

  useEffect(() => {
    run(async () => {
      const [emps, att, holidays, levels, set, users] = await Promise.all([
        api.employees.list(),
        api.attendance.list(monthStart, monthEnd),
        api.holidays.list(),
        api.levels.list(),
        api.settings.get(),
        bisyncApi.users().catch(() => [] as AppUser[]),
      ]);
      setEmployees(emps);
      setPlatformUsers(users);
      setAttendance(att);
      setPublicHolidays(holidays);
      setEmployeeLevels(levels);
      setSetting(set);
      await refreshLeave();
      await refreshSchedules();
      await refreshOrgTree();
    });
  }, [run, refreshLeave, refreshSchedules, refreshOrgTree, monthStart, monthEnd]);

  const employeeName = (id: number) => employees.find(e => e.id === id)?.name ?? `#${id}`;
  const levelName = (id?: number | null) => employeeLevels.find(l => l.id === id)?.levelName;
  const divisionName = (id?: number | null) => orgTree.find(d => d.id === id)?.name ?? '—';
  const employeeDivisionName = (employee: Employee) => {
    if (employee.divisionId) return divisionName(employee.divisionId);
    for (const division of orgTree) {
      if (division.departments.some((d) => d.id === employee.departmentId || d.name === employee.department)) {
        return division.name;
      }
    }
    return '—';
  };
  const departmentName = (employee: Employee) => {
    if (employee.departmentId) {
      for (const division of orgTree) {
        const department = division.departments.find((d) => d.id === employee.departmentId);
        if (department) return department.name;
      }
    }
    return employee.department || '—';
  };
  const employeeIsShift = (employee: Employee) => {
    const level = employee.employeeLevel ?? employeeLevels.find(l => l.id === employee.employeeLevelId);
    if (level) return level.isShift;
    return employee.isShiftEmployee;
  };

  const platformUserFor = (employee: Employee) =>
    platformUsers.find(u => u.employeeId === employee.id)
    ?? platformUsers.find(u => u.email.toLowerCase() === employee.email.toLowerCase());

  const employeeCompanyName = (employee: Employee) => platformUserFor(employee)?.companyName ?? '—';
  const employeeLocationLabel = (employee: Employee) => {
    const names = platformUserFor(employee)?.locationNames;
    if (!names?.length) return '—';
    return names.join(', ');
  };

  // ---------- employee actions ----------

  const openAddEmployeeForm = () => {
    setShowEmployeeForm(true);
    setFormData({ ...emptyEmployeeForm, joinDate: iso(today) });
  };

  const submitEmployeeForm = () => run(async () => {
    const { name, email, mobile, position, joinDate, divisionId, departmentId } = formData;
    const missing: string[] = [];
    if (!name.trim()) missing.push('Full Name');
    if (!email.trim()) missing.push('Email');
    if (!mobile.trim()) missing.push('Mobile Number');
    if (!divisionId) missing.push('Division');
    if (!departmentId) missing.push('Department');
    if (!position.trim()) missing.push('Position');
    if (!joinDate) missing.push('Join Date');
    if (missing.length > 0) {
      setError(`Please fill in required fields: ${missing.join(', ')}.`);
      return;
    }
    await api.employees.create({
      name,
      email,
      mobile,
      divisionId,
      departmentId,
      position,
      joinDate,
      fingerprintEnrolled: false,
      faceRecognitionEnrolled: false,
      isShiftEmployee: false,
      shiftType: null,
      posEnabled: false,
      bisyncEnabled: false,
      active: true,
      checkinMethod: 'Biometrics',
      workingHoursPerDay: 8,
      employeeLevelId: formData.employeeLevelId,
      reportsToId: formData.reportsToId,
      nationality: null,
      idPassportNumber: null,
      dateOfBirth: null,
      personalEmail: null,
      permanentAddress: null,
    });
    setShowEmployeeForm(false);
    setFormData({ ...emptyEmployeeForm });
    await refreshEmployees();
    await refreshLeave();
  });

  const handleDeleteEmployee = (id: number) => run(async () => {
    await api.employees.remove(id);
    await refreshEmployees();
    await refreshLeave();
  });

  const resetPosPin = () => run(async () => {
    if (!detailDraft) return;
    const updated = await api.employees.resetPosPin(detailDraft.id);
    setDetailDraft(updated);
    setSelectedEmployee(updated);
    await refreshEmployees();
  });

  const openEmployeeDetail = (id: number) => run(async () => {
    const emp = await api.employees.get(id);
    setSelectedEmployee(emp);
    setDetailDraft(emp);
  });

  const closeEmployeeDetail = () => {
    setSelectedEmployee(null);
    setDetailDraft(null);
  };

  const saveEmployeeDetail = () => run(async () => {
    if (!detailDraft) return;
    const saved = await api.employees.update(detailDraft.id, toEmployeeRequest(detailDraft));
    setSelectedEmployee(saved);
    setDetailDraft(saved);
    setEmployees(prev => prev.map(e => (e.id === saved.id ? saved : e)));
    const users = await bisyncApi.users().catch(() => [] as AppUser[]);
    setPlatformUsers(users);
  });

  const toggleEmployeeActive = (employee: Employee, active: boolean) => run(async () => {
    const updated = { ...employee, active };
    const saved = await api.employees.update(employee.id, toEmployeeRequest(updated));
    setEmployees(prev => prev.map(e => (e.id === employee.id ? saved : e)));
    if (detailDraft?.id === employee.id) setDetailDraft(saved);
    if (selectedEmployee?.id === employee.id) setSelectedEmployee(saved);
    const users = await bisyncApi.users().catch(() => [] as AppUser[]);
    setPlatformUsers(users);
  });

  const updateDetailDraft = (patch: Partial<Employee>) => {
    if (!detailDraft) return;
    const next = { ...detailDraft, ...patch };
    if (patch.checkinMethod === 'POS') next.posEnabled = true;
    if (patch.checkinMethod && patch.checkinMethod !== 'POS') next.posEnabled = false;
    setDetailDraft(next);
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

  // ---------- admin actions ----------

  const toggleHoliday = (id: number) => run(async () => {
    const updated = await api.holidays.toggle(id);
    setPublicHolidays(prev => prev.map(h => (h.id === id ? updated : h)));
  });

  const saveMultiplier = (value: number) => run(async () => {
    if (!Number.isFinite(value) || value < 1) return;
    setSetting(await api.settings.update({ publicHolidayPayMultiplier: value }));
  });

  const changeOperatingCountry = (countryCode: string) => run(async () => {
    if (!countryCode || countryCode === setting?.operatingCountryCode) return;
    setChangingCountry(true);
    try {
      const updated = await api.settings.update({ operatingCountryCode: countryCode });
      setSetting(updated);
      await refreshHolidays();
    } finally {
      setChangingCountry(false);
    }
  });

  const operatingCountryName = countryOptions.find(c => c.countryCode === setting?.operatingCountryCode)?.name
    ?? setting?.operatingCountryCode
    ?? '—';

  const submitLevelForm = () => run(async () => {
    if (!levelFormData.levelName) return;
    const payload = { ...levelFormData, shiftType: null };
    if (editingLevel) await api.levels.update(editingLevel.id, payload);
    else await api.levels.create(payload);
    setShowLevelForm(false);
    setEditingLevel(null);
    setLevelFormData({ ...emptyLevelForm });
    setEmployeeLevels(await api.levels.list());
    await refreshEmployees();
  });

  const handleEditLevel = (level: EmployeeLevel) => {
    setEditingLevel(level);
    setLevelFormData({
      levelName: level.levelName,
      annualLeaveDays: level.annualLeaveDays,
      sickLeaveDays: level.sickLeaveDays,
      overtimeEligible: level.overtimeEligible,
      workingHoursPerDay: level.workingHoursPerDay,
      breakHoursPerShift: level.breakHoursPerShift,
      publicHolidayEligible: level.publicHolidayEligible,
      isShift: level.isShift,
    });
    setShowLevelForm(true);
  };

  const handleDeleteLevel = (id: number) => run(async () => {
    await api.levels.remove(id);
    setEmployeeLevels(await api.levels.list());
  });

  const toggleLevelFlag = (level: EmployeeLevel, patch: Partial<EmployeeLevel>) => run(async () => {
    const updated = { ...level, ...patch, shiftType: null };
    await api.levels.update(level.id, updated);
    setEmployeeLevels(prev => prev.map(l => (l.id === level.id ? updated : l)));
    await refreshEmployees();
  });

  const submitDivisionForm = () => run(async () => {
    if (!divisionFormData.name.trim()) {
      setError('Division name is required.');
      return;
    }
    const payload = {
      name: divisionFormData.name.trim(),
      code: divisionFormData.code.trim() || null,
    };
    if (editingDivision) await api.org.divisions.update(editingDivision.id, payload);
    else await api.org.divisions.create(payload);
    setShowDivisionForm(false);
    setEditingDivision(null);
    setDivisionFormData({ ...emptyDivisionForm });
    await refreshOrgTree();
  });

  const handleEditDivision = (division: DivisionTreeNode) => {
    setEditingDivision(division);
    setDivisionFormData({ name: division.name, code: division.code ?? '' });
    setShowDivisionForm(true);
  };

  const handleDeleteDivision = (id: number) => run(async () => {
    await api.org.divisions.remove(id);
    await refreshOrgTree();
  });

  const openAddDepartmentForm = (divisionId: number) => {
    setEditingDepartment(null);
    setDepartmentFormData({ name: '', divisionId });
    setShowDepartmentForm(true);
  };

  const submitDepartmentForm = () => run(async () => {
    if (!departmentFormData.name.trim()) {
      setError('Department name is required.');
      return;
    }
    if (!departmentFormData.divisionId) {
      setError('Please select a division for this department.');
      return;
    }
    const payload = {
      name: departmentFormData.name.trim(),
      divisionId: departmentFormData.divisionId,
    };
    if (editingDepartment) await api.org.departments.update(editingDepartment.id, payload);
    else await api.org.departments.create(payload);
    setShowDepartmentForm(false);
    setEditingDepartment(null);
    setDepartmentFormData({ ...emptyDepartmentForm });
    await refreshOrgTree();
  });

  const handleEditDepartment = (department: { id: number; name: string; divisionId: number }) => {
    setEditingDepartment(department);
    setDepartmentFormData({ name: department.name, divisionId: department.divisionId });
    setShowDepartmentForm(true);
  };

  const handleDeleteDepartment = (id: number) => run(async () => {
    await api.org.departments.remove(id);
    await refreshOrgTree();
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
              ['employees', Users, 'Employees'],
              ['attendance', Calendar, 'Attendance'],
              ['leave', FileText, 'Leave Requests'],
              ['schedule', Clock, 'Schedule'],
              ['admin', Settings, 'Admin'],
              ['portal', LayoutDashboard, 'Employee Portal'],
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
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">×</button>
        </div>
      )}

      <div className={embedded ? 'p-4' : 'p-8'}>
        {/* Employees Tab */}
        {activeTab === 'employees' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl text-gray-900">Employee Directory</h2>
              <button
                onClick={openAddEmployeeForm}
                className="flex items-center gap-2 bg-herme text-white px-4 py-2 rounded-lg hover:bg-herme-dark transition-colors"
              >
                <Plus className="w-5 h-5" />
                Add Employee
              </button>
            </div>

            {showEmployeeForm && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                <h3 className="text-xl text-gray-900 mb-4">Add New Employee</h3>
                <p className="text-sm text-gray-500 mb-4">Employee ID is assigned automatically. Configure check-in method and other details after creation.</p>
                {error && (
                  <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm flex justify-between">
                    <span>{error}</span>
                    <button type="button" onClick={() => setError(null)} className="text-red-600 hover:text-red-800">×</button>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {([
                    ['Full Name', 'name', 'text', 'John Doe'],
                    ['Email', 'email', 'email', 'john.doe@company.com'],
                    ['Mobile Number', 'mobile', 'tel', '+1 (555) 123-4567'],
                    ['Position', 'position', 'text', 'Software Engineer'],
                    ['Join Date', 'joinDate', 'date', ''],
                  ] as const).map(([label, key, type, placeholder]) => (
                    <div key={key}>
                      <label className="block text-sm text-gray-700 mb-1">{label}</label>
                      <input
                        type={type}
                        required
                        value={formData[key]}
                        onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-herme"
                        placeholder={placeholder}
                      />
                    </div>
                  ))}
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Division</label>
                    <select
                      required
                      value={formData.divisionId ?? ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        divisionId: e.target.value ? Number(e.target.value) : null,
                        departmentId: null,
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-herme bg-white"
                    >
                      <option value="">— Select division —</option>
                      {orgTree.map((division) => (
                        <option key={division.id} value={division.id}>{division.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Department</label>
                    <select
                      required
                      value={formData.departmentId ?? ''}
                      disabled={!formData.divisionId}
                      onChange={(e) => setFormData({
                        ...formData,
                        departmentId: e.target.value ? Number(e.target.value) : null,
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-herme bg-white disabled:bg-gray-50 disabled:text-gray-500"
                    >
                      <option value="">— Select department —</option>
                      {(orgTree.find((d) => d.id === formData.divisionId)?.departments ?? []).map((department) => (
                        <option key={department.id} value={department.id}>{department.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Employee Level</label>
                    <select
                      value={formData.employeeLevelId ?? ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        employeeLevelId: e.target.value ? Number(e.target.value) : null,
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-herme bg-white"
                    >
                      <option value="">— Select level —</option>
                      {employeeLevels.map((level) => (
                        <option key={level.id} value={level.id}>{level.levelName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Reports To</label>
                    <select
                      value={formData.reportsToId ?? ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        reportsToId: e.target.value ? Number(e.target.value) : null,
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-herme bg-white"
                    >
                      <option value="">— Select manager —</option>
                      {employees.map((e) => (
                        <option key={e.id} value={e.id}>{e.name} — {e.position}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={submitEmployeeForm} className="bg-herme text-white px-4 py-2 rounded-lg hover:bg-herme-dark transition-colors">
                    Add Employee
                  </button>
                  <button
                    onClick={() => { setShowEmployeeForm(false); setFormData({ ...emptyEmployeeForm }); }}
                    className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
              <table className="w-full min-w-[1100px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm text-gray-700">Employee ID</th>
                    <th className="px-6 py-3 text-left text-sm text-gray-700">Employee</th>
                    <th className="px-6 py-3 text-left text-sm text-gray-700">Company</th>
                    <th className="px-6 py-3 text-left text-sm text-gray-700">Location</th>
                    <th className="px-6 py-3 text-left text-sm text-gray-700">Division</th>
                    <th className="px-6 py-3 text-left text-sm text-gray-700">Department</th>
                    <th className="px-6 py-3 text-left text-sm text-gray-700">Position</th>
                    <th className="px-6 py-3 text-left text-sm text-gray-700">Employee Level</th>
                    <th className="px-6 py-3 text-center text-sm text-gray-700">Shift</th>
                    <th className="px-6 py-3 text-left text-sm text-gray-700">Platform Access</th>
                    <th className="px-6 py-3 text-left text-sm text-gray-700">Check-in Method</th>
                    <th className="px-6 py-3 text-center text-sm text-gray-700">Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {employees.map((employee) => (
                    <tr key={employee.id} className={`hover:bg-gray-50 ${employee.active === false ? 'opacity-60' : ''}`}>
                      <td className="px-6 py-4 text-sm text-gray-900">{employee.employeeCode}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-herme text-white flex items-center justify-center shrink-0">
                            {initials(employee.name)}
                          </div>
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => openEmployeeDetail(employee.id)}
                              className="text-sm text-herme hover:text-herme-dark hover:underline font-medium text-left"
                            >
                              {employee.name}
                            </button>
                            <div className="text-sm text-gray-500 truncate">{employee.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{employeeCompanyName(employee)}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-[160px] truncate" title={employeeLocationLabel(employee)}>{employeeLocationLabel(employee)}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{employeeDivisionName(employee)}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{departmentName(employee)}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{employee.position}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {levelName(employee.employeeLevelId) ? (
                          <span className="inline-flex px-2.5 py-1 rounded-md bg-herme-soft text-herme-darker text-xs font-medium">
                            {levelName(employee.employeeLevelId)}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={employeeIsShift(employee)}
                          disabled
                          className="w-4 h-4 text-herme border-gray-300 rounded opacity-70"
                          title="Set via Admin → Employee Levels"
                        />
                      </td>
                      <td className="px-6 py-4">
                        {(() => {
                          const user = platformUserFor(employee);
                          if (!user) {
                            return <span className="text-xs text-gray-400">Not granted</span>;
                          }
                          const modules = parseUserAccess(user.accessJson).modules;
                          return (
                            <div className="flex flex-wrap gap-1">
                              {modules.length > 0 ? modules.map(m => (
                                <span key={m} className="inline-flex px-2 py-0.5 rounded bg-herme-soft text-herme-darker text-xs font-medium">{m}</span>
                              )) : (
                                <span className="text-xs text-gray-500">No modules</span>
                              )}
                              {!user.active && (
                                <span className="inline-flex px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-xs">Inactive</span>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <span className="inline-flex px-2 py-1 rounded-md bg-gray-100 text-gray-800 text-xs">
                          {checkinMethodLabel(employee.checkinMethod ?? 'Biometrics')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <label className="inline-flex items-center cursor-pointer" title={employee.active === false ? 'Activate employee' : 'Deactivate employee'}>
                          <input
                            type="checkbox"
                            checked={employee.active !== false}
                            onChange={(e) => toggleEmployeeActive(employee, e.target.checked)}
                            className="sr-only peer"
                          />
                          <span className="relative w-10 h-5 bg-gray-300 rounded-full peer-checked:bg-herme transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4 after:bg-white after:rounded-full after:transition-transform peer-checked:after:translate-x-5" />
                        </label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
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
                                    {late && <span className="text-red-600">⚠</span>}
                                  </div>
                                )}
                              </td>
                              <td className="px-2 py-3 text-center text-xs text-gray-900">{so || '-'}</td>
                              <td className="px-2 py-3 text-center text-xs">
                                {record.status === 'Absent' ? <span className="text-gray-400">-</span> : (
                                  <div className="flex flex-col items-center">
                                    <span className="text-gray-900">{ao || '-'}</span>
                                    {earlyOut && <span className="text-orange-600">⚠</span>}
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
                <p className="text-gray-500">No employees are assigned to shifts. Mark a level as Shift under Admin → Employee Levels & Entitlements.</p>
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

        {/* Admin Tab */}
        {activeTab === 'admin' && (
          <div className="space-y-8">
            <h2 className="text-2xl text-gray-900">Admin Settings</h2>

            {/* Public Holidays */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-4">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => setHolidaysExpanded(prev => !prev)}
                    className="mt-1 p-2 text-herme hover:bg-herme-light rounded-lg transition-colors"
                    title={holidaysExpanded ? 'Collapse holiday list' : 'Expand holiday list'}
                    aria-expanded={holidaysExpanded}
                    aria-label={holidaysExpanded ? 'Collapse holiday list' : 'Expand holiday list'}
                  >
                    {holidaysExpanded ? <Minus className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                  </button>
                  <div>
                    <h3 className="text-xl text-gray-900">Public Holidays</h3>
                    <p className="text-sm text-gray-600 mt-1">Select holidays recognized by your company</p>
                  </div>
                </div>
                <div className="min-w-[220px]">
                  <label className="block text-sm text-gray-700 mb-2">Operating Country</label>
                  <select
                    value={setting?.operatingCountryCode ?? ''}
                    onChange={(e) => changeOperatingCountry(e.target.value)}
                    disabled={changingCountry}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-herme bg-white"
                  >
                    {setting?.operatingCountryCode
                      && !countryOptions.some(c => c.countryCode === setting.operatingCountryCode) && (
                      <option value={setting.operatingCountryCode}>{operatingCountryName}</option>
                    )}
                    {countryOptions.map((country) => (
                      <option key={country.countryCode} value={country.countryCode}>
                        {country.name}
                      </option>
                    ))}
                  </select>
                  {changingCountry && <p className="text-xs text-gray-500 mt-1">Loading holidays…</p>}
                </div>
              </div>
              {holidaysExpanded && (
                <div className="overflow-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-sm text-gray-700">Holiday Name</th>
                        <th className="px-6 py-3 text-left text-sm text-gray-700">Date</th>
                        <th className="px-6 py-3 text-center text-sm text-gray-700">Recognized by Company</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {publicHolidays.map((holiday) => (
                        <tr key={holiday.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm text-gray-900">{holiday.name}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {new Date(holiday.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <input
                              type="checkbox"
                              checked={holiday.isRecognized}
                              onChange={() => toggleHoliday(holiday.id)}
                              className="w-4 h-4 text-herme border-gray-300 rounded focus:ring-2 focus:ring-herme"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Payment Rule */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-xl text-gray-900 mb-4">Public Holiday Payment Rule</h3>
              <p className="text-sm text-gray-600 mb-4">Define payment multiplier for working on public holidays</p>
              <div className="max-w-md">
                <label className="block text-sm text-gray-700 mb-2">Payment Multiplier</label>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600">Base Salary ×</span>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    value={setting?.publicHolidayPayMultiplier ?? 1.5}
                    onChange={(e) => saveMultiplier(parseFloat(e.target.value))}
                    className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-herme"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">Example: 1.5 means employees receive 150% of base salary when working on public holidays</p>
              </div>
            </div>

            {/* Employee Levels */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-xl text-gray-900">Employee Levels & Entitlements</h3>
                  <p className="text-sm text-gray-600">Define leave and overtime entitlements by employee level</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowLevelForm(true); setEditingLevel(null); setLevelFormData({ ...emptyLevelForm }); }}
                  className="flex items-center gap-2 bg-herme text-white px-4 py-2 rounded-lg hover:bg-herme-dark transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Add Level
                </button>
              </div>

              {showLevelForm && (
                <div className="bg-gray-50 rounded-lg p-4 mb-4 border border-gray-200">
                  <h4 className="text-lg text-gray-900 mb-3">{editingLevel ? 'Edit Employee Level' : 'Add New Employee Level'}</h4>
                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Level Name</label>
                      <input
                        type="text"
                        value={levelFormData.levelName}
                        onChange={(e) => setLevelFormData({ ...levelFormData, levelName: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-herme"
                        placeholder="e.g., Junior, Senior"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Annual Leave (days)</label>
                      <input
                        type="number" min="0"
                        value={levelFormData.annualLeaveDays}
                        onChange={(e) => setLevelFormData({ ...levelFormData, annualLeaveDays: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-herme"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Sick Leave (days)</label>
                      <input
                        type="number" min="0"
                        value={levelFormData.sickLeaveDays}
                        onChange={(e) => setLevelFormData({ ...levelFormData, sickLeaveDays: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-herme"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Working Hours/Day</label>
                      <input
                        type="number" min="0" step="0.5"
                        value={levelFormData.workingHoursPerDay}
                        onChange={(e) => setLevelFormData({ ...levelFormData, workingHoursPerDay: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-herme"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Break Hours/Shift</label>
                      <input
                        type="number" min="0" step="0.5"
                        value={levelFormData.breakHoursPerShift}
                        onChange={(e) => setLevelFormData({ ...levelFormData, breakHoursPerShift: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-herme"
                      />
                    </div>
                    <div className="flex items-end pb-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={levelFormData.overtimeEligible}
                          onChange={(e) => setLevelFormData({ ...levelFormData, overtimeEligible: e.target.checked })}
                          className="w-4 h-4 text-herme border-gray-300 rounded focus:ring-2 focus:ring-herme"
                        />
                        <span className="text-sm text-gray-700">Overtime</span>
                      </label>
                    </div>
                    <div className="flex items-end pb-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={levelFormData.publicHolidayEligible}
                          onChange={(e) => setLevelFormData({ ...levelFormData, publicHolidayEligible: e.target.checked })}
                          className="w-4 h-4 text-herme border-gray-300 rounded focus:ring-2 focus:ring-herme"
                        />
                        <span className="text-sm text-gray-700">Public Holiday</span>
                      </label>
                    </div>
                  </div>
                  <div className="mb-4 p-4 bg-white rounded-lg border border-gray-200">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={levelFormData.isShift}
                        onChange={(e) => setLevelFormData({ ...levelFormData, isShift: e.target.checked })}
                        className="w-4 h-4 text-herme border-gray-300 rounded focus:ring-2 focus:ring-herme"
                      />
                      <span className="text-sm font-medium text-gray-700">Shift</span>
                    </label>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={submitLevelForm} className="bg-herme text-white px-4 py-2 rounded-lg hover:bg-herme-dark transition-colors">
                      {editingLevel ? 'Update Level' : 'Add Level'}
                    </button>
                    <button
                      onClick={() => { setShowLevelForm(false); setEditingLevel(null); setLevelFormData({ ...emptyLevelForm }); }}
                      className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="overflow-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm text-gray-700">Level Name</th>
                      <th className="px-6 py-3 text-center text-sm text-gray-700">Annual Leave</th>
                      <th className="px-6 py-3 text-center text-sm text-gray-700">Sick Leave</th>
                      <th className="px-6 py-3 text-center text-sm text-gray-700">Working Hours/Day</th>
                      <th className="px-6 py-3 text-center text-sm text-gray-700">Break Hours/Shift</th>
                      <th className="px-6 py-3 text-center text-sm text-gray-700">Shift</th>
                      <th className="px-6 py-3 text-center text-sm text-gray-700">Overtime</th>
                      <th className="px-6 py-3 text-center text-sm text-gray-700">Public Holiday</th>
                      <th className="px-6 py-3 text-right text-sm text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {employeeLevels.map((level) => (
                      <tr key={level.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-900">{level.levelName}</td>
                        <td className="px-6 py-4 text-center text-sm text-gray-900">{level.annualLeaveDays} days</td>
                        <td className="px-6 py-4 text-center text-sm text-gray-900">{level.sickLeaveDays} days</td>
                        <td className="px-6 py-4 text-center text-sm text-gray-900">{level.workingHoursPerDay} hrs</td>
                        <td className="px-6 py-4 text-center text-sm text-gray-900">{level.breakHoursPerShift} hrs</td>
                        <td className="px-6 py-4 text-center">
                          <input
                            type="checkbox"
                            checked={level.isShift}
                            onChange={(e) => toggleLevelFlag(level, { isShift: e.target.checked })}
                            className="w-4 h-4 text-herme border-gray-300 rounded focus:ring-2 focus:ring-herme"
                          />
                        </td>
                        <td className="px-6 py-4 text-center">
                          <input
                            type="checkbox"
                            checked={level.overtimeEligible}
                            onChange={(e) => toggleLevelFlag(level, { overtimeEligible: e.target.checked })}
                            className="w-4 h-4 text-herme border-gray-300 rounded focus:ring-2 focus:ring-herme"
                          />
                        </td>
                        <td className="px-6 py-4 text-center">
                          <input
                            type="checkbox"
                            checked={level.publicHolidayEligible}
                            onChange={(e) => toggleLevelFlag(level, { publicHolidayEligible: e.target.checked })}
                            className="w-4 h-4 text-herme border-gray-300 rounded focus:ring-2 focus:ring-herme"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => handleEditLevel(level)} className="p-2 text-herme hover:bg-herme-light rounded-lg transition-colors" title="Edit">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDeleteLevel(level.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Divisions & Departments */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-xl text-gray-900">Divisions &amp; Departments</h3>
                  <p className="text-sm text-gray-600">Organize company structure by division and department</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowDivisionForm(true);
                    setEditingDivision(null);
                    setDivisionFormData({ ...emptyDivisionForm });
                  }}
                  className="flex items-center gap-2 bg-herme text-white px-4 py-2 rounded-lg hover:bg-herme-dark transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Add Division
                </button>
              </div>

              {showDivisionForm && (
                <div className="bg-gray-50 rounded-lg p-4 mb-4 border border-gray-200">
                  <h4 className="text-lg text-gray-900 mb-3">{editingDivision ? 'Edit Division' : 'Add New Division'}</h4>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Division Name</label>
                      <input
                        type="text"
                        value={divisionFormData.name}
                        onChange={(e) => setDivisionFormData({ ...divisionFormData, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-herme"
                        placeholder="e.g. Operations"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Code (optional)</label>
                      <input
                        type="text"
                        value={divisionFormData.code}
                        onChange={(e) => setDivisionFormData({ ...divisionFormData, code: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-herme"
                        placeholder="e.g. OPS"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={submitDivisionForm} className="bg-herme text-white px-4 py-2 rounded-lg hover:bg-herme-dark transition-colors">
                      {editingDivision ? 'Save Changes' : 'Add Division'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowDivisionForm(false); setEditingDivision(null); setDivisionFormData({ ...emptyDivisionForm }); }}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {showDepartmentForm && (
                <div className="bg-gray-50 rounded-lg p-4 mb-4 border border-gray-200">
                  <h4 className="text-lg text-gray-900 mb-3">{editingDepartment ? 'Edit Department' : 'Add New Department'}</h4>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Department Name</label>
                      <input
                        type="text"
                        value={departmentFormData.name}
                        onChange={(e) => setDepartmentFormData({ ...departmentFormData, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-herme"
                        placeholder="e.g. Engineering"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Division</label>
                      <select
                        value={departmentFormData.divisionId || ''}
                        onChange={(e) => setDepartmentFormData({ ...departmentFormData, divisionId: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-herme bg-white"
                      >
                        <option value="">Select division</option>
                        {orgTree.map((division) => (
                          <option key={division.id} value={division.id}>{division.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={submitDepartmentForm} className="bg-herme text-white px-4 py-2 rounded-lg hover:bg-herme-dark transition-colors">
                      {editingDepartment ? 'Save Changes' : 'Add Department'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowDepartmentForm(false); setEditingDepartment(null); setDepartmentFormData({ ...emptyDepartmentForm }); }}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {orgTree.length === 0 ? (
                <p className="text-sm text-gray-500">No divisions yet. Add a division to get started.</p>
              ) : (
                <div className="divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                  {orgTree.map((division) => (
                    <div key={division.id}>
                      <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
                        <div>
                          <span className="text-sm font-medium text-gray-900">{division.name}</span>
                          {division.code && <span className="ml-2 text-xs text-gray-500">({division.code})</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openAddDepartmentForm(division.id)}
                            className="flex items-center gap-1 px-2 py-1 text-sm text-herme hover:bg-herme-light rounded-lg transition-colors"
                            title="Add department"
                          >
                            <Plus className="w-4 h-4" />
                            Department
                          </button>
                          <button onClick={() => handleEditDivision(division)} className="p-2 text-herme hover:bg-herme-light rounded-lg transition-colors" title="Edit division">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDeleteDivision(division.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete division">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      {division.departments.length === 0 ? (
                        <div className="px-8 py-2 text-sm text-gray-500 italic">No departments</div>
                      ) : (
                        division.departments.map((department) => (
                          <div key={department.id} className="flex items-center justify-between px-8 py-2 hover:bg-gray-50">
                            <span className="text-sm text-gray-800">{department.name}</span>
                            <div className="flex items-center gap-2">
                              <button onClick={() => handleEditDepartment(department)} className="p-2 text-herme hover:bg-herme-light rounded-lg transition-colors" title="Edit department">
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDeleteDepartment(department.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete department">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
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
            <button onClick={() => setSelectedAttendanceEmployee(null)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
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
                                {late && <span className="text-red-600 text-xs">⚠ Late</span>}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center text-sm text-gray-900">{so || '-'}</td>
                          <td className="px-6 py-4 text-center text-sm">
                            {record.status === 'Absent' ? <span className="text-gray-400">-</span> : (
                              <div className="flex items-center justify-center gap-2">
                                <span className="text-gray-900">{ao || '-'}</span>
                                {earlyOut && <span className="text-orange-600 text-xs">⚠ Early</span>}
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

    {/* Employee Detail Modal */}
    {selectedEmployee && detailDraft && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 flex justify-between items-start z-10">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-herme text-white flex items-center justify-center text-2xl">
                {initials(detailDraft.name)}
              </div>
              <div>
                <h2 className="text-2xl text-gray-900">{detailDraft.name}</h2>
                <p className="text-gray-600">{detailDraft.position} — {departmentName(detailDraft)}</p>
                <p className="text-sm text-gray-500">Employee ID: {detailDraft.employeeCode}</p>
                <p className="text-sm text-gray-500">
                  Company: {employeeCompanyName(detailDraft)} · Location: {employeeLocationLabel(detailDraft)}
                </p>
              </div>
            </div>
            <button onClick={closeEmployeeDetail} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
          </div>

          <div className="p-8 space-y-8">
            <div>
              <h3 className="text-xl text-gray-900 mb-4 pb-2 border-b-2 border-herme">1. Personal &amp; Employment Details</h3>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={detailDraft.name}
                    onChange={(e) => updateDetailDraft({ name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-herme"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Work Email</label>
                  <input
                    type="email"
                    value={detailDraft.email}
                    onChange={(e) => updateDetailDraft({ email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-herme"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Position</label>
                  <input
                    type="text"
                    value={detailDraft.position}
                    onChange={(e) => updateDetailDraft({ position: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-herme"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Join Date</label>
                  <input
                    type="date"
                    value={detailDraft.joinDate}
                    onChange={(e) => updateDetailDraft({ joinDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-herme"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Division</label>
                  <select
                    value={detailDraft.divisionId ?? ''}
                    onChange={(e) => updateDetailDraft({
                      divisionId: e.target.value ? Number(e.target.value) : null,
                      departmentId: null,
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-herme bg-white"
                  >
                    <option value="">— Select division —</option>
                    {orgTree.map((division) => (
                      <option key={division.id} value={division.id}>{division.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Department</label>
                  <select
                    value={detailDraft.departmentId ?? ''}
                    disabled={!detailDraft.divisionId}
                    onChange={(e) => updateDetailDraft({
                      departmentId: e.target.value ? Number(e.target.value) : null,
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-herme bg-white disabled:bg-gray-50"
                  >
                    <option value="">— Select department —</option>
                    {(orgTree.find((d) => d.id === detailDraft.divisionId)?.departments ?? []).map((department) => (
                      <option key={department.id} value={department.id}>{department.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Employee Level</label>
                  <select
                    value={detailDraft.employeeLevelId ?? ''}
                    onChange={(e) => updateDetailDraft({
                      employeeLevelId: e.target.value ? Number(e.target.value) : null,
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-herme bg-white"
                  >
                    <option value="">— Select level —</option>
                    {employeeLevels.map((level) => (
                      <option key={level.id} value={level.id}>{level.levelName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Reports To</label>
                  <select
                    value={detailDraft.reportsToId ?? ''}
                    onChange={(e) => updateDetailDraft({
                      reportsToId: e.target.value ? Number(e.target.value) : null,
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-herme bg-white"
                  >
                    <option value="">— Select manager —</option>
                    {employees.filter((e) => e.id !== detailDraft.id).map((e) => (
                      <option key={e.id} value={e.id}>{e.name} — {e.position}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Nationality</label>
                  <input
                    type="text"
                    value={detailDraft.nationality ?? ''}
                    onChange={(e) => updateDetailDraft({ nationality: e.target.value || null })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-herme"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">ID / Passport Number</label>
                  <input
                    type="text"
                    value={detailDraft.idPassportNumber ?? ''}
                    onChange={(e) => updateDetailDraft({ idPassportNumber: e.target.value || null })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-herme"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={detailDraft.dateOfBirth ?? ''}
                    onChange={(e) => updateDetailDraft({ dateOfBirth: e.target.value || null })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-herme"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Contact Number</label>
                  <input
                    type="tel"
                    value={detailDraft.mobile}
                    onChange={(e) => updateDetailDraft({ mobile: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-herme"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Personal Email</label>
                  <input
                    type="email"
                    value={detailDraft.personalEmail ?? ''}
                    onChange={(e) => updateDetailDraft({ personalEmail: e.target.value || null })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-herme"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm text-gray-600 mb-1">Permanent Address</label>
                  <textarea
                    value={detailDraft.permanentAddress ?? ''}
                    onChange={(e) => updateDetailDraft({ permanentAddress: e.target.value || null })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-herme"
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xl text-gray-900 mb-4 pb-2 border-b-2 border-herme">2. Check-in Method</h3>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Method</label>
                  <select
                    value={detailDraft.checkinMethod ?? 'Biometrics'}
                    onChange={(e) => updateDetailDraft({ checkinMethod: e.target.value as CheckinMethod })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-herme bg-white"
                  >
                    {CHECKIN_METHODS.map((method) => (
                      <option key={method} value={method}>{checkinMethodLabel(method)}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <p className="text-sm text-gray-500">
                    Shift status: {employeeIsShift(detailDraft) ? 'Shift employee' : 'Non-shift'} (via Employee Level)
                  </p>
                </div>
              </div>

              {detailDraft.checkinMethod === 'Biometrics' && (
                <div className="mt-4 flex flex-wrap gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={detailDraft.fingerprintEnrolled}
                      onChange={(e) => updateDetailDraft({ fingerprintEnrolled: e.target.checked })}
                      className="w-4 h-4 text-herme border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">Fingerprint enrolled</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={detailDraft.faceRecognitionEnrolled}
                      onChange={(e) => updateDetailDraft({ faceRecognitionEnrolled: e.target.checked })}
                      className="w-4 h-4 text-herme border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">Face recognition enrolled</span>
                  </label>
                </div>
              )}

              {detailDraft.checkinMethod === 'POS' && (
                <div className="mt-4 flex flex-wrap items-end gap-3 p-4 bg-herme-light border border-herme-muted rounded-lg">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-sm text-gray-700 mb-1">POS PIN</label>
                    <input
                      type="text"
                      readOnly
                      value={detailDraft.posPin ?? DEFAULT_POS_PIN}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white font-mono tracking-widest"
                    />
                    {detailDraft.posPinMustChange && (
                      <p className="text-xs text-gray-500 mt-1">PIN change required on next login</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={resetPosPin}
                    className="px-4 py-2 text-sm border border-herme text-herme rounded-lg hover:bg-herme-soft"
                  >
                    Reset PIN to {DEFAULT_POS_PIN}
                  </button>
                </div>
              )}

              {detailDraft.checkinMethod === 'AccessTag' && (
                <p className="mt-4 text-sm text-gray-500">Employee will check in using an assigned access tag.</p>
              )}
            </div>

            {/* Education */}
            <div>
              <h3 className="text-xl text-gray-900 mb-4 pb-2 border-b-2 border-herme">3. Educational Details &amp; Certificates</h3>
              {detailDraft.education?.length ? (
                <div className="space-y-4">
                  {detailDraft.education.map((edu) => (
                    <div key={edu.id} className="bg-gray-50 rounded-lg p-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Degree</label>
                          <p className="text-gray-900">{edu.degree}</p>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Institution</label>
                          <p className="text-gray-900">{edu.institution}</p>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Year</label>
                          <p className="text-gray-900">{edu.year}</p>
                        </div>
                        <div className="col-span-3">
                          <label className="block text-sm text-gray-600 mb-1">Certificate</label>
                          <p className="text-gray-900">{edu.certificate}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-gray-500 italic">No education records available</p>}
            </div>

            {/* Previous Employment */}
            <div>
              <h3 className="text-xl text-gray-900 mb-4 pb-2 border-b-2 border-herme">4. Previous Employment History</h3>
              {detailDraft.previousEmployments?.length ? (
                <div className="space-y-4">
                  {detailDraft.previousEmployments.map((emp) => (
                    <div key={emp.id} className="bg-gray-50 rounded-lg p-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Company Name</label>
                          <p className="text-gray-900">{emp.companyName}</p>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Position</label>
                          <p className="text-gray-900">{emp.position}</p>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Years of Service</label>
                          <p className="text-gray-900">{emp.yearsOfService} years ({emp.startYear} - {emp.endYear})</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-gray-500 italic">No previous employment records</p>}
            </div>

            {/* Movements */}
            <div>
              <h3 className="text-xl text-gray-900 mb-4 pb-2 border-b-2 border-herme">5. Movement &amp; Promotions Within Company</h3>
              {detailDraft.movements?.length ? (
                <div className="space-y-4">
                  {detailDraft.movements.map((movement) => (
                    <div key={movement.id} className="bg-gray-50 rounded-lg p-4">
                      <div className="grid grid-cols-4 gap-4">
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Date</label>
                          <p className="text-gray-900">{movement.date}</p>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">From Position</label>
                          <p className="text-gray-900">{movement.fromPosition}</p>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">To Position</label>
                          <p className="text-gray-900">{movement.toPosition}</p>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Type</label>
                          <span className={`inline-flex px-3 py-1 rounded-full text-xs ${
                            movement.type === 'Promotion' ? 'bg-green-100 text-green-800' :
                            movement.type === 'Transfer' ? 'bg-herme-soft text-herme-darker' :
                            'bg-gray-100 text-gray-800'
                          }`}>{movement.type}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-gray-500 italic">No movement records</p>}
            </div>

            {/* Appraisals */}
            <div>
              <h3 className="text-xl text-gray-900 mb-4 pb-2 border-b-2 border-herme">6. Annual Performance Appraisal</h3>
              {detailDraft.performanceAppraisals?.length ? (
                <div className="space-y-4">
                  {detailDraft.performanceAppraisals.map((appraisal) => (
                    <div key={appraisal.id} className="bg-gray-50 rounded-lg p-4">
                      <div className="grid grid-cols-4 gap-4 mb-3">
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Year</label>
                          <p className="text-gray-900">{appraisal.year}</p>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Rating</label>
                          <span className={`inline-flex px-3 py-1 rounded-full text-xs ${
                            appraisal.rating === 'Exceptional' ? 'bg-purple-100 text-purple-800' :
                            appraisal.rating === 'Excellent' ? 'bg-green-100 text-green-800' :
                            appraisal.rating === 'Very Good' ? 'bg-herme-soft text-herme-darker' :
                            'bg-gray-100 text-gray-800'
                          }`}>{appraisal.rating}</span>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Score</label>
                          <p className="text-gray-900">{appraisal.score} / 5.0</p>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Reviewer</label>
                          <p className="text-gray-900">{appraisal.reviewer}</p>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Comments</label>
                        <p className="text-gray-900">{appraisal.comments}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-gray-500 italic">No performance appraisal records</p>}
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 -mx-8 px-8 py-4 flex justify-between items-center">
              <button
                type="button"
                onClick={() => { if (confirm('Delete this employee permanently?')) { handleDeleteEmployee(detailDraft.id); closeEmployeeDetail(); } }}
                className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
              >
                Delete Employee
              </button>
              <div className="flex gap-3">
                <button type="button" onClick={closeEmployeeDetail} className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
                  Cancel
                </button>
                <button type="button" onClick={saveEmployeeDetail} className="px-4 py-2 text-sm bg-herme text-white rounded-lg hover:bg-herme-dark">
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
