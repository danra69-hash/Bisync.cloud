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
    public int? CompanyId { get; set; }

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

public class VendorContactRequest
{
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;
    [MaxLength(100)]
    public string Position { get; set; } = string.Empty;
    [MaxLength(30)]
    public string Mobile { get; set; } = string.Empty;
    [MaxLength(256)]
    public string Email { get; set; } = string.Empty;
    public bool IsDefault { get; set; }
}

public class EngageVendorRequest
{
    public List<VendorContactRequest> Contacts { get; set; } = [];
    [MaxLength(200)]
    public string? RequestedBy { get; set; }
}

public class ApproveVendorEngagementRequest
{
    [Range(0, 999999999)]
    public decimal MinOrderAmount { get; set; }
    [Range(0, 999999999)]
    public decimal DeliveryChargeBelowMin { get; set; }
    [Required, MaxLength(20)]
    public string PaymentTerms { get; set; } = string.Empty;
    [MaxLength(200)]
    public string? ApprovedBy { get; set; }
}

public class RejectVendorEngagementRequest
{
    [MaxLength(200)]
    public string? RejectedBy { get; set; }
    [MaxLength(500)]
    public string? Reason { get; set; }
}

public class VendorOrderLineAdjustRequest
{
    public int Id { get; set; }
    [Range(0.0001, 999999999)]
    public decimal? Quantity { get; set; }
    [Range(0, 999999999)]
    public decimal? UnitPrice { get; set; }
}

public class CreateVendorRequest
{
    public int? CompanyId { get; set; }
    [Required, MaxLength(50)]
    public string ExternalId { get; set; } = string.Empty;
    [Required, MaxLength(200)]
    public string Name { get; set; } = string.Empty;
    [MaxLength(20)]
    public string Type { get; set; } = "offline";
    [MaxLength(50)]
    public string Brn { get; set; } = string.Empty;
    [MaxLength(300)]
    public string Products { get; set; } = string.Empty;
    [MaxLength(100)]
    public string City { get; set; } = string.Empty;
    [MaxLength(100)]
    public string State { get; set; } = string.Empty;
    [MaxLength(400)]
    public string Address { get; set; } = string.Empty;
    [MaxLength(200)]
    public string ContactPerson { get; set; } = string.Empty;
    [MaxLength(100)]
    public string ContactPosition { get; set; } = string.Empty;
    [MaxLength(30)]
    public string Mobile { get; set; } = string.Empty;
    [MaxLength(256)]
    public string Email { get; set; } = string.Empty;
    [Required, MaxLength(30)]
    public string ProductPolicyTag { get; set; } = string.Empty;
}

public class UpdateVendorRequest
{
    [Required, MaxLength(200)]
    public string Name { get; set; } = string.Empty;
    [MaxLength(20)]
    public string Type { get; set; } = "offline";
    [MaxLength(50)]
    public string Brn { get; set; } = string.Empty;
    [MaxLength(300)]
    public string Products { get; set; } = string.Empty;
    [MaxLength(100)]
    public string City { get; set; } = string.Empty;
    [MaxLength(100)]
    public string State { get; set; } = string.Empty;
    [MaxLength(400)]
    public string Address { get; set; } = string.Empty;
    [MaxLength(200)]
    public string ContactPerson { get; set; } = string.Empty;
    [MaxLength(100)]
    public string ContactPosition { get; set; } = string.Empty;
    [MaxLength(30)]
    public string Mobile { get; set; } = string.Empty;
    [MaxLength(256)]
    public string Email { get; set; } = string.Empty;
    [Required, MaxLength(30)]
    public string ProductPolicyTag { get; set; } = string.Empty;
}

public class SetVendorActiveRequest
{
    public bool Active { get; set; }
    public int? CompanyId { get; set; }
}

public class UntagVendorComponentsRequest
{
    public int? CompanyId { get; set; }
    public List<int>? ComponentIds { get; set; }
}

public class CreatePurchaseOrderItemRequest
{
    [MaxLength(32)]
    public string? ComponentId { get; set; }
    [MaxLength(200)]
    public string? ComponentName { get; set; }
    [MaxLength(32)]
    public string? VendorProductId { get; set; }
    [Required, MaxLength(300)]
    public string Name { get; set; } = string.Empty;
    [Range(0.0001, 999999999)]
    public decimal Quantity { get; set; }
    [Range(0, 999999999)]
    public decimal UnitPrice { get; set; }
    [MaxLength(50)]
    public string Unit { get; set; } = string.Empty;
    [MaxLength(50)]
    public string? ComponentUom { get; set; }
    [MaxLength(200)]
    public string DeliveryPackage { get; set; } = string.Empty;
}

