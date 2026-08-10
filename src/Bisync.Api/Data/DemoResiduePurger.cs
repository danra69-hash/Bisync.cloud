using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Bisync.Api.Data;

/// <summary>
/// Removes non-user demo/seed residue from the operational DB.
/// Never deletes customer-tenant catalog that was user-created (e.g. Weissbrau).
/// Platform feature code (UOM bridge, ownership, etc.) is untouched — data only.
/// </summary>
public static class DemoResiduePurger
{
    public static bool IsDemoSandboxCompanyName(string? name) =>
        !string.IsNullOrWhiteSpace(name)
        && (name.StartsWith("Bisync", StringComparison.OrdinalIgnoreCase)
            || name.StartsWith("QA ", StringComparison.OrdinalIgnoreCase));

    /// <summary>Hardcoded DataSeeder / FIFO demo component ids — never user-assigned under current ID rules.</summary>
    static readonly HashSet<string> LegacySeedComponentIds = new(StringComparer.OrdinalIgnoreCase)
    {
        "CMP-WAGYUB-001",
        "CMP-BLACKT-001",
        "CMP-BURRAT-001",
        "CMP-SCFIFO-001",
    };

    /// <summary>IngredientCatalogSeeder / DataSeeder names — only purged for Bisync/QA sandbox companies.</summary>
    static readonly HashSet<string> CatalogSeedNames = new(StringComparer.OrdinalIgnoreCase)
    {
        "Lamb Rack", "Duck Breast", "Pork Belly", "Chicken Thigh", "Tiger Prawns", "Bluefin Tuna",
        "Atlantic Cod", "Mozzarella Fior di Latte", "Parmesan Reggiano", "Unsalted Butter", "Heavy Cream",
        "Free Range Eggs", "Rocket Arugula", "Roma Tomatoes", "Yellow Onions", "Peeled Garlic",
        "Russet Potatoes", "Basmati Rice", "Penne Pasta", "00 Flour", "Olive Oil Extra Virgin",
        "Balsamic Vinegar", "Sea Salt Flakes", "Black Peppercorns", "Tomato Passata",
        "Fresh Orange Juice", "Craft IPA Beer", "House Red Wine", "Tonic Water", "Oat Milk Barista",
        "Wagyu Beef A5", "Black Truffle", "Burrata",
        "Baked Beans", "Yogurt Strawberry", "Spaghetti No. 5", "Chili Flakes", "Paprika",
    };

    public sealed record Result(IReadOnlyDictionary<string, int> Counts)
    {
        public int Total => Counts.Values.Sum();
    }

