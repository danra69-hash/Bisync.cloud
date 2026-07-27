using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

public class ProductionInventoryService(
    BisyncDbContext db,
    ComponentStockService componentStock,
    ProductSaleInventoryService productSaleInventory)
{
    public async Task<ProduceBatchResult> PreviewRequirementsAsync(
        int productId,
        IReadOnlyList<string> locationExternalIds,
        decimal batchQty,
        IReadOnlyDictionary<string, decimal>? componentUsages = null,
        CancellationToken cancellationToken = default)
    {
        if (batchQty <= 0)
            throw new InvalidOperationException("Batch quantity must be greater than zero.");

        var product = await db.Products
            .Include(p => p.Items)
            .Include(p => p.PackagingItems)
            .FirstOrDefaultAsync(p => p.Id == productId, cancellationToken)
            ?? throw new InvalidOperationException("Product not found.");

        var recipeLines = GetRecipeLines(product);
        if (recipeLines.Count == 0)
        {
            return new ProduceBatchResult { Success = true, BatchQty = batchQty };
        }

        var subProductsByCode = await LoadActiveSubProductsByCodeAsync(product.CompanyId, cancellationToken);
        var ingredientsByCode = await LoadIngredientsByCodeAsync(
            recipeLines.Select(l => l.ComponentId).Distinct(StringComparer.OrdinalIgnoreCase).ToList(),
            product.CompanyId,
            cancellationToken);

        var components = new List<ProduceComponentRequirement>();
        var shortages = new List<ProduceStockShortage>();

        foreach (var locationId in locationExternalIds)
        {
            foreach (var line in recipeLines)
            {
                var requiredQty = ResolveUsageQty(
                    line, batchQty, ingredientsByCode, componentUsages);
                if (requiredQty < 0) requiredQty = 0;

                decimal onHand;
                if (subProductsByCode.TryGetValue(line.ComponentId, out var subProduct))
                {
                    var stockRow = await db.ProductB2bLocationStocks.AsNoTracking()
                        .FirstOrDefaultAsync(
                            s => s.ProductId == subProduct.Id && s.LocationExternalId == locationId,
                            cancellationToken);
                    onHand = stockRow?.InStock ?? 0m;
                }
                else
                {
                    onHand = await componentStock.GetOnHandAsync(
                        line.ComponentId,
                        locationId,
                        line.ComponentUom,
                        cancellationToken);
                }

                var isSufficient = onHand + 0.0001m >= requiredQty;
                components.Add(new ProduceComponentRequirement(
                    locationId,
                    line.ComponentId,
                    line.ComponentName,
                    requiredQty,
                    onHand,
                    line.ComponentUom,
                    isSufficient));

                if (!isSufficient && requiredQty > 0)
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

        return new ProduceBatchResult
        {
            Success = shortages.Count == 0,
            BatchQty = batchQty,
            Shortages = shortages,
            Components = components,
        };
    }

    public async Task<ProduceBatchResult> ProduceSubProductBatchesAsync(
        int productId,
        IReadOnlyList<string> locationExternalIds,
        decimal batchQty,
        bool overrideStock = false,
        IReadOnlyDictionary<string, decimal>? componentUsages = null,
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

        var recipeLines = GetRecipeLines(product);
        var ingredientsByCode = await LoadIngredientsByCodeAsync(
            recipeLines.Select(l => l.ComponentId).Distinct(StringComparer.OrdinalIgnoreCase).ToList(),
            product.CompanyId,
            cancellationToken);

        var preview = await PreviewRequirementsAsync(
            productId, locationExternalIds, batchQty, componentUsages, cancellationToken);

        if (!overrideStock && !preview.Success)
        {
            return preview;
        }

        var deductionReason = FormatProductionDeductionReason(product, overrideStock);
        foreach (var locationId in locationExternalIds)
        {
            foreach (var line in recipeLines)
            {
                var requiredQty = ResolveUsageQty(line, batchQty, ingredientsByCode, componentUsages);
                if (requiredQty <= 0) continue;

                await componentStock.RecordDeductionAsync(
                    line.ComponentId,
                    line.ComponentName,
                    locationId,
                    requiredQty,
                    line.ComponentUom,
                    reason: deductionReason,
                    referenceType: "production",
                    referenceId: product.Id,
                    companyId: product.CompanyId,
                    cancellationToken);
            }

            var stockRow = await EnsureStockRowAsync(product.Id, locationId, cancellationToken);
            stockRow.InStock += batchQty;
            stockRow.ProducedQty += batchQty;
            stockRow.ToProduceQty = Math.Max(0, stockRow.ToProduceQty - batchQty);
            stockRow.UpdatedAt = DateTime.UtcNow;
        }

        product.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);

        return new ProduceBatchResult
        {
            Success = true,
            BatchQty = batchQty,
            Components = preview.Components,
        };
    }

    /// <summary>
    /// Deduct recipe/component usage for a parent (B2B) product production without treating it as a sub-product batch.
    /// </summary>
    public async Task<ProduceBatchResult> DeductComponentsForProductionAsync(
        int productId,
        IReadOnlyList<string> locationExternalIds,
        decimal batchQty,
        bool overrideStock = false,
        IReadOnlyDictionary<string, decimal>? componentUsages = null,
        CancellationToken cancellationToken = default)
    {
        var product = await db.Products
            .Include(p => p.Items)
            .Include(p => p.PackagingItems)
            .FirstOrDefaultAsync(p => p.Id == productId, cancellationToken)
            ?? throw new InvalidOperationException("Product not found.");

        var recipeLines = GetRecipeLines(product);
        if (recipeLines.Count == 0)
            return new ProduceBatchResult { Success = true, BatchQty = batchQty };

        var preview = await PreviewRequirementsAsync(
            productId, locationExternalIds, batchQty, componentUsages, cancellationToken);
        if (!overrideStock && !preview.Success)
            return preview;

        var subProductsByCode = await LoadActiveSubProductsByCodeAsync(product.CompanyId, cancellationToken);
        var ingredientsByCode = await LoadIngredientsByCodeAsync(
            recipeLines.Select(l => l.ComponentId).Distinct(StringComparer.OrdinalIgnoreCase).ToList(),
            product.CompanyId,
            cancellationToken);
        var deductionReason = FormatProductionDeductionReason(product, overrideStock);
        foreach (var locationId in locationExternalIds)
        {
            foreach (var line in recipeLines)
            {
                var requiredQty = ResolveUsageQty(line, batchQty, ingredientsByCode, componentUsages);
                if (requiredQty <= 0) continue;

                if (subProductsByCode.TryGetValue(line.ComponentId, out var subProduct))
                {
                    await DeductSubProductForProductionAsync(
                        product,
                        subProduct,
                        locationId,
                        requiredQty,
                        deductionReason,
                        overrideStock,
                        ingredientsByCode,
                        cancellationToken);
                    continue;
                }

                await componentStock.RecordDeductionAsync(
                    line.ComponentId,
                    line.ComponentName,
                    locationId,
                    requiredQty,
                    line.ComponentUom,
                    reason: deductionReason,
                    referenceType: "production",
                    referenceId: product.Id,
                    companyId: product.CompanyId,
                    cancellationToken);
            }
        }

        await db.SaveChangesAsync(cancellationToken);
        return new ProduceBatchResult { Success = true, BatchQty = batchQty, Components = preview.Components };
    }

    async Task DeductSubProductForProductionAsync(
        Product parentProduct,
        Product subProduct,
        string locationId,
        decimal requiredQty,
        string deductionReason,
        bool overrideStock,
        IReadOnlyDictionary<string, Ingredient> ingredientsByCode,
        CancellationToken cancellationToken)
    {
        var stockRow = await db.ProductB2bLocationStocks
            .FirstOrDefaultAsync(
                s => s.ProductId == subProduct.Id && s.LocationExternalId == locationId,
                cancellationToken);

        var availableStock = stockRow?.InStock ?? 0m;
        var fromProducedStock = Math.Min(availableStock, requiredQty);
        var shortfall = requiredQty - fromProducedStock;

        if (fromProducedStock > 0 && stockRow is not null)
        {
            stockRow.InStock = Math.Max(0, stockRow.InStock - fromProducedStock);
            stockRow.UpdatedAt = DateTime.UtcNow;
        }

        if (shortfall <= 0)
            return;

        if (!overrideStock)
            throw new InvalidOperationException(
                $"Insufficient stock. Short by {shortfall:0.####} units.");

        // Override: explode remaining sub-product demand into its recipe components.
        foreach (var recipeLine in subProduct.Items.Where(l => !string.IsNullOrWhiteSpace(l.ComponentId)))
        {
            if (!ingredientsByCode.ContainsKey(recipeLine.ComponentId)
                && !await IngredientExistsAsync(recipeLine.ComponentId, parentProduct.CompanyId, cancellationToken))
                continue;

            var componentQty = recipeLine.Quantity * shortfall;
            if (componentQty <= 0) continue;

            await componentStock.RecordDeductionAsync(
                recipeLine.ComponentId,
                recipeLine.ComponentName,
                locationId,
                componentQty,
                recipeLine.ComponentUom,
                reason: $"{deductionReason} (sub-product recipe shortfall)",
                referenceType: "production",
                referenceId: parentProduct.Id,
                companyId: parentProduct.CompanyId,
                cancellationToken);
        }
    }

    async Task<bool> IngredientExistsAsync(string componentId, int? companyId, CancellationToken cancellationToken)
    {
        var map = await LoadIngredientsByCodeAsync([componentId], companyId, cancellationToken);
        return map.ContainsKey(componentId);
    }

    async Task<Dictionary<string, Product>> LoadActiveSubProductsByCodeAsync(
        int? companyId,
        CancellationToken cancellationToken)
    {
        var query = db.Products.AsNoTracking()
            .Include(p => p.Items)
            .Include(p => p.PackagingItems)
            .Where(p => p.IsSubProduct && p.Active);
        if (companyId is int cid)
            query = query.Where(p => p.CompanyId == null || p.CompanyId == cid);

        return await query.ToDictionaryAsync(
            p => p.ProductId,
            StringComparer.OrdinalIgnoreCase,
            cancellationToken);
    }

    static List<RecipeLine> GetRecipeLines(Product product) =>
        product.Items
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

    static decimal ResolveUsageQty(
        RecipeLine line,
        decimal batchQty,
        IReadOnlyDictionary<string, Ingredient> ingredientsByCode,
        IReadOnlyDictionary<string, decimal>? componentUsages)
    {
        if (componentUsages is not null
            && componentUsages.TryGetValue(line.ComponentId, out var used))
        {
            return used;
        }

        return GrossRequiredQty(line.Quantity, batchQty, line.ComponentId, ingredientsByCode);
    }

    public async Task<ProduceBatchResult> AdjustProducedBatchAsync(
        int batchLogId,
        decimal newBatchQty,
        string productionDate,
        string expiryDate,
        bool overrideStock = false,
        CancellationToken cancellationToken = default)
    {
        if (newBatchQty <= 0)
            throw new InvalidOperationException("Batch quantity must be greater than zero.");

        var log = await db.ProductProductionLogs
            .FirstOrDefaultAsync(l => l.Id == batchLogId, cancellationToken);
        if (log is null || !string.Equals(log.EntryType, "produced", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Production batch not found.");

        var product = await db.Products
            .Include(p => p.Items)
            .Include(p => p.PackagingItems)
            .FirstOrDefaultAsync(p => p.Id == log.ProductId, cancellationToken);
        if (product is null)
            throw new InvalidOperationException("Product not found.");

        var locationExternalIds = PurchaseOrderWorkflow.DeserializeLocationIds(log.LocationIdsJson);
        if (locationExternalIds.Count == 0)
            throw new InvalidOperationException("Batch has no locations.");

        var delta = newBatchQty - log.Quantity;
        if (delta != 0 && product.IsSubProduct)
        {
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
            var ingredientsByCode = await LoadIngredientsByCodeAsync(
                recipeLines.Select(l => l.ComponentId).Distinct(StringComparer.OrdinalIgnoreCase).ToList(),
                product.CompanyId,
                cancellationToken);
            var components = new List<ProduceComponentRequirement>();
            var shortages = new List<ProduceStockShortage>();

            if (delta > 0 && !overrideStock)
            {
                foreach (var locationId in locationExternalIds)
                {
                    foreach (var line in recipeLines)
                    {
                        var requiredQty = GrossRequiredQty(line.Quantity, delta, line.ComponentId, ingredientsByCode);
                        if (requiredQty <= 0) continue;

                        var onHand = await componentStock.GetOnHandAsync(
                            line.ComponentId,
                            locationId,
                            line.ComponentUom,
                            cancellationToken);

                        var isSufficient = onHand + 0.0001m >= requiredQty;
                        components.Add(new ProduceComponentRequirement(
                            locationId,
                            line.ComponentId,
                            line.ComponentName,
                            requiredQty,
                            onHand,
                            line.ComponentUom,
                            isSufficient));

                        if (!isSufficient)
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
                        Components = components,
                    };
                }
            }

            var adjustmentReason = FormatProductionDeductionReason(product, overrideStock, "batch_edit");
            foreach (var locationId in locationExternalIds)
            {
                foreach (var line in recipeLines)
                {
                    var componentDelta = GrossRequiredQty(line.Quantity, delta, line.ComponentId, ingredientsByCode);
                    if (componentDelta == 0) continue;

                    if (componentDelta > 0)
                    {
                        await componentStock.RecordDeductionAsync(
                            line.ComponentId,
                            line.ComponentName,
                            locationId,
                            componentDelta,
                            line.ComponentUom,
                            reason: adjustmentReason,
                            referenceType: "production",
                            referenceId: product.Id,
                            companyId: product.CompanyId,
                            cancellationToken);
                    }
                    else
                    {
                        componentStock.RecordAddition(
                            line.ComponentId,
                            line.ComponentName,
                            locationId,
                            -componentDelta,
                            line.ComponentUom,
                            reason: adjustmentReason,
                            referenceType: "production_batch",
                            referenceId: batchLogId,
                            companyId: product.CompanyId);
                    }
                }
            }
        }

        if (delta != 0)
        {
            foreach (var locationId in locationExternalIds)
            {
                var stockRow = await EnsureStockRowAsync(product.Id, locationId, cancellationToken);
                stockRow.InStock += delta;
                stockRow.ProducedQty += delta;
                stockRow.UpdatedAt = DateTime.UtcNow;
            }
        }

        log.Quantity = newBatchQty;
        log.ProductionDate = productionDate;
        log.ExpiryDate = expiryDate;
        product.UpdatedAt = DateTime.UtcNow;

        await RecomputeStockExpiryAsync(product.Id, locationExternalIds, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);

        return new ProduceBatchResult { Success = true, BatchQty = newBatchQty };
    }

    async Task RecomputeStockExpiryAsync(
        int productId,
        IReadOnlyList<string> locationExternalIds,
        CancellationToken cancellationToken)
    {
        var expiryDates = await db.ProductProductionLogs
            .AsNoTracking()
            .Where(l => l.ProductId == productId
                && l.EntryType == "produced"
                && l.ExpiryDate != "")
            .Select(l => l.ExpiryDate)
            .ToListAsync(cancellationToken);

        DateOnly? earliest = null;
        foreach (var raw in expiryDates)
        {
            if (!DateOnly.TryParse(raw.Trim(), out var parsed))
                continue;
            earliest = earliest is null || parsed < earliest ? parsed : earliest;
        }

        var nextExpiry = earliest?.ToString("yyyy-MM-dd") ?? string.Empty;
        foreach (var locationId in locationExternalIds)
        {
            var stockRow = await db.ProductB2bLocationStocks
                .FirstOrDefaultAsync(
                    s => s.ProductId == productId && s.LocationExternalId == locationId,
                    cancellationToken);
            if (stockRow is null) continue;
            stockRow.ExpiryDate = nextExpiry;
            stockRow.UpdatedAt = DateTime.UtcNow;
        }
    }

    public Task RecordParentProductSaleAsync(
        int productId,
        IReadOnlyList<string> locationExternalIds,
        decimal quantitySold,
        string salesChannel,
        CancellationToken cancellationToken = default) =>
        productSaleInventory.RecordProductSaleAsync(
            productId,
            locationExternalIds,
            quantitySold,
            salesChannel,
            cancellationToken);

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

    static string FormatProductionDeductionReason(Product product, bool overrideStock, string? scenario = null)
    {
        var kind = product.IsSubProduct ? "Sub-product" : "Product";
        var codeSuffix = string.IsNullOrWhiteSpace(product.ProductId)
            ? string.Empty
            : $" ({product.ProductId.Trim()})";

        return scenario switch
        {
            "batch_edit" when overrideStock =>
                $"Production batch adjustment (override) — {product.Name.Trim()}{codeSuffix} ({kind})",
            "batch_edit" =>
                $"Production batch adjustment — {product.Name.Trim()}{codeSuffix} ({kind})",
            _ when overrideStock =>
                $"Production override — {product.Name.Trim()}{codeSuffix} ({kind})",
            _ =>
                $"Production — {product.Name.Trim()}{codeSuffix} ({kind})",
        };
    }

    static decimal GrossRequiredQty(
        decimal lineQuantity,
        decimal multiplier,
        string componentId,
        IReadOnlyDictionary<string, Ingredient> ingredientsByCode)
    {
        var nett = lineQuantity * multiplier;
        if (nett == 0)
            return 0m;

        if (!ingredientsByCode.TryGetValue(componentId, out var ingredient))
            return nett;

        var sign = nett < 0 ? -1m : 1m;
        return sign * ComponentYieldLossRules.ToGrossQuantity(ingredient, Math.Abs(nett));
    }

    async Task<Dictionary<string, Ingredient>> LoadIngredientsByCodeAsync(
        IReadOnlyList<string> componentIds,
        int? companyId,
        CancellationToken cancellationToken)
    {
        if (componentIds.Count == 0)
            return new Dictionary<string, Ingredient>(StringComparer.OrdinalIgnoreCase);

        IQueryable<Ingredient> query = db.Ingredients.AsNoTracking()
            .Where(i => componentIds.Contains(i.ComponentId));
        if (companyId is int cid)
            query = query.Where(i => i.CompanyId == null || i.CompanyId == cid);

        var rows = await query.ToListAsync(cancellationToken);
        return rows
            .GroupBy(i => i.ComponentId, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);
    }
}

public sealed class ProduceBatchResult
{
    public bool Success { get; set; }
    public decimal BatchQty { get; set; }
    public List<ProduceStockShortage> Shortages { get; set; } = [];
    public List<ProduceComponentRequirement> Components { get; set; } = [];
}

public sealed record ProduceComponentRequirement(
    string LocationExternalId,
    string ComponentId,
    string ComponentName,
    decimal RequiredQty,
    decimal OnHandQty,
    string Uom,
    bool IsSufficient);

public sealed record ProduceStockShortage(
    string LocationExternalId,
    string ComponentId,
    string ComponentName,
    decimal RequiredQty,
    decimal OnHandQty,
    string Uom);

sealed record RecipeLine(
    string ComponentId,
    string ComponentName,
    string ComponentUom,
    decimal Quantity);
