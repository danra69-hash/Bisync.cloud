using System.Text.Json.Serialization;

namespace Bisync.Api.Models;

public class ShiftSchedule
{
    public int Id { get; set; }
    public int EmployeeId { get; set; }
    [JsonIgnore]
    public Employee? Employee { get; set; }

    public DateOnly Date { get; set; }
    /// <summary>Null when the entry is a day-off / leave type rather than a work day.</summary>
    public TimeOnly? StartTime { get; set; }
    public TimeOnly? EndTime { get; set; }
    public ScheduleType Type { get; set; } = ScheduleType.Work;
}
