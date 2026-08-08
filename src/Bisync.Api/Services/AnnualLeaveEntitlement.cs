namespace Bisync.Api.Services;

/// <summary>
/// Resolves annual-leave entitlement for the current operating year.
/// Tenure bands supply the full-year days; joiners in the current calendar year
/// receive a pro-rated balance (months remaining including join month / 12), not a lumpsum.
/// </summary>
public static class AnnualLeaveEntitlement
{
    public static decimal YearsOfServiceFromJoinDate(DateOnly joinDate, DateOnly? asOfDate = null)
    {
        var asOf = asOfDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
        if (joinDate >= asOf) return 0;
        var years = asOf.Year - joinDate.Year;
        var anniversary = joinDate.AddYears(years);
        if (anniversary > asOf) years--;
        var partialAnniversary = joinDate.AddYears(Math.Max(0, years));
        var daysInYear = DateTime.IsLeapYear(asOf.Year) ? 366d : 365d;
        var partial = Math.Clamp(asOf.DayNumber - partialAnniversary.DayNumber, 0, 366) / daysInYear;
        return Math.Round(Math.Max(0, years + (decimal)partial), 1);
    }

    /// <summary>
    /// Full-year band entitlement (before operating-year pro-rata).
    /// </summary>
    public static int ResolveFullYearDays(
        string? rulesJson,
        DateOnly joinDate,
        int fallback,
        bool annualLeaveEnabled = true,
        DateOnly? asOfDate = null)
    {
        if (!annualLeaveEnabled) return 0;
        var yos = YearsOfServiceFromJoinDate(joinDate, asOfDate);
        return LeaveTenureRules.ResolveDays(rulesJson, yos, fallback);
    }

    /// <summary>
    /// Operating-year balance grant: pro-rated when join date falls in the current calendar year.
    /// </summary>
    public static decimal ResolveOpeningBalanceDays(
        string? rulesJson,
        DateOnly joinDate,
        int fallback,
        bool annualLeaveEnabled = true,
        DateOnly? asOfDate = null)
    {
        var full = ResolveFullYearDays(rulesJson, joinDate, fallback, annualLeaveEnabled, asOfDate);
        return ProrateForOperatingYear(full, joinDate, asOfDate);
    }

    /// <summary>
    /// Pro-rate full-year days for the operating (calendar) year of <paramref name="asOfDate"/>.
    /// Prior-year joiners keep the full entitlement; same-year joiners get
    /// months from join month through December inclusive / 12, rounded to 0.5 day.
    /// </summary>
    public static decimal ProrateForOperatingYear(
        decimal fullYearDays,
        DateOnly joinDate,
        DateOnly? asOfDate = null)
    {
        if (fullYearDays <= 0) return 0;

        var asOf = asOfDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
        if (joinDate > asOf) return 0;

        var yearStart = new DateOnly(asOf.Year, 1, 1);
        if (joinDate < yearStart)
            return RoundToHalfDay(fullYearDays);

        // Join month through December inclusive.
        var monthsRemaining = 12 - joinDate.Month + 1;
        var raw = fullYearDays * monthsRemaining / 12m;
        return RoundToHalfDay(raw);
    }

    public static decimal RoundToHalfDay(decimal value)
        => Math.Round(value * 2m, MidpointRounding.AwayFromZero) / 2m;

    public static decimal CalendarDays(DateOnly start, DateOnly end)
        => Math.Max(0, end.DayNumber - start.DayNumber + 1);
}