public class CreatePurchaseOrderRequest
{
    [Required, MaxLength(200)]
    public string VendorName { get; set; } = string.Empty;
    [MaxLength(32)]
    public string? VendorExternalId { get; set; }
    [MaxLength(50)]
    public string? PoNumber { get; set; }
    [MaxLength(10)]
    public string? DocumentType { get; set; }
    public DateOnly? OrderDate { get; set; }
    public DateOnly? DeliveryDate { get; set; }
    [MaxLength(50)]
    public string Status { get; set; } = "Open";
    public List<CreatePurchaseOrderItemRequest> Items { get; set; } = [];
}

public class CreatePurchaseOrdersBatchRequest
{
    public int? CompanyId { get; set; }
    public List<string> LocationExternalIds { get; set; } = [];
    [MaxLength(200)]
    public string? InitiatedBy { get; set; }
    [MaxLength(200)]
    public string? ApprovedBy { get; set; }
    public List<CreatePurchaseOrderRequest> Orders { get; set; } = [];
}

public class ApprovePurchaseOrderRequest
{
    [MaxLength(200)]
    public string? ApprovedBy { get; set; }
}

public class PurchaseOrderLineWorkflowRequest
{
    public int ItemId { get; set; }
    [Range(0, 999999999)]
    public decimal Quantity { get; set; }
    [Range(0, 999999999)]
    public decimal UnitPrice { get; set; }
    [MaxLength(50)]
    public string? ComponentUom { get; set; }
    [Range(0, 999999999)]
    public decimal TaxAmount { get; set; }
    [MaxLength(100)]
    public string? HalalCertNo { get; set; }
    /// <summary>Optional product expiry date as yyyy-MM-dd.</summary>
    [MaxLength(20)]
    public string? ProductExpiryDate { get; set; }
    /// <summary>Optional temperature check (°C) at receive/consolidate.</summary>
    public decimal? ReceivedTemperature { get; set; }
}

public class CreateCashPurchaseRequest
{
    public DateOnly DatePurchased { get; set; }
    [MaxLength(200)]
    public string StoreName { get; set; } = string.Empty;
    [MaxLength(50)]
    public string ComponentId { get; set; } = string.Empty;
    [MaxLength(200)]
    public string? ComponentName { get; set; }
    [MaxLength(200)]
    public string StoreProductName { get; set; } = string.Empty;
    [MaxLength(100)]
    public string DeliveryUnit { get; set; } = string.Empty;
    [Range(0, 999999999)]
    public decimal DeliveryPrice { get; set; }
    [Range(0.0001, 999999999)]
    public decimal Quantity { get; set; }
    [MaxLength(50)]
    public string ComponentUom { get; set; } = string.Empty;
    [MaxLength(100)]
    public string? ReceiptNumber { get; set; }
    [MaxLength(500)]
    public string? ReceiptFileName { get; set; }
    public string? ReceiptFileBase64 { get; set; }
    public int? CompanyId { get; set; }
    public List<string> LocationExternalIds { get; set; } = [];
}

public class UpsertOrderTemplateItemRequest
{
    [MaxLength(50)]
    public string ComponentId { get; set; } = string.Empty;
    [MaxLength(200)]
    public string? ComponentName { get; set; }
    [MaxLength(50)]
    public string? VendorProductId { get; set; }
    [MaxLength(50)]
    public string? VendorExternalId { get; set; }
    [MaxLength(200)]
    public string? VendorName { get; set; }
    [MaxLength(200)]
    public string? ProductName { get; set; }
    [Range(0.0001, 999999999)]
    public decimal Quantity { get; set; }
    [MaxLength(50)]
    public string? ComponentUom { get; set; }
    [MaxLength(200)]
    public string? DeliveryUnit { get; set; }
}

public class UpsertOrderTemplateRequest
{
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;
    [MaxLength(50)]
    public string? VendorExternalId { get; set; }
    [MaxLength(200)]
    public string? VendorName { get; set; }
    [MaxLength(20)]
    public string? ScheduleMode { get; set; }
    public List<string> Weekdays { get; set; } = [];
    public List<int> MonthDays { get; set; } = [];
    public bool RepeatEnabled { get; set; }
    public int? CompanyId { get; set; }
    public List<string> LocationExternalIds { get; set; } = [];
    public List<UpsertOrderTemplateItemRequest> Items { get; set; } = [];
}

