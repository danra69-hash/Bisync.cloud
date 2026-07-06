using System.Text.Json;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Data;

/// <summary>
/// Seeds a showcase smart component with multi-price FIFO purchases and varied depletion types.
/// </summary>
public static class StockCardFifoDemoSeeder
{
    public const string ComponentName = "SC FIFO Demo Wagyu";
    public const string ComponentId = "CMP-SCFIFO-001";

    public static async Task<object> EnsureAsync(BisyncDbContext db, int companyId = 1, bool force = false)
    {
        var existing = await db.Ingredients
            .FirstOrDefaultAsync(i => i.ComponentId == ComponentId || i.Name == ComponentName);

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
                return new
                {
                    skipped = true,
                    message = "FIFO demo already seeded.",
                    componentId = existing.ComponentId,
                };
            }
        }

        var now = DateTime.UtcNow;
        var locationsJson = JsonSerializer.Serialize(new[] { "downtown", "midtown", "airport", "westend" });
        var ingredient = existing ?? new Ingredient
        {
            ComponentId = ComponentId,
            Name = ComponentName,
            Category = "Food",
            Group = "Proteins",
            RecipeUom = "g",
            InventoryUom = "kg",
            LastPriceRecipe = 0.042m,
            LastPriceInventory = 42m,
            DailyUsage = 2.5m,
            OrderFreqDays = 3,
            StorageJson = JsonSerializer.Serialize(new[] { "Chiller" }),
            DetailConfigJson = "{}",
            Active = true,
            LocationsJson = locationsJson,
        };

        if (existing is null)
        {
            db.Ingredients.Add(ingredient);
            await db.SaveChangesAsync();
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
                    Quantity = poQtys[i],
                    Uom = "kg",
                    UnitPrice = poPrices[i],
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
            QtyDelta = 10,
            Uom = "kg",
            UnitPrice = 41m,
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
            QtyDelta = -35,
            Uom = "kg",
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
            QtyDelta = -18,
            Uom = "kg",
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
            QtyDelta = -5,
            Uom = "kg",
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
            QtyDelta = -8,
            Uom = "kg",
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
            QtyDelta = -3,
            Uom = "kg",
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
            QtyDelta = 2,
            Uom = "kg",
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
            QtyDelta = -12,
            Uom = "kg",
            Reason = "POS sales depletion",
            ReferenceType = "pos_sale",
            ReferenceId = refId++,
            CompanyId = companyId,
            CreatedAt = now.AddDays(-1).AddHours(19),
        });

        await db.SaveChangesAsync();

        return new
        {
            skipped = false,
            message = "FIFO demo seeded. Search 'SC FIFO Demo Wagyu' in Stock Card.",
            componentId = ingredient.ComponentId,
            purchaseOrders = poNumbers,
        };
    }
}
