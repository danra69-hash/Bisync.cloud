using System.Text.Json;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

/// <summary>
/// Depletes stock when a parent product is sold (POS, online, offline).
/// Smart components: BOM qty × units sold (FIFO), inflated by Yield Loss % to gross stock.
/// Sub-products: deplete produced stock first; shortfall uses sub-product recipe components.
/// </summary>
public class ProductSaleInventoryService(
    BisyncDbContext db,
    ComponentStockService componentStock)
{
    public static readonly IReadOnlySet<string> ValidChannels = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "pos", "online", "offline",
    };

    public async Task RecordProductSaleAsync(
        int productId,
        IReadOnlyList<string> locationExternalIds,
        decimal quantitySold,
        string salesChannel,
        CancellationToken cancellationToken = default)
    {
        if (quantitySold <= 0)
            return;

        var channel = NormalizeChannel(salesChannel);
        var referenceType = ChannelToReferenceType(channel);
        var reasonLabel = ChannelToReasonLabel(channel);

        var product = await db.Products
            .Include(p => p.Items)
            .Include(p => p.PackagingItems)
            .FirstOrDefaultAsync(p => p.Id == productId, cancellationToken);

        if (product is null || product.IsSubProduct || !product.Active)
            return;

        var subProductsByCode = await db.Products
            .AsNoTracking()
            .Include(p => p.Items)
            .Include(p => p.PackagingItems)
            .Where(p => p.IsSubProduct && p.Active)
            .ToDictionaryAsync(p => p.ProductId, StringComparer.OrdinalIgnoreCase, cancellationToken);

        var ingredientsByCode = await LoadActiveIngredientsByCodeAsync(product.CompanyId, cancellationToken);

        foreach (var locationId in locationExternalIds)
        {
            async Task DepleteBomLineAsync(string componentId, string componentName, string componentUom, decimal lineQty)
            {
                if (string.IsNullOrWhiteSpace(componentId) || lineQty <= 0)
                    return;

                if (subProductsByCode.TryGetValue(componentId, out var subProduct))
                {
                    await DepleteSubProductLineAsync(
                        product,
                        subProduct,
                        new ProductComponentItem
                        {
                            ComponentId = componentId,
                            ComponentName = componentName,
                            ComponentUom = componentUom,
                            Quantity = lineQty,
                        },
                        locationId,
                        quantitySold,
                        referenceType,
                        reasonLabel,
                        ingredientsByCode,
                        cancellationToken);
                    return;
                }

                if (!ingredientsByCode.TryGetValue(componentId, out var ingredient))
                    return;

                var nettQty = lineQty * quantitySold;
                if (nettQty <= 0)
                    return;

                var requiredQty = ComponentYieldLossRules.ToGrossQuantity(ingredient, nettQty);

                await componentStock.RecordDeductionAsync(
                    componentId,
                    componentName,
                    locationId,
                    requiredQty,
                    componentUom,
                    reason: $"{reasonLabel} — {product.Name}",
                    referenceType: referenceType,
                    referenceId: product.Id,
                    companyId: product.CompanyId,
                    cancellationToken);
            }

            foreach (var line in product.Items)
            {
                await DepleteBomLineAsync(line.ComponentId, line.ComponentName, line.ComponentUom, line.Quantity);
            }

            foreach (var line in product.PackagingItems)
            {
                await DepleteBomLineAsync(line.ComponentId, line.ComponentName, line.ComponentUom, line.Quantity);
            }
        }

        product.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
    }

    async Task DepleteSubProductLineAsync(
        Product parentProduct,
        Product subProduct,
        ProductComponentItem bomLine,
        string locationId,
        decimal quantitySold,
        string referenceType,
        string reasonLabel,
        IReadOnlyDictionary<string, Ingredient> ingredientsByCode,
        CancellationToken cancellationToken)
    {
        var piecesNeeded = bomLine.Quantity * quantitySold;
        if (piecesNeeded <= 0)
            return;

        var stockUnitsRequired = subProduct.YieldQuantity > 0
            ? piecesNeeded / subProduct.YieldQuantity
            : piecesNeeded;

        if (stockUnitsRequired <= 0)
            return;

        var stockRow = await db.ProductB2bLocationStocks
            .FirstOrDefaultAsync(
                s => s.ProductId == subProduct.Id && s.LocationExternalId == locationId,
                cancellationToken);

        var availableStock = stockRow?.InStock ?? 0m;
        var fromProducedStock = Math.Min(availableStock, stockUnitsRequired);
        var shortfall = stockUnitsRequired - fromProducedStock;

        if (fromProducedStock > 0 && stockRow is not null)
        {
            stockRow.InStock = Math.Max(0, stockRow.InStock - fromProducedStock);
            stockRow.UpdatedAt = DateTime.UtcNow;

            db.ProductProductionLogs.Add(new ProductProductionLog
            {
                ProductId = subProduct.Id,
                EntryType = referenceType,
                Quantity = fromProducedStock,
                ProductionDate = DateOnly.FromDateTime(DateTime.UtcNow).ToString("yyyy-MM-dd"),
                LocationIdsJson = JsonSerializer.Serialize(new[] { locationId }),
                CompanyId = subProduct.CompanyId,
                CreatedAt = DateTime.UtcNow,
            });
        }

        if (shortfall <= 0)
            return;

        foreach (var recipeLine in subProduct.Items.Where(line => !string.IsNullOrWhiteSpace(line.ComponentId)))
        {
            if (!ingredientsByCode.TryGetValue(recipeLine.ComponentId, out var ingredient))
                continue;

            var nettQty = recipeLine.Quantity * shortfall;
            if (nettQty <= 0)
                continue;

            var componentQty = ComponentYieldLossRules.ToGrossQuantity(ingredient, nettQty);

            await componentStock.RecordDeductionAsync(
                recipeLine.ComponentId,
                recipeLine.ComponentName,
                locationId,
                componentQty,
                recipeLine.ComponentUom,
                reason: $"{reasonLabel} — {parentProduct.Name} (sub-product recipe, no production stock)",
                referenceType: referenceType,
                referenceId: parentProduct.Id,
                companyId: parentProduct.CompanyId,
                cancellationToken);
        }

        foreach (var packagingLine in subProduct.PackagingItems.Where(line => !string.IsNullOrWhiteSpace(line.ComponentId)))
        {
            if (!ingredientsByCode.TryGetValue(packagingLine.ComponentId, out var ingredient))
                continue;

            var nettQty = packagingLine.Quantity * shortfall;
            if (nettQty <= 0)
                continue;

            var componentQty = ComponentYieldLossRules.ToGrossQuantity(ingredient, nettQty);

            await componentStock.RecordDeductionAsync(
                packagingLine.ComponentId,
                packagingLine.ComponentName,
                locationId,
                componentQty,
                packagingLine.ComponentUom,
                reason: $"{reasonLabel} — {parentProduct.Name} (sub-product recipe, no production stock)",
                referenceType: referenceType,
                referenceId: parentProduct.Id,
                companyId: parentProduct.CompanyId,
                cancellationToken);
        }
    }

    async Task<Dictionary<string, Ingredient>> LoadActiveIngredientsByCodeAsync(
        int? companyId,
        CancellationToken cancellationToken)
    {
        IQueryable<Ingredient> query = db.Ingredients.AsNoTracking().Where(i => i.Active);
        if (companyId is int cid)
            query = query.Where(i => i.CompanyId == null || i.CompanyId == cid);

        var rows = await query.ToListAsync(cancellationToken);
        return rows
            .GroupBy(i => i.ComponentId, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);
    }

    static string NormalizeChannel(string salesChannel)
    {
        var normalized = salesChannel.Trim().ToLowerInvariant();
        return ValidChannels.Contains(normalized) ? normalized : "pos";
    }

    public static string ChannelToReferenceType(string channel) =>
        channel switch
        {
            "online" => "online_order",
            "offline" => "offline_order",
            _ => "pos_sale",
        };

    static string ChannelToReasonLabel(string channel) =>
        channel switch
        {
            "online" => "Online order sales depletion",
            "offline" => "Offline order sales depletion",
            _ => "POS sales depletion",
        };
}
