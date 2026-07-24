using Bisync.Api.Contracts;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Bisync.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/promotions")]
public class PromotionsController(BisyncDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> List(
        [FromQuery] int companyId,
        [FromQuery] string? status,
        CancellationToken cancellationToken)
    {
        if (companyId <= 0)
            return BadRequest(new { message = "companyId is required." });

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var promotions = await db.Promotions
            .AsNoTracking()
            .Include(p => p.Products)
            .Where(p => p.CompanyId == companyId)
            .OrderByDescending(p => p.UpdatedAt)
            .ThenByDescending(p => p.Id)
            .ToListAsync(cancellationToken);

        IEnumerable<Promotion> filtered = promotions;
        if (!string.IsNullOrWhiteSpace(status))
        {
            var needle = status.Trim();
            filtered = promotions.Where(p =>
                string.Equals(
                    PromotionPricingService.ResolveStatusLabel(p, today),
                    needle,
                    StringComparison.OrdinalIgnoreCase));
        }

        return Ok(filtered.Select(p => MapPromotion(p, today)));
    }

    [HttpGet("active-prices")]
    public async Task<ActionResult<object>> ActivePrices(
        [FromQuery] int companyId,
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

        if (ids.Count == 0)
            return Ok(Array.Empty<object>());

        var products = await db.Products.AsNoTracking()
            .Include(p => p.Aliases)
            .Where(p => ids.Contains(p.Id) && p.CompanyId == companyId)
            .ToListAsync(cancellationToken);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var baseRrp = products.ToDictionary(
            p => p.Id,
            p =>
            {
                var pricing = B2bProductPricing.ResolveForCustomerProduct(p, null);
                return pricing.Rrp > 0 ? pricing.Rrp : p.Rrp;
            });

        var hits = await PromotionPricingService.ResolvePromoRrpAsync(db, companyId, baseRrp, today, cancellationToken);
        return Ok(hits.Select(kv => new
        {
            productId = kv.Key,
            promotionId = kv.Value.PromotionId,
            promotionName = kv.Value.PromotionName,
            promoRrp = kv.Value.PromoRrp,
            remainingQty = kv.Value.RemainingQty,
            baseRrp = baseRrp.GetValueOrDefault(kv.Key),
        }));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<object>> Get(int id, CancellationToken cancellationToken)
    {
        var promotion = await db.Promotions.AsNoTracking()
            .Include(p => p.Products)
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);
        if (promotion is null)
            return NotFound(new { message = "Promotion not found." });
        return Ok(MapPromotion(promotion, DateOnly.FromDateTime(DateTime.UtcNow)));
    }

    [HttpPost]
    public async Task<ActionResult<object>> Create(
        [FromBody] CreatePromotionRequest request,
        CancellationToken cancellationToken)
    {
        if (request.CompanyId <= 0)
            return BadRequest(new { message = "Company is required." });

        var name = request.Name?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(name))
            return BadRequest(new { message = "Promotion name is required." });

        var durationMode = (request.DurationMode ?? string.Empty).Trim();
        if (!string.Equals(durationMode, PromotionPricingService.DurationByDate, StringComparison.OrdinalIgnoreCase)
            && !string.Equals(durationMode, PromotionPricingService.DurationByQty, StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Duration must be By Date or By QTY." });

        durationMode = string.Equals(durationMode, PromotionPricingService.DurationByQty, StringComparison.OrdinalIgnoreCase)
            ? PromotionPricingService.DurationByQty
            : PromotionPricingService.DurationByDate;

        var promotionType = (request.PromotionType ?? string.Empty).Trim();
        if (!string.Equals(promotionType, PromotionPricingService.TypeDiscountPercent, StringComparison.OrdinalIgnoreCase)
            && !string.Equals(promotionType, PromotionPricingService.TypeKnockedDownPrice, StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Promotion type must be discount % or knocked-down price." });

        promotionType = string.Equals(promotionType, PromotionPricingService.TypeKnockedDownPrice, StringComparison.OrdinalIgnoreCase)
            ? PromotionPricingService.TypeKnockedDownPrice
            : PromotionPricingService.TypeDiscountPercent;

        if (!DateOnly.TryParse(request.StartDate, out var startDate))
            return BadRequest(new { message = "Promotion start date is required." });

        DateOnly? endDate = null;
        if (durationMode == PromotionPricingService.DurationByDate)
        {
            if (!DateOnly.TryParse(request.EndDate, out var parsedEnd))
                return BadRequest(new { message = "End date is required when duration is By Date." });
            if (parsedEnd < startDate)
                return BadRequest(new { message = "End date must be on or after the start date." });
            endDate = parsedEnd;
        }

        decimal? discountPercent = null;
        if (promotionType == PromotionPricingService.TypeDiscountPercent)
        {
            if (request.DiscountPercent is null or < 0 or > 100)
                return BadRequest(new { message = "Discount percent must be between 0 and 100." });
            discountPercent = request.DiscountPercent;
        }

        var selected = (request.Products ?? [])
            .Where(p => p.ProductId > 0)
            .GroupBy(p => p.ProductId)
            .Select(g => g.First())
            .ToList();
        if (selected.Count == 0)
            return BadRequest(new { message = "Select at least one product for this promotion." });

        var productIds = selected.Select(p => p.ProductId).ToList();
        var products = await db.Products.AsNoTracking()
            .Where(p => productIds.Contains(p.Id) && p.CompanyId == request.CompanyId && p.Active && p.B2bEnabled && !p.IsSubProduct)
            .ToListAsync(cancellationToken);
        var productById = products.ToDictionary(p => p.Id);
        if (products.Count != productIds.Count)
            return BadRequest(new { message = "One or more selected products are not available B2B products." });

        var lines = new List<PromotionProduct>();
        foreach (var row in selected)
        {
            var product = productById[row.ProductId];
            decimal? promoQty = null;
            decimal? remainingQty = null;
            if (durationMode == PromotionPricingService.DurationByQty)
            {
                if (row.PromoQty is null or <= 0)
                    return BadRequest(new { message = $"Promo QTY is required for {product.Name}." });
                promoQty = row.PromoQty;
                remainingQty = row.PromoQty;
            }

            decimal? knockedDown = null;
            if (promotionType == PromotionPricingService.TypeKnockedDownPrice)
            {
                if (row.KnockedDownPrice is null or < 0)
                    return BadRequest(new { message = $"Knocked-down price is required for {product.Name}." });
                knockedDown = row.KnockedDownPrice;
            }

            lines.Add(new PromotionProduct
            {
                ProductId = product.Id,
                ProductName = product.Name,
                DeliveryUnit = string.IsNullOrWhiteSpace(product.B2bPackageUnit) ? "pcs" : product.B2bPackageUnit.Trim(),
                PromoQty = promoQty,
                RemainingQty = remainingQty,
                KnockedDownPrice = knockedDown,
            });
        }

        var now = DateTime.UtcNow;
        var promotion = new Promotion
        {
            CompanyId = request.CompanyId,
            Name = name,
            DurationMode = durationMode,
            StartDate = startDate,
            EndDate = endDate,
            PromotionType = promotionType,
            DiscountPercent = discountPercent,
            Active = true,
            CreatedBy = request.CreatedBy?.Trim() ?? string.Empty,
            CreatedAt = now,
            UpdatedAt = now,
            Products = lines,
        };

        db.Promotions.Add(promotion);
        await db.SaveChangesAsync(cancellationToken);
        return Ok(MapPromotion(promotion, DateOnly.FromDateTime(DateTime.UtcNow)));
    }

    [HttpPatch("{id:int}/active")]
    public async Task<ActionResult<object>> SetActive(
        int id,
        [FromBody] SetPromotionActiveRequest request,
        CancellationToken cancellationToken)
    {
        var promotion = await db.Promotions
            .Include(p => p.Products)
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);
        if (promotion is null)
            return NotFound(new { message = "Promotion not found." });

        promotion.Active = request.Active;
        promotion.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return Ok(MapPromotion(promotion, DateOnly.FromDateTime(DateTime.UtcNow)));
    }

    static object MapPromotion(Promotion p, DateOnly asOf) => new
    {
        id = p.Id,
        companyId = p.CompanyId,
        name = p.Name,
        durationMode = p.DurationMode,
        startDate = p.StartDate.ToString("yyyy-MM-dd"),
        endDate = p.EndDate?.ToString("yyyy-MM-dd"),
        promotionType = p.PromotionType,
        discountPercent = p.DiscountPercent,
        active = p.Active,
        status = PromotionPricingService.ResolveStatusLabel(p, asOf),
        createdBy = p.CreatedBy,
        createdAt = p.CreatedAt,
        updatedAt = p.UpdatedAt,
        products = p.Products.Select(line => new
        {
            id = line.Id,
            productId = line.ProductId,
            productName = line.ProductName,
            deliveryUnit = line.DeliveryUnit,
            promoQty = line.PromoQty,
            remainingQty = line.RemainingQty,
            knockedDownPrice = line.KnockedDownPrice,
        }),
    };
}
