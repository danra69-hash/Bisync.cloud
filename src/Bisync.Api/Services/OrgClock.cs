using Bisync.Api.Models;

namespace Bisync.Api.Services;

/// <summary>
/// Company-aware clock.
/// Instant timestamps for DB remain UTC (<see cref="UtcNow"/>).
/// Calendar dates and wall-clock values use the company's operating timezone
/// (persisted on <see cref="Company.TimeZoneId"/> at company creation).
/// </summary>
public static class OrgClock
{
    public static DateTime UtcNow => DateTime.UtcNow;

    public static TimeZoneInfo ResolveTimeZone(Company? company, Location? location = null)
    {
        if (!string.IsNullOrWhiteSpace(company?.TimeZoneId)
            && TryFindTimeZone(company.TimeZoneId, out var fromCompany))
            return fromCompany;

        // Company operating clock is authoritative; location state is only a fallback
        // when the company row has no persisted TimeZoneId yet.
        return CountryTimeZones.Resolve(
            company?.CountryCode ?? location?.Company?.CountryCode,
            company?.StateProvince ?? location?.StateProvince);
    }

    public static string ResolveTimeZoneId(Company? company, Location? location = null) =>
        ResolveTimeZone(company, location).Id;

    public static string ResolveTimeZoneId(string? countryCode, string? stateProvince = null) =>
        CountryTimeZones.ResolveId(countryCode, stateProvince);

    public static DateTime NowLocal(Company? company, Location? location = null) =>
        TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, ResolveTimeZone(company, location));

    public static DateTime NowLocal(string? countryCode, string? stateProvince = null) =>
        CountryTimeZones.NowLocal(countryCode, stateProvince);

    public static DateOnly TodayLocal(Company? company, Location? location = null) =>
        DateOnly.FromDateTime(NowLocal(company, location));

    public static DateOnly TodayLocal(string? countryCode, string? stateProvince = null) =>
        CountryTimeZones.TodayLocal(countryCode, stateProvince);

    public static DateTime ToLocal(DateTime utc, Company? company, Location? location = null)
    {
        var utcDt = utc.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(utc, DateTimeKind.Utc)
            : utc.ToUniversalTime();
        return TimeZoneInfo.ConvertTimeFromUtc(utcDt, ResolveTimeZone(company, location));
    }

    public static DateTime ToUtc(DateTime local, Company? company, Location? location = null)
    {
        var localDt = DateTime.SpecifyKind(local, DateTimeKind.Unspecified);
        return TimeZoneInfo.ConvertTimeToUtc(localDt, ResolveTimeZone(company, location));
    }

    /// <summary>
    /// End of the given local calendar day, expressed as UTC (for ledger CreatedAt stamps).
    /// </summary>
    public static DateTime EndOfLocalDayUtc(DateOnly localDate, Company? company, Location? location = null)
    {
        var localEnd = localDate.ToDateTime(new TimeOnly(23, 59, 59, 999), DateTimeKind.Unspecified);
        return ToUtc(localEnd, company, location);
    }

    /// <summary>
    /// Start of the given local calendar day, expressed as UTC.
    /// </summary>
    public static DateTime StartOfLocalDayUtc(DateOnly localDate, Company? company, Location? location = null)
    {
        var localStart = localDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified);
        return ToUtc(localStart, company, location);
    }

    /// <summary>
    /// Assign and persist the company's immutable operating timezone from country + state.
    /// No-op when TimeZoneId is already set.
    /// </summary>
    public static string AssignCompanyTimeZone(Company company)
    {
        if (!string.IsNullOrWhiteSpace(company.TimeZoneId))
            return company.TimeZoneId;

        var id = ResolveTimeZoneId(company.CountryCode, company.StateProvince);
        company.TimeZoneId = id;
        return id;
    }

    /// <summary>
    /// Persist timezone id on a location from the company operating clock (preferred)
    /// or country + location state/province as fallback.
    /// </summary>
    public static string AssignLocationTimeZone(Location location, Company? company)
    {
        var id = !string.IsNullOrWhiteSpace(company?.TimeZoneId)
            ? company!.TimeZoneId
            : ResolveTimeZoneId(company?.CountryCode, company?.StateProvince ?? location.StateProvince);
        location.TimeZoneId = id;
        return id;
    }

    /// <summary>
    /// Persist timezone id on a location from company country + state/province.
    /// Prefer <see cref="AssignLocationTimeZone(Location, Company?)"/> when the company row is available.
    /// </summary>
    public static string AssignLocationTimeZone(Location location, string? companyCountryCode)
    {
        var id = ResolveTimeZoneId(companyCountryCode, location.StateProvince);
        location.TimeZoneId = id;
        return id;
    }

    static bool TryFindTimeZone(string id, out TimeZoneInfo tz)
    {
        try
        {
            tz = TimeZoneInfo.FindSystemTimeZoneById(id.Trim());
            return true;
        }
        catch (TimeZoneNotFoundException)
        {
            tz = TimeZoneInfo.Utc;
            return false;
        }
        catch (InvalidTimeZoneException)
        {
            tz = TimeZoneInfo.Utc;
            return false;
        }
    }
}