public class UpsertProductComponentItemRequest
{
    [MaxLength(50)]
    public string ComponentId { get; set; } = string.Empty;
    [MaxLength(200)]
    public string? ComponentName { get; set; }
    [MaxLength(50)]
    public string? ComponentUom { get; set; }
    [Range(0, 999999999)]
    public decimal ComponentUomPrice { get; set; }
    [Range(0.0001, 999999999)]
    public decimal Quantity { get; set; }
}

public class UpsertProductAliasRequest
{
    public int? Id { get; set; }
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;
    [Range(0, 999999999)]
    public decimal Rrp { get; set; }
    public string? B2bSalesConfigJson { get; set; }
}

public class UpsertProductRequest
{
    [MaxLength(50)]
    public string? ProductId { get; set; }
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;
    [MaxLength(100)]
    public string? Category { get; set; }
    [MaxLength(100)]
    public string? Group { get; set; }
    public bool IsSubProduct { get; set; }
    public bool B2cEnabled { get; set; }
    public bool B2bEnabled { get; set; }
    [MaxLength(20)]
    public string? B2bPackageUnit { get; set; }
    public string? B2bSalesConfigJson { get; set; }
    public decimal? Rrp { get; set; }
    [Range(0, 999999999)]
    public decimal? YieldQuantity { get; set; }
    [MaxLength(20)]
    public string? YieldUom { get; set; }
    public string? YieldAltUnitsJson { get; set; }
    [Range(0, 9999)]
    public int? ExpiryPeriodDays { get; set; }
    [Range(0, 99999)]
    public int? ActivationPeriodHours { get; set; }
    [Range(1, 365)]
    public int? OrderLockPeriodDays { get; set; }
    [Range(0, 999999999)]
    public decimal? ParStock { get; set; }
    [MaxLength(20)]
    public string? ParStockUom { get; set; }
    public bool? PosEnabled { get; set; }
    public bool? Active { get; set; }
    public int? CompanyId { get; set; }
    public List<string> LocationExternalIds { get; set; } = [];
    public List<UpsertProductComponentItemRequest> Items { get; set; } = [];
    public List<UpsertProductComponentItemRequest> PackagingItems { get; set; } = [];
    public List<UpsertProductAliasRequest> Aliases { get; set; } = [];
}

public class PatchProductRequest
{
    public bool? PosEnabled { get; set; }
    public List<PosDeliveryUnitRequest>? PosDeliveryUnits { get; set; }
    public bool? Active { get; set; }
    [Range(0, 999999999)]
    public decimal? Rrp { get; set; }
    [Range(0, 999999999)]
    public decimal? ParStock { get; set; }
    [MaxLength(20)]
    public string? ParStockUom { get; set; }
    public string? YieldAltUnitsJson { get; set; }
    public List<string>? LocationExternalIds { get; set; }
}

public class PatchProductManagementRequest
{
    [MaxLength(20)]
    public string? PackageUnit { get; set; }
    [Range(0, 999999999)]
    public decimal? InStock { get; set; }
    [Range(0, 999999999)]
    public decimal? SalesPerDay { get; set; }
    [Range(1, 365)]
    public int? OrderLockPeriodDays { get; set; }
    public List<string> LocationExternalIds { get; set; } = [];
}

public class ProductManagementActionRequest
{
    public List<string> LocationExternalIds { get; set; } = [];
    [Range(0.0001, 999999999)]
    public decimal BatchQty { get; set; }
    public string? ProductionDate { get; set; }
    public string? ExpiryDate { get; set; }
    public bool OverrideStock { get; set; }
}

public class ProduceBatchRequest
{
    public List<string> LocationExternalIds { get; set; } = [];
    [Range(0.0001, 999999999)]
    public decimal BatchQty { get; set; }
    public string? ProductionDate { get; set; }
    public string? ExpiryDate { get; set; }
    public bool OverrideStock { get; set; }
}

public class RecordProductSaleRequest
{
    public List<string> LocationExternalIds { get; set; } = [];
    [Range(0.0001, 999999999)]
    public decimal QuantitySold { get; set; }
  /// <summary>pos, online, or offline</summary>
    public string SalesChannel { get; set; } = "pos";
}

public class PatchProductionBatchRequest
{
    [Range(0.0001, 999999999)]
    public decimal BatchQty { get; set; }
    public string? ProductionDate { get; set; }
    public string? ExpiryDate { get; set; }
    public bool OverrideStock { get; set; }
}

