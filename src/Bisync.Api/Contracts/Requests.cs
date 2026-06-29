using System.ComponentModel.DataAnnotations;
using Bisync.Api.Models;

namespace Bisync.Api.Contracts;

public class EmployeeRequest
{
    /// <summary>Ignored on create (auto-generated). Ignored on update.</summary>
    [MaxLength(20)]
    public string? EmployeeCode { get; set; }
    [Required, MaxLength(200)]
    public string Name { get; set; } = null!;
    [Required, EmailAddress, MaxLength(256)]
    public string Email { get; set; } = null!;
    [Required, MaxLength(30)]
    public string Mobile { get; set; } = null!;
    [MaxLength(100)]
    public string? Department { get; set; }
    public int? DivisionId { get; set; }
    public int? DepartmentId { get; set; }
    [Required, MaxLength(100)]
    public string Position { get; set; } = null!;
    [Required]
    public DateOnly JoinDate { get; set; }

    public bool FingerprintEnrolled { get; set; }
    public bool FaceRecognitionEnrolled { get; set; }
    public bool IsShiftEmployee { get; set; }
    [MaxLength(100)]
    public string? ShiftType { get; set; }
    public bool PosEnabled { get; set; }
    public bool BisyncEnabled { get; set; }
    public bool Active { get; set; } = true;
    public CheckinMethod CheckinMethod { get; set; } = CheckinMethod.Biometrics;
    [Range(0, 24)]
    public decimal WorkingHoursPerDay { get; set; } = 8;
    public int? EmployeeLevelId { get; set; }
    public int? ReportsToId { get; set; }

    [MaxLength(100)]
    public string? Nationality { get; set; }
    [MaxLength(50)]
    public string? IdPassportNumber { get; set; }
    public DateOnly? DateOfBirth { get; set; }
    [EmailAddress, MaxLength(256)]
    public string? PersonalEmail { get; set; }
    [MaxLength(500)]
    public string? PermanentAddress { get; set; }
    [MaxLength(20)]
    public string? MaritalStatus { get; set; }

    [MaxLength(100)]
    public string? BankName { get; set; }
    [MaxLength(30)]
    public string? BankAccountNumber { get; set; }
    [MaxLength(200)]
    public string? BankAccountHolderName { get; set; }

    [Range(0, 999999999)]
    public decimal? BaseSalary { get; set; }
    [Range(0, 999999999)]
    public decimal? ServiceAllowance { get; set; }
    [Range(0, 999999999)]
    public decimal? TransportAllowance { get; set; }
    [Range(0, 999999999)]
    public decimal? AccommodationAllowance { get; set; }
    [Range(0, 999999999)]
    public decimal? MobileAllowance { get; set; }
    public List<PayrollOtherAllowanceRequest>? OtherAllowances { get; set; }
    public bool? WorkPermitByCompany { get; set; }

    public bool TransportProvided { get; set; }
    [MaxLength(100)]
    public string? TransportCarModel { get; set; }
    [MaxLength(20)]
    public string? TransportPlateNumber { get; set; }

    public bool AccommodationProvided { get; set; }
    [MaxLength(500)]
    public string? AccommodationAddress { get; set; }
    public DateOnly? AccommodationLeaseStart { get; set; }
    public DateOnly? AccommodationLeaseEnd { get; set; }

    public bool MobileProvided { get; set; }
    [MaxLength(30)]
    public string? MobileAllowancePhone { get; set; }
    [MaxLength(50)]
    public string? MobileProvider { get; set; }

    public bool OvertimeAllowanceEnabled { get; set; }

    public bool BonusEnabled { get; set; }
    public bool BonusMonthly { get; set; }
    public bool BonusAnnually { get; set; }
    [Range(0, 999999999)]
    public decimal? BonusAmount { get; set; }
    public bool BonusByBasicSalary { get; set; }
    public bool BonusByService { get; set; }
}

public class PayrollOtherAllowanceRequest
{
    [Required, MaxLength(100)]
    public string Name { get; set; } = "";
    [Range(0, 999999999)]
    public decimal Amount { get; set; }
}

public class EducationRecordRequest
{
    [Required, MaxLength(200)]
    public string Degree { get; set; } = null!;
    [Required, MaxLength(200)]
    public string Institution { get; set; } = null!;
    [Required, MaxLength(10)]
    public string Year { get; set; } = null!;
    [Required, MaxLength(200)]
    public string Certificate { get; set; } = null!;
}

