using System.Text.Json;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Bisync.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Data;

/// <summary>
/// Seeds a showcase smart component with multi-price FIFO purchases and varied depletion types.
/// </summary>
public static class StockCardFifoDemoSeeder
{
    public const string ComponentName = "SC FIFO Demo Wagyu";
    public const string LegacyComponentId = "CMP-SCFIFO-001";

    public static async Task<object> EnsureAsync(BisyncDbContext db, int companyId = 1, bool force = false)
    {
        var existing = await db.Ingredients
            .FirstOrDefaultAsync(i =>
                i.ComponentId == LegacyComponentId
                || i.Name == ComponentName
                || (i.CompanyId == companyId && i.Name.ToLower() == ComponentName.ToLower()));

        if (existing is not null && force)
        {
            var purchases = await db.InventoryPurchases.Where(p => p.ComponentId == existing.ComponentId).ToListAsync();
            db.InventoryPurchases.RemoveRange(purchases);
            var movements = await db.InventoryMovements.Where(m => m.ComponentId == existing.ComponentId).ToListAsync();
            db.InventoryMovements.RemoveRange(movements);
            await db.SaveChangesAsync();
        }

        if (existing is not null && !force)
        {
            var purchaseCount = await db.InventoryPurchases.CountAsync(p => p.ComponentId == existing.ComponentId);
            var movementCount = await db.InventoryMovements.CountAsync(m => m.ComponentId == existing.ComponentId);
            if (purchaseCount >= 3 && movementCount >= 6)
            {
                await EnsureJulyFifoTestCasesAsync(db, existing, companyId);
                var integrityPack = await EnsureIntegrityChickenBreastAsync(db, companyId);
                await db.SaveChangesAsync();
                return new
                {
                    skipped = true,
                    message = "FIFO demo already seeded (integrity pack refreshed).",
                    componentId = existing.ComponentId,
                    integrityDemo = integrityPack,
                };
            }
        }

        var now = DateTime.UtcNow;
        var locationsJson = JsonSerializer.Serialize(new[] { "downtown", "midtown", "airport", "westend" });
        var code = await CompanyCodeService.ResolveCodeAsync(db, companyId);
        var ingredient = existing ?? new Ingredient
        {
            CompanyId = companyId,
            ComponentId = await ComponentIdGenerator.GenerateAsync(db, code, companyId),
            Name = ComponentName,
            Category = "Food",
            Group = "Proteins",
            RecipeUom = "g",
            LastPriceRecipe = 0.042m,
            DailyUsage = 2.5m,
            OrderFreqDays = 3,
            StorageJson = JsonSerializer.Serialize(new[] { "Chiller" }),
            DetailConfigJson = """{"altRecipeUnits":[{"fromQty":"1","qty":"1000","unit":"kg"}]}""",
            Active = true,
            LocationsJson = locationsJson,
        };

        if (existing is null)
        {
            db.Ingredients.Add(ingredient);
            await db.SaveChangesAsync();
        }
        else
        {
            existing.CompanyId ??= companyId;
        }

        var poNumbers = new[] { "PO-2026-FIFO-001", "PO-2026-FIFO-014", "PO-2026-FIFO-028" };
        var poPrices = new[] { 38.50m, 42.00m, 45.75m };
        var poQtys = new[] { 50m, 40m, 30m };
        var poDaysAgo = new[] { 25, 18, 8 };

        for (var i = 0; i < poNumbers.Length; i++)
        {
            var poNumber = poNumbers[i];
            var po = await db.PurchaseOrders.FirstOrDefaultAsync(p => p.PoNumber == poNumber);
            if (po is null)
            {
                po = new PurchaseOrder
                {
                    PoNumber = poNumber,
                    VendorName = "Premium Meats Co.",
                    OrderDate = DateOnly.FromDateTime(now.AddDays(-poDaysAgo[i] - 2)),
                    DeliveryDate = DateOnly.FromDateTime(now.AddDays(-poDaysAgo[i])),
                    DocumentType = "PO",
                    Status = "Reconciled",
                    CompanyId = companyId,
                    LocationIdsJson = JsonSerializer.Serialize(new[] { "downtown" }),
                    InitiatedBy = "Demo Seeder",
                    ApprovedBy = "Demo Seeder",
                    ApprovedAt = now.AddDays(-poDaysAgo[i] - 1),
                    ReceivedAt = now.AddDays(-poDaysAgo[i]),
                    ReconciledAt = now.AddDays(-poDaysAgo[i]),
                };
                db.PurchaseOrders.Add(po);
                await db.SaveChangesAsync();
            }

            var hasPurchase = await db.InventoryPurchases.AnyAsync(p =>
                p.ComponentId == ingredient.ComponentId && p.PurchaseOrderId == po.Id);
            if (!hasPurchase)
            {
                db.InventoryPurchases.Add(new InventoryPurchase
                {
                    ComponentId = ingredient.ComponentId,
                    ComponentName = ingredient.Name,
                    Quantity = poQtys[i] * 1000m,
                    Uom = "g",
                    UnitPrice = poPrices[i] / 1000m,
                    DateOrdered = po.OrderDate,
                    DateCreatedInStock = now.AddDays(-poDaysAgo[i]).AddHours(9 + i),
                    PurchaseOrderId = po.Id,
                    CompanyId = companyId,
                    LocationIdsJson = JsonSerializer.Serialize(new[] { "downtown" }),
                });
            }
        }

        await db.SaveChangesAsync();

        async Task AddMovementIfMissing(string key, InventoryMovement movement)
        {
            var exists = await db.InventoryMovements.AnyAsync(m =>
                m.ComponentId == movement.ComponentId
                && m.ReferenceType == movement.ReferenceType
                && m.ReferenceId == movement.ReferenceId);
            if (!exists)
                db.InventoryMovements.Add(movement);
        }

        var refId = 9001;
        await AddMovementIfMissing("transfer_in", new InventoryMovement
        {
            ComponentId = ingredient.ComponentId,
            ComponentName = ingredient.Name,
            LocationExternalId = "downtown",
            QtyDelta = 10_000,
            Uom = "g",
            UnitPrice = 0.041m,
            Reason = "Transfer in from Midtown",
            ReferenceType = "transfer_in",
            ReferenceId = refId++,
            CompanyId = companyId,
            CreatedAt = now.AddDays(-22).AddHours(11),
        });

        await AddMovementIfMissing("production", new InventoryMovement
        {
            ComponentId = ingredient.ComponentId,
            ComponentName = ingredient.Name,
            LocationExternalId = "downtown",
            QtyDelta = -35_000,
            Uom = "g",
            Reason = "Production — Sub-product batch",
            ReferenceType = "production",
            ReferenceId = refId++,
            CompanyId = companyId,
            CreatedAt = now.AddDays(-20).AddHours(14),
        });

        await AddMovementIfMissing("pos_sale", new InventoryMovement
        {
            ComponentId = ingredient.ComponentId,
            ComponentName = ingredient.Name,
            LocationExternalId = "downtown",
            QtyDelta = -18_000,
            Uom = "g",
            Reason = "POS sales depletion",
            ReferenceType = "pos_sale",
            ReferenceId = refId++,
            CompanyId = companyId,
            CreatedAt = now.AddDays(-14).AddHours(20),
        });

        await AddMovementIfMissing("wastage", new InventoryMovement
        {
            ComponentId = ingredient.ComponentId,
            ComponentName = ingredient.Name,
            LocationExternalId = "downtown",
            QtyDelta = -5_000,
            Uom = "g",
            Reason = "Wastage — spoilage",
            ReferenceType = "wastage",
            ReferenceId = refId++,
            CompanyId = companyId,
            CreatedAt = now.AddDays(-5).AddHours(10),
        });

        await AddMovementIfMissing("transfer_out", new InventoryMovement
        {
            ComponentId = ingredient.ComponentId,
            ComponentName = ingredient.Name,
            LocationExternalId = "downtown",
            QtyDelta = -8_000,
            Uom = "g",
            Reason = "Transfer out to Airport",
            ReferenceType = "transfer_out",
            ReferenceId = refId++,
            CompanyId = companyId,
            CreatedAt = now.AddDays(-4).AddHours(9),
        });

        await AddMovementIfMissing("adjustment_out", new InventoryMovement
        {
            ComponentId = ingredient.ComponentId,
            ComponentName = ingredient.Name,
            LocationExternalId = "downtown",
            QtyDelta = -3_000,
            Uom = "g",
            Reason = "Inventory adjustment — count short",
            ReferenceType = "inventory_adjustment",
            ReferenceId = refId++,
            CompanyId = companyId,
            CreatedAt = now.AddDays(-3).AddHours(16),
        });

        await AddMovementIfMissing("adjustment_in", new InventoryMovement
        {
            ComponentId = ingredient.ComponentId,
            ComponentName = ingredient.Name,
            LocationExternalId = "downtown",
            QtyDelta = 2_000,
            Uom = "g",
            Reason = "Inventory adjustment — count found",
            ReferenceType = "inventory_adjustment",
            ReferenceId = refId++,
            CompanyId = companyId,
            CreatedAt = now.AddDays(-2).AddHours(11),
        });

        await AddMovementIfMissing("pos_sale_2", new InventoryMovement
        {
            ComponentId = ingredient.ComponentId,
            ComponentName = ingredient.Name,
            LocationExternalId = "downtown",
            QtyDelta = -12_000,
            Uom = "g",
            Reason = "POS sales depletion",
            ReferenceType = "pos_sale",
            ReferenceId = refId++,
            CompanyId = companyId,
            CreatedAt = now.AddDays(-1).AddHours(19),
        });

        await EnsureJulyFifoTestCasesAsync(db, ingredient, companyId);
        var integrity = await EnsureIntegrityChickenBreastAsync(db, companyId);

        await db.SaveChangesAsync();

        return new
        {
            skipped = false,
            message = "FIFO demo seeded. Search 'SC FIFO Demo Wagyu' or 'SC FIFO Integrity Chicken Breast' in Stock Card (recipe UOM / July 2026).",
            componentId = ingredient.ComponentId,
            purchaseOrders = poNumbers,
            integrityDemo = integrity,
        };
    }

