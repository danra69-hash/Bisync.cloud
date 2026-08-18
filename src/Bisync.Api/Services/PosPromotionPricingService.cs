using System.Globalization;
using System.Text.Json;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

/// <summary>
/// Resolves POS promotional prices (RPP) for products when a schedule is in effect
/// (active flag + date range + time-of-day window + weekday repeat rules).
/// </summary>
public static class PosPromotionPricingService
{
    public sealed record ActiveRppHit(
        int PromotionId,
        string PromotionName,
        int ProductId,
        decimal Rrp,
        decimal Rpp,
        decimal DiscountPercent);

    static readonly string[] WeekdayOrder = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    public static async Task<(Company? Company, Location? Location, DateTime LocalNow)> ResolveLocalNowAsync(
        BisyncDbContext db,
        int companyId,
        string? locationExternalId,
        CancellationToken cancellationToken = default)
    {
        var company = await db.Companies.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == companyId, cancellationToken);

        Location? location = null;
        var externalId = (locationExternalId ?? string.Empty).Trim();
        if (!string.IsNullOrEmpty(externalId))
        {
            location = await db.Locations.AsNoTracking()
                .FirstOrDefaultAsync(
                    l => l.CompanyId == companyId && l.ExternalId == externalId,
                    cancellationToken);
        }

        location ??= await db.Locations.AsNoTracking()
            .Where(l => l.CompanyId == companyId && l.Active)
            .OrderBy(l => l.Id)
            .FirstOrDefaultAsync(cancellationToken);

        var localNow = OrgClock.NowLocal(company, location);
        return (company, location, localNow);
    }

    public static bool IsInEffect(PosPromotion promotion, DateTime localNow)
    {
        if (!promotion.Active) return false;

        var today = DateOnly.FromDateTime(localNow);
        if (today < promotion.StartDate) return false;
        if (!promotion.EndDateOpen && promotion.EndDate is DateOnly end && today > end)
            return false;

        if (string.Equals(promotion.RepeatMode, "daysOfWeek", StringComparison.OrdinalIgnoreCase))
        {
            var days = ReadDays(promotion.DaysOfWeekJson);
            if (days.Count == 0) return false;
            var code = WeekdayCode(localNow.DayOfWeek);
            if (!days.Contains(code, StringComparer.OrdinalIgnoreCase))
                return false;
        }

        return IsWithinTimeWindow(promotion.StartTime, promotion.EndTime, TimeOnly.FromDateTime(localNow));
    }

    /// <summary>
    /// Campaign list status using local calendar date (time/weekday do not demote an in-date promo).
    /// </summary>
    public static string ResolveStatusLabel(PosPromotion promotion, DateTime localNow)
    {
        if (!promotion.Active) return "Inactive";
        var today = DateOnly.FromDateTime(localNow);
        if (promotion.StartDate > today) return "Scheduled";
        if (!promotion.EndDateOpen && promotion.EndDate is DateOnly end && end < today)
            return "Inactive";
        return "Active";
    }

    public static async Task<Dictionary<int, ActiveRppHit>> ResolveActiveRppByProductAsync(
        BisyncDbContext db,
        int companyId,
        IEnumerable<int>? productIds,
        string? locationExternalId,
        CancellationToken cancellationToken = default)
    {
        var ids = (productIds ?? []).Where(id => id > 0).Distinct().ToList();
        var result = new Dictionary<int, ActiveRppHit>();

        var (_, _, localNow) = await ResolveLocalNowAsync(db, companyId, locationExternalId, cancellationToken);

        var promotions = await db.PosPromotions
            .AsNoTracking()
            .Include(p => p.Products)
            .Where(p => p.CompanyId == companyId && p.Active)
            .OrderByDescending(p => p.UpdatedAt)
            .ThenByDescending(p => p.Id)
            .ToListAsync(cancellationToken);

        foreach (var promotion in promotions)
        {
            // Prepaid packages are sold/redeemed via PosPrepaidController — not live RPP overlays.
            if (string.Equals(promotion.PromotionKind, "prepaid", StringComparison.OrdinalIgnoreCase))
                continue;

            if (!IsInEffect(promotion, localNow))
                continue;

            foreach (var line in promotion.Products)
            {
                if (ids.Count > 0 && !ids.Contains(line.ProductId))
                    continue;
                if (result.ContainsKey(line.ProductId))
                    continue;
                if (line.Rpp < 0)
                    continue;

                result[line.ProductId] = new ActiveRppHit(
                    promotion.Id,
                    promotion.Name,
                    line.ProductId,
                    line.Rrp,
                    line.Rpp,
                    line.DiscountPercent);
            }
        }

        return result;
    }

    public static bool IsWithinTimeWindow(TimeOnly start, TimeOnly end, TimeOnly now)
    {
        // Compare by minute so EndTime 23:59 covers the whole minute.
        var nowM = now.Hour * 60 + now.Minute;
        var startM = start.Hour * 60 + start.Minute;
        var endM = end.Hour * 60 + end.Minute;

        if (endM < startM)
        {
            // Overnight window (e.g. 22:00–02:00).
            return nowM >= startM || nowM <= endM;
        }

        return nowM >= startM && nowM <= endM;
    }

    public static string WeekdayCode(DayOfWeek day) => day switch
    {
        DayOfWeek.Monday => "Mon",
        DayOfWeek.Tuesday => "Tue",
        DayOfWeek.Wednesday => "Wed",
        DayOfWeek.Thursday => "Thu",
        DayOfWeek.Friday => "Fri",
        DayOfWeek.Saturday => "Sat",
        _ => "Sun",
    };

    public static List<string> ReadDays(string? daysOfWeekJson)
    {
        try
        {
            var days = JsonSerializer.Deserialize<List<string>>(daysOfWeekJson ?? "[]") ?? [];
            return days
                .Select(NormalizeDayCode)
                .Where(d => d is not null)
                .Cast<string>()
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(d => Array.IndexOf(WeekdayOrder, d))
                .ToList();
        }
        catch
        {
            return [];
        }
    }

    static string? NormalizeDayCode(string? raw)
    {
        var code = (raw ?? string.Empty).Trim();
        if (code.Length < 3) return null;
        code = char.ToUpperInvariant(code[0]) + code[1..3].ToLowerInvariant();
        return WeekdayOrder.FirstOrDefault(d => d.Equals(code, StringComparison.OrdinalIgnoreCase));
    }

    public static string FormatLocalStamp(DateTime localNow) =>
        localNow.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture);
}
