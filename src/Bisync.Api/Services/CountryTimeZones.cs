using System.Collections.Concurrent;

namespace Bisync.Api.Services;

/// <summary>Maps company CountryCode → IANA / Windows timezone for audit local time.</summary>
public static class CountryTimeZones
{
    static readonly ConcurrentDictionary<string, TimeZoneInfo> Cache = new(StringComparer.OrdinalIgnoreCase);

    static readonly Dictionary<string, string[]> IanaByCountry = new(StringComparer.OrdinalIgnoreCase)
    {
        ["MY"] = ["Asia/Kuala_Lumpur", "Singapore Standard Time"],
        ["SG"] = ["Asia/Singapore", "Singapore Standard Time"],
        ["ID"] = ["Asia/Jakarta", "SE Asia Standard Time"],
        ["TH"] = ["Asia/Bangkok", "SE Asia Standard Time"],
        ["VN"] = ["Asia/Ho_Chi_Minh", "SE Asia Standard Time"],
        ["PH"] = ["Asia/Manila", "Singapore Standard Time"],
        ["JP"] = ["Asia/Tokyo", "Tokyo Standard Time"],
        ["KR"] = ["Asia/Seoul", "Korea Standard Time"],
        ["CN"] = ["Asia/Shanghai", "China Standard Time"],
        ["HK"] = ["Asia/Hong_Kong", "China Standard Time"],
        ["TW"] = ["Asia/Taipei", "Taipei Standard Time"],
        ["AU"] = ["Australia/Sydney", "AUS Eastern Standard Time"],
        ["NZ"] = ["Pacific/Auckland", "New Zealand Standard Time"],
        ["GB"] = ["Europe/London", "GMT Standard Time"],
        ["UK"] = ["Europe/London", "GMT Standard Time"],
        ["FR"] = ["Europe/Paris", "Romance Standard Time"],
        ["DE"] = ["Europe/Berlin", "W. Europe Standard Time"],
        ["IT"] = ["Europe/Rome", "W. Europe Standard Time"],
        ["ES"] = ["Europe/Madrid", "Romance Standard Time"],
        ["US"] = ["America/New_York", "Eastern Standard Time"],
        ["CA"] = ["America/Toronto", "Eastern Standard Time"],
        ["AE"] = ["Asia/Dubai", "Arabian Standard Time"],
        ["IN"] = ["Asia/Kolkata", "India Standard Time"],
    };

    public static TimeZoneInfo Resolve(string? countryCode)
    {
        var code = (countryCode ?? "MY").Trim().ToUpperInvariant();
        if (code.Length == 0) code = "MY";
        return Cache.GetOrAdd(code, ResolveCore);
    }

    public static string ResolveId(string? countryCode) => Resolve(countryCode).Id;

    public static DateTime ToLocal(DateTime utc, string? countryCode)
    {
        var tz = Resolve(countryCode);
        var utcDt = utc.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(utc, DateTimeKind.Utc)
            : utc.ToUniversalTime();
        return TimeZoneInfo.ConvertTimeFromUtc(utcDt, tz);
    }

    static TimeZoneInfo ResolveCore(string code)
    {
        if (IanaByCountry.TryGetValue(code, out var candidates))
        {
            foreach (var id in candidates)
            {
                try
                {
                    return TimeZoneInfo.FindSystemTimeZoneById(id);
                }
                catch (TimeZoneNotFoundException)
                {
                    // try next
                }
                catch (InvalidTimeZoneException)
                {
                    // try next
                }
            }
        }

        return TimeZoneInfo.Utc;
    }
}
