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
}

public class PublicHolidayRequest
{
    [Required, MaxLength(200)]
    public string Name { get; set; } = null!;
    [Required]
    public DateOnly Date { get; set; }
    public bool IsRecognized { get; set; }
}

public class PayMultiplierRequest
{
    [Range(1, 10)]
    public decimal? PublicHolidayPayMultiplier { get; set; }
    [MaxLength(2)]
    public string? OperatingCountryCode { get; set; }
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
