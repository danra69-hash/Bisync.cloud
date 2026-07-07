using System.Text.Json;
using Bisync.Api.Models;
using Bisync.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Data;

public static class DataSeeder
{
    public static async Task SeedAsync(BisyncDbContext db)
    {
        if (await db.Locations.AnyAsync()) return;

        db.Locations.AddRange(
            new Location { ExternalId = "downtown", Name = "Downtown", Address = "12 King St", SalesToday = 4210, SalesWtd = 22800, SalesMtd = 82400, SalesYtd = 448500, SalesPrevToday = 3890, SalesPrevWtd = 20500, SalesPrevMtd = 84100, SalesPrevYtd = 382000, CoversToday = 112, CoversWtd = 598, CoversMtd = 2540, CoversYtd = 26900, CoversPrevToday = 105, CoversPrevWtd = 551, CoversPrevMtd = 2610, CoversPrevYtd = 23800, ChecksToday = 51, ChecksWtd = 274, ChecksMtd = 1160, ChecksYtd = 12230, ChecksPrevToday = 48, ChecksPrevWtd = 252, ChecksPrevMtd = 1190, ChecksPrevYtd = 10800 },
            new Location { ExternalId = "midtown", Name = "Midtown", Address = "88 Park Ave", SalesToday = 2980, SalesWtd = 16100, SalesMtd = 58200, SalesYtd = 318400, SalesPrevToday = 2750, SalesPrevWtd = 14900, SalesPrevMtd = 55900, SalesPrevYtd = 274000, CoversToday = 80, CoversWtd = 428, CoversMtd = 1820, CoversYtd = 19200, CoversPrevToday = 74, CoversPrevWtd = 396, CoversPrevMtd = 1870, CoversPrevYtd = 17100, ChecksToday = 36, ChecksWtd = 196, ChecksMtd = 832, ChecksYtd = 8730, ChecksPrevToday = 34, ChecksPrevWtd = 181, ChecksPrevMtd = 855, ChecksPrevYtd = 7780 },
            new Location { ExternalId = "airport", Name = "Airport Terminal", Address = "T2 Departures", SalesToday = 1380, SalesWtd = 7440, SalesMtd = 26800, SalesYtd = 147200, SalesPrevToday = 1510, SalesPrevWtd = 8100, SalesPrevMtd = 29400, SalesPrevYtd = 128600, CoversToday = 38, CoversWtd = 205, CoversMtd = 874, CoversYtd = 9240, CoversPrevToday = 42, CoversPrevWtd = 224, CoversPrevMtd = 960, CoversPrevYtd = 8100, ChecksToday = 27, ChecksWtd = 146, ChecksMtd = 624, ChecksYtd = 6590, ChecksPrevToday = 30, ChecksPrevWtd = 160, ChecksPrevMtd = 686, ChecksPrevYtd = 5780 },
            new Location { ExternalId = "westend", Name = "West End", Address = "5 Harbour Walk", SalesToday = 1080, SalesWtd = 5710, SalesMtd = 19940, SalesYtd = 110680, SalesPrevToday = 990, SalesPrevWtd = 5250, SalesPrevMtd = 18600, SalesPrevYtd = 94800, CoversToday = 26, CoversWtd = 132, CoversMtd = 587, CoversYtd = 6100, CoversPrevToday = 24, CoversPrevWtd = 122, CoversPrevMtd = 570, CoversPrevYtd = 5420, ChecksToday = 12, ChecksWtd = 61, ChecksMtd = 270, ChecksYtd = 2810, ChecksPrevToday = 11, ChecksPrevWtd = 56, ChecksPrevMtd = 262, ChecksPrevYtd = 2490 }
        );

        db.MenuItems.AddRange(
            new MenuItem { Name = "Wagyu Burger", Category = "food", Orders = 312, Revenue = 9360, MarginPercent = 68 },
            new MenuItem { Name = "Truffle Pasta", Category = "food", Orders = 287, Revenue = 10332, MarginPercent = 74 },
            new MenuItem { Name = "Grilled Salmon", Category = "food", Orders = 251, Revenue = 11295, MarginPercent = 71 },
            new MenuItem { Name = "Merlot Reserve", Category = "beverage", Orders = 198, Revenue = 4752, MarginPercent = 76 },
            new MenuItem { Name = "Craft Beer", Category = "beverage", Orders = 174, Revenue = 2088, MarginPercent = 71 }
        );

        db.Ingredients.AddRange(
            new Ingredient { ComponentId = "CMP-WAGYUB-001", Name = "Wagyu Beef A5", Category = "Food", Group = "Proteins", RecipeUom = "g", InventoryUom = "kg", LastPriceRecipe = 0.38m, LastPriceInventory = 380m, DailyUsage = 2.4m, OrderFreqDays = 3, StorageJson = JsonSerializer.Serialize(new[] { "Freezer" }), AttachedProducts = 3, AttachedVendors = 2, Active = true, LocationsJson = JsonSerializer.Serialize(new[] { "downtown", "midtown" }) },
            new Ingredient { ComponentId = "CMP-BLACKT-001", Name = "Black Truffle", Category = "Food", Group = "Produce", RecipeUom = "g", InventoryUom = "g", LastPriceRecipe = 1.80m, LastPriceInventory = 1.80m, DailyUsage = 45m, OrderFreqDays = 7, StorageJson = JsonSerializer.Serialize(new[] { "Chiller" }), AttachedProducts = 2, AttachedVendors = 1, Active = true, LocationsJson = JsonSerializer.Serialize(new[] { "downtown" }) },
            new Ingredient { ComponentId = "CMP-BURRAT-001", Name = "Burrata", Category = "Food", Group = "Dairy", RecipeUom = "pcs", InventoryUom = "pcs", LastPriceRecipe = 8.75m, LastPriceInventory = 8.75m, DailyUsage = 8m, OrderFreqDays = 2, StorageJson = JsonSerializer.Serialize(new[] { "Chiller" }), AttachedProducts = 4, AttachedVendors = 1, Active = true, LocationsJson = JsonSerializer.Serialize(new[] { "all" }) }
        );

        var po1 = new PurchaseOrder { PoNumber = "PO-2841", VendorName = "Premium Meats Co.", OrderDate = new DateOnly(2025, 6, 18), DeliveryDate = new DateOnly(2025, 6, 21), Status = "In Transit" };
        po1.Items.Add(new PurchaseOrderItem { Name = "Wagyu Beef (A5)", Quantity = 5, UnitPrice = 380, Unit = "kg", DeliveryPackage = "Vacuum-sealed 1kg portions" });
        po1.Items.Add(new PurchaseOrderItem { Name = "Ribeye (Prime)", Quantity = 8, UnitPrice = 145, Unit = "kg", DeliveryPackage = "Whole primal cut" });
        db.PurchaseOrders.Add(po1);

        var po2 = new PurchaseOrder { PoNumber = "PO-2842", VendorName = "Fine Truffle Imports", OrderDate = new DateOnly(2025, 6, 19), DeliveryDate = new DateOnly(2025, 6, 22), Status = "Confirmed" };
        po2.Items.Add(new PurchaseOrderItem { Name = "Black Truffle", Quantity = 500, UnitPrice = 1.80m, Unit = "g", DeliveryPackage = "Individual 50g jars" });
        db.PurchaseOrders.Add(po2);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var po3 = new PurchaseOrder
        {
            PoNumber = "PO-2843",
            VendorName = "Fresh Produce Ltd.",
            OrderDate = today,
            DeliveryDate = today.AddDays(3),
            DocumentType = PurchaseOrderWorkflow.DocumentTypePr,
            Status = PurchaseOrderWorkflow.StatusPendingApproval,
            InitiatedBy = "Kitchen Manager",
        };
        po3.Items.Add(new PurchaseOrderItem { VendorProductId = "VP-BUR001", ComponentId = "CMP-BURRAT-001", ComponentName = "Burrata", Name = "Burrata", Quantity = 24, UnitPrice = 8.75m, IssuedUnitPrice = 8.75m, Unit = "6pcs tray", ComponentUom = "pcs", DeliveryPackage = "6pcs tray" });
        db.PurchaseOrders.Add(po3);

        var po4 = new PurchaseOrder
        {
            PoNumber = "PO-2844",
            VendorName = "Dairy Direct",
            OrderDate = today,
            DeliveryDate = today.AddDays(2),
            DocumentType = PurchaseOrderWorkflow.DocumentTypePo,
            Status = PurchaseOrderWorkflow.StatusOpen,
            InitiatedBy = "Procurement",
            ApprovedBy = "Operations Manager",
            ApprovedAt = DateTime.UtcNow,
        };
        po4.Items.Add(new PurchaseOrderItem { VendorProductId = "VP-BUR001", ComponentId = "CMP-BURRAT-001", ComponentName = "Burrata", Name = "Burrata", Quantity = 24, UnitPrice = 8.75m, IssuedUnitPrice = 8.75m, Unit = "6pcs tray", ComponentUom = "pcs", DeliveryPackage = "6pcs tray" });
        db.PurchaseOrders.Add(po4);

        db.InventoryAlerts.AddRange(
            new InventoryAlert { ItemName = "Wagyu Beef (A5)", Stock = "1.2 kg", Status = "critical", Threshold = "2 kg" },
            new InventoryAlert { ItemName = "Black Truffle", Stock = "180 g", Status = "low", Threshold = "250 g" },
            new InventoryAlert { ItemName = "Merlot Reserve 2019", Stock = "4 btl", Status = "critical", Threshold = "6 btl" }
        );

        db.RevenueDataPoints.AddRange(
            new RevenueDataPoint { Period = "week", Label = "Mon", CurrentValue = 4820, PriorValue = 4200, Covers = 124 },
            new RevenueDataPoint { Period = "week", Label = "Tue", CurrentValue = 5340, PriorValue = 4900, Covers = 138 },
            new RevenueDataPoint { Period = "week", Label = "Wed", CurrentValue = 6100, PriorValue = 5200, Covers = 162 },
            new RevenueDataPoint { Period = "week", Label = "Thu", CurrentValue = 5780, PriorValue = 5600, Covers = 151 },
            new RevenueDataPoint { Period = "week", Label = "Fri", CurrentValue = 8920, PriorValue = 7800, Covers = 234 },
            new RevenueDataPoint { Period = "week", Label = "Sat", CurrentValue = 11240, PriorValue = 10100, Covers = 298 },
            new RevenueDataPoint { Period = "week", Label = "Sun", CurrentValue = 9650, PriorValue = 8900, Covers = 256 }
        );

        db.DevelopmentMilestones.AddRange(
            new DevelopmentMilestone { Phase = "Foundation", Title = "Figma design import", Status = "completed", ProgressPercent = 100, Notes = "Imported from Figma Make Bisync.cloud design" },
            new DevelopmentMilestone { Phase = "Foundation", Title = "C# API + PostgreSQL database", Status = "completed", ProgressPercent = 100, Notes = "ASP.NET Core Web API with EF Core + Npgsql" },
            new DevelopmentMilestone { Phase = "Foundation", Title = "Local development environment", Status = "in_progress", ProgressPercent = 80, Notes = "localhost API + React client" },
            new DevelopmentMilestone { Phase = "Core", Title = "Dashboard API integration", Status = "in_progress", ProgressPercent = 40, Notes = "Locations, revenue, menu endpoints" },
            new DevelopmentMilestone { Phase = "Core", Title = "Revenue Management module", Status = "pending", ProgressPercent = 10, Notes = "Ingredients, vendors, purchase orders" },
            new DevelopmentMilestone { Phase = "Core", Title = "Point-of-Sales module", Status = "pending", ProgressPercent = 0 },
            new DevelopmentMilestone { Phase = "Platform", Title = "Authentication & multi-tenant", Status = "pending", ProgressPercent = 0 },
            new DevelopmentMilestone { Phase = "Platform", Title = "Production deployment", Status = "pending", ProgressPercent = 0 }
        );

        await db.SaveChangesAsync();
    }
}
