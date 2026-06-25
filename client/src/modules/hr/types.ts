export interface EducationRecord {
  id: number;
  degree: string;
  institution: string;
  year: string;
  certificate: string;
}

export interface PreviousEmployment {
  id: number;
  companyName: string;
  position: string;
  startYear: string;
  endYear: string;
  yearsOfService: number;
}

export type MovementType = 'Promotion' | 'Transfer' | 'Lateral';

export interface EmployeeMovement {
  id: number;
  date: string;
  fromPosition: string;
  toPosition: string;
  type: MovementType;
  department: string;
}

export interface PerformanceAppraisal {
  id: number;
  year: string;
  rating: string;
  score: number;
  reviewer: string;
  comments?: string;
}

export type CheckinMethod = 'POS' | 'Biometrics' | 'AccessTag';

export interface Employee {
  id: number;
  employeeCode: string;
  name: string;
  email: string;
  mobile: string;
  department: string;
  divisionId?: number | null;
  departmentId?: number | null;
  position: string;
  joinDate: string;
  fingerprintEnrolled: boolean;
  faceRecognitionEnrolled: boolean;
  isShiftEmployee: boolean;
  shiftType?: string | null;
  posEnabled: boolean;
  posPin?: string | null;
  posPinMustChange?: boolean;
  bisyncEnabled: boolean;
  active: boolean;
  checkinMethod: CheckinMethod;
  workingHoursPerDay: number;
  employeeLevelId?: number | null;
  employeeLevel?: EmployeeLevel | null;
  reportsToId?: number | null;
  reportsTo?: Pick<Employee, 'id' | 'name' | 'employeeCode' | 'position'> | null;
  nationality?: string | null;
  idPassportNumber?: string | null;
  dateOfBirth?: string | null;
  personalEmail?: string | null;
  permanentAddress?: string | null;
  education?: EducationRecord[];
  previousEmployments?: PreviousEmployment[];
  movements?: EmployeeMovement[];
  performanceAppraisals?: PerformanceAppraisal[];
}

export type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'HalfDay';

export interface AttendanceRecord {
  id: number;
  employeeId: number;
  date: string;
  status: AttendanceStatus;
  scheduledIn?: string | null;
  scheduledOut?: string | null;
  actualIn?: string | null;
  actualOut?: string | null;
}

export type LeaveType = 'RDO' | 'RPH' | 'AL' | 'UPL';
export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected';

export interface LeaveRequest {
  id: number;
  employeeId: number;
  type: LeaveType;
  startDate: string;
  endDate: string;
  status: LeaveStatus;
  reason?: string | null;
}

export interface LeaveBalanceRow {
  employeeId: number;
  employeeName: string;
  rdoBalance: number;
  rphBalance: number;
  alBalance: number;
}

export type ScheduleType = 'Work' | 'DO' | 'RDO' | 'AL' | 'RPH' | 'UPL';

export interface ShiftSchedule {
  id: number;
  employeeId: number;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  type: ScheduleType;
}

export interface PublicHoliday {
  id: number;
  name: string;
  date: string;
  isRecognized: boolean;
  countryCode?: string | null;
  catalogKey?: string | null;
}

export interface EmployeeLevel {
  id: number;
  levelName: string;
  annualLeaveDays: number;
  sickLeaveDays: number;
  overtimeEligible: boolean;
  workingHoursPerDay: number;
  breakHoursPerShift: number;
  publicHolidayEligible: boolean;
  isShift: boolean;
  shiftType?: string | null;
}

export interface CompanySetting {
  id: number;
  publicHolidayPayMultiplier: number;
  operatingCountryCode: string;
}

export interface CountryOption {
  countryCode: string;
  name: string;
}

export interface DepartmentNode {
  id: number;
  name: string;
  divisionId: number;
}

export interface DivisionTreeNode {
  id: number;
  name: string;
  code?: string | null;
  departments: DepartmentNode[];
}

export interface Division {
  id: number;
  name: string;
  code?: string | null;
}

export interface Department {
  id: number;
  name: string;
  divisionId: number;
}

export interface EmployeeRequest {
  employeeCode?: string;
  name: string;
  email: string;
  mobile: string;
  department?: string | null;
  divisionId?: number | null;
  departmentId?: number | null;
  position: string;
  joinDate: string;
  fingerprintEnrolled: boolean;
  faceRecognitionEnrolled: boolean;
  isShiftEmployee: boolean;
  shiftType?: string | null;
  posEnabled: boolean;
  bisyncEnabled: boolean;
  active?: boolean;
  checkinMethod?: CheckinMethod;
  workingHoursPerDay: number;
  employeeLevelId?: number | null;
  reportsToId?: number | null;
  nationality?: string | null;
  idPassportNumber?: string | null;
  dateOfBirth?: string | null;
  personalEmail?: string | null;
  permanentAddress?: string | null;
}

export type EmployeeCreateRequest = Omit<EmployeeRequest, 'employeeCode'>;
