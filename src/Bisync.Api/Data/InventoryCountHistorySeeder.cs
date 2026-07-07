using System.Text.Json;
using Bisync.Api.Models;
using Bisync.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Data;

/// <summary>
/// Seeds spot and full inventory history for the Downtown location (demo data).
/// </summary>
public static class InventoryCountHistorySeeder
{
    private const int CompanyId = 1;
    private const string LocationId = "downtown";

    public static async Task EnsureAsync(BisyncDbContext db)
    {
        var hasDowntownHistory = await db.InventoryCountSessions
            .AnyAsync(s => s.CompanyId == CompanyId && s.LocationIdsJson.Contains($"\"{LocationId}\""));

        if (hasDowntownHistory)
            return;

        var wagyu = await db.Ingredients.FirstOrDefaultAsync(i => i.ComponentId == "CMP-WAGYUB-001")
            ?? await db.Ingredients.FirstOrDefaultAsync(i => i.Name == "Wagyu Beef A5");
        var burrata = await db.Ingredients.FirstOrDefaultAsync(i => i.ComponentId == "CMP-BURRAT-001")
            ?? await db.Ingredients.FirstOrDefaultAsync(i => i.Name == "Burrata");
        var orange = await db.Ingredients.FirstOrDefaultAsync(i => i.Name == "Fresh Orange Juice")
            ?? await db.Ingredients.FirstOrDefaultAsync(i => i.Category == "Beverage");

        if (wagyu is null || burrata is null)
            return;

        var locationJson = JsonSerializer.Serialize(new[] { LocationId });
        var now = DateTime.UtcNow;

        var spotJune = CreateSession(
            InventoryCountWorkflow.TypeSpot,
            InventoryCountWorkflow.StatusSaved,
            "2026-06",
            now.AddDays(-12),
            "Sarah Chen",
            locationJson,
            countDate: "2026-06-18",
            [
                Line("component", wagyu.ComponentId, wagyu.Name, wagyu.Group, wagyu.InventoryUom, 12.4m, 12.1m, wagyu.LastPriceInventory),
                Line("component", burrata.ComponentId, burrata.Name, burrata.Group, burrata.InventoryUom, 26m, 24m, burrata.LastPriceInventory),
            ]);

        if (orange is not null)
        {
            spotJune.Lines.Add(Line(
                "component", orange.ComponentId, orange.Name, orange.Group, orange.InventoryUom, 18.5m, 18.5m, orange.LastPriceInventory));
        }

        var spotMay = CreateSession(
            InventoryCountWorkflow.TypeSpot,
            InventoryCountWorkflow.StatusSaved,
            "2026-05",
            now.AddDays(-42),
            "James Dubois",
            locationJson,
            countDate: "2026-05-22",
            [
                Line("component", wagyu.ComponentId, wagyu.Name, wagyu.Group, wagyu.InventoryUom, 11.8m, 11.5m, wagyu.LastPriceInventory),
                Line("component", burrata.ComponentId, burrata.Name, burrata.Group, burrata.InventoryUom, 22m, 20m, burrata.LastPriceInventory),
            ]);

        var fullJune = CreateSession(
            InventoryCountWorkflow.TypeFull,
            InventoryCountWorkflow.StatusPendingConfirmation,
            "2026-06",
            now.AddDays(-2),
            "Melissa Tan",
            locationJson,
            countDate: "2026-06-30",
            [
                Line("component", wagyu.ComponentId, wagyu.Name, wagyu.Group, wagyu.InventoryUom, 12.4m, 11.9m, wagyu.LastPriceInventory),
                Line("component", burrata.ComponentId, burrata.Name, burrata.Group, burrata.InventoryUom, 26m, 25m, burrata.LastPriceInventory),
            ]);
        fullJune.ConfirmDeadlineAt = now.AddHours(48);

        if (orange is not null)
        {
            fullJune.Lines.Add(Line(
                "component", orange.ComponentId, orange.Name, orange.Group, orange.InventoryUom, 18.5m, 17.2m, orange.LastPriceInventory));
        }

        var truffle = await db.Ingredients.FirstOrDefaultAsync(i => i.ComponentId == "CMP-BLACKT-001")
            ?? await db.Ingredients.FirstOrDefaultAsync(i => i.Name == "Black Truffle");
        if (truffle is not null)
        {
            fullJune.Lines.Add(Line(
                "component", truffle.ComponentId, truffle.Name, truffle.Group, truffle.InventoryUom, 0.45m, 0.42m, truffle.LastPriceInventory));
        }

        var fullMay = CreateSession(
            InventoryCountWorkflow.TypeFull,
            InventoryCountWorkflow.StatusConfirmed,
            "2026-05",
            now.AddDays(-35),
            "Sarah Chen",
            locationJson,
            countDate: "2026-05-31",
            [
                Line("component", wagyu.ComponentId, wagyu.Name, wagyu.Group, wagyu.InventoryUom, 11.2m, 11.0m, wagyu.LastPriceInventory),
                Line("component", burrata.ComponentId, burrata.Name, burrata.Group, burrata.InventoryUom, 20m, 19m, burrata.LastPriceInventory),
            ]);
        fullMay.ConfirmedAt = now.AddDays(-33);
        fullMay.ConfirmedBy = "Sarah Chen";
        fullMay.EffectiveDate = "2026-06-03";
        fullMay.AdjustmentsAppliedAt = fullMay.ConfirmedAt;

        if (orange is not null)
        {
            fullMay.Lines.Add(Line(
                "component", orange.ComponentId, orange.Name, orange.Group, orange.InventoryUom, 16m, 15.5m, orange.LastPriceInventory));
        }

        db.InventoryCountSessions.AddRange(spotJune, spotMay, fullJune, fullMay);
        await db.SaveChangesAsync();
    }

    static InventoryCountSession CreateSession(
        string sessionType,
        string status,
        string periodMonth,
        DateTime savedAt,
        string savedBy,
        string locationIdsJson,
        string countDate,
        IEnumerable<InventoryCountSessionLine> lines)
    {
        var session = new InventoryCountSession
        {
            SessionType = sessionType,
            Status = status,
            CompanyId = CompanyId,
            LocationIdsJson = locationIdsJson,
            PeriodMonth = periodMonth,
            UomMode = "inventory",
            ItemTypeFilter = "component",
            GroupFilter = "All",
            CountDate = countDate,
            SavedAt = savedAt,
            SavedBy = savedBy,
            CreatedAt = savedAt,
            UpdatedAt = savedAt,
        };

        foreach (var line in lines)
            session.Lines.Add(line);

        return session;
    }

    static InventoryCountSessionLine Line(
        string itemType,
        string itemKey,
        string itemName,
        string groupName,
        string uom,
        decimal systemQty,
        decimal countedQty,
        decimal unitPrice)
    {
        var variance = countedQty - systemQty;
        return new InventoryCountSessionLine
        {
            ItemType = itemType,
            ItemKey = itemKey,
            ItemName = itemName,
            GroupName = groupName,
            Uom = uom,
            SystemQty = systemQty,
            CountedQty = countedQty,
            VarianceQty = variance,
            SystemUnitPrice = unitPrice,
        };
    }
}
