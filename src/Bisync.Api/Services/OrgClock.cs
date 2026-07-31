using Bisync.Api.Models;

namespace Bisync.Api.Services;

/// <summary>
/// Company/location-aware clock.
/// Instant timestamps for DB remain UTC (<see cref="UtcNow"/>).
/// Calendar dates and wall-clock values use the registered company country
/// and, when available, the location state/province timezone.
/// </summary>
public static class OrgClock
{
    public static DateTime UtcNow => DateTime.UtcNow;

    public static TimeZoneInfo ResolveTimeZone(Company? company, Location? location = null)
    {
        if (!string.IsNullOrWhiteSpace(location?.TimeZoneId))
        {
            var explicitTz = CountryTimeZones.TryFind(location.TimeZoneId);
            if (explicitTz is not null) return explicitTz;
        }

        return CountryTimeZones.Resolve(
            location?.Company?.CountryCode ?? company?.CountryCode,
            location?.StateProvince ?? company?.StateProvince);
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

    public static DateTime ToLocal(DateTime utc, string? countryCode, string? stateProvince = null) =>
        CountryTimeZones.ToLocal(utc, countryCode, stateProvince);

    public static DateTime ToUtc(DateTime local, Company? company, Location? location = null)
    {
        var localDt = DateTime.SpecifyKind(local, DateTimeKind.Unspecified);
        return TimeZoneInfo.ConvertTimeToUtc(localDt, ResolveTimeZone(company, location));
    }

    public static DateTime ToUtc(DateTime local, string? countryCode, string? stateProvince = null) =>
        CountryTimeZones.ToUtc(local, countryCode, stateProvince);

    /// <summary>
    /// Persist timezone id on a location from its company country + state/province.
    /// </summary>
    public static string AssignLocationTimeZone(Location location, string? companyCountryCode)
    {
        var id = ResolveTimeZoneId(companyCountryCode, location.StateProvince);
        location.TimeZoneId = id;
        return id;
    }
}
