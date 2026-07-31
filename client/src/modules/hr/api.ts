import { HR_API_BASE } from '../../config/hrBackend';
import type {
  AttendanceRecord, AttendanceStatus, CompanySetting, CompanySettingUpdate, CountryOption, Department, Division, DivisionTreeNode,
  Employee, EmployeeCreateRequest, EmployeeLevel, EmployeeRequest,
  IncomeTaxYear, IncomeTaxYearPreview, IncomeTaxYearRequest,
  LeaveBalanceRow, LeaveRequest, LeaveType, PayStructure, PayStructureRequest, PayrollPreview, PayrollRunDetail, PayrollRunSummary, PublicHoliday, PublicHolidayRequest, ScheduleType, ShiftSchedule,
} from './types';

function formatHttpError(status: number, statusText: string, body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return `${status} ${statusText}`;
  try {
    const parsed = JSON.parse(trimmed) as {
      message?: string;
      title?: string;
      errors?: Record<string, string[] | string>;
    };
    if (parsed.errors && typeof parsed.errors === 'object') {
      const parts = Object.entries(parsed.errors).flatMap(([key, value]) => {
        const messages = Array.isArray(value) ? value : [String(value)];
        return messages.map(msg => (key ? `${key}: ${msg}` : msg));
      });
      if (parts.length > 0) return parts.join(' ');
    }
    if (parsed.message?.trim()) return parsed.message.trim();
    if (parsed.title?.trim()) return parsed.title.trim();
  } catch {
    /* plain-text body */
  }
  return trimmed;
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${HR_API_BASE}${path}`, {
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(formatHttpError(res.status, res.statusText, text));
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

function blankToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Normalize date fields to yyyy-MM-dd or null (API DateOnly rejects "" / ISO timestamps). */
function toDateOnlyOrNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1]! : null;
}

function toDateOnlyRequired(value: string | null | undefined, fallback: string): string {
  return toDateOnlyOrNull(value) ?? fallback;
}

export function toEmployeeRequest(e: Employee): EmployeeRequest {
  const today = new Date().toISOString().slice(0, 10);
  return {
    employeeCode: e.employeeCode,
    name: e.name?.trim() ?? '',
    email: e.email?.trim() ?? '',
    mobile: e.mobile?.trim() ?? '',
    department: blankToNull(e.department) ?? undefined,
    divisionId: e.divisionId ?? null,
    departmentId: e.departmentId ?? null,
    position: e.position?.trim() ?? '',
    joinDate: toDateOnlyRequired(e.joinDate, today),
    fingerprintEnrolled: e.fingerprintEnrolled,
    faceRecognitionEnrolled: e.faceRecognitionEnrolled,
    isShiftEmployee: e.isShiftEmployee,
    shiftType: blankToNull(e.shiftType),
    posEnabled: e.posEnabled,
    bisyncEnabled: e.bisyncEnabled,
    active: e.active ?? true,
    checkinMethod: e.checkinMethod ?? 'Biometrics',
    workingHoursPerDay: e.workingHoursPerDay,
    employeeLevelId: e.employeeLevelId ?? null,
    reportsToId: e.reportsToId ?? null,
    nationality: blankToNull(e.nationality),
    idPassportNumber: blankToNull(e.idPassportNumber),
    dateOfBirth: toDateOnlyOrNull(e.dateOfBirth),
    personalEmail: blankToNull(e.personalEmail),
    permanentAddress: blankToNull(e.permanentAddress),
    maritalStatus: blankToNull(e.maritalStatus),
    bankName: blankToNull(e.bankName),
    bankAccountNumber: blankToNull(e.bankAccountNumber),
    bankAccountHolderName: blankToNull(e.bankAccountHolderName),
    baseSalary: e.baseSalary,
    serviceAllowance: e.serviceAllowance,
    transportAllowance: e.transportAllowance,
    accommodationAllowance: e.accommodationAllowance,
    mobileAllowance: e.mobileAllowance,
    otherAllowances: (e.otherAllowances ?? [])
      .filter(a => (a.name ?? '').trim().length > 0)
      .map(a => ({ name: a.name.trim(), amount: a.amount })),
    workPermitByCompany: e.workPermitByCompany,
    transportProvided: e.transportProvided ?? false,
    transportCarModel: blankToNull(e.transportCarModel),
    transportPlateNumber: blankToNull(e.transportPlateNumber),
    accommodationProvided: e.accommodationProvided ?? false,
    accommodationAddress: blankToNull(e.accommodationAddress),
    accommodationLeaseStart: toDateOnlyOrNull(e.accommodationLeaseStart),
    accommodationLeaseEnd: toDateOnlyOrNull(e.accommodationLeaseEnd),
    mobileProvided: e.mobileProvided ?? false,
    mobileAllowancePhone: blankToNull(e.mobileAllowancePhone),
    mobileProvider: blankToNull(e.mobileProvider),
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
    verifyPosPin: async (pin: string) => {
      const result = await http<{
        valid?: boolean
        Valid?: boolean
        employeeId?: number | null
        EmployeeId?: number | null
        employeeName?: string | null
        EmployeeName?: string | null
        employeeCode?: string | null
        EmployeeCode?: string | null
        mustChangePin?: boolean
        MustChangePin?: boolean
      }>('/employees/verify-pos-pin', {
        method: 'POST',
        body: JSON.stringify({ pin }),
      });
      return {
        valid: result.valid ?? result.Valid ?? false,
        employeeId: result.employeeId ?? result.EmployeeId ?? null,
        employeeName: result.employeeName ?? result.EmployeeName ?? null,
        employeeCode: result.employeeCode ?? result.EmployeeCode ?? null,
        mustChangePin: result.mustChangePin ?? result.MustChangePin ?? false,
      };
    },
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
    list: (from: string, to: string, employeeId?: number) => {
      const params = new URLSearchParams({ from, to });
      if (employeeId != null) params.set('employeeId', String(employeeId));
      return http<AttendanceRecord[]>(`/attendance?${params}`);
    },
    create: (body: {
      employeeId: number;
      date: string;
      status: AttendanceStatus;
      scheduledIn?: string | null;
      scheduledOut?: string | null;
      actualIn?: string | null;
      actualOut?: string | null;
    }) => http<AttendanceRecord>('/attendance', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: {
      employeeId: number;
      date: string;
      status: AttendanceStatus;
      scheduledIn?: string | null;
      scheduledOut?: string | null;
      actualIn?: string | null;
      actualOut?: string | null;
    }) => http<AttendanceRecord>(`/attendance/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
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
  incomeTax: {
    get: (companyId: number, year: number) =>
      http<IncomeTaxYear>(`/income-tax/${companyId}/${year}`),
    save: (companyId: number, year: number, body: IncomeTaxYearRequest) =>
      http<IncomeTaxYear>(`/income-tax/${companyId}/${year}`, { method: 'PUT', body: JSON.stringify(body) }),
    preview: (companyId: number, year: number) =>
      http<IncomeTaxYearPreview>(`/income-tax/${companyId}/${year}/preview`),
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
