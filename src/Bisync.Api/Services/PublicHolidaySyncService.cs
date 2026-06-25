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

        var existing = await db.PublicHolidays.ToListAsync(ct);
        db.PublicHolidays.RemoveRange(existing);

        foreach (var holiday in catalogHolidays.OrderBy(h => h.Date))
        {
            db.PublicHolidays.Add(new PublicHoliday
            {
                Name = holiday.Name,
                Date = holiday.Date,
                IsRecognized = recognitionByDate?.GetValueOrDefault(holiday.Date, true) ?? true,
                CountryCode = code,
                CatalogKey = holiday.CatalogKey,
            });
        }

        await db.SaveChangesAsync(ct);
    }
}
