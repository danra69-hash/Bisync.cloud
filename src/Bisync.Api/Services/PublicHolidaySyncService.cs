using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

public class PublicHolidaySyncService(PublicHolidayCatalogService catalog)
{
    public async Task SyncOperatingCountryAsync(
        BisyncDbContext db,
        string countryCode,
        IReadOnlyDictionary<DateOnly, bool>? recognitionByDate,
        CancellationToken ct = default)
    {
        var code = countryCode.ToUpperInvariant();
        var year = DateTime.UtcNow.Year;
        var catalogHolidays = new List<PublicHolidayCatalogService.CatalogHoliday>();

        for (var y = year; y <= year + 1; y++)
            catalogHolidays.AddRange(await catalog.GetHolidaysAsync(code, y, ct));

        if (catalogHolidays.Count == 0)
            catalogHolidays.AddRange(GetFallbackHolidays(code, year));

        var existing = await db.PublicHolidays
            .Where(h => h.CountryCode == code && (h.CatalogKey == null || !h.CatalogKey.StartsWith("CUSTOM|")))
            .ToListAsync(ct);
        db.PublicHolidays.RemoveRange(existing);

        foreach (var holiday in catalogHolidays.OrderBy(h => h.Date))
        {
            db.PublicHolidays.Add(new PublicHoliday
            {
                Name = holiday.Name,
                Date = holiday.Date,
                IsRecognized = recognitionByDate?.GetValueOrDefault(holiday.Date, true) ?? true,
                IsGazetted = true,
                CountryCode = code,
                CatalogKey = holiday.CatalogKey,
            });
        }

        await db.SaveChangesAsync(ct);
    }

    static IEnumerable<PublicHolidayCatalogService.CatalogHoliday> GetFallbackHolidays(string countryCode, int year)
    {
        if (!string.Equals(countryCode, "MY", StringComparison.OrdinalIgnoreCase)) return [];

        (string Name, int Month, int Day, bool Recognized)[] my2026 =
        [
            ("New Year's Day", 1, 1, true),
            ("Chinese New Year", 1, 29, true),
            ("Chinese New Year (2nd day)", 1, 30, true),
            ("Thaipusam", 2, 3, false),
            ("Federal Territory Day", 2, 1, false),
            ("Labour Day", 5, 1, true),
            ("Wesak Day", 5, 11, true),
            ("Agong's Birthday", 6, 6, true),
            ("Hari Raya Aidilfitri", 6, 17, true),
            ("Hari Raya Aidilfitri (2nd day)", 6, 18, true),
            ("Hari Raya Aidiladha", 8, 24, true),
            ("Merdeka Day", 8, 31, true),
            ("Malaysia Day", 9, 16, true),
            ("Awal Muharram", 9, 14, false),
            ("Prophet Muhammad's Birthday", 11, 23, true),
            ("Deepavali", 11, 5, true),
            ("Christmas Day", 12, 25, true),
        ];

        return my2026
            .Where(h => h.Month >= 1)
            .Select(h =>
            {
                var date = new DateOnly(year, h.Month, h.Day);
                return new PublicHolidayCatalogService.CatalogHoliday(
                    date,
                    h.Name,
                    PublicHolidayCatalogService.BuildCatalogKey("MY", date, h.Name));
            });
    }
}
