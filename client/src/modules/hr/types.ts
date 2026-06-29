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

export interface PayrollOtherAllowance {
  name: string;
  amount: number;
}

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
  payrollPinMustChange?: boolean;
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
  maritalStatus?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountHolderName?: string | null;
  education?: EducationRecord[];
  previousEmployments?: PreviousEmployment[];
  movements?: EmployeeMovement[];
  performanceAppraisals?: PerformanceAppraisal[];
  baseSalary?: number | null;
  serviceAllowance?: number | null;
  transportAllowance?: number | null;
  accommodationAllowance?: number | null;
  mobileAllowance?: number | null;
  otherAllowances?: PayrollOtherAllowance[];
  workPermitByCompany?: boolean | null;
  transportProvided?: boolean;
  transportCarModel?: string | null;
  transportPlateNumber?: string | null;
  accommodationProvided?: boolean;
  accommodationAddress?: string | null;
  accommodationLeaseStart?: string | null;
  accommodationLeaseEnd?: string | null;
  mobileProvided?: boolean;
  mobileAllowancePhone?: string | null;
  mobileProvider?: string | null;
  overtimeAllowanceEnabled?: boolean;
  bonusEnabled?: boolean;
  bonusMonthly?: boolean;
  bonusAnnually?: boolean;
  bonusAmount?: number | null;
  bonusByBasicSalary?: boolean;
  bonusByService?: boolean;
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

export type ScheduleLeaveType = Exclude<ScheduleType, 'Work'>;

export type ScheduleBatchChange =
  | { action: 'clear'; employeeId: number; date: string }
  | { action: 'upsert'; employeeId: number; date: string; type: ScheduleType; startTime?: string };

export interface PublicHoliday {
  id: number;
  name: string;
  date: string;
  isRecognized: boolean;
  countryCode?: string | null;
  catalogKey?: string | null;
  isRecurringAnnually?: boolean;
  isGazetted?: boolean;
}

export interface PublicHolidayRequest {
  name: string;
  date: string;
  isRecognized: boolean;
  isRecurringAnnually: boolean;
  isGazetted?: boolean;
  countryCode: string;
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
  active: boolean;
}

export interface CompanySetting {
  id: number;
  publicHolidayPayMultiplier: number;
  replacementPublicHolidayEnabled: boolean;
  operatingCountryCode: string;
  gazettedPhReplacementDayEnabled: boolean;
  gazettedPhNormalHoursRate: number;
  gazettedPhOvertimeHoursRate: number;
  nonGazettedPhReplacementDayEnabled: boolean;
}

export type CompanySettingUpdate = Partial<Pick<CompanySetting,
  | 'publicHolidayPayMultiplier'
  | 'replacementPublicHolidayEnabled'
  | 'operatingCountryCode'
  | 'gazettedPhReplacementDayEnabled'
  | 'gazettedPhNormalHoursRate'
  | 'gazettedPhOvertimeHoursRate'
  | 'nonGazettedPhReplacementDayEnabled'
>>;

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
  maritalStatus?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountHolderName?: string | null;
  baseSalary?: number | null;
  serviceAllowance?: number | null;
  transportAllowance?: number | null;
  accommodationAllowance?: number | null;
  mobileAllowance?: number | null;
  otherAllowances?: PayrollOtherAllowance[];
  workPermitByCompany?: boolean | null;
  transportProvided?: boolean;
  transportCarModel?: string | null;
  transportPlateNumber?: string | null;
  accommodationProvided?: boolean;
  accommodationAddress?: string | null;
  accommodationLeaseStart?: string | null;
  accommodationLeaseEnd?: string | null;
  mobileProvided?: boolean;
  mobileAllowancePhone?: string | null;
  mobileProvider?: string | null;
  overtimeAllowanceEnabled?: boolean;
  bonusEnabled?: boolean;
  bonusMonthly?: boolean;
  bonusAnnually?: boolean;
  bonusAmount?: number | null;
  bonusByBasicSalary?: boolean;
  bonusByService?: boolean;
}

export type EmployeeCreateRequest = Omit<EmployeeRequest, 'employeeCode'>;

export interface MandatoryContributionItem {
  id?: number | null;
  name: string;
  employerPct: number;
  employeePct: number;
}

export interface ProvidentFundBracketItem {
  id?: number | null;
  minAge?: number | null;
  maxAge?: number | null;
  minMonthlySalary?: number | null;
  maxMonthlySalary?: number | null;
  employerPct: number;
  employeePct: number;
  noContribution: boolean;
}

