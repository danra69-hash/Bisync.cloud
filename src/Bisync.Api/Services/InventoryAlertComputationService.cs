using System.Data;
using System.Globalization;
using System.Text.Json;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace Bisync.Api.Services;

/// <summary>
/// Builds live Operations Overview inventory alerts:
/// 1) Par-stock — on-hand near (within 10% above) or below configured/derived par stock.
/// 2) System — days of cover from avg component usage (product sales BOM) vs delivery cycle
///    (order frequency, weekend-aware next delivery).
/// 3) Expiry — consolidated lots with a product expiry date that will not be fully consumed
///    before expiry at average daily usage (FIFO-aware).
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

        var datedLotsByComponent = await LoadDatedLotsByComponentAsync(companyId, locationIdList, ct);

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

            datedLotsByComponent.TryGetValue(ingredient.ComponentId, out var lots);
            var expiryAlert = TryBuildExpiryAlert(
                seq,
                ingredient,
                lots ?? [],
                dailyUsage,
                uom,
                today,
                computedUsage > 0);
            if (expiryAlert is not null)
            {
                alerts.Add(expiryAlert);
                seq++;
            }
        }

        return alerts
            .OrderBy(a => a.Status == "critical" ? 0 : 1)
            .ThenBy(a => a.ItemName, StringComparer.OrdinalIgnoreCase)
            .ThenBy(a => a.AlertType, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    async Task<Dictionary<string, List<DatedLot>>> LoadDatedLotsByComponentAsync(
        int companyId,
        List<string> locationIdList,
        CancellationToken ct)
    {
        var locationSet = new HashSet<string>(locationIdList, StringComparer.OrdinalIgnoreCase);
        var purchases = await db.InventoryPurchases.AsNoTracking()
            .Where(p => p.CompanyId == companyId && p.PurchaseOrderItemId > 0)
            .ToListAsync(ct);
        if (purchases.Count == 0)
            return new Dictionary<string, List<DatedLot>>(StringComparer.OrdinalIgnoreCase);

        if (locationSet.Count > 0)
        {
            purchases = purchases
                .Where(p =>
                {
                    var loc = (p.LocationExternalId ?? string.Empty).Trim();
                    if (!string.IsNullOrEmpty(loc))
                        return locationSet.Contains(loc);
                    var ids = PurchaseOrderWorkflow.DeserializeLocationIds(p.LocationIdsJson);
                    return ids.Count == 0 || ids.Any(id => locationSet.Contains(id));
                })
                .ToList();
        }

        var poItemIds = purchases.Select(p => p.PurchaseOrderItemId).Distinct().ToList();
        var expiryByPoItem = await db.PurchaseOrderItems.AsNoTracking()
            .Where(i => poItemIds.Contains(i.Id))
            .Select(i => new { i.Id, i.ProductExpiryDate })
            .ToDictionaryAsync(i => i.Id, i => (i.ProductExpiryDate ?? string.Empty).Trim(), ct);

        var remainingByPurchase = await LoadBatchRemainingByPurchaseAsync(companyId, ct);
        var result = new Dictionary<string, List<DatedLot>>(StringComparer.OrdinalIgnoreCase);

        foreach (var purchase in purchases)
        {
            var expiryRaw = (purchase.ProductExpiryDate ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(expiryRaw)
                && expiryByPoItem.TryGetValue(purchase.PurchaseOrderItemId, out var fromPo))
            {
                expiryRaw = fromPo;
            }

            if (string.IsNullOrWhiteSpace(expiryRaw)
                || !DateOnly.TryParseExact(
                    expiryRaw,
                    "yyyy-MM-dd",
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.None,
                    out var expiryDate))
            {
                continue;
            }

            if (!remainingByPurchase.TryGetValue(purchase.Id, out var remaining) || remaining <= 0)
                continue;

            var componentId = (purchase.ComponentId ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(componentId)) continue;

            if (!result.TryGetValue(componentId, out var list))
            {
                list = [];
                result[componentId] = list;
            }

            list.Add(new DatedLot(
                purchase.Id,
                remaining,
                (purchase.Uom ?? string.Empty).Trim(),
                purchase.DateCreatedInStock,
                expiryDate));
        }

        foreach (var key in result.Keys.ToList())
        {
            result[key] = result[key]
                .OrderBy(l => l.ReceivedAt)
                .ThenBy(l => l.PurchaseId)
                .ToList();
        }

        return result;
    }

    async Task<Dictionary<int, decimal>> LoadBatchRemainingByPurchaseAsync(int companyId, CancellationToken ct)
    {
        var map = new Dictionary<int, decimal>();
        await using var cmd = db.Database.GetDbConnection().CreateCommand();
        if (cmd.Connection!.State != ConnectionState.Open)
            await db.Database.OpenConnectionAsync(ct);
        cmd.Transaction = db.Database.CurrentTransaction?.GetDbTransaction();
        cmd.CommandText =
            """
            SELECT source_purchase_id, COALESCE(SUM(remaining_qty), 0)
            FROM inventory_batches
            WHERE status = 'ACTIVE'
              AND remaining_qty > 0
              AND source_purchase_id IS NOT NULL
              AND (company_id = @company_id OR company_id IS NULL)
            GROUP BY source_purchase_id
            """;
        var p = cmd.CreateParameter();
        p.ParameterName = "@company_id";
        p.Value = companyId;
        cmd.Parameters.Add(p);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            if (reader.IsDBNull(0)) continue;
            var purchaseId = Convert.ToInt32(reader.GetValue(0));
            var remaining = Convert.ToDecimal(reader.GetValue(1));
            if (purchaseId > 0 && remaining > 0)
                map[purchaseId] = remaining;
        }

        return map;
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
            Uom: uom,
            ExpiryDate: null,
            DaysUntilExpiry: null,
            AtRiskQty: null);
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
            Uom: uom,
            ExpiryDate: null,
            DaysUntilExpiry: null,
            AtRiskQty: null);
    }

    /// <summary>
    /// FIFO-aware expiry risk: only lots consolidated with an expiry date.
    /// Alerts when remaining qty cannot be consumed before expiry at average daily usage.
    /// </summary>
    static ComputedInventoryAlert? TryBuildExpiryAlert(
        int id,
        Ingredient ingredient,
        IReadOnlyList<DatedLot> lots,
        decimal dailyUsage,
        string displayUom,
        DateOnly today,
        bool usageFromSales)
    {
        if (lots.Count == 0 || dailyUsage <= 0) return null;

        decimal virtualDay = 0;
        decimal atRiskQty = 0;
        DateOnly? worstExpiry = null;
        int? worstDaysLeft = null;
        var anyDated = false;

        foreach (var lot in lots)
        {
            anyDated = true;
            var remainingRecipe = ToRecipeQty(lot.RemainingQty, lot.Uom, ingredient);
            if (remainingRecipe <= 0) continue;

            var daysToDrain = remainingRecipe / dailyUsage;
            var daysLeft = lot.ExpiryDate.DayNumber - today.DayNumber;

            if (daysLeft < 0)
            {
                atRiskQty += remainingRecipe;
                worstExpiry = worstExpiry is null || lot.ExpiryDate < worstExpiry
                    ? lot.ExpiryDate
                    : worstExpiry;
                worstDaysLeft = worstDaysLeft is null
                    ? daysLeft
                    : Math.Min(worstDaysLeft.Value, daysLeft);
            }
            else
            {
                var consumableBeforeExpiry = dailyUsage * Math.Max(0m, daysLeft - virtualDay);
                var uneaten = remainingRecipe - consumableBeforeExpiry;
                if (uneaten > StockCardFifoEngine.QtyEpsilon)
                {
                    atRiskQty += uneaten;
                    worstExpiry = worstExpiry is null || lot.ExpiryDate < worstExpiry
                        ? lot.ExpiryDate
                        : worstExpiry;
                    worstDaysLeft = worstDaysLeft is null
                        ? daysLeft
                        : Math.Min(worstDaysLeft.Value, daysLeft);
                }
            }

            virtualDay += daysToDrain;
        }

        if (!anyDated || atRiskQty <= StockCardFifoEngine.QtyEpsilon || worstExpiry is null)
            return null;

        var daysUntil = worstDaysLeft ?? (worstExpiry.Value.DayNumber - today.DayNumber);
        var status = daysUntil <= 0 || atRiskQty >= dailyUsage * 3m ? "critical" : "low";
        var usageBasis = usageFromSales ? "avg product sales" : "configured daily usage";
        var expiryLabel = worstExpiry.Value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

        return new ComputedInventoryAlert(
            Id: id,
            ItemName: ingredient.Name,
            ComponentId: ingredient.ComponentId,
            Stock: FormatQty(
                lots.Sum(l => ToRecipeQty(l.RemainingQty, l.Uom, ingredient)),
                displayUom),
            Status: status,
            Threshold: expiryLabel,
            AlertType: "expiry",
            BasisLabel: "Based on expiry & average usage",
            Detail: daysUntil < 0
                ? $"Expired stock on hand ({expiryLabel}) · ~{FormatQty(atRiskQty, displayUom)} at risk from consolidated lots with expiry."
                : $"~{FormatQty(atRiskQty, displayUom)} may expire before use ({usageBasis}) · earliest expiry {expiryLabel} ({daysUntil}d left).",
            OnHandQty: lots.Sum(l => ToRecipeQty(l.RemainingQty, l.Uom, ingredient)),
            ParStock: 0,
            DailyUsage: dailyUsage,
            OrderFreqDays: 0,
            DeliveryCycleDays: 0,
            DaysOfCover: decimal.Round(
                lots.Sum(l => ToRecipeQty(l.RemainingQty, l.Uom, ingredient)) / dailyUsage,
                2,
                MidpointRounding.AwayFromZero),
            Uom: displayUom,
            ExpiryDate: expiryLabel,
            DaysUntilExpiry: daysUntil,
            AtRiskQty: decimal.Round(atRiskQty, 4, MidpointRounding.AwayFromZero));
    }

    static decimal ToRecipeQty(decimal qty, string lotUom, Ingredient ingredient)
    {
        if (qty <= 0) return 0;
        var lot = NormalizeUom(lotUom);
        var recipe = NormalizeUom(ingredient.RecipeUom);
        var inventory = NormalizeUom(ingredient.InventoryUom);

        if (string.IsNullOrEmpty(lot) || string.IsNullOrEmpty(recipe) || lot == recipe)
            return qty;

        if (lot == inventory && TryReadConversion(ingredient.DetailConfigJson, out var fromInv, out var toRecipe)
            && fromInv > 0)
        {
            return qty * (toRecipe / fromInv);
        }

        // Unknown UOM mapping — treat as already recipe-compatible rather than drop the lot.
        return qty;
    }

    static bool TryReadConversion(string? json, out decimal inventoryQty, out decimal recipeQty)
    {
        inventoryQty = recipeQty = 0;
        if (string.IsNullOrWhiteSpace(json) || json is "{}") return false;
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            inventoryQty = ReadDecimal(root, "convertFromInventoryQty", "ConvertFromInventoryQty");
            recipeQty = ReadDecimal(root, "convertToRecipeQty", "ConvertToRecipeQty");
            return inventoryQty > 0 && recipeQty > 0;
        }
        catch (JsonException)
        {
            return false;
        }
    }

    static decimal ReadDecimal(JsonElement root, params string[] names)
    {
        foreach (var name in names)
        {
            if (!root.TryGetProperty(name, out var prop)) continue;
            if (prop.ValueKind == JsonValueKind.Number && prop.TryGetDecimal(out var n)) return n;
            if (prop.ValueKind == JsonValueKind.String
                && decimal.TryParse(prop.GetString(), NumberStyles.Any, CultureInfo.InvariantCulture, out var s))
                return s;
        }
        return 0;
    }

    static string NormalizeUom(string? uom) => (uom ?? string.Empty).Trim().ToLowerInvariant();

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

    sealed record DatedLot(
        int PurchaseId,
        decimal RemainingQty,
        string Uom,
        DateTime ReceivedAt,
        DateOnly ExpiryDate);
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
    string Uom,
    string? ExpiryDate,
    int? DaysUntilExpiry,
    decimal? AtRiskQty);
