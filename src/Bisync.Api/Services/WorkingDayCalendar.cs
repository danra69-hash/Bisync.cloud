namespace Bisync.Api.Services;

/// <summary>
/// Calendar helpers that skip weekends (Sat/Sun). Used for PO vendor accept and SO client accept windows.
/// </summary>
public static class WorkingDayCalendar
{
    public static bool IsWeekend(DateOnly date) =>
        date.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday;

    public static bool IsWorkingDay(DateOnly date) => !IsWeekend(date);

    /// <summary>
    /// Returns the calendar date that is <paramref name="workingDays"/> working days after
    /// <paramref name="start"/> (the start date itself is not counted).
    /// Example: Monday + 7 working days → the following Wednesday.
    /// </summary>
    public static DateOnly AddWorkingDays(DateOnly start, int workingDays)
    {
        if (workingDays <= 0) return start;

        var cursor = start;
        var remaining = workingDays;
        while (remaining > 0)
        {
            cursor = cursor.AddDays(1);
            if (IsWorkingDay(cursor))
                remaining--;
        }

        return cursor;
    }

    /// <summary>True when <paramref name="today"/> is after the inclusive accept-by date.</summary>
    public static bool IsPastAcceptDeadline(DateOnly? acceptByInclusive, DateOnly today) =>
        acceptByInclusive is DateOnly deadline && today > deadline;
}