public class PreviousEmploymentRequest
{
    [Required, MaxLength(200)]
    public string CompanyName { get; set; } = null!;
    [Required, MaxLength(100)]
    public string Position { get; set; } = null!;
    [Required, MaxLength(10)]
    public string StartYear { get; set; } = null!;
    [Required, MaxLength(10)]
    public string EndYear { get; set; } = null!;
    [Range(0, 80)]
    public decimal YearsOfService { get; set; }
}

public class EmployeeMovementRequest
{
    [Required]
    public DateOnly Date { get; set; }
    [Required, MaxLength(100)]
    public string FromPosition { get; set; } = null!;
    [Required, MaxLength(100)]
    public string ToPosition { get; set; } = null!;
    public MovementType Type { get; set; }
    [Required, MaxLength(100)]
    public string Department { get; set; } = null!;
}

public class PerformanceAppraisalRequest
{
    [Required, MaxLength(10)]
    public string Year { get; set; } = null!;
    [Required, MaxLength(50)]
    public string Rating { get; set; } = null!;
    [Range(0, 5)]
    public decimal Score { get; set; }
    [Required, MaxLength(200)]
    public string Reviewer { get; set; } = null!;
    [MaxLength(2000)]
    public string? Comments { get; set; }
}

public class PayrollPinVerifyRequest
{
    [Required, MinLength(6), MaxLength(6)]
    public string Pin { get; set; } = null!;
}

public class PayrollPinVerifyResult
{
    public bool Valid { get; set; }
}

public class AttendanceRecordRequest
{
    [Required]
    public int EmployeeId { get; set; }
    [Required]
    public DateOnly Date { get; set; }
    public AttendanceStatus Status { get; set; }
    public TimeOnly? ScheduledIn { get; set; }
    public TimeOnly? ScheduledOut { get; set; }
    public TimeOnly? ActualIn { get; set; }
    public TimeOnly? ActualOut { get; set; }
}

public class LeaveRequestCreate
{
    [Required]
    public int EmployeeId { get; set; }
    public LeaveType Type { get; set; }
    [Required]
    public DateOnly StartDate { get; set; }
    [Required]
    public DateOnly EndDate { get; set; }
    [MaxLength(1000)]
    public string? Reason { get; set; }
}

public class LeaveBalanceRequest
{
    [Range(0, 999)]
    public decimal RdoBalance { get; set; }
    [Range(0, 999)]
    public decimal RphBalance { get; set; }
    [Range(0, 999)]
    public decimal AlBalance { get; set; }
}

public class ShiftScheduleRequest
{
    [Required]
    public int EmployeeId { get; set; }
    [Required]
    public DateOnly Date { get; set; }
    public ScheduleType Type { get; set; } = ScheduleType.Work;
    /// <summary>For Work entries; EndTime is computed from the employee's working hours.</summary>
    public TimeOnly? StartTime { get; set; }
}

public class EmployeeLevelRequest
{
    [Required, MaxLength(100)]
    public string LevelName { get; set; } = null!;
    [Range(0, 365)]
    public int AnnualLeaveDays { get; set; }
    [Range(0, 365)]
    public int SickLeaveDays { get; set; }
    public bool OvertimeEligible { get; set; }
    [Range(0, 24)]
    public decimal WorkingHoursPerDay { get; set; } = 8;
    [Range(0, 24)]
    public decimal BreakHoursPerShift { get; set; } = 1;
    public bool PublicHolidayEligible { get; set; }
    public bool IsShift { get; set; }
    [MaxLength(100)]
    public string? ShiftType { get; set; }
    public bool Active { get; set; } = true;
}

public class PublicHolidayRequest
{
    [Required, MaxLength(200)]
    public string Name { get; set; } = null!;
    [Required]
    public DateOnly Date { get; set; }
    public bool IsRecognized { get; set; } = true;
    public bool IsRecurringAnnually { get; set; }
    public bool IsGazetted { get; set; }
    [MaxLength(2)]
    public string? CountryCode { get; set; }
}

public class PayMultiplierRequest
{
    [Range(1, 10)]
    public decimal? PublicHolidayPayMultiplier { get; set; }
    public bool? ReplacementPublicHolidayEnabled { get; set; }
    [MaxLength(2)]
    public string? OperatingCountryCode { get; set; }
    public bool? GazettedPhReplacementDayEnabled { get; set; }
    [Range(0.1, 10)]
    public decimal? GazettedPhNormalHoursRate { get; set; }
    [Range(0.1, 10)]
    public decimal? GazettedPhOvertimeHoursRate { get; set; }
    public bool? NonGazettedPhReplacementDayEnabled { get; set; }
}

