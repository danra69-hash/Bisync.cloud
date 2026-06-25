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

    public List<EducationRecord> Education { get; set; } = [];
    public List<PreviousEmployment> PreviousEmployments { get; set; } = [];
    public List<EmployeeMovement> Movements { get; set; } = [];
    public List<PerformanceAppraisal> PerformanceAppraisals { get; set; } = [];

    [JsonIgnore]
    public LeaveBalance? LeaveBalance { get; set; }
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
