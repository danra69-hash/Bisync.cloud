using System.Text.Json;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

public class WastageService(
    BisyncDbContext db,
    ComponentStockService componentStock,
    ComponentFifoCostingService fifoCosting,
    StockCardService stockCards)
{
    public const string ReferenceType = "wastage";
    public const string SourceManual = "manual";
    public const string SourcePos = "pos";
    public const string SourceSplitUse = "split-use";

    public async Task<(decimal UnitPrice, decimal TotalValue, string Uom)> EstimateValueAsync(
        int companyId,
        string locationExternalId,
        string itemType,
        string itemKey,
        decimal quantity,
        string uom,
        DateOnly wastedDate,
        CancellationToken cancellationToken = default)
    {
        if (quantity <= 0)
            return (0, 0, (uom ?? string.Empty).Trim());

        var type = NormalizeItemType(itemType);
        var asOfEnd = EndOfUtcDay(wastedDate);
        var loc = locationExternalId.Trim();

        if (type == "component")
        {
            var ingredient = await db.Ingredients
                .AsNoTracking()
                .FirstOrDefaultAsync(i => i.ComponentId == itemKey && i.CompanyId == companyId, cancellationToken)
                ?? await db.Ingredients
                    .AsNoTracking()
                    .FirstOrDefaultAsync(i => i.ComponentId == itemKey, cancellationToken);

            var deductQty = quantity;
            var deductUom = (uom ?? string.Empty).Trim();
            if (ingredient is not null)
                (deductQty, deductUom) = IngredientUomBridge.ToInventoryPreferred(ingredient, deductQty, deductUom);

            var unitPrice = await fifoCosting.ResolveOutboundUnitPriceAsOfAsync(
                itemKey.Trim(),
                loc,
                deductUom,
                deductQty,
                companyId,
                asOfEnd,
                cancellationToken);

            var totalValue = DecimalRounding.ToDb(unitPrice * deductQty);
            return (StockCardFifoEngine.RoundUnitPrice(unitPrice), totalValue, deductUom);
        }

        if (!int.TryParse(itemKey, out _))
            return (0, 0, (uom ?? string.Empty).Trim());

        var snapshot = await stockCards.GetAsOfSnapshotAsync(
            type,
            itemKey.Trim(),
            companyId,
            loc,
            [loc],
            "inventory",
            wastedDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc),
            cancellationToken);

        if (snapshot is null || snapshot.Layers.Count == 0)
            return (0, 0, string.IsNullOrWhiteSpace(uom) ? (snapshot?.Uom ?? string.Empty) : uom.Trim());

        var layers = snapshot.Layers
            .Select((l, i) => new FifoLayer
            {
                ReceivedAt = l.SortOrder,
                SourceId = i,
                Quantity = l.Quantity,
                UnitPrice = l.UnitPrice,
                SourceLabel = "on-hand",
            })
            .ToList();

        var consumed = StockCardFifoEngine.Consume(ref layers, quantity);
        var total = DecimalRounding.ToDb(consumed.TotalCost);
        return (
            StockCardFifoEngine.RoundUnitPrice(consumed.UnitPrice),
            total,
            string.IsNullOrWhiteSpace(uom) ? snapshot.Uom : uom.Trim());
    }

    public async Task<WastageEntry> CreateManualAsync(
        int companyId,
        string locationExternalId,
        string itemType,
        string itemKey,
        string itemName,
        decimal quantity,
        string uom,
        DateOnly wastedDate,
        string reason,
        CancellationToken cancellationToken = default)
    {
        if (quantity <= 0)
            throw new InvalidOperationException("Quantity must be greater than zero.");
        if (string.IsNullOrWhiteSpace(locationExternalId))
            throw new InvalidOperationException("Location is required.");
        if (string.IsNullOrWhiteSpace(reason))
            throw new InvalidOperationException("Reason is required.");

        var type = NormalizeItemType(itemType);
        var entry = new WastageEntry
        {
            CompanyId = companyId,
            LocationExternalId = locationExternalId.Trim(),
            Source = SourceManual,
            ItemType = type,
            ItemKey = itemKey.Trim(),
            ItemName = itemName.Trim(),
            Quantity = quantity,
            Uom = uom.Trim(),
            WastedDate = wastedDate,
            Reason = reason.Trim(),
            CreatedAt = DateTime.UtcNow,
        };

        db.WastageEntries.Add(entry);
        await db.SaveChangesAsync(cancellationToken);

        // End-of-day stamp so same-day purchases/receipts sit before wastage in FIFO.
        var occurredAt = EndOfUtcDay(wastedDate);
        var reasonLabel = $"Wastage — {entry.Reason}";

        if (type == "component")
        {
            var ingredient = await db.Ingredients
                .AsNoTracking()
                .FirstOrDefaultAsync(i => i.ComponentId == entry.ItemKey && i.CompanyId == companyId, cancellationToken)
                ?? await db.Ingredients
                    .AsNoTracking()
                    .FirstOrDefaultAsync(i => i.ComponentId == entry.ItemKey, cancellationToken);

            var deductQty = entry.Quantity;
            var deductUom = entry.Uom;
            if (ingredient is not null)
            {
                (deductQty, deductUom) = IngredientUomBridge.ToInventoryPreferred(ingredient, deductQty, deductUom);
                if (string.IsNullOrWhiteSpace(entry.ItemName))
                    entry.ItemName = ingredient.Name;
            }

            await RecordWastageComponentDeductionAsync(
                entry.ItemKey,
                entry.ItemName,
                entry.LocationExternalId,
                deductQty,
                deductUom,
                reasonLabel,
                entry.Id,
                companyId,
                occurredAt,
                cancellationToken);
        }
        else
        {
            if (!int.TryParse(entry.ItemKey, out var productId))
                throw new InvalidOperationException("Invalid product id.");

            await DepleteProductOrSubProductAsync(
                productId,
                entry.LocationExternalId,
                entry.Quantity,
                reasonLabel,
                entry.Id,
                companyId,
                occurredAt,
                cancellationToken);
        }

        await db.SaveChangesAsync(cancellationToken);
        return entry;
    }

    /// <summary>
    /// POS void/refund → explode finished product BOM (incl. nested sub-products) and deplete components.
    /// </summary>
    public async Task<WastageEntry> CreatePosWastageAsync(
        int companyId,
        string locationExternalId,
        int productId,
        decimal quantity,
        string checkNo,
        string reason,
        DateOnly wastedDate,
        CancellationToken cancellationToken = default)
    {
        if (quantity <= 0)
            throw new InvalidOperationException("Quantity must be greater than zero.");

        var product = await db.Products
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == productId, cancellationToken)
            ?? throw new InvalidOperationException("Product not found.");

        var entry = new WastageEntry
        {
            CompanyId = companyId,
            LocationExternalId = locationExternalId.Trim(),
            Source = SourcePos,
            ItemType = product.IsSubProduct ? "sub-product" : "product",
            ItemKey = product.Id.ToString(),
            ItemName = product.Name,
            Quantity = quantity,
            Uom = string.IsNullOrWhiteSpace(product.YieldUom) ? "pcs" : product.YieldUom,
            WastedDate = wastedDate,
            Reason = string.IsNullOrWhiteSpace(reason) ? "POS void/refund" : reason.Trim(),
            PosCheckNo = (checkNo ?? string.Empty).Trim(),
            CreatedAt = DateTime.UtcNow,
        };

        db.WastageEntries.Add(entry);
        await db.SaveChangesAsync(cancellationToken);

        var occurredAt = EndOfUtcDay(wastedDate);
        var reasonLabel = $"POS wastage — check {entry.PosCheckNo} — {entry.Reason}";

        await DepleteProductOrSubProductAsync(
            productId,
            entry.LocationExternalId,
            entry.Quantity,
            reasonLabel,
            entry.Id,
            companyId,
            occurredAt,
            cancellationToken);

        await db.SaveChangesAsync(cancellationToken);
        return entry;
    }

    async Task DepleteProductOrSubProductAsync(
        int productId,
        string locationExternalId,
        decimal quantity,
        string reasonLabel,
        int wastageId,
        int companyId,
        DateTime occurredAt,
        CancellationToken cancellationToken)
    {
        var product = await db.Products
            .Include(p => p.Items)
            .Include(p => p.PackagingItems)
            .FirstOrDefaultAsync(p => p.Id == productId, cancellationToken)
            ?? throw new InvalidOperationException("Product not found.");

        // Finished-goods / sub-product stock card layer
        var stockRow = await db.ProductB2bLocationStocks
            .FirstOrDefaultAsync(
                s => s.ProductId == productId && s.LocationExternalId == locationExternalId,
                cancellationToken);
        if (stockRow is not null)
        {
            stockRow.InStock = Math.Max(0, stockRow.InStock - quantity);
            stockRow.UpdatedAt = DateTime.UtcNow;
        }

        db.ProductProductionLogs.Add(new ProductProductionLog
        {
            ProductId = productId,
            EntryType = ReferenceType,
            Quantity = quantity,
            ProductionDate = DateOnly.FromDateTime(occurredAt).ToString("yyyy-MM-dd"),
            BatchNumber = $"WST-{wastageId}",
            LocationIdsJson = JsonSerializer.Serialize(new[] { locationExternalId }),
            CompanyId = companyId,
            CreatedAt = occurredAt,
        });

        var subProductsByCode = await db.Products
            .AsNoTracking()
            .Include(p => p.Items)
            .Include(p => p.PackagingItems)
            .Where(p => p.IsSubProduct && p.Active)
            .ToDictionaryAsync(p => p.ProductId, StringComparer.OrdinalIgnoreCase, cancellationToken);

        var ingredientIds = await db.Ingredients
            .AsNoTracking()
            .Where(i => i.Active)
            .Select(i => i.ComponentId)
            .ToListAsync(cancellationToken);
        var ingredientCodes = new HashSet<string>(ingredientIds, StringComparer.OrdinalIgnoreCase);

        foreach (var line in product.Items.Where(l => !string.IsNullOrWhiteSpace(l.ComponentId)))
        {
            if (subProductsByCode.TryGetValue(line.ComponentId, out var subProduct))
            {
                await ExplodeSubProductComponentsAsync(
                    subProduct,
                    line.Quantity * quantity,
                    locationExternalId,
                    reasonLabel,
                    wastageId,
                    companyId,
                    occurredAt,
                    ingredientCodes,
                    subProductsByCode,
                    cancellationToken);
                continue;
            }

            if (!ingredientCodes.Contains(line.ComponentId))
                continue;

            var qty = line.Quantity * quantity;
            if (qty <= 0) continue;

            var (deductQty, deductUom) = await ToInventoryDeductionAsync(
                line.ComponentId,
                companyId,
                qty,
                line.ComponentUom,
                cancellationToken);

            await RecordWastageComponentDeductionAsync(
                line.ComponentId,
                line.ComponentName,
                locationExternalId,
                deductQty,
                deductUom,
                reasonLabel,
                wastageId,
                companyId,
                occurredAt,
                cancellationToken);
        }

        foreach (var pack in product.PackagingItems.Where(l => !string.IsNullOrWhiteSpace(l.ComponentId)))
        {
            if (!ingredientCodes.Contains(pack.ComponentId))
                continue;
            var qty = pack.Quantity * quantity;
            if (qty <= 0) continue;

            var (deductQty, deductUom) = await ToInventoryDeductionAsync(
                pack.ComponentId,
                companyId,
                qty,
                pack.ComponentUom,
                cancellationToken);

            await RecordWastageComponentDeductionAsync(
                pack.ComponentId,
                pack.ComponentName,
                locationExternalId,
                deductQty,
                deductUom,
                reasonLabel,
                wastageId,
                companyId,
                occurredAt,
                cancellationToken);
        }

        product.UpdatedAt = DateTime.UtcNow;
    }

    async Task ExplodeSubProductComponentsAsync(
        Product subProduct,
        decimal subProductUnitsNeeded,
        string locationExternalId,
        string reasonLabel,
        int wastageId,
        int companyId,
        DateTime occurredAt,
        HashSet<string> ingredientCodes,
        Dictionary<string, Product> subProductsByCode,
        CancellationToken cancellationToken,
        int depth = 0)
    {
        if (depth > 8)
            return;

        // Prefer depleting produced sub-product stock; shortfall still explodes recipe.
        var stockRow = await db.ProductB2bLocationStocks
            .FirstOrDefaultAsync(
                s => s.ProductId == subProduct.Id && s.LocationExternalId == locationExternalId,
                cancellationToken);

        var stockUnitsRequired = subProduct.YieldQuantity > 0
            ? subProductUnitsNeeded / subProduct.YieldQuantity
            : subProductUnitsNeeded;

        var fromStock = stockRow is null ? 0m : Math.Min(stockRow.InStock, stockUnitsRequired);
        var shortfall = stockUnitsRequired - fromStock;

        if (fromStock > 0 && stockRow is not null)
        {
            stockRow.InStock = Math.Max(0, stockRow.InStock - fromStock);
            stockRow.UpdatedAt = DateTime.UtcNow;
            db.ProductProductionLogs.Add(new ProductProductionLog
            {
                ProductId = subProduct.Id,
                EntryType = ReferenceType,
                Quantity = fromStock,
                ProductionDate = DateOnly.FromDateTime(occurredAt).ToString("yyyy-MM-dd"),
                BatchNumber = $"WST-{wastageId}",
                LocationIdsJson = JsonSerializer.Serialize(new[] { locationExternalId }),
                CompanyId = companyId,
                CreatedAt = occurredAt,
            });
        }

        if (shortfall <= 0)
            return;

        foreach (var line in subProduct.Items.Where(l => !string.IsNullOrWhiteSpace(l.ComponentId)))
        {
            if (subProductsByCode.TryGetValue(line.ComponentId, out var nested)
                && nested.Id != subProduct.Id)
            {
                await ExplodeSubProductComponentsAsync(
                    nested,
                    line.Quantity * shortfall,
                    locationExternalId,
                    reasonLabel,
                    wastageId,
                    companyId,
                    occurredAt,
                    ingredientCodes,
                    subProductsByCode,
                    cancellationToken,
                    depth + 1);
                continue;
            }

            if (!ingredientCodes.Contains(line.ComponentId))
                continue;
            var qty = line.Quantity * shortfall;
            if (qty <= 0) continue;

            var (deductQty, deductUom) = await ToInventoryDeductionAsync(
                line.ComponentId,
                companyId,
                qty,
                line.ComponentUom,
                cancellationToken);

            await RecordWastageComponentDeductionAsync(
                line.ComponentId,
                line.ComponentName,
                locationExternalId,
                deductQty,
                deductUom,
                reasonLabel,
                wastageId,
                companyId,
                occurredAt,
                cancellationToken);
        }

        foreach (var pack in subProduct.PackagingItems.Where(l => !string.IsNullOrWhiteSpace(l.ComponentId)))
        {
            if (!ingredientCodes.Contains(pack.ComponentId))
                continue;
            var qty = pack.Quantity * shortfall;
            if (qty <= 0) continue;

            var (deductQty, deductUom) = await ToInventoryDeductionAsync(
                pack.ComponentId,
                companyId,
                qty,
                pack.ComponentUom,
                cancellationToken);

            await RecordWastageComponentDeductionAsync(
                pack.ComponentId,
                pack.ComponentName,
                locationExternalId,
                deductQty,
                deductUom,
                reasonLabel,
                wastageId,
                companyId,
                occurredAt,
                cancellationToken);
        }
    }

    /// <summary>
    /// Depletes component stock with FIFO unit cost as of <paramref name="occurredAt"/> (wasted date).
    /// </summary>
    async Task RecordWastageComponentDeductionAsync(
        string componentId,
        string componentName,
        string locationExternalId,
        decimal quantity,
        string uom,
        string reasonLabel,
        int wastageId,
        int companyId,
        DateTime occurredAt,
        CancellationToken cancellationToken)
    {
        if (quantity <= 0)
            return;

        var asOfEnd = DateTime.SpecifyKind(
            occurredAt.Date.AddDays(1).AddTicks(-1),
            occurredAt.Kind == DateTimeKind.Unspecified ? DateTimeKind.Utc : occurredAt.Kind);

        var unitPrice = await fifoCosting.ResolveOutboundUnitPriceAsOfAsync(
            componentId,
            locationExternalId,
            uom,
            quantity,
            companyId,
            asOfEnd,
            cancellationToken);

        await componentStock.RecordDeductionAsync(
            componentId,
            componentName,
            locationExternalId,
            quantity,
            uom,
            reasonLabel,
            ReferenceType,
            wastageId,
            companyId,
            cancellationToken,
            createdAt: occurredAt,
            unitPriceOverride: unitPrice);
    }

    async Task<(decimal Quantity, string Uom)> ToInventoryDeductionAsync(
        string componentId,
        int companyId,
        decimal quantity,
        string uom,
        CancellationToken cancellationToken)
    {
        var ingredient = await db.Ingredients
            .AsNoTracking()
            .FirstOrDefaultAsync(i => i.ComponentId == componentId && i.CompanyId == companyId, cancellationToken)
            ?? await db.Ingredients
                .AsNoTracking()
                .FirstOrDefaultAsync(i => i.ComponentId == componentId, cancellationToken);

        if (ingredient is null)
            return (quantity, uom);

        // Recipe qty is nett usable; inflate by Yield Loss % before stock write.
        var grossQty = ComponentYieldLossRules.ToGrossQuantity(ingredient, quantity);
        return IngredientUomBridge.ToInventoryPreferred(ingredient, grossQty, uom);
    }

    static DateTime EndOfUtcDay(DateOnly date) =>
        date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc).AddDays(1).AddTicks(-1);

    static string NormalizeItemType(string itemType)
    {
        var t = (itemType ?? string.Empty).Trim().ToLowerInvariant();
        return t switch
        {
            "product" => "product",
            "sub-product" or "subproduct" or "sub_product" => "sub-product",
            _ => "component",
        };
    }
}