public class DivisionRequest
{
    [Required, MaxLength(100)]
    public string Name { get; set; } = null!;
    [MaxLength(20)]
    public string? Code { get; set; }
}

public class DepartmentRequest
{
    [Required, MaxLength(100)]
    public string Name { get; set; } = null!;
    [Required]
    public int DivisionId { get; set; }
}

public class DepartmentNode
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public int DivisionId { get; set; }
}

public class DivisionTreeNode
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public string? Code { get; set; }
    public List<DepartmentNode> Departments { get; set; } = [];
}

public class MandatoryContributionItem
{
    public int? Id { get; set; }
    [Required, MaxLength(100)]
    public string Name { get; set; } = null!;
    [Range(0, 100)]
    public decimal EmployerPct { get; set; }
    [Range(0, 100)]
    public decimal EmployeePct { get; set; }
}

public class ProvidentFundBracketItem
{
    public int? Id { get; set; }
    public int? MinAge { get; set; }
    public int? MaxAge { get; set; }
    public decimal? MinMonthlySalary { get; set; }
    public decimal? MaxMonthlySalary { get; set; }
    [Range(0, 100)]
    public decimal EmployerPct { get; set; }
    [Range(0, 100)]
    public decimal EmployeePct { get; set; }
    public bool NoContribution { get; set; }
}

public class SocsoBracketItem
{
    public int? Id { get; set; }
    public int? MinAge { get; set; }
    public int? MaxAge { get; set; }
    public decimal? MinMonthlySalary { get; set; }
    public decimal? MaxMonthlySalary { get; set; }
    [Range(0, 10000)]
    public decimal EmployerAmount { get; set; }
    [Range(0, 10000)]
    public decimal EmployeeAmount { get; set; }
}

public class PayStructureRequest
{
    [Required]
    public int CompanyId { get; set; }
    [Required, MaxLength(50)]
    public string PayType { get; set; } = null!;
    [Required, MaxLength(50)]
    public string PayCycle { get; set; } = null!;
    [Range(0, 100)]
    public decimal ProvidentFundEmployerPct { get; set; }
    [Range(0, 100)]
    public decimal ProvidentFundEmployeePct { get; set; }
    [Range(0, 100)]
    public decimal ForeignProvidentFundEmployerPct { get; set; } = 2;
    [Range(0, 100)]
    public decimal ForeignProvidentFundEmployeePct { get; set; } = 2;
    [Range(0, 100)]
    public decimal ForeignSocsoEmployerPct { get; set; } = 1.25m;
    [Range(1, 10)]
    public decimal OvertimeRateMultiplier { get; set; } = 1.5m;
    [MaxLength(20)]
    public string OvertimeCalculationMode { get; set; } = "Calculated";
    [Range(0, 999999999)]
    public decimal? OvertimeFixedHourlyRate { get; set; }
    public bool Active { get; set; } = true;

    public List<ProvidentFundBracketItem> ProvidentFundBrackets { get; set; } = [];
    public List<SocsoBracketItem> SocsoBrackets { get; set; } = [];
    public List<MandatoryContributionItem> MandatoryContributions { get; set; } = [];
}

public class PayStructureDetail
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string CompanyName { get; set; } = null!;
    public string CountryCode { get; set; } = null!;
    public string PayType { get; set; } = null!;
    public string PayCycle { get; set; } = null!;
    public decimal ProvidentFundEmployerPct { get; set; }
    public decimal ProvidentFundEmployeePct { get; set; }
    public decimal ForeignProvidentFundEmployerPct { get; set; }
    public decimal ForeignProvidentFundEmployeePct { get; set; }
    public decimal ForeignSocsoEmployerPct { get; set; }
    public decimal OvertimeRateMultiplier { get; set; }
    public string OvertimeCalculationMode { get; set; } = "";
    public decimal? OvertimeFixedHourlyRate { get; set; }
    public bool Active { get; set; }
    public List<ProvidentFundBracketItem> ProvidentFundBrackets { get; set; } = [];
    public List<SocsoBracketItem> SocsoBrackets { get; set; } = [];
    public List<MandatoryContributionItem> MandatoryContributions { get; set; } = [];
}

public class IncomeTaxBracketItem
{
    public int? Id { get; set; }
    [Range(0, 999999999)]
    public decimal MinAnnualChargeableIncome { get; set; }
    [Range(0, 999999999)]
    public decimal? MaxAnnualChargeableIncome { get; set; }
    [Range(0, 100)]
    public decimal RatePct { get; set; }
    [Range(0, 999999999)]
    public decimal BaseMinTaxAmount { get; set; }
}

