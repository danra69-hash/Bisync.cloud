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

    /// <summary>Create a pending transfer and alert the receiving location. Stock is not moved yet.</summary>
    public async Task<TransferEntry> InitiateAsync(
        int companyId,
        string fromLocationExternalId,
        string toLocationExternalId,
        string itemType,
        string itemKey,
        string itemName,
        decimal quantity,
        string uom,
        DateOnly transferDate,
        string? initiatedBy = null,
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

        if (type == "component")
        {
            var ingredient = await FindIngredientAsync(companyId, key, cancellationToken);
            if (ingredient is not null)
            {
                (moveQty, moveUom) = IngredientUomBridge.ToInventoryPreferred(ingredient, quantity, uom);
                if (string.IsNullOrWhiteSpace(name))
                    name = ingredient.Name;
            }
        }
        else if (string.IsNullOrWhiteSpace(name) && int.TryParse(key, out var productIdForName))
        {
            var product = await db.Products.AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == productIdForName, cancellationToken);
            if (product is not null)
                name = product.Name;
        }

        await EnsureAvailableAsync(companyId, type, key, fromLoc, moveQty, moveUom, excludeTransferId: null, cancellationToken);

        var estimatedUnitPrice = await EstimateUnitPriceAsync(
            companyId, type, key, fromLoc, moveQty, moveUom, transferDate, cancellationToken);

        var entry = new TransferEntry
        {
            CompanyId = companyId,
            FromLocationExternalId = fromLoc,
            ToLocationExternalId = toLoc,
            ItemType = type,
            ItemKey = key,
            ItemName = name,
            // Persist inventory-preferred qty/uom for components so reservations match stock cards.
            Quantity = moveQty,
            Uom = moveUom,
            UnitPrice = estimatedUnitPrice,
            TransferDate = transferDate,
            Status = TransferEntry.StatusPending,
            InitiatedBy = (initiatedBy ?? string.Empty).Trim(),
            CreatedAt = DateTime.UtcNow,
        };

        db.TransferEntries.Add(entry);
        await db.SaveChangesAsync(cancellationToken);

        await UserNotificationService.NotifyTransferInitiatedAsync(db, entry);
        return entry;
    }

    /// <summary>
    /// Receiving party confirms receipt: deplete source stock and post inbound at destination.
    /// </summary>
    public async Task<TransferEntry> ConfirmReceiveAsync(
        int transferId,
        int companyId,
        string? receivedBy = null,
        decimal? receivedQuantity = null,
        DateOnly? receivedDate = null,
        CancellationToken cancellationToken = default)
    {
        var entry = await db.TransferEntries
            .FirstOrDefaultAsync(t => t.Id == transferId && t.CompanyId == companyId, cancellationToken)
            ?? throw new InvalidOperationException("Transfer not found.");

        if (!string.Equals(entry.Status, TransferEntry.StatusPending, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException($"Transfer is already {entry.Status}.");

        var receiveQty = receivedQuantity ?? entry.Quantity;
        if (receiveQty <= 0)
            throw new InvalidOperationException("Received quantity must be greater than zero.");
        if (receiveQty > entry.Quantity)
            throw new InvalidOperationException("Received quantity cannot exceed initiated quantity.");

        var type = NormalizeItemType(entry.ItemType);
        var moveUom = entry.Uom;
        var moveQty = receiveQty;

        if (type == "component")
        {
            var ingredient = await FindIngredientAsync(companyId, entry.ItemKey, cancellationToken);
            if (ingredient is not null)
                (moveQty, moveUom) = IngredientUomBridge.ToInventoryPreferred(ingredient, receiveQty, entry.Uom);
        }

        await EnsureAvailableAsync(
            companyId,
            type,
            entry.ItemKey,
            entry.FromLocationExternalId,
            moveQty,
            moveUom,
            excludeTransferId: entry.Id,
            cancellationToken);

        var transferDate = receivedDate ?? entry.TransferDate;
        var occurredAt = transferDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var reasonOut = $"Transfer out to {entry.ToLocationExternalId} (XFR-{entry.Id})";
        var reasonIn = $"Transfer in from {entry.FromLocationExternalId} (XFR-{entry.Id})";

        if (type == "component")
        {
            entry.UnitPrice = await MoveComponentAsync(
                entry, companyId, moveQty, moveUom, reasonOut, reasonIn, occurredAt, cancellationToken);
        }
        else
        {
            if (!int.TryParse(entry.ItemKey, out var productId))
                throw new InvalidOperationException("Invalid product id.");
            entry.UnitPrice = await MoveProductAsync(
                entry, productId, companyId, receiveQty, reasonOut, reasonIn, occurredAt, cancellationToken);
        }

        entry.Status = TransferEntry.StatusReceived;
        entry.ReceivedBy = (receivedBy ?? string.Empty).Trim();
        entry.ReceivedAt = DateTime.UtcNow;
        entry.ReceivedQuantity = receiveQty;
        entry.TransferDate = transferDate;

        await db.SaveChangesAsync(cancellationToken);
        await UserNotificationService.NotifyTransferReceivedAsync(db, entry);
        return entry;
    }

    public async Task<TransferEntry> CancelAsync(
        int transferId,
        int companyId,
        CancellationToken cancellationToken = default)
    {
        var entry = await db.TransferEntries
            .FirstOrDefaultAsync(t => t.Id == transferId && t.CompanyId == companyId, cancellationToken)
            ?? throw new InvalidOperationException("Transfer not found.");

        if (!string.Equals(entry.Status, TransferEntry.StatusPending, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException($"Only pending transfers can be cancelled (current: {entry.Status}).");

        entry.Status = TransferEntry.StatusCancelled;
        await db.SaveChangesAsync(cancellationToken);
        return entry;
    }

    public async Task<decimal> GetAvailableAsync(
        int? companyId,
        string itemType,
        string itemKey,
        string locationExternalId,
        string uom,
        CancellationToken cancellationToken = default)
    {
        var type = NormalizeItemType(itemType);
        var loc = locationExternalId.Trim();
        var key = itemKey.Trim();
        var moveUom = uom.Trim();
        decimal onHand;

        if (type == "component")
        {
            var ingredient = companyId is int cid
                ? await FindIngredientAsync(cid, key, cancellationToken)
                : await db.Ingredients.AsNoTracking().FirstOrDefaultAsync(i => i.ComponentId == key, cancellationToken);
            if (ingredient is not null)
                (_, moveUom) = IngredientUomBridge.ToInventoryPreferred(ingredient, 1, moveUom);

            onHand = await componentStock.GetOnHandAsync(key, loc, moveUom, cancellationToken);
        }
        else
        {
            if (!int.TryParse(key, out var productId))
                return 0;
            var stock = await db.ProductB2bLocationStocks.AsNoTracking()
                .FirstOrDefaultAsync(s => s.ProductId == productId && s.LocationExternalId == loc, cancellationToken);
            onHand = stock?.InStock ?? 0m;
            moveUom = string.IsNullOrWhiteSpace(uom) ? "pcs" : uom.Trim();
        }

        var pendingOut = await GetPendingOutboundQtyAsync(companyId, type, key, loc, cancellationToken);
        return Math.Max(0, onHand - pendingOut);
    }

    async Task EnsureAvailableAsync(
        int companyId,
        string type,
        string key,
        string fromLoc,
        decimal requiredQty,
        string uom,
        int? excludeTransferId,
        CancellationToken cancellationToken)
    {
        decimal onHand;
        if (type == "component")
        {
            onHand = await componentStock.GetOnHandAsync(key, fromLoc, uom, cancellationToken);
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

            var fromStock = await db.ProductB2bLocationStocks.AsNoTracking()
                .FirstOrDefaultAsync(
                    s => s.ProductId == productId && s.LocationExternalId == fromLoc,
                    cancellationToken);
            onHand = fromStock?.InStock ?? 0m;
        }

        var pendingOut = await GetPendingOutboundQtyAsync(companyId, type, key, fromLoc, cancellationToken, excludeTransferId);
        var available = onHand - pendingOut;
        if (available < requiredQty)
            throw new InvalidOperationException(
                $"Insufficient stock at source. Available {available} {uom}, requested {requiredQty} {uom}.");
    }

    async Task<decimal> GetPendingOutboundQtyAsync(
        int? companyId,
        string type,
        string key,
        string fromLoc,
        CancellationToken cancellationToken,
        int? excludeTransferId = null)
    {
        var query = db.TransferEntries.AsNoTracking()
            .Where(t => t.Status == TransferEntry.StatusPending
                && t.ItemType == type
                && t.ItemKey == key
                && t.FromLocationExternalId == fromLoc);
        if (companyId is int cid)
            query = query.Where(t => t.CompanyId == cid);
        if (excludeTransferId is int xid)
            query = query.Where(t => t.Id != xid);

        return await query.SumAsync(t => t.Quantity, cancellationToken);
    }

    async Task<decimal> EstimateUnitPriceAsync(
        int companyId,
        string type,
        string key,
        string fromLoc,
        decimal qty,
        string uom,
        DateOnly transferDate,
        CancellationToken cancellationToken)
    {
        if (type == "component")
        {
            var asOfEnd = transferDate.ToDateTime(new TimeOnly(23, 59, 59), DateTimeKind.Utc);
            return await fifoCosting.ResolveOutboundUnitPriceAsOfAsync(
                key, fromLoc, uom, qty, companyId, asOfEnd, cancellationToken);
        }

        if (!int.TryParse(key, out var productId))
            return 0;

        var product = await db.Products.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == productId, cancellationToken);
        return product is null ? 0 : ResolveProductTransferUnitCost(product);
    }

    async Task<decimal> MoveComponentAsync(
        TransferEntry entry,
        int companyId,
        decimal qty,
        string uom,
        string reasonOut,
        string reasonIn,
        DateTime occurredAt,
        CancellationToken cancellationToken)
    {
        // Smart-component transfers must move at FIFO stock cost as of the transfer date
        // (oldest on-hand tranche first) — never catalog/LastPrice or RRP.
        var asOfEnd = DateTime.SpecifyKind(
            occurredAt.Date.AddDays(1).AddTicks(-1),
            occurredAt.Kind == DateTimeKind.Unspecified ? DateTimeKind.Utc : occurredAt.Kind);

        var unitPrice = await fifoCosting.ResolveOutboundUnitPriceAsOfAsync(
            entry.ItemKey,
            entry.FromLocationExternalId,
            uom,
            qty,
            companyId,
            asOfEnd,
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

        return unitPrice;
    }

    async Task<decimal> MoveProductAsync(
        TransferEntry entry,
        int productId,
        int companyId,
        decimal quantity,
        string reasonOut,
        string reasonIn,
        DateTime occurredAt,
        CancellationToken cancellationToken)
    {
        var product = await db.Products.FirstOrDefaultAsync(p => p.Id == productId, cancellationToken)
            ?? throw new InvalidOperationException("Product not found.");

        var fromStock = await EnsureStockRowAsync(productId, entry.FromLocationExternalId, cancellationToken);
        if (fromStock.InStock < quantity)
            throw new InvalidOperationException(
                $"Insufficient stock at source. Available {fromStock.InStock}, requested {quantity}.");

        fromStock.InStock = Math.Max(0, fromStock.InStock - quantity);
        fromStock.UpdatedAt = DateTime.UtcNow;

        var toStock = await EnsureStockRowAsync(productId, entry.ToLocationExternalId, cancellationToken);
        toStock.InStock += quantity;
        toStock.UpdatedAt = DateTime.UtcNow;

        var productionDate = entry.TransferDate.ToString("yyyy-MM-dd");
        var unitCost = ResolveProductTransferUnitCost(product);
        db.ProductProductionLogs.Add(new ProductProductionLog
        {
            ProductId = productId,
            EntryType = RefTransferOut,
            Quantity = quantity,
            ProductionDate = productionDate,
            BatchNumber = $"XFR-{entry.Id}",
            LocationIdsJson = JsonSerializer.Serialize(new[] { entry.FromLocationExternalId }),
            CompanyId = companyId,
            UnitPrice = unitCost,
            CreatedAt = occurredAt,
        });
        db.ProductProductionLogs.Add(new ProductProductionLog
        {
            ProductId = productId,
            EntryType = RefTransferIn,
            Quantity = quantity,
            ProductionDate = productionDate,
            BatchNumber = $"XFR-{entry.Id}",
            LocationIdsJson = JsonSerializer.Serialize(new[] { entry.ToLocationExternalId }),
            CompanyId = companyId,
            UnitPrice = unitCost,
            CreatedAt = occurredAt,
        });

        product.UpdatedAt = DateTime.UtcNow;
        return unitCost;
    }

    /// <summary>Inter-outlet transfers move stock at recipe cost, never RRP.</summary>
    static decimal ResolveProductTransferUnitCost(Product product)
    {
        if (product.IsSubProduct && product.YieldQuantity > 0)
            return Math.Round(product.TotalCost / product.YieldQuantity, 4, MidpointRounding.AwayFromZero);
        return Math.Round(product.TotalCost, 4, MidpointRounding.AwayFromZero);
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

    async Task<Ingredient?> FindIngredientAsync(int companyId, string componentId, CancellationToken cancellationToken) =>
        await db.Ingredients.AsNoTracking()
            .FirstOrDefaultAsync(i => i.ComponentId == componentId && i.CompanyId == companyId, cancellationToken)
        ?? await db.Ingredients.AsNoTracking()
            .FirstOrDefaultAsync(i => i.ComponentId == componentId, cancellationToken);

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
