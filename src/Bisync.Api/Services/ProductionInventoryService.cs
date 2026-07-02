using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

public class ProductionInventoryService(
    BisyncDbContext db,
    ComponentStockService componentStock)
{
    public async Task<ProduceBatchResult> ProduceSubProductBatchesAsync(
        int productId,
        IReadOnlyList<string> locationExternalIds,
        decimal batchQty,
        CancellationToken cancellationToken = default)
    {
        if (batchQty <= 0)
            throw new InvalidOperationException("Batch quantity must be greater than zero.");

        var product = await db.Products
            .Include(p => p.Items)
            .Include(p => p.PackagingItems)
            .FirstOrDefaultAsync(p => p.Id == productId, cancellationToken);

        if (product is null)
            throw new InvalidOperationException("Product not found.");
        if (!product.IsSubProduct)
            throw new InvalidOperationException("Only sub-products can be produced in batches.");
        if (!product.Active)
            throw new InvalidOperationException("Product is not active.");

        var recipeLines = product.Items
            .Where(line => !string.IsNullOrWhiteSpace(line.ComponentId))
            .Select(line => new RecipeLine(
                line.ComponentId,
                line.ComponentName,
                line.ComponentUom,
                line.Quantity))
            .Concat(product.PackagingItems
                .Where(line => !string.IsNullOrWhiteSpace(line.ComponentId))
                .Select(line => new RecipeLine(
                    line.ComponentId,
                    line.ComponentName,
                    line.ComponentUom,
                    line.Quantity)))
            .ToList();

        var shortages = new List<ProduceStockShortage>();
        foreach (var locationId in locationExternalIds)
        {
            foreach (var line in recipeLines)
            {
                var requiredQty = line.Quantity * batchQty;
                if (requiredQty <= 0) continue;

                var onHand = await componentStock.GetOnHandAsync(
                    line.ComponentId,
                    locationId,
                    line.ComponentUom,
                    cancellationToken);

                if (onHand + 0.0001m < requiredQty)
                {
                    shortages.Add(new ProduceStockShortage(
                        locationId,
                        line.ComponentId,
                        line.ComponentName,
                        requiredQty,
                        onHand,
                        line.ComponentUom));
                }
            }
        }

        if (shortages.Count > 0)
        {
            return new ProduceBatchResult
            {
                Success = false,
                Shortages = shortages,
            };
        }

        foreach (var locationId in locationExternalIds)
        {
            foreach (var line in recipeLines)
            {
                var requiredQty = line.Quantity * batchQty;
                if (requiredQty <= 0) continue;

                componentStock.RecordDeduction(
                    line.ComponentId,
                    line.ComponentName,
                    locationId,
                    requiredQty,
                    line.ComponentUom,
                    reason: "production",
                    referenceType: "sub_product_batch",
                    referenceId: product.Id,
                    companyId: product.CompanyId);
            }

            var stockRow = await EnsureStockRowAsync(product.Id, locationId, cancellationToken);
            stockRow.InStock += batchQty;
            stockRow.ToProduceQty = Math.Max(0, stockRow.ToProduceQty - batchQty);
            stockRow.UpdatedAt = DateTime.UtcNow;
        }

        product.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);

        return new ProduceBatchResult { Success = true, BatchQty = batchQty };
    }

    public async Task RecordParentProductSaleAsync(
        int productId,
        IReadOnlyList<string> locationExternalIds,
        decimal quantitySold,
        CancellationToken cancellationToken = default)
    {
        if (quantitySold <= 0) return;

        var product = await db.Products
            .Include(p => p.Items)
            .FirstOrDefaultAsync(p => p.Id == productId, cancellationToken);

        if (product is null || product.IsSubProduct) return;

        var subProductsByCode = await db.Products
            .AsNoTracking()
            .Where(p => p.IsSubProduct && p.Active)
            .ToDictionaryAsync(p => p.ProductId, StringComparer.OrdinalIgnoreCase, cancellationToken);

        foreach (var line in product.Items.Where(l => !string.IsNullOrWhiteSpace(l.ComponentId)))
        {
            if (!subProductsByCode.TryGetValue(line.ComponentId, out var subProduct))
                continue;

            var piecesNeeded = line.Quantity * quantitySold;
            var batchesToDeduct = subProduct.YieldQuantity > 0
                ? piecesNeeded / subProduct.YieldQuantity
                : piecesNeeded;

            if (batchesToDeduct <= 0) continue;

            foreach (var locationId in locationExternalIds)
            {
                var stockRow = await db.ProductB2bLocationStocks
                    .FirstOrDefaultAsync(
                        s => s.ProductId == subProduct.Id && s.LocationExternalId == locationId,
                        cancellationToken);

                if (stockRow is null) continue;
                stockRow.InStock = Math.Max(0, stockRow.InStock - batchesToDeduct);
                stockRow.UpdatedAt = DateTime.UtcNow;
            }
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    async Task<ProductB2bLocationStock> EnsureStockRowAsync(
        int productId,
        string locationExternalId,
        CancellationToken cancellationToken)
    {
        var row = await db.ProductB2bLocationStocks
            .FirstOrDefaultAsync(
                s => s.ProductId == productId && s.LocationExternalId == locationExternalId,
                cancellationToken);

        if (row is not null) return row;

        row = new ProductB2bLocationStock
        {
            ProductId = productId,
            LocationExternalId = locationExternalId,
            UpdatedAt = DateTime.UtcNow,
        };
        db.ProductB2bLocationStocks.Add(row);
        await db.SaveChangesAsync(cancellationToken);
        return row;
    }
}

public sealed class ProduceBatchResult
{
    public bool Success { get; set; }
    public decimal BatchQty { get; set; }
    public List<ProduceStockShortage> Shortages { get; set; } = [];
}

public sealed record ProduceStockShortage(
    string LocationExternalId,
    string ComponentId,
    string ComponentName,
    decimal RequiredQty,
    decimal OnHandQty,
    string Uom);

file sealed record RecipeLine(
    string ComponentId,
    string ComponentName,
    string ComponentUom,
    decimal Quantity);
