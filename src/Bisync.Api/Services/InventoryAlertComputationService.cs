using System.Globalization;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

/// <summary>
/// Builds live Operations Overview inventory alerts:
/// 1) Par-stock — on-hand near (within 10% above) or below configured/derived par stock.
/// 2) System — days of cover from avg component usage (product sales BOM) vs delivery cycle
///    (order frequency, weekend-aware next delivery).
/// </summary>
public sealed class InventoryAlertComputationService(
    BisyncDbContext db,
    IngredientUsageMetricsService usageMetrics,
    StockCardService stockCardService)
{
    /// <summary>Alert when on-hand is at or below 110% of par (within 10% of reaching par from above, and below).</summary>
    public const decimal ParNearFactor = 1.10m;

    /// <summary>Critical when on-hand is at or below 10% of par (or zero).</summary>
    public const decimal ParCriticalFactor = 0.10m;

    public async Task<IReadOnlyList<ComputedInventoryAlert>> ComputeAsync(
        int companyId,
        IReadOnlyList<string>? locationIds,
        CancellationToken ct = default)
    {
        var locationIdList = (locationIds ?? Array.Empty<string>())
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Select(id => id.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (locationIdList.Count == 0)
        {
            locationIdList = await db.Locations.AsNoTracking()
                .Where(l => l.CompanyId == companyId)
                .Select(l => l.ExternalId)
                .ToListAsync(ct);
        }

        var ingredients = await db.Ingredients.AsNoTracking()
            .Where(i => i.CompanyId == companyId && i.Active)
            .OrderBy(i => i.Name)
            .ToListAsync(ct);
        if (ingredients.Count == 0)
            return [];

        var metrics = await usageMetrics.ComputeAsync(companyId, locationIdList, ct);

        var onHandByKey = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
        if (locationIdList.Count > 0)
        {
            var stockRows = await stockCardService.ListAsync(
                companyId,
                locationIdList,
                "component",
                "recipe",
                period: null,
                ct);
            foreach (var row in stockRows)
            {
                onHandByKey.TryGetValue(row.ItemKey, out var existing);
                onHandByKey[row.ItemKey] = existing + row.OnHandQty;
            }
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var alerts = new List<ComputedInventoryAlert>();
        var seq = 1;

        foreach (var ingredient in ingredients)
        {
            metrics.DailyUsageByComponentId.TryGetValue(ingredient.ComponentId, out var computedUsage);
            metrics.OrderFreqDaysByComponentId.TryGetValue(ingredient.ComponentId, out var computedFreq);
            onHandByKey.TryGetValue(ingredient.ComponentId, out var onHand);

            var dailyUsage = computedUsage > 0 ? computedUsage : ingredient.DailyUsage;
            var orderFreq = computedFreq > 0 ? computedFreq : ingredient.OrderFreqDays;
            if (orderFreq <= 0) orderFreq = 7;

            var parStock = ingredient.ParStock > 0
                ? ingredient.ParStock
                : (dailyUsage > 0 && orderFreq > 0 ? dailyUsage * orderFreq : 0m);
            var uom = !string.IsNullOrWhiteSpace(ingredient.ParStockUom)
                ? ingredient.ParStockUom.Trim()
                : (ingredient.RecipeUom ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(uom))
                uom = "ea";

            var parAlert = TryBuildParStockAlert(
                seq,
                ingredient,
                onHand,
                parStock,
                uom);
            if (parAlert is not null)
            {
                alerts.Add(parAlert);
                seq++;
            }

            var systemAlert = TryBuildSystemAlert(
                seq,
                ingredient,
                onHand,
                dailyUsage,
                orderFreq,
                uom,
                today,
                computedUsage > 0);
            if (systemAlert is not null)
            {
                alerts.Add(systemAlert);
                seq++;
            }
        }

        return alerts
            .OrderBy(a => a.Status == "critical" ? 0 : 1)
            .ThenBy(a => a.ItemName, StringComparer.OrdinalIgnoreCase)
            .ThenBy(a => a.AlertType, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    static ComputedInventoryAlert? TryBuildParStockAlert(
        int id,
        Ingredient ingredient,
        decimal onHand,
        decimal parStock,
        string uom)
    {
        if (parStock <= 0) return null;

        var nearThreshold = parStock * ParNearFactor;
        if (onHand > nearThreshold) return null;

        var criticalFloor = parStock * ParCriticalFactor;
        var status = onHand <= 0 || onHand <= criticalFloor ? "critical" : "low";
        var pctOfPar = parStock > 0
            ? decimal.Round(onHand / parStock * 100m, 1, MidpointRounding.AwayFromZero)
            : 0m;

        return new ComputedInventoryAlert(
            Id: id,
            ItemName: ingredient.Name,
            ComponentId: ingredient.ComponentId,
            Stock: FormatQty(onHand, uom),
            Status: status,
            Threshold: FormatQty(parStock, uom),
            AlertType: "parstock",
            BasisLabel: "Based on par stock",
            Detail: onHand <= parStock
                ? $"On hand is at or below par stock ({pctOfPar}% of par)."
                : $"On hand is within 10% of par stock ({pctOfPar}% of par).",
            OnHandQty: onHand,
            ParStock: parStock,
            DailyUsage: 0,
            OrderFreqDays: 0,
            DeliveryCycleDays: 0,
            DaysOfCover: 0,
            Uom: uom);
    }

    static ComputedInventoryAlert? TryBuildSystemAlert(
        int id,
        Ingredient ingredient,
        decimal onHand,
        decimal dailyUsage,
        int orderFreqDays,
        string uom,
        DateOnly today,
        bool usageFromSales)
    {
        if (dailyUsage <= 0) return null;

        var deliveryCycleDays = ResolveDeliveryCycleDays(orderFreqDays, today);
        var daysOfCover = decimal.Round(onHand / dailyUsage, 2, MidpointRounding.AwayFromZero);
        if (daysOfCover >= deliveryCycleDays) return null;

        var status = daysOfCover <= 0 || daysOfCover < deliveryCycleDays * 0.5m
            ? "critical"
            : "low";
        var usageBasis = usageFromSales ? "avg product sales" : "configured daily usage";

        return new ComputedInventoryAlert(
            Id: id,
            ItemName: ingredient.Name,
            ComponentId: ingredient.ComponentId,
            Stock: FormatQty(onHand, uom),
            Status: status,
            Threshold: $"{deliveryCycleDays}d cycle",
            AlertType: "system",
            BasisLabel: "Based on sales & delivery cycle",
            Detail:
                $"~{FormatNumber(daysOfCover)}d cover from {usageBasis} vs {deliveryCycleDays}d delivery cycle (weekends considered).",
            OnHandQty: onHand,
            ParStock: 0,
            DailyUsage: dailyUsage,
            OrderFreqDays: orderFreqDays,
            DeliveryCycleDays: deliveryCycleDays,
            DaysOfCover: daysOfCover,
            Uom: uom);
    }

    /// <summary>
    /// Calendar days until the next typical delivery, starting from today + order frequency,
    /// rolling weekend landing dates forward to Monday (deliveries typically skip Sat/Sun).
    /// </summary>
    public static int ResolveDeliveryCycleDays(int orderFreqDays, DateOnly fromDate)
    {
        var cycle = Math.Max(1, orderFreqDays);
        var delivery = fromDate.AddDays(cycle);
        while (delivery.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday)
            delivery = delivery.AddDays(1);
        return Math.Max(1, delivery.DayNumber - fromDate.DayNumber);
    }

    static string FormatQty(decimal qty, string uom)
    {
        var n = FormatNumber(qty);
        return string.IsNullOrWhiteSpace(uom) ? n : $"{n} {uom}";
    }

    static string FormatNumber(decimal value) =>
        value.ToString("0.##", CultureInfo.InvariantCulture);
}

public sealed record ComputedInventoryAlert(
    int Id,
    string ItemName,
    string ComponentId,
    string Stock,
    string Status,
    string Threshold,
    string AlertType,
    string BasisLabel,
    string Detail,
    decimal OnHandQty,
    decimal ParStock,
    decimal DailyUsage,
    int OrderFreqDays,
    int DeliveryCycleDays,
    decimal DaysOfCover,
    string Uom);
