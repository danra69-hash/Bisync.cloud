using System.Net.Http.Json;

namespace Bisync.Api.Services;

public class CountryOption
{
    public string CountryCode { get; set; } = null!;
    public string Name { get; set; } = null!;
}

public class PublicHolidayCatalogService(HttpClient http)
{
    private const string BaseUrl = "https://date.nager.at/api/v3";

    public static string BuildCatalogKey(string countryCode, DateOnly date, string name) =>
        $"{countryCode.ToUpperInvariant()}|{date:yyyy-MM-dd}|{name.Trim().ToUpperInvariant()}";

    public static string BuildCustomCatalogKey(string countryCode, DateOnly date, string name) =>
        $"CUSTOM|{countryCode.ToUpperInvariant()}|{date:MM-dd}|{name.Trim().ToUpperInvariant()}";

    public static bool IsCustomCatalogKey(string? catalogKey) =>
        catalogKey is not null && catalogKey.StartsWith("CUSTOM|", StringComparison.OrdinalIgnoreCase);

    public async Task<IReadOnlyList<CountryOption>> GetAvailableCountriesAsync(CancellationToken ct = default)
    {
        try
        {
            var countries = await http.GetFromJsonAsync<List<NagerCountry>>($"{BaseUrl}/AvailableCountries", ct)
                ?? [];
            return countries
                .OrderBy(c => c.Name)
                .Select(c => new CountryOption { CountryCode = c.CountryCode, Name = c.Name })
                .ToList();
        }
        catch
        {
            return [new CountryOption { CountryCode = "MY", Name = "Malaysia" }];
        }
    }

    public async Task<IReadOnlyList<CatalogHoliday>> GetHolidaysAsync(
        string countryCode,
        int year,
        CancellationToken ct = default)
    {
        var code = countryCode.ToUpperInvariant();
        try
        {
            var holidays = await http.GetFromJsonAsync<List<NagerHoliday>>($"{BaseUrl}/PublicHolidays/{year}/{code}", ct)
                ?? [];
            return holidays
                .Select(h => new CatalogHoliday(h.Date, h.LocalName, BuildCatalogKey(code, h.Date, h.LocalName)))
                .ToList();
        }
        catch
        {
            return [];
        }
    }

    private sealed record NagerCountry(string CountryCode, string Name);
    private sealed record NagerHoliday(DateOnly Date, string LocalName, string Name);

    public sealed record CatalogHoliday(DateOnly Date, string Name, string CatalogKey);
}