public class FulfillB2bSalesOrderRequest
{
    public bool DeliveryOrderIssued { get; set; }
    public bool InvoiceIssued { get; set; }
}

public class CreateB2bSalesOrderRequest
{
  [Range(1, int.MaxValue)]
    public int CompanyId { get; set; }
    [MaxLength(80)]
    public string CustomerExternalId { get; set; } = string.Empty;
    [MaxLength(200)]
    public string CustomerName { get; set; } = string.Empty;
    /// <summary>sales_order or online_order</summary>
    [MaxLength(40)]
    public string Source { get; set; } = "sales_order";
    [Range(1, 365)]
    public int LockPeriodDays { get; set; }
    public List<CreateB2bSalesOrderLineRequest> Lines { get; set; } = [];
}

public class CreateB2bSalesOrderLineRequest
{
    [Range(1, int.MaxValue)]
    public int ProductId { get; set; }
    public int? ProductAliasId { get; set; }
    [MaxLength(80)]
    public string LocationExternalId { get; set; } = string.Empty;
    [Range(0.0001, 999999999)]
    public decimal QuantityOrdered { get; set; }
    [MaxLength(40)]
    public string? Uom { get; set; }
    [Range(0, 999999999)]
    public decimal? Rrp { get; set; }
}

public class PurchaseOrderWorkflowRequest
{
    public List<PurchaseOrderLineWorkflowRequest> Items { get; set; } = [];
    /// <summary>Vendor delivery order number. Required on receive unless invoice number is set.</summary>
    [MaxLength(100)]
    public string? VendorDoNumber { get; set; }
    /// <summary>Vendor invoice number. Required on receive unless DO number is set.</summary>
    [MaxLength(100)]
    public string? VendorInvoiceNumber { get; set; }
    /// <summary>Customer input: satisfied | acceptable | poor.</summary>
    [MaxLength(32)]
    public string? ProductQualityRating { get; set; }
    [MaxLength(2000)]
    public string? ProductQualityComment { get; set; }
    /// <summary>Customer input: satisfied | acceptable | poor.</summary>
    [MaxLength(32)]
    public string? HygieneRating { get; set; }
    [MaxLength(2000)]
    public string? HygieneComment { get; set; }
}

public class B2bCustomerContactRequest
{
    public string? Id { get; set; }
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;
    [MaxLength(100)]
    public string Position { get; set; } = string.Empty;
    [MaxLength(30)]
    public string Mobile { get; set; } = string.Empty;
    [MaxLength(256)]
    public string Email { get; set; } = string.Empty;
    public bool IsDefault { get; set; }
}

