using System.Text.Json.Serialization;

namespace Bisync.Api.Models;

public class LeaveRequest
{
    public int Id { get; set; }
    public int EmployeeId { get; set; }
    [JsonIgnore]
    public Employee? Employee { get; set; }

    public LeaveType Type { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public LeaveStatus Status { get; set; } = LeaveStatus.Pending;
    public string? Reason { get; set; }
}

/// <summary>One row per employee holding the remaining day balances.</summary>
public class LeaveBalance
{
    /// <summary>PK and FK to Employee (one-to-one).</summary>
    public int EmployeeId { get; set; }
    [JsonIgnore]
    public Employee? Employee { get; set; }

    public decimal RdoBalance { get; set; }
    public decimal RphBalance { get; set; }
    public decimal AlBalance { get; set; }
}
