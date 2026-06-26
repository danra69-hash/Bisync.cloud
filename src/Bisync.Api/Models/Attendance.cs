using System.Text.Json.Serialization;

namespace Bisync.Api.Models;

public class AttendanceRecord
{
    public int Id { get; set; }
    public int EmployeeId { get; set; }
    [JsonIgnore]
    public Employee? Employee { get; set; }

    public DateOnly Date { get; set; }
    public AttendanceStatus Status { get; set; }

    // Shift employees track scheduled vs actual clock in/out times.
    public TimeOnly? ScheduledIn { get; set; }
    public TimeOnly? ScheduledOut { get; set; }
    public TimeOnly? ActualIn { get; set; }
    public TimeOnly? ActualOut { get; set; }
    /// <summary>RPH days credited to the employee for working this public holiday date.</summary>
    public decimal RphAccruedDays { get; set; }
}
