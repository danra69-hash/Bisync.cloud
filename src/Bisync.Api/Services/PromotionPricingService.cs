using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

public static class PromotionPricingService
{
    public const string DurationByDate = "byDate";
    public const string DurationByQty = "byQty";
    public const string TypeDiscountPercent = "discountPercent";
    public const string TypeKnockedDownPrice = "knockedDownPrice";

    public sealed record PromoPriceHit(
        int PromotionId,
        int PromotionProductId,
        string PromotionName,
        decimal PromoRrp,
        decimal? RemainingQty);

    public static bool IsEffectivelyActive(Promotion promotion, DateOnly asOf)
    {
        if (!promotion.Active) return false;
        if (asOf < promotion.StartDate) return false;

        if (string.Equals(promotion.DurationMode, DurationByDate, StringComparison.OrdinalIgnoreCase))
        {
            if (promotion.EndDate is DateOnly end && asOf > end)
                return false;
            return true;
        }

        if (string.Equals(promotion.DurationMode, DurationByQty, StringComparison.OrdinalIgnoreCase))
            return promotion.Products.Any(p => p.RemainingQty is > 0);

        return false;
    }

    public static string ResolveStatusLabel(Promotion promotion, DateOnly asOf) =>
        IsEffectivelyActive(promotion, asOf) ? "Active" : "Inactive";

    public static decimal? ComputePromoRrp(Promotion promotion, PromotionProduct line, decimal baseRrp)
    {
        if (string.Equals(promotion.PromotionType, TypeKnockedDownPrice, StringComparison.OrdinalIgnoreCase))
        {
            if (line.KnockedDownPrice is > 0)
                return Math.Round(line.KnockedDownPrice.Value, 4, MidpointRounding.AwayFromZero);
            return null;
        }

        if (string.Equals(promotion.PromotionType, TypeDiscountPercent, StringComparison.OrdinalIgnoreCase))
        {
            var pct = promotion.DiscountPercent ?? 0;
            if (pct < 0) pct = 0;
            if (pct > 100) pct = 100;
            if (baseRrp <= 0) return null;
            var discounted = baseRrp * (1m - (pct / 100m));
            return Math.Round(Math.Max(0, discounted), 4, MidpointRounding.AwayFromZero);
        }

        return null;
    }

    public static async Task<Dictionary<int, PromoPriceHit>> ResolveForProductsAsync(
        BisyncDbContext db,
        int companyId,
        IEnumerable<int> productIds,
        DateOnly asOf,
        CancellationToken cancellationToken = default)
    {
        var ids = productIds.Where(id => id > 0).Distinct().ToList();
        var result = new Dictionary<int, PromoPriceHit>();
        if (ids.Count == 0) return result;

        var promotions = await db.Promotions
            .Include(p => p.Products)
            .Where(p => p.CompanyId == companyId && p.Active)
            .OrderByDescending(p => p.CreatedAt)
            .ThenByDescending(p => p.Id)
            .ToListAsync(cancellationToken);

        foreach (var promotion in promotions)
        {
            if (!IsEffectivelyActive(promotion, asOf))
                continue;

            foreach (var line in promotion.Products)
            {
                if (!ids.Contains(line.ProductId) || result.ContainsKey(line.ProductId))
                    continue;

                if (string.Equals(promotion.DurationMode, DurationByQty, StringComparison.OrdinalIgnoreCase)
                    && line.RemainingQty is not > 0)
                    continue;

                // Base RRP for discount is resolved by caller; store 0 placeholder and recompute when applying.
                result[line.ProductId] = new PromoPriceHit(
                    promotion.Id,
                    line.Id,
                    promotion.Name,
                    0,
                    line.RemainingQty);
            }
        }

        return result;
    }

    public static async Task<Dictionary<int, PromoPriceHit>> ResolvePromoRrpAsync(
        BisyncDbContext db,
        int companyId,
        IReadOnlyDictionary<int, decimal> baseRrpByProductId,
        DateOnly asOf,
        CancellationToken cancellationToken = default)
    {
        var hits = await ResolveForProductsAsync(db, companyId, baseRrpByProductId.Keys, asOf, cancellationToken);
        var result = new Dictionary<int, PromoPriceHit>();

        var promotions = await db.Promotions
            .Include(p => p.Products)
            .Where(p => p.CompanyId == companyId && hits.Values.Select(h => h.PromotionId).Contains(p.Id))
            .ToListAsync(cancellationToken);
        var promoById = promotions.ToDictionary(p => p.Id);

        foreach (var (productId, hit) in hits)
        {
            if (!promoById.TryGetValue(hit.PromotionId, out var promotion))
                continue;
            var line = promotion.Products.FirstOrDefault(p => p.Id == hit.PromotionProductId);
            if (line is null) continue;
            if (!baseRrpByProductId.TryGetValue(productId, out var baseRrp))
                baseRrp = 0;
            var promoRrp = ComputePromoRrp(promotion, line, baseRrp);
            if (promoRrp is null) continue;
            result[productId] = hit with { PromoRrp = promoRrp.Value };
        }

        return result;
    }

    public static async Task ConsumePromoQtyAsync(
        BisyncDbContext db,
        IReadOnlyDictionary<int, decimal> qtyByPromotionProductId,
        CancellationToken cancellationToken = default)
    {
        if (qtyByPromotionProductId.Count == 0) return;

        var ids = qtyByPromotionProductId.Keys.ToList();
        var lines = await db.PromotionProducts
            .Where(p => ids.Contains(p.Id))
            .ToListAsync(cancellationToken);

        foreach (var line in lines)
        {
            if (!qtyByPromotionProductId.TryGetValue(line.Id, out var qty) || qty <= 0)
                continue;
            if (line.RemainingQty is null) continue;
            line.RemainingQty = Math.Max(0, line.RemainingQty.Value - qty);
        }
    }
}