export interface SocsoBracketItem {
  id?: number | null;
  minAge?: number | null;
  maxAge?: number | null;
  minMonthlySalary?: number | null;
  maxMonthlySalary?: number | null;
  employerAmount: number;
  employeeAmount: number;
}

export interface PayStructure {
  id: number;
  companyId: number;
  companyName: string;
  countryCode: string;
  payType: string;
  payCycle: string;
  providentFundEmployerPct: number;
  providentFundEmployeePct: number;
  foreignProvidentFundEmployerPct: number;
  foreignProvidentFundEmployeePct: number;
  foreignSocsoEmployerPct: number;
  overtimeRateMultiplier: number;
  overtimeCalculationMode: string;
  overtimeFixedHourlyRate?: number | null;
  active: boolean;
  providentFundBrackets: ProvidentFundBracketItem[];
  socsoBrackets: SocsoBracketItem[];
  mandatoryContributions: MandatoryContributionItem[];
}

export type PayStructureRequest = Omit<PayStructure, 'id' | 'companyName' | 'countryCode' | 'mandatoryContributions' | 'providentFundBrackets' | 'socsoBrackets'> & {
  providentFundBrackets: ProvidentFundBracketItem[];
  socsoBrackets: SocsoBracketItem[];
  mandatoryContributions: MandatoryContributionItem[];
};

export interface PayrollRunLine {
  id?: number;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  department: string;
  position: string;
  presentDays: number;
  workingDays: number;
  totalHours: number;
  overtimeHours: number;
  attendanceRatio: number;
  baseSalary: number;
  serviceAllowance: number;
  accommodationAllowance: number;
  transportAllowance: number;
  mobileAllowance: number;
  bonusAmount: number;
  overtimeAmount: number;
  epfEmployeeAmount: number;
  epfEmployerAmount: number;
  socsoEmployeeAmount: number;
  socsoEmployerAmount: number;
  incomeTaxAmount: number;
  grossPay: number;
  totalPayout: number;
}

export interface PayrollPreview {
  companyId: number;
  companyName: string;
  year: number;
  month: number;
  payCycle: string;
  payType: string;
  countryCode: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  totalGross: number;
  totalPayout: number;
  employeeCount: number;
  alreadyProcessed: boolean;
  existingRunId: number | null;
  lines: PayrollRunLine[];
}

export interface PayrollRunSummary {
  id: number;
  companyId: number;
  companyName: string;
  year: number;
  month: number;
  payCycle: string;
  payType: string;
  countryCode: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  processedAt: string;
  totalGross: number;
  totalPayout: number;
  employeeCount: number;
}

export interface PayrollRunDetail extends PayrollRunSummary {
  lines: PayrollRunLine[];
}

export interface IncomeTaxBracketItem {
  id?: number;
  minAnnualChargeableIncome: number;
  maxAnnualChargeableIncome: number | null;
  ratePct: number;
  baseMinTaxAmount: number;
}

export interface IncomeTaxReliefItem {
  id?: number;
  name: string;
  amount: number;
  isMaximum?: boolean;
  applyCondition?: string | null;
}

export interface IncomeTaxRebateItem {
  id?: number;
  name: string;
  amount: number;
}

export interface IncomeTaxYear {
  id: number;
  companyId: number;
  companyName: string;
  year: number;
  countryCode: string;
  active: boolean;
  brackets: IncomeTaxBracketItem[];
  reliefs: IncomeTaxReliefItem[];
  rebates: IncomeTaxRebateItem[];
}

export interface IncomeTaxYearRequest {
  active: boolean;
  brackets: IncomeTaxBracketItem[];
  reliefs: IncomeTaxReliefItem[];
  rebates: IncomeTaxRebateItem[];
}

export interface IncomeTaxEmployeeLine {
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  position: string;
  annualGross: number;
  annualEpfEmployee: number;
  annualTaxRelief: number;
  baseTaxAmount: number;
  annualRebate: number;
  annualTax: number;
  monthlyPcb: number;
}

export interface IncomeTaxYearPreview {
  companyId: number;
  companyName: string;
  year: number;
  countryCode: string;
  configured: boolean;
  totalAnnualGross: number;
  totalAnnualTax: number;
  totalMonthlyPcb: number;
  employeeCount: number;
  lines: IncomeTaxEmployeeLine[];
}