    public static async Task<Result> PurgeAsync(
        BisyncDbContext db,
        ILogger? logger = null,
        CancellationToken cancellationToken = default)
    {
        var counts = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        var sandboxCompanyIds = await db.Companies.AsNoTracking()
            .Where(c => c.Name.StartsWith("Bisync") || c.Name.StartsWith("QA "))
            .Select(c => c.Id)
            .ToListAsync(cancellationToken);
        var hasCustomerCompany = await db.Companies.AsNoTracking()
            .AnyAsync(c => !IsDemoSandboxCompanyName(c.Name), cancellationToken);

        List<string> componentIds;
        List<int> ingredientRowIds;

        if (!hasCustomerCompany)
        {
            // Repo / sandbox DB: every ingredient is seed residue.
            var all = await db.Ingredients.AsNoTracking()
                .Select(i => new { i.Id, i.ComponentId })
                .ToListAsync(cancellationToken);
            ingredientRowIds = all.Select(i => i.Id).ToList();
            componentIds = all.Select(i => i.ComponentId)
                .Where(id => !string.IsNullOrWhiteSpace(id))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
        }
        else
        {
            var demoQuery = db.Ingredients.AsNoTracking().Where(i =>
                i.Name.StartsWith("SC Demo ")
                || i.Name.StartsWith("SC FIFO ")
                || i.ComponentId.StartsWith("CMP-SCDEMO-")
                || i.ComponentId.StartsWith("CMP-SCFIFO-")
                || LegacySeedComponentIds.Contains(i.ComponentId));

            var demo = await demoQuery
                .Select(i => new { i.Id, i.ComponentId })
                .ToListAsync(cancellationToken);

            if (sandboxCompanyIds.Count > 0)
            {
                var catalog = await db.Ingredients.AsNoTracking()
                    .Where(i =>
                        i.CompanyId != null
                        && sandboxCompanyIds.Contains(i.CompanyId.Value)
                        && CatalogSeedNames.Contains(i.Name))
                    .Select(i => new { i.Id, i.ComponentId })
                    .ToListAsync(cancellationToken);
                demo = demo.Concat(catalog).GroupBy(x => x.Id).Select(g => g.First()).ToList();
            }

            ingredientRowIds = demo.Select(i => i.Id).ToList();
            componentIds = demo.Select(i => i.ComponentId)
                .Where(id => !string.IsNullOrWhiteSpace(id))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
        }

        if (componentIds.Count > 0)
        {
            counts["inventoryMovements"] = await db.InventoryMovements
                .Where(m => componentIds.Contains(m.ComponentId))
                .ExecuteDeleteAsync(cancellationToken);
            counts["inventoryPurchases"] = await db.InventoryPurchases
                .Where(p => componentIds.Contains(p.ComponentId))
                .ExecuteDeleteAsync(cancellationToken);
            counts["cashPurchases"] = await db.CashPurchases
                .Where(c => componentIds.Contains(c.ComponentId))
                .ExecuteDeleteAsync(cancellationToken);

            // Capture names before delete for alert cleanup.
            var wipedNames = await db.Ingredients.AsNoTracking()
                .Where(i => ingredientRowIds.Contains(i.Id))
                .Select(i => i.Name)
                .ToListAsync(cancellationToken);

            counts["ingredients"] = await db.Ingredients
                .Where(i => ingredientRowIds.Contains(i.Id))
                .ExecuteDeleteAsync(cancellationToken);

            try
            {
                counts["inventoryAlerts"] = wipedNames.Count == 0
                    ? 0
                    : await db.InventoryAlerts
                        .Where(a => wipedNames.Contains(a.ItemName))
                        .ExecuteDeleteAsync(cancellationToken);
            }
            catch
            {
                counts["inventoryAlerts"] = 0;
            }
        }
        else
        {
            counts["inventoryMovements"] = 0;
            counts["inventoryPurchases"] = 0;
            counts["inventoryAlerts"] = 0;
            counts["cashPurchases"] = 0;
            counts["ingredients"] = 0;
        }

        // Products
        List<int> demoProductIds;
        if (!hasCustomerCompany)
        {
            demoProductIds = await db.Products.AsNoTracking().Select(p => p.Id).ToListAsync(cancellationToken);
        }
        else
        {
            demoProductIds = await db.Products.AsNoTracking()
                .Where(p => p.Name.StartsWith("SC Demo ") || p.Name.StartsWith("SC FIFO "))
                .Select(p => p.Id)
                .ToListAsync(cancellationToken);
        }

        if (demoProductIds.Count > 0)
        {
            counts["productComponentItems"] = await db.ProductComponentItems
                .Where(x => demoProductIds.Contains(x.ProductId))
                .ExecuteDeleteAsync(cancellationToken);
            counts["productPackagingItems"] = await db.ProductPackagingItems
                .Where(x => demoProductIds.Contains(x.ProductId))
                .ExecuteDeleteAsync(cancellationToken);
            counts["productProductionLogs"] = await db.ProductProductionLogs
                .Where(x => demoProductIds.Contains(x.ProductId))
                .ExecuteDeleteAsync(cancellationToken);
            counts["productB2bLocationStocks"] = await db.ProductB2bLocationStocks
                .Where(x => demoProductIds.Contains(x.ProductId))
                .ExecuteDeleteAsync(cancellationToken);
            counts["products"] = await db.Products
                .Where(p => demoProductIds.Contains(p.Id))
                .ExecuteDeleteAsync(cancellationToken);
        }
        else
        {
            counts["productComponentItems"] = 0;
            counts["productPackagingItems"] = 0;
            counts["productProductionLogs"] = 0;
            counts["productB2bLocationStocks"] = 0;
            counts["products"] = 0;
        }

        // Purchase orders
        List<int> demoPoIds;
        if (!hasCustomerCompany)
        {
            demoPoIds = await db.PurchaseOrders.AsNoTracking().Select(o => o.Id).ToListAsync(cancellationToken);
        }
        else
        {
            demoPoIds = await db.PurchaseOrders.AsNoTracking()
                .Where(o =>
                    o.InitiatedBy == "Demo Seeder"
                    || o.PoNumber.StartsWith("PO-2026-FIFO-")
                    || o.PoNumber.StartsWith("PO-284"))
                .Select(o => o.Id)
                .ToListAsync(cancellationToken);
        }

        if (demoPoIds.Count > 0)
        {
            counts["purchaseOrderItems"] = await db.PurchaseOrderItems
                .Where(i => demoPoIds.Contains(i.PurchaseOrderId))
                .ExecuteDeleteAsync(cancellationToken);
            counts["purchaseOrders"] = await db.PurchaseOrders
                .Where(o => demoPoIds.Contains(o.Id))
                .ExecuteDeleteAsync(cancellationToken);
        }
        else
        {
            counts["purchaseOrderItems"] = 0;
            counts["purchaseOrders"] = 0;
        }

        counts["b2bSalesOrderLines"] = 0;
        try
        {
            var demoOrderIds = await db.B2bSalesOrders.AsNoTracking()
                .Where(o => o.OrderNumber.StartsWith("SO-DEMO-"))
                .Select(o => o.Id)
                .ToListAsync(cancellationToken);
            if (demoOrderIds.Count > 0)
            {
                counts["b2bSalesOrderLines"] = await db.B2bSalesOrderLines
                    .Where(l => demoOrderIds.Contains(l.SalesOrderId))
                    .ExecuteDeleteAsync(cancellationToken);
                counts["b2bSalesOrders"] = await db.B2bSalesOrders
                    .Where(o => demoOrderIds.Contains(o.Id))
                    .ExecuteDeleteAsync(cancellationToken);
            }
            else
            {
                counts["b2bSalesOrders"] = 0;
            }
        }
        catch
        {
            counts["b2bSalesOrders"] = 0;
        }

        try
        {
            var customerQ = db.B2bCustomers.Where(c =>
                c.ExternalId == "B2BC-001"
                || c.ExternalId == "B2BC-002"
                || c.CompanyName.StartsWith("Metro Foods")
                || c.CompanyName.StartsWith("Green Leaf"));
            if (hasCustomerCompany && sandboxCompanyIds.Count > 0)
                customerQ = customerQ.Where(c => sandboxCompanyIds.Contains(c.CompanyId));
            else if (hasCustomerCompany)
                customerQ = customerQ.Where(_ => false);
            counts["b2bCustomers"] = await customerQ.ExecuteDeleteAsync(cancellationToken);
        }
        catch
        {
            counts["b2bCustomers"] = 0;
        }

        if (!hasCustomerCompany)
        {
            counts["menuItems"] = await db.MenuItems.ExecuteDeleteAsync(cancellationToken);
            try
            {
                var lines = await db.InventoryCountSessionLines.ExecuteDeleteAsync(cancellationToken);
                var sessions = await db.InventoryCountSessions.ExecuteDeleteAsync(cancellationToken);
                counts["inventoryCounts"] = lines + sessions;
            }
            catch
            {
                counts["inventoryCounts"] = 0;
            }

            // Clear any leftover stock rows after ingredient wipe.
            counts["orphanPurchases"] = await db.InventoryPurchases.ExecuteDeleteAsync(cancellationToken);
            counts["orphanMovements"] = await db.InventoryMovements.ExecuteDeleteAsync(cancellationToken);

            // Sandbox-only: bundled vendor product seed + catalog vendors are not user-created.
            try
            {
                counts["vendorProductPrices"] = await db.VendorProductPrices.ExecuteDeleteAsync(cancellationToken);
            }
            catch
            {
                counts["vendorProductPrices"] = 0;
            }

            try
            {
                counts["vendorProducts"] = await db.VendorProducts.ExecuteDeleteAsync(cancellationToken);
            }
            catch
            {
                counts["vendorProducts"] = 0;
            }

            try
            {
                counts["vendors"] = await db.Vendors.ExecuteDeleteAsync(cancellationToken);
            }
            catch
            {
                counts["vendors"] = 0;
            }
        }
        else
        {
            counts["menuItems"] = await db.MenuItems
                .Where(m =>
                    m.Name == "Wagyu Burger"
                    || m.Name == "Truffle Pasta"
                    || m.Name == "Grilled Salmon"
                    || m.Name == "Merlot Reserve"
                    || m.Name == "Craft Beer")
                .ExecuteDeleteAsync(cancellationToken);
            counts["inventoryCounts"] = 0;
            if (sandboxCompanyIds.Count > 0)
            {
                try
                {
                    var sessionIds = await db.InventoryCountSessions.AsNoTracking()
                        .Where(s => s.CompanyId != null && sandboxCompanyIds.Contains(s.CompanyId.Value))
                        .Select(s => s.Id)
                        .ToListAsync(cancellationToken);
                    if (sessionIds.Count > 0)
                    {
                        var lines = await db.InventoryCountSessionLines
                            .Where(l => sessionIds.Contains(l.SessionId))
                            .ExecuteDeleteAsync(cancellationToken);
                        var sessions = await db.InventoryCountSessions
                            .Where(s => sessionIds.Contains(s.Id))
                            .ExecuteDeleteAsync(cancellationToken);
                        counts["inventoryCounts"] = lines + sessions;
                    }
                }
                catch
                {
                    counts["inventoryCounts"] = 0;
                }
            }
        }

        var result = new Result(counts);
        if (result.Total > 0)
        {
            logger?.LogInformation(
                "Purged {Total} demo/seed residue row(s): {Summary}",
                result.Total,
                string.Join(", ", counts.Where(kv => kv.Value > 0).Select(kv => $"{kv.Key}={kv.Value}")));
        }

        return result;
    }
}
