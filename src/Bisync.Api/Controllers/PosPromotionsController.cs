using System.Globalization;
using System.Text.Json;
using Bisync.Api.Contracts;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Bisync.Api.Services;
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

    static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> List(
        [FromQuery] int companyId,
        [FromQuery] string? status,
        [FromQuery] string? locationExternalId,
        CancellationToken cancellationToken)
    {
        if (companyId <= 0)
            return BadRequest(new { message = "companyId is required." });

        var (_, _, localNow) = await PosPromotionPricingService.ResolveLocalNowAsync(
            db, companyId, locationExternalId, cancellationToken);

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
                string.Equals(
                    PosPromotionPricingService.ResolveStatusLabel(p, localNow),
                    needle,
                    StringComparison.OrdinalIgnoreCase));
        }

        return Ok(filtered.Select(p => MapPromotion(p, localNow)));
    }

    /// <summary>
    /// Products with an in-effect POS promotion RPP for the company/location clock.
    /// </summary>
    [HttpGet("active-prices")]
    public async Task<ActionResult<object>> ActivePrices(
        [FromQuery] int companyId,
        [FromQuery] string? locationExternalId,
        [FromQuery] string? productIds,
        CancellationToken cancellationToken)
    {
        if (companyId <= 0)
            return BadRequest(new { message = "companyId is required." });

        var ids = (productIds ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(s => int.TryParse(s, out var id) ? id : 0)
            .Where(id => id > 0)
            .Distinct()
            .ToList();

        var (_, location, localNow) = await PosPromotionPricingService.ResolveLocalNowAsync(
            db, companyId, locationExternalId, cancellationToken);

        var hits = await PosPromotionPricingService.ResolveActiveRppByProductAsync(
            db, companyId, ids.Count > 0 ? ids : null, locationExternalId, cancellationToken);

        return Ok(new
        {
            asOfLocal = PosPromotionPricingService.FormatLocalStamp(localNow),
            locationExternalId = location?.ExternalId,
            prices = hits.Values
                .OrderBy(h => h.ProductId)
                .Select(h => new
                {
                    productId = h.ProductId,
                    promotionId = h.PromotionId,
                    promotionName = h.PromotionName,
                    rrp = h.Rrp,
                    rpp = h.Rpp,
                    discountPercent = h.DiscountPercent,
                }),
        });
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<object>> Get(
        int id,
        [FromQuery] string? locationExternalId,
        CancellationToken cancellationToken)
    {
        var promotion = await db.PosPromotions.AsNoTracking()
            .Include(p => p.Products)
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);
        if (promotion is null)
            return NotFound(new { message = "POS promotion not found." });

        var (_, _, localNow) = await PosPromotionPricingService.ResolveLocalNowAsync(
            db, promotion.CompanyId, locationExternalId, cancellationToken);
        return Ok(MapPromotion(promotion, localNow));
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

        var kindRaw = (request.PromotionKind ?? string.Empty).Trim();
        var isPrepaid = string.Equals(kindRaw, "prepaid", StringComparison.OrdinalIgnoreCase);
        var promotionKind = isPrepaid ? "prepaid" : "timeBase";

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

        TimeOnly startTime;
        TimeOnly endTime;
        string repeatMode;
        List<string> days;

        if (isPrepaid)
        {
            startTime = new TimeOnly(0, 0);
            endTime = new TimeOnly(23, 59);
            repeatMode = "daily";
            days = [];

            if (request.ValidityPeriodValue <= 0)
                return BadRequest(new { message = "Validity period must be greater than zero." });

            var validityUnit = (request.ValidityPeriodUnit ?? "days").Trim();
            if (!string.Equals(validityUnit, "days", StringComparison.OrdinalIgnoreCase)
                && !string.Equals(validityUnit, "months", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { message = "Validity period unit must be days or months." });

            if (request.PackageQty <= 0)
                return BadRequest(new { message = "Package quantity must be greater than zero." });

            if (string.IsNullOrWhiteSpace(request.PackageUom))
                return BadRequest(new { message = "Package UOM is required." });

            if (request.PackageRpp < 0)
                return BadRequest(new { message = "Package RPP must be zero or greater." });
        }
        else
        {
            if (!TimeOnly.TryParse(request.StartTime, CultureInfo.InvariantCulture, DateTimeStyles.None, out startTime))
                return BadRequest(new { message = "Start time is required (HH:mm)." });
            if (!TimeOnly.TryParse(request.EndTime, CultureInfo.InvariantCulture, DateTimeStyles.None, out endTime))
                return BadRequest(new { message = "End time is required (HH:mm)." });

            repeatMode = (request.RepeatMode ?? string.Empty).Trim();
            if (!string.Equals(repeatMode, "daily", StringComparison.OrdinalIgnoreCase)
                && !string.Equals(repeatMode, "daysOfWeek", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { message = "Repeat must be Daily or choose specific days." });

            repeatMode = string.Equals(repeatMode, "daysOfWeek", StringComparison.OrdinalIgnoreCase)
                ? "daysOfWeek"
                : "daily";

            days = NormalizeDays(request.DaysOfWeek);
            if (repeatMode == "daysOfWeek" && days.Count == 0)
                return BadRequest(new { message = "Select at least one weekday, or choose Repeat Daily." });
        }

        var promoType = (request.PromoType ?? string.Empty).Trim();
        if (!string.Equals(promoType, "discountPercent", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(promoType, "discountPrice", StringComparison.OrdinalIgnoreCase))
        {
            if (isPrepaid)
                promoType = "discountPrice";
            else
                return BadRequest(new { message = "Promo type must be Discount by % or Discount by Price." });
        }

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
        var packageRpp = RoundMoney(request.PackageRpp);
        foreach (var line in request.Products)
        {
            var product = byId[line.ProductId];
            if (product.IsSubProduct || !product.B2cEnabled || !product.PosEnabled || product.Active == false)
                return BadRequest(new { message = $"Product '{product.Name}' is not eligible for POS promotions." });

            var effectiveRrp = RoundMoney(line.Rrp);
            var effectiveRpp = isPrepaid && line == request.Products[0]
                ? packageRpp
                : RoundMoney(line.Rpp);

            if (!isPrepaid && effectiveRrp <= 0)
                return BadRequest(new { message = $"Product '{product.Name}' needs a positive RRP." });
            if (effectiveRpp < 0 || (effectiveRrp > 0 && effectiveRpp > effectiveRrp))
                return BadRequest(new { message = $"RPP for '{product.Name}' must be between 0 and RRP." });
            if (line.DiscountPercent < 0 || line.DiscountPercent > 100)
                return BadRequest(new { message = $"Discount % for '{product.Name}' must be between 0 and 100." });
        }

        var validityUnitCanonical = string.Equals(
            (request.ValidityPeriodUnit ?? "days").Trim(),
            "months",
            StringComparison.OrdinalIgnoreCase)
            ? "months"
            : "days";

        var depletionMethod = string.Equals(
            (request.DepletionMethod ?? "salesUnit").Trim(),
            "weight",
            StringComparison.OrdinalIgnoreCase)
            ? "weight"
            : "salesUnit";

        var depletionUnitsJson = SerializeDepletionUnits(request.DepletionUnits);

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
            PromotionKind = promotionKind,
            ValidityPeriodValue = isPrepaid ? request.ValidityPeriodValue : 0,
            ValidityPeriodUnit = isPrepaid ? validityUnitCanonical : "days",
            PackageQty = isPrepaid ? RoundMoney(request.PackageQty) : 0,
            PackageUom = isPrepaid ? (request.PackageUom?.Trim() ?? string.Empty) : string.Empty,
            PackageRrp = isPrepaid ? RoundMoney(request.PackageRrp) : 0,
            PackageTotalValue = isPrepaid ? RoundMoney(request.PackageTotalValue) : 0,
            PackageRpp = isPrepaid ? packageRpp : 0,
            DiscountAmount = isPrepaid ? RoundMoney(request.DiscountAmount) : 0,
            DepletionMethod = isPrepaid ? depletionMethod : "salesUnit",
            DepletionUnitsJson = isPrepaid ? depletionUnitsJson : "[]",
            Active = true,
            CreatedBy = request.CreatedBy?.Trim() ?? string.Empty,
            CreatedAt = now,
            UpdatedAt = now,
            Products = request.Products.Select((line, index) =>
            {
                var product = byId[line.ProductId];
                var rpp = isPrepaid && index == 0 ? packageRpp : RoundMoney(line.Rpp);
                return new PosPromotionProduct
                {
                    ProductId = product.Id,
                    ProductCode = product.ProductId ?? string.Empty,
                    ProductName = product.Name,
                    Rrp = RoundMoney(line.Rrp),
                    Cogs = RoundMoney(line.Cogs),
                    Rpp = rpp,
                    DiscountPercent = RoundPercent(line.DiscountPercent),
                };
            }).ToList(),
        };

        db.PosPromotions.Add(entity);
        await db.SaveChangesAsync(cancellationToken);
        var (_, _, localNow) = await PosPromotionPricingService.ResolveLocalNowAsync(
            db, entity.CompanyId, null, cancellationToken);
        return Ok(MapPromotion(entity, localNow));
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
        var (_, _, localNow) = await PosPromotionPricingService.ResolveLocalNowAsync(
            db, promotion.CompanyId, null, cancellationToken);
        return Ok(MapPromotion(promotion, localNow));
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

    static string SerializeDepletionUnits(IEnumerable<PosPromotionDepletionUnitRequest>? units)
    {
        if (units is null) return "[]";
        var cleaned = units
            .Where(u => !string.IsNullOrWhiteSpace(u.Code) || !string.IsNullOrWhiteSpace(u.Label))
            .Select(u => new
            {
                code = (u.Code ?? string.Empty).Trim(),
                label = (u.Label ?? string.Empty).Trim(),
                qtyPerUnit = u.QtyPerUnit > 0 ? u.QtyPerUnit : 1m,
            })
            .ToList();
        return JsonSerializer.Serialize(cleaned, JsonOpts);
    }

    static List<object> ReadDepletionUnits(string? json)
    {
        try
        {
            using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(json) ? "[]" : json);
            if (doc.RootElement.ValueKind != JsonValueKind.Array) return [];
            var list = new List<object>();
            foreach (var el in doc.RootElement.EnumerateArray())
            {
                var code = el.TryGetProperty("code", out var c) ? c.GetString() ?? string.Empty : string.Empty;
                var label = el.TryGetProperty("label", out var l) ? l.GetString() ?? string.Empty : string.Empty;
                var qty = 1m;
                if (el.TryGetProperty("qtyPerUnit", out var q) && q.TryGetDecimal(out var parsed))
                    qty = parsed > 0 ? parsed : 1m;
                list.Add(new { code, label, qtyPerUnit = qty });
            }
            return list;
        }
        catch
        {
            return [];
        }
    }

    static decimal RoundMoney(decimal value) => Math.Round(value, 2, MidpointRounding.AwayFromZero);
    static decimal RoundPercent(decimal value) => Math.Round(value, 2, MidpointRounding.AwayFromZero);

    static bool IsPrepaidKind(PosPromotion promotion) =>
        string.Equals(promotion.PromotionKind, "prepaid", StringComparison.OrdinalIgnoreCase);

    static object MapPromotion(PosPromotion promotion, DateTime localNow)
    {
        var days = PosPromotionPricingService.ReadDays(promotion.DaysOfWeekJson);
        var isPrepaid = IsPrepaidKind(promotion);
        var inEffect = !isPrepaid && PosPromotionPricingService.IsInEffect(promotion, localNow);

        return new
        {
            id = promotion.Id,
            companyId = promotion.CompanyId,
            name = promotion.Name,
            promotionKind = string.IsNullOrWhiteSpace(promotion.PromotionKind) ? "timeBase" : promotion.PromotionKind,
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
            validityPeriodValue = promotion.ValidityPeriodValue,
            validityPeriodUnit = promotion.ValidityPeriodUnit,
            packageQty = promotion.PackageQty,
            packageUom = promotion.PackageUom,
            packageRrp = promotion.PackageRrp,
            packageTotalValue = promotion.PackageTotalValue,
            packageRpp = promotion.PackageRpp,
            discountAmount = promotion.DiscountAmount,
            depletionMethod = promotion.DepletionMethod,
            depletionUnits = ReadDepletionUnits(promotion.DepletionUnitsJson),
            active = promotion.Active,
            status = PosPromotionPricingService.ResolveStatusLabel(promotion, localNow),
            inEffectNow = inEffect,
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
