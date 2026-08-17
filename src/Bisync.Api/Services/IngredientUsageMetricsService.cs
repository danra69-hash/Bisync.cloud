using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

/// <summary>
/// Computes component daily usage from fulfilled sales (BOM explode, last 90 days)
/// and order frequency from consolidated purchase orders (last 90 days).
/// </summary>
public sealed class IngredientUsageMetricsService(BisyncDbContext db)
{
    public const int LookbackDays = 90;

    public async Task<IngredientUsageMetricsResult> ComputeAsync(
        int companyId,
        IReadOnlyList<string>? locationIds,
        CancellationToken ct = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var fromDate = today.AddDays(-LookbackDays);
        var fromDateStr = fromDate.ToString("yyyy-MM-dd");
        var locationFilter = locationIds?
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Select(id => id.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList() ?? [];

        var dailyUsage = await ComputeDailyUsageAsync(companyId, fromDateStr, locationFilter, ct);
        var orderFreq = await ComputeOrderFreqAsync(companyId, fromDate, locationFilter, ct);
        return new IngredientUsageMetricsResult(dailyUsage, orderFreq, LookbackDays);
    }

    async Task<Dictionary<string, decimal>> ComputeDailyUsageAsync(
        int companyId,
        string fromDateStr,
        List<string> locationFilter,
        CancellationToken ct)
    {
        var totals = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);

        var lines = await db.B2bSalesOrderLines
            .AsNoTracking()
            .Where(l =>
                l.SalesOrder != null
                && l.SalesOrder.CompanyId == companyId
                && l.SalesOrder.Status == "fulfilled"
                && l.Status == "fulfilled"
                && l.QuantityLocked > 0
                && l.SalesOrder.FulfilledDate.CompareTo(fromDateStr) >= 0)
            .Select(l => new
            {
                l.ProductId,
                l.QuantityLocked,
                l.LocationExternalId,
            })
            .ToListAsync(ct);

        if (locationFilter.Count > 0)
        {
            lines = lines
                .Where(l => locationFilter.Contains(l.LocationExternalId, StringComparer.OrdinalIgnoreCase))
                .ToList();
        }

        if (lines.Count == 0)
            return totals;

        var productIds = lines.Select(l => l.ProductId).Distinct().ToList();
        var products = await db.Products
            .AsNoTracking()
            .Include(p => p.Items)
            .Where(p => productIds.Contains(p.Id) && p.CompanyId == companyId)
            .ToListAsync(ct);
        var productsById = products.ToDictionary(p => p.Id);

        // Legacy data can contain duplicate ProductId values among active sub-products.
        // ToDictionary would throw and take down /api/ingredients enrichment.
        var subProductRows = await db.Products
            .AsNoTracking()
            .Include(p => p.Items)
            .Where(p => p.CompanyId == companyId && p.IsSubProduct && p.Active)
            .ToListAsync(ct);
        var subProducts = subProductRows
            .Where(p => !string.IsNullOrWhiteSpace(p.ProductId))
            .GroupBy(p => p.ProductId.Trim(), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                g => g.Key,
                g => g.OrderBy(p => p.Id).First(),
                StringComparer.OrdinalIgnoreCase);

        foreach (var line in lines)
        {
            if (!productsById.TryGetValue(line.ProductId, out var product))
                continue;

            AddBomUsage(totals, product, line.QuantityLocked, subProducts);
        }

        var days = Math.Max(1, LookbackDays);
        foreach (var key in totals.Keys.ToList())
            totals[key] = decimal.Round(totals[key] / days, 4, MidpointRounding.AwayFromZero);

        return totals;
    }

    static void AddBomUsage(
        Dictionary<string, decimal> totals,
        Product product,
        decimal quantitySold,
        Dictionary<string, Product> subProducts)
    {
        if (quantitySold <= 0) return;

        foreach (var bom in product.Items.Where(i => !string.IsNullOrWhiteSpace(i.ComponentId) && i.Quantity > 0))
        {
            if (subProducts.TryGetValue(bom.ComponentId, out var sub))
            {
                var yieldQty = sub.YieldQuantity > 0 ? sub.YieldQuantity : 1m;
                var batches = (bom.Quantity * quantitySold) / yieldQty;
                AddBomUsage(totals, sub, batches, subProducts);
                continue;
            }

            var qty = bom.Quantity * quantitySold;
            if (qty <= 0) continue;
            totals.TryGetValue(bom.ComponentId, out var existing);
            totals[bom.ComponentId] = existing + qty;
        }
    }

    async Task<Dictionary<string, int>> ComputeOrderFreqAsync(
        int companyId,
        DateOnly fromDate,
        List<string> locationFilter,
        CancellationToken ct)
    {
        var result = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        var excluded = new[]
        {
            PurchaseOrderWorkflow.StatusPendingApproval,
            "Cancelled",
            "Rejected",
        };

        var orders = await db.PurchaseOrders
            .AsNoTracking()
            .Include(o => o.Items)
            .Where(o =>
                o.CompanyId == companyId
                && o.OrderDate >= fromDate
                && o.DocumentType == PurchaseOrderWorkflow.DocumentTypePo
                && !excluded.Contains(o.Status))
            .ToListAsync(ct);

        if (locationFilter.Count > 0)
        {
            orders = orders
                .Where(o =>
                {
                    var ids = PurchaseOrderWorkflow.DeserializeLocationIds(o.LocationIdsJson);
                    if (ids.Count == 0) return true;
                    return ids.Any(id => locationFilter.Contains(id, StringComparer.OrdinalIgnoreCase));
                })
                .ToList();
        }

        var datesByComponent = new Dictionary<string, SortedSet<DateOnly>>(StringComparer.OrdinalIgnoreCase);
        foreach (var order in orders)
        {
            foreach (var item in order.Items.Where(i => !string.IsNullOrWhiteSpace(i.ComponentId)))
            {
                if (!datesByComponent.TryGetValue(item.ComponentId, out var set))
                {
                    set = [];
                    datesByComponent[item.ComponentId] = set;
                }
                set.Add(order.OrderDate);
            }
        }

        foreach (var (componentId, dates) in datesByComponent)
        {
            if (dates.Count >= 2)
            {
                var list = dates.ToList();
                var gaps = new List<int>();
                for (var i = 1; i < list.Count; i++)
                    gaps.Add(list[i].DayNumber - list[i - 1].DayNumber);
                var avg = gaps.Count > 0 ? (int)Math.Round(gaps.Average()) : LookbackDays;
                result[componentId] = Math.Max(1, avg);
            }
            else if (dates.Count == 1)
            {
                result[componentId] = LookbackDays;
            }
        }

        return result;
    }
}

public sealed record IngredientUsageMetricsResult(
    IReadOnlyDictionary<string, decimal> DailyUsageByComponentId,
    IReadOnlyDictionary<string, int> OrderFreqDaysByComponentId,
    int LookbackDays);
