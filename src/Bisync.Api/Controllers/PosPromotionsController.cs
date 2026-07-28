using System.Globalization;
using System.Text.Json;
using Bisync.Api.Contracts;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/pos-promotions")]
public class PosPromotionsController(BisyncDbContext db) : ControllerBase
{
    static readonly HashSet<string> WeekdayCodes = new(StringComparer.OrdinalIgnoreCase)
    {
        "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun",
    };

    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> List(
        [FromQuery] int companyId,
        [FromQuery] string? status,
        CancellationToken cancellationToken)
    {
        if (companyId <= 0)
            return BadRequest(new { message = "companyId is required." });

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var promotions = await db.PosPromotions
            .AsNoTracking()
            .Include(p => p.Products)
            .Where(p => p.CompanyId == companyId)
            .OrderByDescending(p => p.UpdatedAt)
            .ThenByDescending(p => p.Id)
            .ToListAsync(cancellationToken);

        IEnumerable<PosPromotion> filtered = promotions;
        if (!string.IsNullOrWhiteSpace(status))
        {
            var needle = status.Trim();
            filtered = promotions.Where(p =>
                string.Equals(ResolveStatusLabel(p, today), needle, StringComparison.OrdinalIgnoreCase));
        }

        return Ok(filtered.Select(p => MapPromotion(p, today)));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<object>> Get(int id, CancellationToken cancellationToken)
    {
        var promotion = await db.PosPromotions.AsNoTracking()
            .Include(p => p.Products)
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);
        if (promotion is null)
            return NotFound(new { message = "POS promotion not found." });
        return Ok(MapPromotion(promotion, DateOnly.FromDateTime(DateTime.UtcNow)));
    }

    [HttpPost]
    public async Task<ActionResult<object>> Create(
        [FromBody] CreatePosPromotionRequest request,
        CancellationToken cancellationToken)
    {
        if (request.CompanyId <= 0)
            return BadRequest(new { message = "Company is required." });

        var name = request.Name?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(name))
            return BadRequest(new { message = "Promotion name is required." });

        if (!DateOnly.TryParse(request.StartDate, CultureInfo.InvariantCulture, DateTimeStyles.None, out var startDate))
            return BadRequest(new { message = "Start date is required (yyyy-MM-dd)." });

        DateOnly? endDate = null;
        if (!request.EndDateOpen)
        {
            if (!DateOnly.TryParse(request.EndDate, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsedEnd))
                return BadRequest(new { message = "End date is required unless End date open is ticked." });
            if (parsedEnd < startDate)
                return BadRequest(new { message = "End date must be on or after the start date." });
            endDate = parsedEnd;
        }

        if (!TimeOnly.TryParse(request.StartTime, CultureInfo.InvariantCulture, DateTimeStyles.None, out var startTime))
            return BadRequest(new { message = "Start time is required (HH:mm)." });
        if (!TimeOnly.TryParse(request.EndTime, CultureInfo.InvariantCulture, DateTimeStyles.None, out var endTime))
            return BadRequest(new { message = "End time is required (HH:mm)." });

