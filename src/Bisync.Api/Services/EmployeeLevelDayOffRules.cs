namespace Bisync.Api.Services;

/// <summary>
/// Day-off rules for employee levels.
/// Unless shift work, DayOff/week = 2 means Saturday and Sunday are the days off.
/// </summary>
public static class EmployeeLevelDayOffRules
{
    /// <summary>DayOfWeek values that are deemed rest days for this level (empty when not applicable).</summary>
    public static IReadOnlyList<DayOfWeek> DeemedWeeklyDayOffs(bool isShift, int dayOffPerWeek)
    {
        if (isShift)
            return [];

        var days = Math.Clamp(dayOffPerWeek, 0, 7);
        if (days == 2)
            return [DayOfWeek.Saturday, DayOfWeek.Sunday];

        return [];
    }

    public static bool IsDeemedDayOff(bool isShift, int dayOffPerWeek, DayOfWeek day) =>
        DeemedWeeklyDayOffs(isShift, dayOffPerWeek).Contains(day);
}
