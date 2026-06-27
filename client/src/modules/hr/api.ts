import { HR_API_BASE } from '../../config/hrBackend';
import type {
  AttendanceRecord, CompanySetting, CompanySettingUpdate, CountryOption, Department, Division, DivisionTreeNode,
  Employee, EmployeeCreateRequest, EmployeeLevel, EmployeeRequest,
  LeaveBalanceRow, LeaveRequest, LeaveType, PayStructure, PayStructureRequest, PayrollPreview, PayrollRunDetail, PayrollRunSummary, PublicHoliday, PublicHolidayRequest, ScheduleType, ShiftSchedule,
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
    active: e.active ?? true,
    checkinMethod: e.checkinMethod ?? 'Biometrics',
    workingHoursPerDay: e.workingHoursPerDay,
    employeeLevelId: e.employeeLevelId,
    reportsToId: e.reportsToId,
    nationality: e.nationality,
    idPassportNumber: e.idPassportNumber,
    dateOfBirth: e.dateOfBirth,
    personalEmail: e.personalEmail,
    permanentAddress: e.permanentAddress,
    bankName: e.bankName,
    bankAccountNumber: e.bankAccountNumber,
    bankAccountHolderName: e.bankAccountHolderName,
    baseSalary: e.baseSalary,
    serviceAllowance: e.serviceAllowance,
    transportAllowance: e.transportAllowance,
    accommodationAllowance: e.accommodationAllowance,
    mobileAllowance: e.mobileAllowance,
    otherAllowances: e.otherAllowances,
    workPermitByCompany: e.workPermitByCompany,
    transportProvided: e.transportProvided ?? false,
    transportCarModel: e.transportCarModel,
    transportPlateNumber: e.transportPlateNumber,
    accommodationProvided: e.accommodationProvided ?? false,
    accommodationAddress: e.accommodationAddress,
    accommodationLeaseStart: e.accommodationLeaseStart,
    accommodationLeaseEnd: e.accommodationLeaseEnd,
    mobileProvided: e.mobileProvided ?? false,
    mobileAllowancePhone: e.mobileAllowancePhone,
    mobileProvider: e.mobileProvider,
    overtimeAllowanceEnabled: e.overtimeAllowanceEnabled ?? false,
    bonusEnabled: e.bonusEnabled ?? false,
    bonusMonthly: e.bonusMonthly ?? false,
    bonusAnnually: e.bonusAnnually ?? false,
    bonusAmount: e.bonusAmount,
    bonusByBasicSalary: e.bonusByBasicSalary ?? false,
    bonusByService: e.bonusByService ?? false,
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
    verifyPayrollPin: async (id: number, pin: string) => {
      const result = await http<{ valid?: boolean; Valid?: boolean }>(`/employees/${id}/verify-payroll-pin`, {
        method: 'POST',
        body: JSON.stringify({ pin }),
      });
      return { valid: result.valid ?? result.Valid ?? false };
    },
    resetPayrollPin: (id: number) => http<Employee>(`/employees/${id}/reset-payroll-pin`, { method: 'POST' }),
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
    list: (countryCode?: string) => {
      const params = countryCode ? `?countryCode=${encodeURIComponent(countryCode)}` : '';
      return http<PublicHoliday[]>(`/public-holidays${params}`);
    },
    create: (body: PublicHolidayRequest) =>
      http<PublicHoliday>('/public-holidays', { method: 'POST', body: JSON.stringify(body) }),
    toggleRecognized: (id: number) => http<PublicHoliday>(`/public-holidays/${id}/toggle-recognized`, { method: 'POST' }),
    toggleGazetted: (id: number) => http<PublicHoliday>(`/public-holidays/${id}/toggle-gazetted`, { method: 'POST' }),
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
    update: (body: CompanySettingUpdate) =>
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
  payStructures: {
    list: () => http<PayStructure[]>('/pay-structures'),
    get: (id: number) => http<PayStructure>(`/pay-structures/${id}`),
    create: (body: PayStructureRequest) => http<PayStructure>('/pay-structures', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: PayStructureRequest) => http<PayStructure>(`/pay-structures/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  },
  payrollRuns: {
    preview: (companyId: number, year: number, month: number) =>
      http<PayrollPreview>(`/payroll-runs/preview?companyId=${companyId}&year=${year}&month=${month}`),
    list: (companyId?: number, year?: number) => {
      const params = new URLSearchParams();
      if (companyId != null) params.set('companyId', String(companyId));
      if (year != null) params.set('year', String(year));
      const query = params.toString();
      return http<PayrollRunSummary[]>(`/payroll-runs${query ? `?${query}` : ''}`);
    },
    get: (id: number) => http<PayrollRunDetail>(`/payroll-runs/${id}`),
    process: (body: { companyId: number; year: number; month: number }) =>
      http<PayrollRunDetail>('/payroll-runs/process', { method: 'POST', body: JSON.stringify(body) }),
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
