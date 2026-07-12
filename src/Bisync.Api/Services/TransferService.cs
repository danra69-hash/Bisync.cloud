using System.Text.Json;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

public class TransferService(
    BisyncDbContext db,
    ComponentStockService componentStock,
    ComponentFifoCostingService fifoCosting)
{
    public const string RefTransferOut = "transfer_out";
    public const string RefTransferIn = "transfer_in";

    public async Task<TransferEntry> CreateAsync(
        int companyId,
        string fromLocationExternalId,
        string toLocationExternalId,
        string itemType,
        string itemKey,
        string itemName,
        decimal quantity,
        string uom,
        DateOnly transferDate,
        CancellationToken cancellationToken = default)
    {
        if (quantity <= 0)
            throw new InvalidOperationException("Transfer quantity must be greater than zero.");
        if (string.IsNullOrWhiteSpace(fromLocationExternalId))
            throw new InvalidOperationException("From location is required.");
        if (string.IsNullOrWhiteSpace(toLocationExternalId))
            throw new InvalidOperationException("To location is required.");
        if (string.Equals(fromLocationExternalId.Trim(), toLocationExternalId.Trim(), StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("From and To locations must be different.");
        if (string.IsNullOrWhiteSpace(itemKey))
            throw new InvalidOperationException("Item is required.");
        if (string.IsNullOrWhiteSpace(uom))
            throw new InvalidOperationException("UOM is required.");

        var type = NormalizeItemType(itemType);
        var fromLoc = fromLocationExternalId.Trim();
        var toLoc = toLocationExternalId.Trim();
        var key = itemKey.Trim();
        var name = (itemName ?? string.Empty).Trim();
        var moveUom = uom.Trim();
        var moveQty = quantity;

        // Validate / normalize before persisting so we never leave orphan transfer rows.
        if (type == "component")
        {
            var ingredient = await db.Ingredients
                .AsNoTracking()
                .FirstOrDefaultAsync(i => i.ComponentId == key && i.CompanyId == companyId, cancellationToken)
                ?? await db.Ingredients
                    .AsNoTracking()
                    .FirstOrDefaultAsync(i => i.ComponentId == key, cancellationToken);

            if (ingredient is not null)
            {
                (moveQty, moveUom) = IngredientUomBridge.ToInventoryPreferred(ingredient, moveQty, moveUom);
                if (string.IsNullOrWhiteSpace(name))
                    name = ingredient.Name;
            }

            var onHand = await componentStock.GetOnHandAsync(key, fromLoc, moveUom, cancellationToken);
            if (onHand < moveQty)
                throw new InvalidOperationException(
                    $"Insufficient stock at source. Available {onHand} {moveUom}, requested {moveQty} {moveUom}.");
        }
        else
        {
            if (!int.TryParse(key, out var productId))
                throw new InvalidOperationException("Invalid product id.");

            var product = await db.Products.AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == productId, cancellationToken)
                ?? throw new InvalidOperationException("Product not found.");

            if (!product.IsSubProduct && !product.B2bEnabled)
                throw new InvalidOperationException("Only B2B products (or sub-products) can be transferred.");

            if (string.IsNullOrWhiteSpace(name))
                name = product.Name;

            var fromStock = await db.ProductB2bLocationStocks.AsNoTracking()
                .FirstOrDefaultAsync(
                    s => s.ProductId == productId && s.LocationExternalId == fromLoc,
                    cancellationToken);
            var available = fromStock?.InStock ?? 0m;
            if (available < moveQty)
                throw new InvalidOperationException(
                    $"Insufficient stock at source. Available {available}, requested {moveQty}.");
        }

        var entry = new TransferEntry
        {
            CompanyId = companyId,
            FromLocationExternalId = fromLoc,
            ToLocationExternalId = toLoc,
            ItemType = type,
            ItemKey = key,
            ItemName = name,
            Quantity = quantity,
            Uom = uom.Trim(),
            TransferDate = transferDate,
            CreatedAt = DateTime.UtcNow,
        };

        db.TransferEntries.Add(entry);
        await db.SaveChangesAsync(cancellationToken);

        var occurredAt = transferDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var reasonOut = $"Transfer out to {toLoc}";
        var reasonIn = $"Transfer in from {fromLoc}";

        if (type == "component")
        {
            await TransferComponentAsync(entry, companyId, moveQty, moveUom, reasonOut, reasonIn, occurredAt, cancellationToken);
        }
        else
        {
            await TransferProductAsync(entry, int.Parse(entry.ItemKey), companyId, reasonOut, reasonIn, occurredAt, cancellationToken);
        }

        await db.SaveChangesAsync(cancellationToken);
        return entry;
    }

    async Task TransferComponentAsync(
        TransferEntry entry,
        int companyId,
        decimal qty,
        string uom,
        string reasonOut,
        string reasonIn,
        DateTime occurredAt,
        CancellationToken cancellationToken)
    {
        var unitPrice = await fifoCosting.ResolveOutboundUnitPriceAsync(
            entry.ItemKey,
            entry.FromLocationExternalId,
            uom,
            qty,
            companyId,
            cancellationToken);

        await componentStock.RecordDeductionAsync(
            entry.ItemKey,
            entry.ItemName,
            entry.FromLocationExternalId,
            qty,
            uom,
            reasonOut,
            RefTransferOut,
            entry.Id,
            companyId,
            cancellationToken,
            createdAt: occurredAt,
            unitPriceOverride: unitPrice);

        componentStock.RecordAddition(
            entry.ItemKey,
            entry.ItemName,
            entry.ToLocationExternalId,
            qty,
            uom,
            reasonIn,
            RefTransferIn,
            entry.Id,
            companyId,
            createdAt: occurredAt,
            unitPrice: unitPrice);
    }

    async Task TransferProductAsync(
        TransferEntry entry,
        int productId,
        int companyId,
        string reasonOut,
        string reasonIn,
        DateTime occurredAt,
        CancellationToken cancellationToken)
    {
        var product = await db.Products.FirstOrDefaultAsync(p => p.Id == productId, cancellationToken)
            ?? throw new InvalidOperationException("Product not found.");

        var fromStock = await EnsureStockRowAsync(productId, entry.FromLocationExternalId, cancellationToken);
        fromStock.InStock = Math.Max(0, fromStock.InStock - entry.Quantity);
        fromStock.UpdatedAt = DateTime.UtcNow;

        var toStock = await EnsureStockRowAsync(productId, entry.ToLocationExternalId, cancellationToken);
        toStock.InStock += entry.Quantity;
        toStock.UpdatedAt = DateTime.UtcNow;

        var productionDate = entry.TransferDate.ToString("yyyy-MM-dd");
        db.ProductProductionLogs.Add(new ProductProductionLog
        {
            ProductId = productId,
            EntryType = RefTransferOut,
            Quantity = entry.Quantity,
            ProductionDate = productionDate,
            BatchNumber = $"XFR-{entry.Id}",
            LocationIdsJson = JsonSerializer.Serialize(new[] { entry.FromLocationExternalId }),
            CompanyId = companyId,
            CreatedAt = occurredAt,
        });
        db.ProductProductionLogs.Add(new ProductProductionLog
        {
            ProductId = productId,
            EntryType = RefTransferIn,
            Quantity = entry.Quantity,
            ProductionDate = productionDate,
            BatchNumber = $"XFR-{entry.Id}",
            LocationIdsJson = JsonSerializer.Serialize(new[] { entry.ToLocationExternalId }),
            CompanyId = companyId,
            CreatedAt = occurredAt,
        });

        product.UpdatedAt = DateTime.UtcNow;
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
        if (row is not null)
            return row;

        row = new ProductB2bLocationStock
        {
            ProductId = productId,
            LocationExternalId = locationExternalId,
            InStock = 0,
            UpdatedAt = DateTime.UtcNow,
        };
        db.ProductB2bLocationStocks.Add(row);
        await db.SaveChangesAsync(cancellationToken);
        return row;
    }

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
