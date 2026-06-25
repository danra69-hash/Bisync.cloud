namespace Bisync.Api.Models;

public enum MovementType
{
    Promotion,
    Transfer,
    Lateral
}

public enum AttendanceStatus
{
    Present,
    Absent,
    Late,
    HalfDay
}

/// <summary>
/// RDO = Replacement Day Off, RPH = Replacement Public Holiday,
/// AL = Annual Leave, UPL = Unpaid Leave.
/// </summary>
public enum LeaveType
{
    RDO,
    RPH,
    AL,
    UPL
}

public enum LeaveStatus
{
    Pending,
    Approved,
    Rejected
}

/// <summary>
/// Schedule entry type: Work day or one of the day-off / leave codes
/// (DO = Day Off, RDO, AL, RPH, UPL — same codes used on the schedule grid).
/// </summary>
public enum ScheduleType
{
    Work,
    DO,
    RDO,
    AL,
    RPH,
    UPL
}

public enum CheckinMethod
{
    POS,
    Biometrics,
    AccessTag
}
