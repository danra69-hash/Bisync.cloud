using System.Text.Json.Serialization;

namespace Bisync.Api.Models;

public class Employee
{
    public int Id { get; set; }

    /// <summary>Auto-generated business identifier (minimum 6 digits), e.g. "000001".</summary>
    public string EmployeeCode { get; set; } = null!;

    public string Name { get; set; } = null!;
    public string Email { get; set; } = null!;
    public string Mobile { get; set; } = null!;
    public string Department { get; set; } = null!;
    public int? DivisionId { get; set; }
    public int? DepartmentId { get; set; }
    [JsonIgnore]
    public Division? Division { get; set; }
    [JsonIgnore]
    public Department? AssignedDepartment { get; set; }
    public string Position { get; set; } = null!;
    public DateOnly JoinDate { get; set; }

    // Biometrics
    public bool FingerprintEnrolled { get; set; }
    public bool FaceRecognitionEnrolled { get; set; }

    // Flags from the employee directory grid
    public bool IsShiftEmployee { get; set; }
    public string? ShiftType { get; set; }
    public bool PosEnabled { get; set; }
    /// <summary>POS access PIN; defaults to 1234 until changed at first login.</summary>
    public string? PosPin { get; set; }
    public bool PosPinMustChange { get; set; }
    /// <summary>Employee portal payroll PIN (6 digits). Not exposed in API responses.</summary>
    [JsonIgnore]
    public string? PayrollPin { get; set; }
    public bool PayrollPinMustChange { get; set; }
    public bool BisyncEnabled { get; set; }

    public bool Active { get; set; } = true;
    public CheckinMethod CheckinMethod { get; set; } = CheckinMethod.Biometrics;

    public decimal WorkingHoursPerDay { get; set; } = 8;

    public int? EmployeeLevelId { get; set; }
    public EmployeeLevel? EmployeeLevel { get; set; }

    public int? ReportsToId { get; set; }
    public Employee? ReportsTo { get; set; }

    // Personal details section
    public string? Nationality { get; set; }
    public string? IdPassportNumber { get; set; }
    public DateOnly? DateOfBirth { get; set; }
    public string? PersonalEmail { get; set; }
    public string? PermanentAddress { get; set; }
    public string? MaritalStatus { get; set; }

    // Payroll bank details
    public string? BankName { get; set; }
    public string? BankAccountNumber { get; set; }
    public string? BankAccountHolderName { get; set; }

    public List<EducationRecord> Education { get; set; } = [];
    public List<PreviousEmployment> PreviousEmployments { get; set; } = [];
    public List<EmployeeMovement> Movements { get; set; } = [];
    public List<PerformanceAppraisal> PerformanceAppraisals { get; set; } = [];

    // Payroll compensation (per employee)
    public decimal? BaseSalary { get; set; }
    public decimal? ServiceAllowance { get; set; }
    public decimal? TransportAllowance { get; set; }
    public decimal? AccommodationAllowance { get; set; }
    public decimal? MobileAllowance { get; set; }
    public List<PayrollOtherAllowance> OtherAllowances { get; set; } = [];
    /// <summary>true = sponsored by company, false = self-sponsored.</summary>
    public bool? WorkPermitByCompany { get; set; }

    public bool TransportProvided { get; set; }
    public string? TransportCarModel { get; set; }
    public string? TransportPlateNumber { get; set; }

    public bool AccommodationProvided { get; set; }
    public string? AccommodationAddress { get; set; }
    public DateOnly? AccommodationLeaseStart { get; set; }
    public DateOnly? AccommodationLeaseEnd { get; set; }

    public bool MobileProvided { get; set; }
    public string? MobileAllowancePhone { get; set; }
    public string? MobileProvider { get; set; }

    public bool OvertimeAllowanceEnabled { get; set; }

    public bool BonusEnabled { get; set; }
    public bool BonusMonthly { get; set; }
    public bool BonusAnnually { get; set; }
    public decimal? BonusAmount { get; set; }
    public bool BonusByBasicSalary { get; set; }
    public bool BonusByService { get; set; }

    [JsonIgnore]
    public LeaveBalance? LeaveBalance { get; set; }
}

public class PayrollOtherAllowance
{
    public string Name { get; set; } = "";
    public decimal Amount { get; set; }
}

public class EducationRecord
{
    public int Id { get; set; }
    public int EmployeeId { get; set; }
    [JsonIgnore]
    public Employee? Employee { get; set; }

    public string Degree { get; set; } = null!;
    public string Institution { get; set; } = null!;
    public string Year { get; set; } = null!;
    public string Certificate { get; set; } = null!;
}

public class PreviousEmployment
{
    public int Id { get; set; }
    public int EmployeeId { get; set; }
    [JsonIgnore]
    public Employee? Employee { get; set; }

    public string CompanyName { get; set; } = null!;
    public string Position { get; set; } = null!;
    public string StartYear { get; set; } = null!;
    public string EndYear { get; set; } = null!;
    public decimal YearsOfService { get; set; }
}

public class EmployeeMovement
{
    public int Id { get; set; }
    public int EmployeeId { get; set; }
    [JsonIgnore]
    public Employee? Employee { get; set; }

    public DateOnly Date { get; set; }
    public string FromPosition { get; set; } = null!;
    public string ToPosition { get; set; } = null!;
    public MovementType Type { get; set; }
    public string Department { get; set; } = null!;
}

public class PerformanceAppraisal
{
    public int Id { get; set; }
    public int EmployeeId { get; set; }
    [JsonIgnore]
    public Employee? Employee { get; set; }

    public string Year { get; set; } = null!;
    public string Rating { get; set; } = null!;
    /// <summary>Score out of 5.0.</summary>
    public decimal Score { get; set; }
    public string Reviewer { get; set; } = null!;
    public string? Comments { get; set; }
}