    /// <summary>
    /// Integrity showcase: sales before stock → negative / zero COGS → late consolidation inbound
    /// backfills earliest lines (your chicken-breast worked example).
    /// </summary>
    public static async Task<object> EnsureIntegrityChickenBreastAsync(
        BisyncDbContext db,
        int companyId = 1,
        bool force = false)
    {
        const string componentName = "SC FIFO Integrity Chicken Breast";
        const string locationId = "downtown";

        var existing = await db.Ingredients
            .FirstOrDefaultAsync(i =>
                i.CompanyId == companyId && i.Name.ToLower() == componentName.ToLower());

        if (existing is not null && force)
        {
            db.InventoryPurchases.RemoveRange(
                await db.InventoryPurchases.Where(p => p.ComponentId == existing.ComponentId).ToListAsync());
            db.InventoryMovements.RemoveRange(
                await db.InventoryMovements.Where(m => m.ComponentId == existing.ComponentId).ToListAsync());
            await db.SaveChangesAsync();
        }

        if (existing is not null && !force)
        {
            var movementCount = await db.InventoryMovements.CountAsync(m => m.ComponentId == existing.ComponentId);
            if (movementCount >= 7)
            {
                return new
                {
                    skipped = true,
                    message = "Integrity chicken-breast demo already seeded.",
                    componentId = existing.ComponentId,
                    componentName,
                    howToCheck = HowToCheck(existing.ComponentId),
                };
            }
        }

        var code = await CompanyCodeService.ResolveCodeAsync(db, companyId);
        var ingredient = existing ?? new Ingredient
        {
            CompanyId = companyId,
            ComponentId = await ComponentIdGenerator.GenerateAsync(db, code, companyId),
            Name = componentName,
            Category = "Food",
            Group = "Proteins",
            RecipeUom = "g",
            LastPriceRecipe = 0.03m,
            DailyUsage = 500m,
            OrderFreqDays = 2,
            StorageJson = JsonSerializer.Serialize(new[] { "Chiller" }),
            DetailConfigJson = """{"altRecipeUnits":[{"fromQty":"1","qty":"1000","unit":"kg"}]}""",
            Active = true,
            LocationsJson = JsonSerializer.Serialize(new[] { locationId, "midtown", "airport", "westend" }),
        };

        if (existing is null)
        {
            db.Ingredients.Add(ingredient);
            await db.SaveChangesAsync();
        }
        else
        {
            existing.CompanyId ??= companyId;
            existing.RecipeUom = "g";
            existing.LastPriceRecipe = 0.03m;
            existing.DetailConfigJson = """{"altRecipeUnits":[{"fromQty":"1","qty":"1000","unit":"kg"}]}""";
            existing.Active = true;
        }

        // Reference IDs 9201+ reserved for this integrity pack (idempotent).
        async Task AddMovementIfMissing(int referenceId, InventoryMovement movement)
        {
            var exists = await db.InventoryMovements.AnyAsync(m =>
                m.ComponentId == movement.ComponentId
                && m.ReferenceType == movement.ReferenceType
                && m.ReferenceId == referenceId);
            if (!exists)
            {
                movement.ReferenceId = referenceId;
                db.InventoryMovements.Add(movement);
            }
        }

        // Pre-consolidation POS sales (Jul 1–3) in the principal recipe UOM.
        var saleQtys = new[] { 200m, 200m, 400m, 600m, 200m, 400m };
        var saleAts = new[]
        {
            new DateTime(2026, 7, 1, 11, 0, 0, DateTimeKind.Utc),
            new DateTime(2026, 7, 1, 18, 30, 0, DateTimeKind.Utc),
            new DateTime(2026, 7, 2, 12, 15, 0, DateTimeKind.Utc),
            new DateTime(2026, 7, 2, 19, 0, 0, DateTimeKind.Utc),
            new DateTime(2026, 7, 3, 10, 45, 0, DateTimeKind.Utc),
            new DateTime(2026, 7, 3, 20, 0, 0, DateTimeKind.Utc),
        };

        for (var i = 0; i < saleQtys.Length; i++)
        {
            await AddMovementIfMissing(9201 + i, new InventoryMovement
            {
                ComponentId = ingredient.ComponentId,
                ComponentName = ingredient.Name,
                LocationExternalId = locationId,
                QtyDelta = -saleQtys[i],
                Uom = "g",
                UnitPrice = 0,
                Reason = $"Integrity demo — POS sale {saleQtys[i]:0.###} g (pre-consolidation)",
                ReferenceType = "pos_sale",
                CompanyId = companyId,
                CreatedAt = saleAts[i],
            });
        }

        // Jul 4 consolidation inbound: 1000 g @ RM 0.03/g.
        await AddMovementIfMissing(9210, new InventoryMovement
        {
            ComponentId = ingredient.ComponentId,
            ComponentName = ingredient.Name,
            LocationExternalId = locationId,
            QtyDelta = 1000m,
            Uom = "g",
            UnitPrice = 0.03m,
            Reason = "Integrity demo — physical inventory C/F 1000 g @ RM 0.03/g",
            ReferenceType = "inventory_adjustment",
            CompanyId = companyId,
            CreatedAt = new DateTime(2026, 7, 4, 16, 0, 0, DateTimeKind.Utc),
        });

        // Jul 6 second inbound at a different price — covers remaining short and shows split COGS.
        await AddMovementIfMissing(9211, new InventoryMovement
        {
            ComponentId = ingredient.ComponentId,
            ComponentName = ingredient.Name,
            LocationExternalId = locationId,
            QtyDelta = 800m,
            Uom = "g",
            UnitPrice = 0.04m,
            Reason = "Integrity demo — top-up inbound 800 g @ RM 0.04/g",
            ReferenceType = "inventory_adjustment",
            CompanyId = companyId,
            CreatedAt = new DateTime(2026, 7, 6, 9, 30, 0, DateTimeKind.Utc),
        });

        await db.SaveChangesAsync();

        return new
        {
            skipped = false,
            message = "Integrity chicken-breast demo seeded (principal recipe UOM / g).",
            componentId = ingredient.ComponentId,
            componentName,
            location = locationId,
            period = "2026-07",
            uomMode = "recipe",
            expected = new
            {
                preConsolidationSalesG = saleQtys.Sum(),
                consolidationInboundG = 1000m,
                consolidationUnitPricePerG = 0.03m,
                backfillCoversG = 1000m,
                remainingShortAfterJul4G = 1000m,
                secondInboundG = 800m,
                secondInboundUnitPricePerG = 0.04m,
                onHandAfterJul6G = -200m,
                notes = new[]
                {
                    "Company: Bisync Hospitality Sdn Bhd (id 1)",
                    "Stock Card → search SC FIFO Integrity Chicken Breast",
                    "Filters: Downtown · Recipe UOM · July 2026",
                    "Jul 1–3 sales then Jul 4 C/F @ 0.03/g backfills; Jul 6 top-up @ 0.04/g",
                    "On-hand after Jul 6 ≈ -200 g with negative banner",
                },
            },
            howToCheck = HowToCheck(ingredient.ComponentId),
        };
    }

