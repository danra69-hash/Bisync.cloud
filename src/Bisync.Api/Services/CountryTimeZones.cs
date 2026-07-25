using System.Collections.Concurrent;

namespace Bisync.Api.Services;

/// <summary>
/// Maps company country (+ optional location state/province) to an IANA/Windows timezone.
/// Multi-zone countries (US, AU, CA, ID) use state/region when provided.
/// </summary>
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

    /// <summary>State/province/region → IANA id for multi-zone countries.</summary>
    static readonly Dictionary<string, Dictionary<string, string[]>> IanaByCountryRegion =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["US"] = new(StringComparer.OrdinalIgnoreCase)
            {
                ["AL"] = ["America/Chicago"], ["AK"] = ["America/Anchorage"], ["AZ"] = ["America/Phoenix"],
                ["AR"] = ["America/Chicago"], ["CA"] = ["America/Los_Angeles"], ["CO"] = ["America/Denver"],
                ["CT"] = ["America/New_York"], ["DE"] = ["America/New_York"], ["FL"] = ["America/New_York"],
                ["GA"] = ["America/New_York"], ["HI"] = ["Pacific/Honolulu"], ["ID"] = ["America/Boise"],
                ["IL"] = ["America/Chicago"], ["IN"] = ["America/Indiana/Indianapolis"], ["IA"] = ["America/Chicago"],
                ["KS"] = ["America/Chicago"], ["KY"] = ["America/New_York"], ["LA"] = ["America/Chicago"],
                ["ME"] = ["America/New_York"], ["MD"] = ["America/New_York"], ["MA"] = ["America/New_York"],
                ["MI"] = ["America/Detroit"], ["MN"] = ["America/Chicago"], ["MS"] = ["America/Chicago"],
                ["MO"] = ["America/Chicago"], ["MT"] = ["America/Denver"], ["NE"] = ["America/Chicago"],
                ["NV"] = ["America/Los_Angeles"], ["NH"] = ["America/New_York"], ["NJ"] = ["America/New_York"],
                ["NM"] = ["America/Denver"], ["NY"] = ["America/New_York"], ["NC"] = ["America/New_York"],
                ["ND"] = ["America/Chicago"], ["OH"] = ["America/New_York"], ["OK"] = ["America/Chicago"],
                ["OR"] = ["America/Los_Angeles"], ["PA"] = ["America/New_York"], ["RI"] = ["America/New_York"],
                ["SC"] = ["America/New_York"], ["SD"] = ["America/Chicago"], ["TN"] = ["America/Chicago"],
                ["TX"] = ["America/Chicago"], ["UT"] = ["America/Denver"], ["VT"] = ["America/New_York"],
                ["VA"] = ["America/New_York"], ["WA"] = ["America/Los_Angeles"], ["WV"] = ["America/New_York"],
                ["WI"] = ["America/Chicago"], ["WY"] = ["America/Denver"],
                ["Alabama"] = ["America/Chicago"], ["Alaska"] = ["America/Anchorage"], ["Arizona"] = ["America/Phoenix"],
                ["California"] = ["America/Los_Angeles"], ["Colorado"] = ["America/Denver"],
                ["Florida"] = ["America/New_York"], ["Hawaii"] = ["Pacific/Honolulu"],
                ["Illinois"] = ["America/Chicago"], ["New York"] = ["America/New_York"],
                ["Texas"] = ["America/Chicago"], ["Washington"] = ["America/Los_Angeles"],
            },
            ["AU"] = new(StringComparer.OrdinalIgnoreCase)
            {
                ["NSW"] = ["Australia/Sydney"], ["New South Wales"] = ["Australia/Sydney"],
                ["VIC"] = ["Australia/Melbourne"], ["Victoria"] = ["Australia/Melbourne"],
                ["QLD"] = ["Australia/Brisbane"], ["Queensland"] = ["Australia/Brisbane"],
                ["SA"] = ["Australia/Adelaide"], ["South Australia"] = ["Australia/Adelaide"],
                ["WA"] = ["Australia/Perth"], ["Western Australia"] = ["Australia/Perth"],
                ["TAS"] = ["Australia/Hobart"], ["Tasmania"] = ["Australia/Hobart"],
                ["NT"] = ["Australia/Darwin"], ["Northern Territory"] = ["Australia/Darwin"],
                ["ACT"] = ["Australia/Sydney"], ["Australian Capital Territory"] = ["Australia/Sydney"],
            },
            ["CA"] = new(StringComparer.OrdinalIgnoreCase)
            {
                ["ON"] = ["America/Toronto"], ["Ontario"] = ["America/Toronto"],
                ["QC"] = ["America/Toronto"], ["Quebec"] = ["America/Toronto"], ["Québec"] = ["America/Toronto"],
                ["BC"] = ["America/Vancouver"], ["British Columbia"] = ["America/Vancouver"],
                ["AB"] = ["America/Edmonton"], ["Alberta"] = ["America/Edmonton"],
                ["MB"] = ["America/Winnipeg"], ["Manitoba"] = ["America/Winnipeg"],
                ["SK"] = ["America/Regina"], ["Saskatchewan"] = ["America/Regina"],
                ["NS"] = ["America/Halifax"], ["Nova Scotia"] = ["America/Halifax"],
                ["NB"] = ["America/Moncton"], ["New Brunswick"] = ["America/Moncton"],
                ["NL"] = ["America/St_Johns"], ["Newfoundland and Labrador"] = ["America/St_Johns"],
                ["PE"] = ["America/Halifax"], ["Prince Edward Island"] = ["America/Halifax"],
                ["YT"] = ["America/Whitehorse"], ["Yukon"] = ["America/Whitehorse"],
                ["NT"] = ["America/Yellowknife"], ["Northwest Territories"] = ["America/Yellowknife"],
                ["NU"] = ["America/Iqaluit"], ["Nunavut"] = ["America/Iqaluit"],
            },
            ["ID"] = new(StringComparer.OrdinalIgnoreCase)
            {
                ["Jakarta"] = ["Asia/Jakarta"], ["Jawa Barat"] = ["Asia/Jakarta"], ["West Java"] = ["Asia/Jakarta"],
                ["Jawa Tengah"] = ["Asia/Jakarta"], ["Central Java"] = ["Asia/Jakarta"],
                ["Jawa Timur"] = ["Asia/Jakarta"], ["East Java"] = ["Asia/Jakarta"],
                ["Bali"] = ["Asia/Makassar"], ["Sulawesi"] = ["Asia/Makassar"],
                ["Sulawesi Selatan"] = ["Asia/Makassar"], ["South Sulawesi"] = ["Asia/Makassar"],
                ["Kalimantan"] = ["Asia/Makassar"], ["Makassar"] = ["Asia/Makassar"],
                ["Papua"] = ["Asia/Jayapura"], ["Maluku"] = ["Asia/Jayapura"],
            },
        };

    public static TimeZoneInfo Resolve(string? countryCode, string? stateProvince = null)
    {
        var code = NormalizeCountry(countryCode);
        var region = (stateProvince ?? string.Empty).Trim();
        var cacheKey = string.IsNullOrEmpty(region) ? code : $"{code}|{region}";
        return Cache.GetOrAdd(cacheKey, _ => ResolveCore(code, region));
    }

    public static string ResolveId(string? countryCode, string? stateProvince = null) =>
        Resolve(countryCode, stateProvince).Id;

    public static DateTime ToLocal(DateTime utc, string? countryCode, string? stateProvince = null)
    {
        var tz = Resolve(countryCode, stateProvince);
        var utcDt = utc.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(utc, DateTimeKind.Utc)
            : utc.ToUniversalTime();
        return TimeZoneInfo.ConvertTimeFromUtc(utcDt, tz);
    }

    public static DateTime ToUtc(DateTime local, string? countryCode, string? stateProvince = null)
    {
        var tz = Resolve(countryCode, stateProvince);
        var localDt = DateTime.SpecifyKind(local, DateTimeKind.Unspecified);
        return TimeZoneInfo.ConvertTimeToUtc(localDt, tz);
    }

    public static DateTime NowLocal(string? countryCode, string? stateProvince = null) =>
        ToLocal(DateTime.UtcNow, countryCode, stateProvince);

    public static DateOnly TodayLocal(string? countryCode, string? stateProvince = null) =>
        DateOnly.FromDateTime(NowLocal(countryCode, stateProvince));

    static string NormalizeCountry(string? countryCode)
    {
        var code = (countryCode ?? "MY").Trim().ToUpperInvariant();
        return code.Length == 0 ? "MY" : code;
    }

    static TimeZoneInfo ResolveCore(string code, string region)
    {
        if (!string.IsNullOrEmpty(region)
            && IanaByCountryRegion.TryGetValue(code, out var byRegion)
            && byRegion.TryGetValue(region, out var regionCandidates))
        {
            var tz = FindFirst(regionCandidates);
            if (tz is not null) return tz;
        }

        if (IanaByCountry.TryGetValue(code, out var countryCandidates))
        {
            var tz = FindFirst(countryCandidates);
            if (tz is not null) return tz;
        }

        return TimeZoneInfo.Utc;
    }

    static TimeZoneInfo? FindFirst(IEnumerable<string> candidates)
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

        return null;
    }
}