public class B2bPurchaseHistoryLineRequest
{
    public string DateOrdered { get; set; } = string.Empty;
    public string DateDelivered { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public string DeliveryUom { get; set; } = string.Empty;
    public decimal Rrp { get; set; }
    public decimal QtyOrdered { get; set; }
    public decimal ActualRrp { get; set; }
    public decimal TotalRevenue { get; set; }
    public decimal Cogs { get; set; }
    public decimal CogsPercent { get; set; }
}

public class TaggedB2bProductUnitRequest
{
    public int ProductId { get; set; }
    public int? AliasId { get; set; }
    [MaxLength(80)]
    public string UnitKey { get; set; } = string.Empty;
    /// <summary>Customer selling price for SO/invoice when &gt; 0; otherwise published RRP is used.</summary>
    public decimal? AppliedRrp { get; set; }
    /// <summary>Discount % off published RRP (0–100), kept in sync with AppliedRrp.</summary>
    public decimal? DiscountPercent { get; set; }
}

public class PosDeliveryUnitRequest
{
    [MaxLength(80)]
    public string UnitKey { get; set; } = string.Empty;
}

public class UpsertB2bCustomerRequest
{
    public int CompanyId { get; set; }
    [Required, MaxLength(50)]
    public string ExternalId { get; set; } = string.Empty;
    [Required, MaxLength(200)]
    public string CompanyName { get; set; } = string.Empty;
    [MaxLength(50)]
    public string Brn { get; set; } = string.Empty;
    [MaxLength(400)]
    public string Address { get; set; } = string.Empty;
    [MaxLength(100)]
    public string City { get; set; } = string.Empty;
    [MaxLength(100)]
    public string State { get; set; } = string.Empty;
    [MaxLength(20)]
    public string Postcode { get; set; } = string.Empty;
    [MaxLength(30)]
    public string Phone { get; set; } = string.Empty;
    [MaxLength(30)]
    public string Fax { get; set; } = string.Empty;
    [MaxLength(256)]
    public string Email { get; set; } = string.Empty;
    public List<B2bCustomerContactRequest> Contacts { get; set; } = [];
    public List<int> TaggedProductIds { get; set; } = [];
    public List<int> TaggedProductAliasIds { get; set; } = [];
    public List<TaggedB2bProductUnitRequest> TaggedB2bProductUnits { get; set; } = [];
    public List<B2bPurchaseHistoryLineRequest> PurchaseHistory { get; set; } = [];
    public bool Active { get; set; } = true;
}

public class PosLoyaltyYearSummaryRequest
{
    public int Year { get; set; }
    public decimal Earned { get; set; }
    public decimal Used { get; set; }
    public decimal Balance { get; set; }
}

public class PosCouponYearSummaryRequest
{
    public int Year { get; set; }
    public int Received { get; set; }
    public int Used { get; set; }
}

public class PosReceiptLineRequest
{
    public string ItemName { get; set; } = string.Empty;
    public decimal Qty { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal LineTotal { get; set; }
}

public class PosCustomerActivityRequest
{
    public string ActivityDate { get; set; } = string.Empty;
    public string ActivityLocation { get; set; } = string.Empty;
    public string ActivityType { get; set; } = string.Empty;
    public string CheckNo { get; set; } = string.Empty;
    public decimal TotalSpending { get; set; }
    public decimal PointsEarned { get; set; }
    public decimal PointsUsed { get; set; }
    public decimal PointsBalance { get; set; }
    public string? CouponUsed { get; set; }
    public List<PosReceiptLineRequest> ReceiptLines { get; set; } = [];
}

public class UpsertPosCustomerRequest
{
    public int CompanyId { get; set; }
    [Required, MaxLength(50)]
    public string ExternalId { get; set; } = string.Empty;
    [Required, MaxLength(200)]
    public string Name { get; set; } = string.Empty;
    [MaxLength(400)]
    public string Address { get; set; } = string.Empty;
    [MaxLength(100)]
    public string City { get; set; } = string.Empty;
    [MaxLength(100)]
    public string State { get; set; } = string.Empty;
    [MaxLength(20)]
    public string Postcode { get; set; } = string.Empty;
    [MaxLength(30)]
    public string Phone { get; set; } = string.Empty;
    [MaxLength(30)]
    public string Fax { get; set; } = string.Empty;
    [MaxLength(256)]
    public string Email { get; set; } = string.Empty;
    public List<PosLoyaltyYearSummaryRequest> LoyaltySummary { get; set; } = [];
    public List<PosCouponYearSummaryRequest> CouponSummary { get; set; } = [];
    public List<PosCustomerActivityRequest> ActivityHistory { get; set; } = [];
    public bool Active { get; set; } = true;
}


public class CreateQuoteRequestLineDto
{
    [MaxLength(20)]
    public string Kind { get; set; } = "principal";
    public int? ComponentId { get; set; }
    [MaxLength(50)]
    public string ComponentExternalId { get; set; } = string.Empty;
    [MaxLength(200)]
    public string ComponentName { get; set; } = string.Empty;
    [MaxLength(2000)]
    public string Specification { get; set; } = string.Empty;
    [MaxLength(50)]
    public string PrincipalUom { get; set; } = string.Empty;
    [Range(0, 999999999)]
    public decimal RequestedQty { get; set; }
}

public class CreateQuoteRequestVendorDto
{
    public int? VendorId { get; set; }
    [MaxLength(50)]
    public string VendorExternalId { get; set; } = string.Empty;
    [MaxLength(200)]
    public string VendorName { get; set; } = string.Empty;
    [MaxLength(200)]
    public string ContactPerson { get; set; } = string.Empty;
    [MaxLength(256)]
    public string Email { get; set; } = string.Empty;
    [MaxLength(50)]
    public string Mobile { get; set; } = string.Empty;
    public bool IsNewVendor { get; set; }
}

public class CreateQuoteRequestDto
{
    public int CompanyId { get; set; }
    public List<string> LocationExternalIds { get; set; } = [];
    [MaxLength(2000)]
    public string? Notes { get; set; }
    [MaxLength(200)]
    public string? CreatedBy { get; set; }
    public List<CreateQuoteRequestVendorDto> Vendors { get; set; } = [];
    public List<CreateQuoteRequestLineDto> Lines { get; set; } = [];
}

public class QuoteLineVendorResponseDto
{
    public int LineId { get; set; }
    [MaxLength(200)]
    public string DeliveryUnitText { get; set; } = string.Empty;
    [Range(0, 999999999)]
    public decimal Rrp { get; set; }
    [MaxLength(500)]
    public string? Notes { get; set; }
}

public class SubmitQuoteRequestPortalDto
{
    [MaxLength(200)]
    public string? SubmittedBy { get; set; }
    public List<QuoteLineVendorResponseDto> Responses { get; set; } = [];
}

public class SampleRequestProductSampleDto
{
    [MaxLength(300)]
    public string Name { get; set; } = string.Empty;
    [MaxLength(4000)]
    public string Description { get; set; } = string.Empty;
}

public class CreateSampleRequestDto
{
    [MaxLength(50)]
    public string TemplateType { get; set; } = "sample-request-flavours";
    public int CompanyId { get; set; }
    public DateOnly DateRequested { get; set; }
    public int? ContactEmployeeId { get; set; }
    [MaxLength(200)]
    public string ContactPersonName { get; set; } = string.Empty;
    [MaxLength(300)]
    public string CompanyRequested { get; set; } = string.Empty;
    [MaxLength(50)]
    public string? CustomerExternalId { get; set; }
    [MaxLength(300)]
    public string CustomerName { get; set; } = string.Empty;
    public bool IsNewCustomer { get; set; }
    [MaxLength(50)]
    public string? VendorExternalId { get; set; }
    [MaxLength(1000)]
    public string? VendorAddress { get; set; }
    [MaxLength(200)]
    public string? VendorContactPerson { get; set; }
    [MaxLength(50)]
    public string? VendorContactMobile { get; set; }
    [MaxLength(200)]
    public string? VendorContactEmail { get; set; }
    [MaxLength(50)]
    public string? IngredientComponentId { get; set; }
    [MaxLength(30)]
    public string? ProductPolicyTag { get; set; }
    [MaxLength(20)]
    public string ProjectScope { get; set; } = "new";
    [MaxLength(30)]
    public string RequestType { get; set; } = "new_submission";
    [MaxLength(4000)]
    public string? ModificationDetails { get; set; }
    [MaxLength(300)]
    public string ProjectName { get; set; } = string.Empty;
    [MaxLength(200)]
    public string DeliveryUnit { get; set; } = string.Empty;
    [Range(0, 999999999)]
    public decimal ExpectedQtyPerYear { get; set; }
    [Range(0, 999999999)]
    public decimal ExpectedPrice { get; set; }
    [MaxLength(100)]
    public string? ProductCategory { get; set; }
    [MaxLength(100)]
    public string? ProductGroup { get; set; }
    public List<SampleRequestProductSampleDto> ProductSamples { get; set; } = [];
    public bool WaterSoluble { get; set; }
    public bool OilSoluble { get; set; }
    public bool FlavourNatural { get; set; }
    public bool FlavourNaturalIdentical { get; set; }
    public bool FlavourArtificial { get; set; }
    [Range(0, 999999999)]
    public decimal QuantityRequested { get; set; }
    [MaxLength(50)]
    public string? QuantityUom { get; set; }
    [MaxLength(1000)]
    public string? TargetProducts { get; set; }
    [MaxLength(30)]
    public string GmoStatus { get; set; } = "na";
    [MaxLength(30)]
    public string AllergenStatus { get; set; } = "na";
    [MaxLength(1000)]
    public string? AllergenFreeFromDetail { get; set; }
    [MaxLength(1000)]
    public string? McpdHvpFreeDetail { get; set; }
    public bool HalalCertified { get; set; }
    public bool HalalCompliantAccepted { get; set; }
    [MaxLength(100)]
    public string? CountryRdSite { get; set; }
    [MaxLength(100)]
    public string? CountryManufacturing { get; set; }
    [MaxLength(100)]
    public string? CountryInUse { get; set; }
    [MaxLength(20)]
    public string RegulatoryRequirement { get; set; } = "na";
    [MaxLength(4000)]
    public string? RegulatoryRequirementDetail { get; set; }
    public DateOnly? CustomerDeadline { get; set; }
    [MaxLength(200)]
    public string? CreatedBy { get; set; }
}

public class AcceptSampleRequestPortalDto
{
    [MaxLength(200)]
    public string? AcceptedBy { get; set; }
}

public class CreateWastageRequest
{
    public int? CompanyId { get; set; }
    [Required, MaxLength(100)]
    public string LocationExternalId { get; set; } = string.Empty;
    /// <summary>component | product | sub-product</summary>
    [Required, MaxLength(30)]
    public string ItemType { get; set; } = "component";
    [Required, MaxLength(80)]
    public string ItemKey { get; set; } = string.Empty;
    [MaxLength(200)]
    public string? ItemName { get; set; }
    [Range(0.0001, 999999999)]
    public decimal Quantity { get; set; }
    [Required, MaxLength(50)]
    public string Uom { get; set; } = string.Empty;
    [Required, MaxLength(20)]
    public string WastedDate { get; set; } = string.Empty;
    [Required, MaxLength(300)]
    public string Reason { get; set; } = string.Empty;
}

public class CreatePosWastageRequest
{
    public int? CompanyId { get; set; }
    [Required, MaxLength(100)]
    public string LocationExternalId { get; set; } = string.Empty;
    [Range(1, int.MaxValue)]
    public int ProductId { get; set; }
    [Range(0.0001, 999999999)]
    public decimal Quantity { get; set; }
    [MaxLength(80)]
    public string? CheckNo { get; set; }
    [MaxLength(300)]
    public string? Reason { get; set; }
    [MaxLength(20)]
    public string? WastedDate { get; set; }
}

public class CreateTransferRequest
{
    public int? CompanyId { get; set; }
    [Required, MaxLength(100)]
    public string FromLocationExternalId { get; set; } = string.Empty;
    [Required, MaxLength(100)]
    public string ToLocationExternalId { get; set; } = string.Empty;
    /// <summary>component | product | sub-product</summary>
    [Required, MaxLength(30)]
    public string ItemType { get; set; } = "component";
    [Required, MaxLength(80)]
    public string ItemKey { get; set; } = string.Empty;
    [MaxLength(200)]
    public string? ItemName { get; set; }
    [Range(0.0001, 999999999)]
    public decimal Quantity { get; set; }
    [Required, MaxLength(50)]
    public string Uom { get; set; } = string.Empty;
    [Required, MaxLength(20)]
    public string TransferDate { get; set; } = string.Empty;
    [MaxLength(200)]
    public string? InitiatedBy { get; set; }
}

public class ReceiveTransferRequest
{
    public int? CompanyId { get; set; }
    [MaxLength(200)]
    public string? ReceivedBy { get; set; }
    [Range(0.0001, 999999999)]
    public decimal? ReceivedQuantity { get; set; }
    [MaxLength(20)]
    public string? ReceivedDate { get; set; }
}

public class RejectTransferRequest
{
    public int? CompanyId { get; set; }
    [MaxLength(200)]
    public string? RejectedBy { get; set; }
}

public class SalesModuleBrandRequest
{
    [MaxLength(120)]
    public string Name { get; set; } = string.Empty;
    public int Count { get; set; }
}

public class SalesModuleContactRequest
{
    [MaxLength(80)]
    public string Id { get; set; } = string.Empty;
    [MaxLength(120)]
    public string Name { get; set; } = string.Empty;
    [MaxLength(120)]
    public string Position { get; set; } = string.Empty;
    [MaxLength(256)]
    public string Email { get; set; } = string.Empty;
    [MaxLength(40)]
    public string Mobile { get; set; } = string.Empty;
}

public class UpsertSalesModuleCustomerRequest
{
    public int CompanyId { get; set; }
    [MaxLength(50)]
    public string? ExternalId { get; set; }
    [Required, MaxLength(200)]
    public string CompanyName { get; set; } = string.Empty;
    public List<SalesModuleBrandRequest> Brands { get; set; } = [];
    public List<SalesModuleContactRequest> Contacts { get; set; } = [];
    [MaxLength(40)]
    public string Status { get; set; } = "Prospect";
    public DateTime? LastContactDate { get; set; }
    [MaxLength(2000)]
    public string LastDiscussionBrief { get; set; } = string.Empty;
    public int LocationCount { get; set; }
    public DateTime? CreatedAt { get; set; }
    public DateTime? LastChangedAt { get; set; }
    public int? HunterMemberId { get; set; }
    [MaxLength(200)]
    public string HunterName { get; set; } = string.Empty;
    public int? FarmerMemberId { get; set; }
    [MaxLength(200)]
    public string FarmerName { get; set; } = string.Empty;
    public int EngagedUserId { get; set; }
    [MaxLength(256)]
    public string EngagedUserEmail { get; set; } = string.Empty;
    [MaxLength(200)]
    public string EngagedUserName { get; set; } = string.Empty;
    public bool Active { get; set; } = true;
}

public class UpsertSalesModuleAppointmentRequest
{
    public int CompanyId { get; set; }
    public int SalesModuleCustomerId { get; set; }
    [Required, MaxLength(200)]
    public string Title { get; set; } = string.Empty;
    [MaxLength(2000)]
    public string Notes { get; set; } = string.Empty;
    public DateTime StartsAt { get; set; }
    public DateTime EndsAt { get; set; }
    [MaxLength(200)]
    public string Location { get; set; } = string.Empty;
    public int EngagedUserId { get; set; }
    [MaxLength(256)]
    public string EngagedUserEmail { get; set; } = string.Empty;
    /// <summary>Optional Sales Module team member assigned to this appointment.</summary>
    public int? SalesTeamMemberId { get; set; }
}

public class UpsertSalesModuleTeamMemberRequest
{
    [Required, MaxLength(200)]
    public string Name { get; set; } = string.Empty;
    [Required, MaxLength(256)]
    public string Email { get; set; } = string.Empty;
    public bool Active { get; set; } = true;
    public bool IsHunter { get; set; } = true;
    public bool IsFarmer { get; set; } = false;
    public bool CalendarSyncEnabled { get; set; } = true;

