import { HR_API_BASE } from '../../config/hrBackend';
import type {
  AttendanceRecord, CompanySetting, CountryOption, Department, Division, DivisionTreeNode,
  Employee, EmployeeCreateRequest, EmployeeLevel, EmployeeRequest,
  LeaveBalanceRow, LeaveRequest, LeaveType, PublicHoliday, ScheduleType, ShiftSchedule,
} from './types';

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${HR_API_BASE}${path}`, {
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `${res.status} ${res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function toEmployeeRequest(e: Employee): EmployeeRequest {
  return {
    employeeCode: e.employeeCode,
    name: e.name,
    email: e.email,
    mobile: e.mobile,
    department: e.department,
    divisionId: e.divisionId,
    departmentId: e.departmentId,
    position: e.position,
    joinDate: e.joinDate,
    fingerprintEnrolled: e.fingerprintEnrolled,
    faceRecognitionEnrolled: e.faceRecognitionEnrolled,
    isShiftEmployee: e.isShiftEmployee,
    shiftType: e.shiftType,
    posEnabled: e.posEnabled,
    bisyncEnabled: e.bisyncEnabled,
    workingHoursPerDay: e.workingHoursPerDay,
    employeeLevelId: e.employeeLevelId,
    reportsToId: e.reportsToId,
    nationality: e.nationality,
    idPassportNumber: e.idPassportNumber,
    dateOfBirth: e.dateOfBirth,
    personalEmail: e.personalEmail,
    permanentAddress: e.permanentAddress,
  };
}

export const hrApi = {
  employees: {
    list: () => http<Employee[]>('/employees'),
    get: (id: number) => http<Employee>(`/employees/${id}`),
    create: (body: EmployeeCreateRequest) => http<Employee>('/employees', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: EmployeeRequest) => http<Employee>(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    remove: (id: number) => http<void>(`/employees/${id}`, { method: 'DELETE' }),
    resetPosPin: (id: number) => http<Employee>(`/employees/${id}/reset-pos-pin`, { method: 'POST' }),
  },
  attendance: {
    list: (from: string, to: string) => http<AttendanceRecord[]>(`/attendance?from=${from}&to=${to}`),
  },
  leaveRequests: {
    list: () => http<LeaveRequest[]>('/leave-requests'),
    create: (body: { employeeId: number; type: LeaveType; startDate: string; endDate: string; reason?: string }) =>
      http<LeaveRequest>('/leave-requests', { method: 'POST', body: JSON.stringify(body) }),
    approve: (id: number) => http<LeaveRequest>(`/leave-requests/${id}/approve`, { method: 'POST' }),
    reject: (id: number) => http<LeaveRequest>(`/leave-requests/${id}/reject`, { method: 'POST' }),
  },
  leaveBalances: {
    list: () => http<LeaveBalanceRow[]>('/leave-balances'),
  },
  schedules: {
    list: (from: string, to: string) => http<ShiftSchedule[]>(`/shift-schedules?from=${from}&to=${to}`),
    upsert: (body: { employeeId: number; date: string; type: ScheduleType; startTime?: string | null }) =>
      http<ShiftSchedule>('/shift-schedules', { method: 'PUT', body: JSON.stringify(body) }),
    remove: (id: number) => http<void>(`/shift-schedules/${id}`, { method: 'DELETE' }),
  },
  holidays: {
    list: () => http<PublicHoliday[]>('/public-holidays'),
    toggle: (id: number) => http<PublicHoliday>(`/public-holidays/${id}/toggle-recognized`, { method: 'POST' }),
  },
  levels: {
    list: () => http<EmployeeLevel[]>('/employee-levels'),
    create: (body: Omit<EmployeeLevel, 'id'>) => http<EmployeeLevel>('/employee-levels', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: Omit<EmployeeLevel, 'id'>) => http<EmployeeLevel>(`/employee-levels/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    remove: (id: number) => http<void>(`/employee-levels/${id}`, { method: 'DELETE' }),
  },
  settings: {
    get: () => http<CompanySetting>('/settings'),
    countries: () => http<CountryOption[]>('/settings/countries'),
    update: (body: { publicHolidayPayMultiplier?: number; operatingCountryCode?: string }) =>
      http<CompanySetting>('/settings', { method: 'PUT', body: JSON.stringify(body) }),
  },
  org: {
    tree: () => http<DivisionTreeNode[]>('/divisions/tree'),
    divisions: {
      list: () => http<Division[]>('/divisions'),
      create: (body: { name: string; code?: string | null }) =>
        http<Division>('/divisions', { method: 'POST', body: JSON.stringify(body) }),
      update: (id: number, body: { name: string; code?: string | null }) =>
        http<Division>(`/divisions/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
      remove: (id: number) => http<void>(`/divisions/${id}`, { method: 'DELETE' }),
    },
    departments: {
      list: () => http<Department[]>('/departments'),
      create: (body: { name: string; divisionId: number }) =>
        http<Department>('/departments', { method: 'POST', body: JSON.stringify(body) }),
      update: (id: number, body: { name: string; divisionId: number }) =>
        http<Department>(`/departments/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
      remove: (id: number) => http<void>(`/departments/${id}`, { method: 'DELETE' }),
    },
  },
};

/** Probe whether the HR API is reachable. */
export async function probeHrApi(): Promise<boolean> {
  try {
    const res = await fetch(`${HR_API_BASE}/settings`, { cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
}