public class IncomeTaxReliefItem
{
    public int? Id { get; set; }
    [Required, MaxLength(200)]
    public string Name { get; set; } = "";
    [Range(0, 999999999)]
    public decimal Amount { get; set; }
    public bool IsMaximum { get; set; }
    [MaxLength(50)]
    public string? ApplyCondition { get; set; }
}

public class IncomeTaxRebateItem
{
    public int? Id { get; set; }
    [Required, MaxLength(200)]
    public string Name { get; set; } = "";
    [Range(0, 999999999)]
    public decimal Amount { get; set; }
}

public class IncomeTaxYearRequest
{
    public bool Active { get; set; } = true;
    public List<IncomeTaxBracketItem> Brackets { get; set; } = [];
    public List<IncomeTaxReliefItem> Reliefs { get; set; } = [];
    public List<IncomeTaxRebateItem> Rebates { get; set; } = [];
}

public class IncomeTaxYearDetail
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string CompanyName { get; set; } = "";
    public int Year { get; set; }
    public string CountryCode { get; set; } = "";
    public bool Active { get; set; }
    public List<IncomeTaxBracketItem> Brackets { get; set; } = [];
    public List<IncomeTaxReliefItem> Reliefs { get; set; } = [];
    public List<IncomeTaxRebateItem> Rebates { get; set; } = [];
}

public class IncomeTaxEmployeeLineItem
{
    public int EmployeeId { get; set; }
    public string EmployeeCode { get; set; } = "";
    public string EmployeeName { get; set; } = "";
    public string Position { get; set; } = "";
    public decimal AnnualGross { get; set; }
    public decimal AnnualEpfEmployee { get; set; }
    public decimal AnnualTaxRelief { get; set; }
    public decimal BaseTaxAmount { get; set; }
    public decimal AnnualRebate { get; set; }
    public decimal AnnualTax { get; set; }
    public decimal MonthlyPcb { get; set; }
}

public class IncomeTaxYearPreviewDetail
{
    public int CompanyId { get; set; }
    public string CompanyName { get; set; } = "";
    public int Year { get; set; }
    public string CountryCode { get; set; } = "";
    public bool Configured { get; set; }
    public decimal TotalAnnualGross { get; set; }
    public decimal TotalAnnualTax { get; set; }
    public decimal TotalMonthlyPcb { get; set; }
    public int EmployeeCount { get; set; }
    public List<IncomeTaxEmployeeLineItem> Lines { get; set; } = [];
}

public class PayrollProcessRequest
{
    public int CompanyId { get; set; }
    public int Year { get; set; }
    public int Month { get; set; }
}

public class PayrollRunSummary
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string CompanyName { get; set; } = "";
    public int Year { get; set; }
    public int Month { get; set; }
    public string PayCycle { get; set; } = "";
    public string PayType { get; set; } = "";
    public string CountryCode { get; set; } = "";
    public string PeriodLabel { get; set; } = "";
    public DateOnly PeriodStart { get; set; }
    public DateOnly PeriodEnd { get; set; }
    public DateTime ProcessedAt { get; set; }
    public decimal TotalGross { get; set; }
    public decimal TotalPayout { get; set; }
    public int EmployeeCount { get; set; }
}

public class PayrollRunLineItem
{
    public int Id { get; set; }
    public int EmployeeId { get; set; }
    public string EmployeeCode { get; set; } = "";
    public string EmployeeName { get; set; } = "";
    public string Department { get; set; } = "";
    public string Position { get; set; } = "";
    public decimal PresentDays { get; set; }
    public decimal WorkingDays { get; set; }
    public decimal TotalHours { get; set; }
    public decimal OvertimeHours { get; set; }
    public decimal AttendanceRatio { get; set; }
    public decimal BaseSalary { get; set; }
    public decimal ServiceAllowance { get; set; }
    public decimal AccommodationAllowance { get; set; }
    public decimal TransportAllowance { get; set; }
    public decimal MobileAllowance { get; set; }
    public decimal BonusAmount { get; set; }
    public decimal OvertimeAmount { get; set; }
    public decimal EpfEmployeeAmount { get; set; }
    public decimal EpfEmployerAmount { get; set; }
    public decimal SocsoEmployeeAmount { get; set; }
    public decimal SocsoEmployerAmount { get; set; }
    public decimal IncomeTaxAmount { get; set; }
    public decimal GrossPay { get; set; }
    public decimal TotalPayout { get; set; }
}

public class PayrollRunDetail : PayrollRunSummary
{
    public List<PayrollRunLineItem> Lines { get; set; } = [];
}