    /// <summary>Optional Microsoft Graph Directory (tenant) ID — saved when creating/editing a team member.</summary>
    [MaxLength(64)]
    public string? GraphTenantId { get; set; }

    /// <summary>Optional Microsoft Graph Application (client) ID.</summary>
    [MaxLength(64)]
    public string? GraphClientId { get; set; }

    /// <summary>Optional client secret (omit to keep existing).</summary>
    [MaxLength(512)]
    public string? GraphClientSecret { get; set; }
}

public class UpsertSalesModuleCompanyRequest
{
    [Required, MaxLength(200)]
    public string Name { get; set; } = string.Empty;
    public bool Active { get; set; } = true;
    /// <summary>Sales Team member ids this company is tagged to (at least one required).</summary>
    public List<int> SalesTeamMemberIds { get; set; } = [];
}

/// <summary>Fill blank Client Update identity fields only (non-blank values are ignored).</summary>
public class PatchSalesModuleClientUpdateRequest
{
    public DateTime? DateCreated { get; set; }
    [MaxLength(200)]
    public string? Hunter { get; set; }
    /// <summary>Preferred when filling blank Hunter — tags row to Sales Team member.</summary>
    public int? SalesTeamMemberId { get; set; }
    [MaxLength(200)]
    public string? Company { get; set; }
    [MaxLength(200)]
    public string? Brand { get; set; }
    public int? LocationCount { get; set; }
}

public class SalesModuleDiaryContactRequest
{
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;
    [MaxLength(200)]
    public string Position { get; set; } = string.Empty;
}

public class CreateSalesModuleDiaryEntryRequest
{
    [Required]
    public int SalesTeamMemberId { get; set; }

