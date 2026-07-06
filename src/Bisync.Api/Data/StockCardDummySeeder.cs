using System.Text.Json;
using Bisync.Api.Models;
using Bisync.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Data;

/// <summary>
/// Seeds ~200 stock-card list rows (components, products, sub-products) with purchases and movements.
/// Idempotent: skips when enough "SC Demo" items already exist.
/// </summary>
public static class StockCardDummySeeder
{
    public const string NamePrefix = "SC Demo ";
    public const int TargetCount = 200;

    private static readonly string[] LocationIds =
        ["downtown", "midtown", "airport", "westend"];

    private static readonly string[] ComponentGroups =
        ["Proteins", "Produce", "Dairy", "Dry Goods", "Seafood", "Beverages", "Packaging"];

    private static readonly (string RecipeUom, string InventoryUom)[] UomPairs =
    [
        ("g", "kg"),
        ("ml", "l"),
        ("pcs", "pcs"),
    ];

    public static async Task<StockCardDummySeedResult> EnsureAsync(BisyncDbContext db, int? companyId = 1)
    {
        var existing = await db.Ingredients
            .CountAsync(i => i.Name.StartsWith(NamePrefix));

        var existingProducts = await db.Products
            .CountAsync(p => p.Name.StartsWith(NamePrefix));

        var existingTotal = existing + existingProducts;
        if (existingTotal >= TargetCount)
        {
            return new StockCardDummySeedResult
            {
                Skipped = true,
                Message = $"Already seeded ({existingTotal} SC Demo items).",
                ComponentsAdded = 0,
                ProductsAdded = 0,
                SubProductsAdded = 0,
            };
        }

        var toAdd = TargetCount - existingTotal;
        var componentTarget = (int)Math.Round(toAdd * 0.85);
        var subProductTarget = (int)Math.Round(toAdd * 0.075);
        var productTarget = toAdd - componentTarget - subProductTarget;

        var rng = new Random(42_006);
        var locationsJson = JsonSerializer.Serialize(LocationIds);
        var now = DateTime.UtcNow;

        var componentsAdded = 0;
        var sequence = existing + existingProducts + 1;

        for (var i = 0; i < componentTarget; i++, sequence++)
        {
            var name = $"{NamePrefix}Component {sequence:D3}";
            if (await db.Ingredients.AnyAsync(ing => ing.Name == name))
                continue;

            var group = ComponentGroups[sequence % ComponentGroups.Length];
            var uom = UomPairs[sequence % UomPairs.Length];
            var componentId = await ComponentIdGenerator.GenerateAsync(db, name);
            var priceRecipe = Math.Round((decimal)(rng.NextDouble() * 2 + 0.05), 4);
            var priceInventory = uom.RecipeUom == uom.InventoryUom
                ? priceRecipe
                : Math.Round(priceRecipe * 1000, 2);

            var ingredient = new Ingredient
            {
                ComponentId = componentId,
                Name = name,
                Category = "Food",
                Group = group,
                RecipeUom = uom.RecipeUom,
                InventoryUom = uom.InventoryUom,
                LastPriceRecipe = priceRecipe,
                LastPriceInventory = priceInventory,
                DailyUsage = Math.Round((decimal)(rng.NextDouble() * 5 + 0.5), 2),
                OrderFreqDays = 3 + (sequence % 5),
                StorageJson = JsonSerializer.Serialize(new[] { "Chiller", "Dry Store" }[sequence % 2]),
                DetailConfigJson = "{}",
                Active = true,
                LocationsJson = locationsJson,
            };
            db.Ingredients.Add(ingredient);
            await db.SaveChangesAsync();

            var displayUom = ingredient.InventoryUom;
            var inboundQty = 80 + (sequence % 420);
            var outboundQty = 10 + (sequence % 60);
            var adjustQty = sequence % 7 == 0 ? -(2 + sequence % 8) : 0;
            var onHand = inboundQty - outboundQty + adjustQty;

            db.InventoryPurchases.Add(new InventoryPurchase
            {
                ComponentId = componentId,
                ComponentName = name,
                Quantity = inboundQty,
                Uom = displayUom,
                UnitPrice = priceInventory,
                DateOrdered = DateOnly.FromDateTime(now.AddDays(-(20 + sequence % 40))),
                DateCreatedInStock = now.AddDays(-(18 + sequence % 35)),
                CompanyId = companyId,
                LocationIdsJson = JsonSerializer.Serialize(new[] { LocationIds[sequence % LocationIds.Length] }),
            });

            db.InventoryMovements.Add(new InventoryMovement
            {
                ComponentId = componentId,
                ComponentName = name,
                LocationExternalId = LocationIds[sequence % LocationIds.Length],
                QtyDelta = -outboundQty,
                Uom = displayUom,
                UnitPrice = priceInventory,
                Reason = "Production depletion",
                ReferenceType = "production",
                ReferenceId = sequence,
                CompanyId = companyId,
                CreatedAt = now.AddDays(-(10 + sequence % 20)).AddHours(sequence % 12),
            });

            if (adjustQty != 0)
            {
                db.InventoryMovements.Add(new InventoryMovement
                {
                    ComponentId = componentId,
                    ComponentName = name,
                    LocationExternalId = LocationIds[sequence % LocationIds.Length],
                    QtyDelta = adjustQty,
                    Uom = displayUom,
                    UnitPrice = priceInventory,
                    Reason = "Inventory adjustment — count short",
                    ReferenceType = "inventory_adjustment",
                    ReferenceId = sequence,
                    CompanyId = companyId,
                    CreatedAt = now.AddDays(-(5 + sequence % 8)).AddHours(sequence % 10),
                });
            }

            // Extra purchase at another location for ledger variety
            if (sequence % 3 == 0)
            {
                var extraInbound = 15 + sequence % 40;
                onHand += extraInbound;
                db.InventoryPurchases.Add(new InventoryPurchase
                {
                    ComponentId = componentId,
                    ComponentName = name,
                    Quantity = extraInbound,
                    Uom = displayUom,
                    UnitPrice = priceInventory,
                    DateOrdered = DateOnly.FromDateTime(now.AddDays(-(7 + sequence % 14))),
                    DateCreatedInStock = now.AddDays(-(6 + sequence % 10)),
                    PurchaseOrderId = 0,
                    CompanyId = companyId,
                    LocationIdsJson = JsonSerializer.Serialize(new[] { LocationIds[(sequence + 1) % LocationIds.Length] }),
                });
            }

            _ = onHand;
            await db.SaveChangesAsync();
            componentsAdded++;
        }

        var productsAdded = 0;
        var subProductsAdded = 0;

        for (var i = 0; i < productTarget + subProductTarget; i++, sequence++)
        {
            var isSub = i >= productTarget;
            var kind = isSub ? "Sub-Product" : "Product";
            var name = $"{NamePrefix}{kind} {sequence:D3}";
            if (await db.Products.AnyAsync(p => p.Name == name))
                continue;

            var productId = await ProductIdGenerator.GenerateAsync(db, name, isSub);
            var group = ComponentGroups[sequence % ComponentGroups.Length];
            var yieldQty = isSub ? 10 + (sequence % 20) : 0;
            var product = new Product
            {
                ProductId = productId,
                Name = name,
                Category = "Food",
                Group = group,
                IsSubProduct = isSub,
                B2bEnabled = true,
                B2cEnabled = !isSub && sequence % 2 == 0,
                PosEnabled = false,
                B2bPackageUnit = isSub ? $"{yieldQty} portion" : "pcs",
                TotalCost = Math.Round((decimal)(rng.NextDouble() * 20 + 5), 2),
                PackagingCost = Math.Round((decimal)(rng.NextDouble() * 3), 2),
                Rrp = Math.Round((decimal)(rng.NextDouble() * 40 + 12), 2),
                YieldQuantity = yieldQty,
                YieldUom = isSub ? "portion" : string.Empty,
                ExpiryPeriodDays = isSub ? 5 + sequence % 10 : 0,
                Active = true,
                CompanyId = companyId,
                LocationIdsJson = locationsJson,
                CreatedAt = now,
                UpdatedAt = now,
            };
            db.Products.Add(product);
            await db.SaveChangesAsync();

            var loc = LocationIds[sequence % LocationIds.Length];
            var producedQty = 20 + sequence % 80;
            var batchNumber = await BatchNumberGenerator.GenerateAsync(db, product.Id, product.ProductId);
            var productionDate = DateOnly.FromDateTime(now.AddDays(-(12 + sequence % 25)));

            db.ProductProductionLogs.Add(new ProductProductionLog
            {
                ProductId = product.Id,
                EntryType = "produced",
                Quantity = producedQty,
                ProductionDate = productionDate.ToString("yyyy-MM-dd"),
                ExpiryDate = productionDate.AddDays(product.ExpiryPeriodDays > 0 ? product.ExpiryPeriodDays : 30)
                    .ToString("yyyy-MM-dd"),
                BatchNumber = batchNumber,
                LocationIdsJson = JsonSerializer.Serialize(new[] { loc }),
                CompanyId = companyId,
                CreatedAt = now.AddDays(-(11 + sequence % 20)),
            });

            db.ProductB2bLocationStocks.Add(new ProductB2bLocationStock
            {
                ProductId = product.Id,
                LocationExternalId = loc,
                InStock = producedQty - (sequence % 15),
                SalesPerDay = Math.Round((decimal)(rng.NextDouble() * 4 + 0.5), 2),
                ProducedQty = producedQty,
                ExpiryDate = productionDate.AddDays(14).ToString("yyyy-MM-dd"),
                UpdatedAt = now,
            });

            if (sequence % 4 == 0)
            {
                var loc2 = LocationIds[(sequence + 2) % LocationIds.Length];
                var produced2 = 10 + sequence % 30;
                db.ProductProductionLogs.Add(new ProductProductionLog
                {
                    ProductId = product.Id,
                    EntryType = "produced",
                    Quantity = produced2,
                    ProductionDate = productionDate.AddDays(3).ToString("yyyy-MM-dd"),
                    ExpiryDate = productionDate.AddDays(17).ToString("yyyy-MM-dd"),
                    BatchNumber = $"{batchNumber}-2",
                    LocationIdsJson = JsonSerializer.Serialize(new[] { loc2 }),
                    CompanyId = companyId,
                    CreatedAt = now.AddDays(-(5 + sequence % 8)),
                });

                db.ProductB2bLocationStocks.Add(new ProductB2bLocationStock
                {
                    ProductId = product.Id,
                    LocationExternalId = loc2,
                    InStock = produced2,
                    ProducedQty = produced2,
                    UpdatedAt = now,
                });
            }

            await db.SaveChangesAsync();
            if (isSub)
                subProductsAdded++;
            else
                productsAdded++;
        }

        return new StockCardDummySeedResult
        {
            Skipped = false,
            Message = "Stock card dummy data seeded.",
            ComponentsAdded = componentsAdded,
            ProductsAdded = productsAdded,
            SubProductsAdded = subProductsAdded,
        };
    }
}

public sealed class StockCardDummySeedResult
{
    public bool Skipped { get; init; }
    public string Message { get; init; } = string.Empty;
    public int ComponentsAdded { get; init; }
    public int ProductsAdded { get; init; }
    public int SubProductsAdded { get; init; }
    public int TotalAdded => ComponentsAdded + ProductsAdded + SubProductsAdded;
}