    static object HowToCheck(string componentId) => new
    {
        stockCardSearch = "SC FIFO Integrity Chicken Breast",
        componentId,
        filters = new
        {
            period = "2026-07",
            uomMode = "recipe",
            location = "downtown",
            company = "Bisync Hospitality Sdn Bhd (id 1)",
        },
    };

    /// <summary>
    /// July 2026 FIFO/COGS test cases: large POS sale, purchase at RM 50, then mixed-tranche outbound.
    /// </summary>
    static async Task EnsureJulyFifoTestCasesAsync(BisyncDbContext db, Ingredient ingredient, int companyId)
    {
        const string poNumber = "PO-2026-FIFO-042";
        var po = await db.PurchaseOrders.FirstOrDefaultAsync(p => p.PoNumber == poNumber);
        if (po is null)
        {
            po = new PurchaseOrder
            {
                PoNumber = poNumber,
                VendorName = "Premium Meats Co.",
                OrderDate = new DateOnly(2026, 7, 1),
                DeliveryDate = new DateOnly(2026, 7, 3),
                DocumentType = "PO",
                Status = "Reconciled",
                CompanyId = companyId,
                LocationIdsJson = JsonSerializer.Serialize(new[] { "downtown" }),
                InitiatedBy = "Demo Seeder",
                ApprovedBy = "Demo Seeder",
                ApprovedAt = new DateTime(2026, 7, 2, 9, 0, 0, DateTimeKind.Utc),
                ReceivedAt = new DateTime(2026, 7, 3, 8, 0, 0, DateTimeKind.Utc),
                ReconciledAt = new DateTime(2026, 7, 3, 8, 0, 0, DateTimeKind.Utc),
            };
            db.PurchaseOrders.Add(po);
            await db.SaveChangesAsync();
        }

        var hasJulyPurchase = await db.InventoryPurchases.AnyAsync(p =>
            p.ComponentId == ingredient.ComponentId && p.PurchaseOrderId == po.Id);
        if (!hasJulyPurchase)
        {
            db.InventoryPurchases.Add(new InventoryPurchase
            {
                ComponentId = ingredient.ComponentId,
                ComponentName = ingredient.Name,
                Quantity = 40_000m,
                Uom = "g",
                UnitPrice = 0.05m,
                DateOrdered = po.OrderDate,
                DateCreatedInStock = new DateTime(2026, 7, 3, 10, 0, 0, DateTimeKind.Utc),
                PurchaseOrderId = po.Id,
                CompanyId = companyId,
                LocationIdsJson = JsonSerializer.Serialize(new[] { "downtown" }),
            });
        }

        async Task AddMovementIfMissing(int referenceId, InventoryMovement movement)
        {
            var exists = await db.InventoryMovements.AnyAsync(m =>
                m.ComponentId == movement.ComponentId
                && m.ReferenceType == movement.ReferenceType
                && m.ReferenceId == referenceId);
            if (!exists)
            {
                movement.ReferenceId = referenceId;
                db.InventoryMovements.Add(movement);
            }
        }

        await AddMovementIfMissing(9010, new InventoryMovement
        {
            ComponentId = ingredient.ComponentId,
            ComponentName = ingredient.Name,
            LocationExternalId = "downtown",
            QtyDelta = -30_000,
            Uom = "g",
            Reason = "POS sales depletion — FIFO test (30000 g)",
            ReferenceType = "pos_sale",
            CompanyId = companyId,
            CreatedAt = new DateTime(2026, 7, 2, 8, 0, 0, DateTimeKind.Utc),
        });

        await AddMovementIfMissing(9012, new InventoryMovement
        {
            ComponentId = ingredient.ComponentId,
            ComponentName = ingredient.Name,
            LocationExternalId = "downtown",
            QtyDelta = -25_000,
            Uom = "g",
            Reason = "POS sales depletion — FIFO test (25000 g)",
            ReferenceType = "pos_sale",
            CompanyId = companyId,
            CreatedAt = new DateTime(2026, 7, 4, 9, 0, 0, DateTimeKind.Utc),
        });
    }
}