        var repeatMode = (request.RepeatMode ?? string.Empty).Trim();
        if (!string.Equals(repeatMode, "daily", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(repeatMode, "daysOfWeek", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Repeat must be Daily or choose specific days." });

        repeatMode = string.Equals(repeatMode, "daysOfWeek", StringComparison.OrdinalIgnoreCase)
            ? "daysOfWeek"
            : "daily";

        var days = NormalizeDays(request.DaysOfWeek);
        if (repeatMode == "daysOfWeek" && days.Count == 0)
            return BadRequest(new { message = "Select at least one weekday, or choose Repeat Daily." });

        var promoType = (request.PromoType ?? string.Empty).Trim();
        if (!string.Equals(promoType, "discountPercent", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(promoType, "discountPrice", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Promo type must be Discount by % or Discount by Price." });

        promoType = string.Equals(promoType, "discountPrice", StringComparison.OrdinalIgnoreCase)
            ? "discountPrice"
            : "discountPercent";

        if (request.Products is null || request.Products.Count == 0)
            return BadRequest(new { message = "Add at least one product with a promotional price." });

        var productIds = request.Products.Select(p => p.ProductId).Distinct().ToList();
        if (productIds.Count != request.Products.Count)
            return BadRequest(new { message = "Duplicate products are not allowed in one promotion." });

        var catalog = await db.Products.AsNoTracking()
            .Where(p => productIds.Contains(p.Id) && p.CompanyId == request.CompanyId)
            .ToListAsync(cancellationToken);

        if (catalog.Count != productIds.Count)
            return BadRequest(new { message = "One or more products were not found for this company." });

        var byId = catalog.ToDictionary(p => p.Id);
        foreach (var line in request.Products)
        {
            var product = byId[line.ProductId];
            if (product.IsSubProduct || !product.B2cEnabled || !product.PosEnabled || product.Active == false)
                return BadRequest(new { message = $"Product '{product.Name}' is not eligible for POS promotions." });
            if (line.Rrp <= 0)
                return BadRequest(new { message = $"Product '{product.Name}' needs a positive RRP." });
            if (line.Rpp < 0 || line.Rpp > line.Rrp)
                return BadRequest(new { message = $"RPP for '{product.Name}' must be between 0 and RRP." });
            if (line.DiscountPercent < 0 || line.DiscountPercent > 100)
                return BadRequest(new { message = $"Discount % for '{product.Name}' must be between 0 and 100." });
        }

        var now = DateTime.UtcNow;
        var entity = new PosPromotion
        {
            CompanyId = request.CompanyId,
            Name = name,
            StartDate = startDate,
            EndDate = endDate,
            EndDateOpen = request.EndDateOpen,
            StartTime = startTime,
            EndTime = endTime,
            RepeatMode = repeatMode,
            DaysOfWeekJson = JsonSerializer.Serialize(days),
            FilterCategory = NormalizeFilter(request.FilterCategory),
            FilterGroup = NormalizeFilter(request.FilterGroup),
            PromoType = promoType,
            Active = true,
            CreatedBy = request.CreatedBy?.Trim() ?? string.Empty,
            CreatedAt = now,
            UpdatedAt = now,
            Products = request.Products.Select(line =>
            {
                var product = byId[line.ProductId];
                return new PosPromotionProduct
                {
                    ProductId = product.Id,
                    ProductCode = product.ProductId ?? string.Empty,
                    ProductName = product.Name,
                    Rrp = RoundMoney(line.Rrp),
                    Cogs = RoundMoney(line.Cogs),
                    Rpp = RoundMoney(line.Rpp),
                    DiscountPercent = RoundPercent(line.DiscountPercent),
                };
            }).ToList(),
        };

        db.PosPromotions.Add(entity);
        await db.SaveChangesAsync(cancellationToken);
        return Ok(MapPromotion(entity, DateOnly.FromDateTime(DateTime.UtcNow)));
    }

    [HttpPatch("{id:int}/active")]
    public async Task<ActionResult<object>> SetActive(
        int id,
        [FromBody] SetPosPromotionActiveRequest request,
        CancellationToken cancellationToken)
    {
        var promotion = await db.PosPromotions
            .Include(p => p.Products)
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);
        if (promotion is null)
            return NotFound(new { message = "POS promotion not found." });

        promotion.Active = request.Active;
        promotion.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return Ok(MapPromotion(promotion, DateOnly.FromDateTime(DateTime.UtcNow)));
    }

    static string? NormalizeFilter(string? value)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrWhiteSpace(trimmed) || string.Equals(trimmed, "All", StringComparison.OrdinalIgnoreCase))
            return null;
        return trimmed;
    }

    static List<string> NormalizeDays(IEnumerable<string>? days)
    {
        var result = new List<string>();
        if (days is null) return result;
        foreach (var raw in days)
        {
            var code = (raw ?? string.Empty).Trim();
            if (code.Length >= 3)
                code = char.ToUpperInvariant(code[0]) + code[1..3].ToLowerInvariant();
            if (!WeekdayCodes.Contains(code)) continue;
            var canonical = WeekdayCodes.First(d => d.Equals(code, StringComparison.OrdinalIgnoreCase));
            if (!result.Contains(canonical, StringComparer.OrdinalIgnoreCase))
                result.Add(canonical);
        }
        return result;
    }

    static decimal RoundMoney(decimal value) => Math.Round(value, 2, MidpointRounding.AwayFromZero);
    static decimal RoundPercent(decimal value) => Math.Round(value, 2, MidpointRounding.AwayFromZero);

    static string ResolveStatusLabel(PosPromotion promotion, DateOnly today)
    {
        if (!promotion.Active) return "Inactive";
        if (promotion.StartDate > today) return "Scheduled";
        if (!promotion.EndDateOpen && promotion.EndDate is DateOnly end && end < today) return "Inactive";
        return "Active";
    }

    static object MapPromotion(PosPromotion promotion, DateOnly today)
    {
        List<string> days;
        try
        {
            days = JsonSerializer.Deserialize<List<string>>(promotion.DaysOfWeekJson ?? "[]") ?? [];
        }
        catch
        {
            days = [];
        }

        return new
        {
            id = promotion.Id,
            companyId = promotion.CompanyId,
            name = promotion.Name,
            startDate = promotion.StartDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            endDate = promotion.EndDate?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            endDateOpen = promotion.EndDateOpen,
            startTime = promotion.StartTime.ToString("HH:mm", CultureInfo.InvariantCulture),
            endTime = promotion.EndTime.ToString("HH:mm", CultureInfo.InvariantCulture),
            repeatMode = promotion.RepeatMode,
            daysOfWeek = days,
            filterCategory = promotion.FilterCategory,
            filterGroup = promotion.FilterGroup,
            promoType = promotion.PromoType,
            active = promotion.Active,
            status = ResolveStatusLabel(promotion, today),
            createdBy = promotion.CreatedBy,
            createdAt = promotion.CreatedAt,
            updatedAt = promotion.UpdatedAt,
            products = promotion.Products
                .OrderBy(p => p.ProductName)
                .Select(p => new
                {
                    id = p.Id,
                    productId = p.ProductId,
                    productCode = p.ProductCode,
                    productName = p.ProductName,
                    rrp = p.Rrp,
                    cogs = p.Cogs,
                    rpp = p.Rpp,
                    discountPercent = p.DiscountPercent,
                }),
        };
    }
}