    /// <summary>StatusChange or SalesCall (also accepts display labels).</summary>
    [Required, MaxLength(40)]
    public string ActivityType { get; set; } = string.Empty;

    public int? SalesModuleCompanyId { get; set; }

    [MaxLength(200)]
    public string? CompanyName { get; set; }

    [MaxLength(200)]
    public string? BrandName { get; set; }

    [MaxLength(300)]
    public string? LocationVisited { get; set; }

    public int? EmailsSent { get; set; }

    public List<string> Statuses { get; set; } = [];

    [MaxLength(80)]
    public string? ContactType { get; set; }

    [Required]
    public DateTime ContactDate { get; set; }

    public List<SalesModuleDiaryContactRequest> Contacts { get; set; } = [];

    /// <summary>Required when ActivityType is Status Change.</summary>
    [MaxLength(2000)]
    public string? Comment { get; set; }

    [MaxLength(256)]
    public string? CreatedByEmail { get; set; }
}

/// <summary>Client Update row Followup: send appointment and/or change status with comment.</summary>
public class ClientUpdateFollowupRequest
{
    public bool SendAppointment { get; set; }

    [MaxLength(200)]
    public string? AppointmentTitle { get; set; }

    public DateTime? StartsAt { get; set; }
    public DateTime? EndsAt { get; set; }

    [MaxLength(300)]
    public string? Location { get; set; }

    [MaxLength(4000)]
    public string? AppointmentNotes { get; set; }

    public bool ChangeStatus { get; set; }

    public List<string> Statuses { get; set; } = [];

    /// <summary>Required when ChangeStatus is true.</summary>
    [MaxLength(2000)]
    public string? Comment { get; set; }

    public DateTime? ContactDate { get; set; }

    [MaxLength(256)]
    public string? CreatedByEmail { get; set; }
}

