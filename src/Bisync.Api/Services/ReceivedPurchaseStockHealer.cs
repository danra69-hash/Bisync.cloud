using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

/// <summary>
/// Heals Received / Partially Delivered POs:
/// 1) Missing InventoryPurchases (received before receive-posts-stock).
/// 2) Under-converted purchases still stored as delivery packages @ package price
///    instead of Principal Component Unit (packages × tagged principal).
/// </summary>
public sealed class ReceivedPurchaseStockHealer(
    BisyncDbContext db,
    SplitUseService splitUse,
    FifoBatchIssueService fifoBatches,
    LocationPartitionService locationPartitions,
    ILogger<ReceivedPurchaseStockHealer> logger)
{
    public async Task<int> HealMissingReceivedStockAsync(CancellationToken cancellationToken = default)
    {
        var missingHealed = await HealMissingAsync(cancellationToken);
        var rewritten = await HealUnderConvertedAsync(cancellationToken);
        return missingHealed + rewritten;
    }

    async Task<int> HealMissingAsync(CancellationToken cancellationToken)
    {
        // Cheap existence probe — most requests find nothing to heal.
        var missingIds = await db.PurchaseOrders.AsNoTracking()
            .Where(o =>
                (o.Status == PurchaseOrderWorkflow.StatusReceived
                    || o.Status == PurchaseOrderWorkflow.StatusPartiallyDelivered)
                && !o.IsPreCommitted)
            .Where(o => !db.InventoryPurchases.Any(p => p.PurchaseOrderId == o.Id))
            .OrderBy(o => o.Id)
            .Select(o => o.Id)
            .Take(100)
            .ToListAsync(cancellationToken);

        if (missingIds.Count == 0)
            return 0;

        var candidates = await db.PurchaseOrders
            .Include(o => o.Items)
            .Where(o => missingIds.Contains(o.Id))
            .ToListAsync(cancellationToken);

        var healed = 0;
        foreach (var order in candidates)
        {
            var lines = order.Items
                .Where(i => !i.IsReturnableDeposit)
                .Select(i =>
                {
                    var qty = i.DeliveredQuantity > 0
                        ? i.DeliveredQuantity
                        : (i.ReceivedQuantity ?? 0m);
                    return (Item: i, Qty: qty);
                })
                .Where(x => x.Qty > 0 && !string.IsNullOrWhiteSpace(x.Item.ComponentId))
                .ToList();

            if (lines.Count == 0)
                continue;

            try
            {
                await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);

                var locationIds = PurchaseOrderWorkflow.DeserializeLocationIds(order.LocationIdsJson);
                var locationIdsJson = locationIds.Count > 0
                    ? order.LocationIdsJson
                    : PurchaseOrderWorkflow.SerializeLocationIds(locationIds);
                var locationExternalId = locationIds.Count > 0
                    ? locationIds[0].Trim()
                    : string.Empty;

                if (!string.IsNullOrEmpty(locationExternalId))
                    await locationPartitions.EnsurePartitionsForLocationAsync(locationExternalId);

                var receiptCreatedAt = order.ReceivedAt ?? DateTime.UtcNow;
                foreach (var (item, qtyRaw) in lines)
                {
                    if (item.DeliveredQuantity <= 0)
                        item.DeliveredQuantity = DecimalRounding.ToDb(qtyRaw);

                    var qty = qtyRaw;
                    var price = item.ReceivedUnitPrice ?? item.UnitPrice;
                    var uom = string.IsNullOrWhiteSpace(item.ComponentUom)
                        ? item.Unit
                        : item.ComponentUom.Trim();

                    var parent = await db.Ingredients.FirstOrDefaultAsync(ingredient =>
                            ingredient.ComponentId == item.ComponentId
                            && (order.CompanyId == null
                                || ingredient.CompanyId == null
                                || ingredient.CompanyId == order.CompanyId),
                        cancellationToken);

                    decimal documentAmount = 0m;
                    decimal roundingResidual = 0m;
                    if (parent is not null)
                    {
                        var inbound = IngredientUomBridge.ToInboundPrincipal(
                            parent,
                            qty,
                            uom,
                            price,
                            item.VendorProductId,
                            string.IsNullOrWhiteSpace(item.Unit) ? item.DeliveryPackage : item.Unit);
                        qty = inbound.Quantity;
                        uom = inbound.Uom;
                        price = inbound.UnitPrice;
                        documentAmount = inbound.DocumentAmount;
                        roundingResidual = inbound.RoundingResidual;
                    }
                    else
                    {
                        documentAmount = DecimalRounding.ToDb(qty * price);
                    }

                    if (parent is not null && splitUse.ReadConfig(parent) is not null)
                    {
                        await splitUse.PostInboundAsync(
                            parent,
                            qty,
                            uom,
                            price,
                            order.OrderDate,
                            receiptCreatedAt,
                            order.Id,
                            item.Id,
                            order.CompanyId,
                            locationIdsJson,
                            locationExternalId,
                            "purchase-order",
                            item.Id,
                            PurchaseOrderWorkflow.StockRemarkReceivedPending,
                            documentAmount,
                            roundingResidual,
                            cancellationToken);
                        continue;
                    }

                    db.InventoryPurchases.Add(new InventoryPurchase
                    {
                        ComponentId = item.ComponentId,
                        ComponentName = string.IsNullOrWhiteSpace(item.ComponentName)
                            ? item.Name
                            : item.ComponentName,
                        Quantity = qty,
                        Uom = uom,
                        UnitPrice = price,
                        DocumentAmount = documentAmount,
                        RoundingResidual = roundingResidual,
                        DateOrdered = order.OrderDate,
                        DateCreatedInStock = receiptCreatedAt,
                        PurchaseOrderId = order.Id,
                        PurchaseOrderItemId = item.Id,
                        ProductExpiryDate = (item.ProductExpiryDate ?? string.Empty).Trim(),
                        Remarks = PurchaseOrderWorkflow.StockRemarkReceivedPending,
                        CompanyId = order.CompanyId,
                        LocationIdsJson = locationIdsJson,
                        LocationExternalId = locationExternalId,
                    });
                }

                await db.SaveChangesAsync(cancellationToken);

                var receiptPurchases = await db.InventoryPurchases
                    .Where(p => p.PurchaseOrderId == order.Id && p.DateCreatedInStock == receiptCreatedAt)
                    .ToListAsync(cancellationToken);
                foreach (var purchase in receiptPurchases)
                    await fifoBatches.RecordReceiptFromPurchaseAsync(purchase, cancellationToken);

                await transaction.CommitAsync(cancellationToken);
                healed++;
                logger.LogInformation(
                    "Healed missing received stock for PO {PoNumber} (id {OrderId}) — {LineCount} line(s).",
                    order.PoNumber,
                    order.Id,
                    lines.Count);
            }
            catch (Exception ex)
            {
                logger.LogError(
                    ex,
                    "Failed healing received stock for PO {PoNumber} (id {OrderId}).",
                    order.PoNumber,
                    order.Id);
            }
        }

        return healed;
    }

    /// <summary>
    /// Rewrites inbound rows that were posted as delivery packages instead of
    /// packages × tagged principal (PCU). Safe for BBQ Sauce-style tags (e.g. 6 tub × 3790 Gr).
    /// </summary>
    async Task<int> HealUnderConvertedAsync(CancellationToken cancellationToken)
    {
        var purchases = await db.InventoryPurchases
            .Where(p => p.PurchaseOrderId > 0 && p.PurchaseOrderItemId > 0)
            .OrderByDescending(p => p.Id)
            .Take(500)
            .ToListAsync(cancellationToken);

        if (purchases.Count == 0)
            return 0;

        var itemIds = purchases.Select(p => p.PurchaseOrderItemId).Distinct().ToList();
        var items = await db.PurchaseOrderItems.AsNoTracking()
            .Where(i => itemIds.Contains(i.Id))
            .ToDictionaryAsync(i => i.Id, cancellationToken);

        var componentIds = purchases
            .Select(p => p.ComponentId)
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        var ingredients = await db.Ingredients
            .Where(i => componentIds.Contains(i.ComponentId))
            .ToListAsync(cancellationToken);

        var rewritten = 0;
        var rewrittenPurchaseIds = new List<int>();
        foreach (var purchase in purchases)
        {
            if (!items.TryGetValue(purchase.PurchaseOrderItemId, out var item))
                continue;
            if (item.IsReturnableDeposit)
                continue;

            var ingredient = ingredients.FirstOrDefault(i =>
                string.Equals(i.ComponentId, purchase.ComponentId, StringComparison.OrdinalIgnoreCase)
                && (purchase.CompanyId is null
                    || i.CompanyId is null
                    || i.CompanyId == purchase.CompanyId));
            if (ingredient is null)
                continue;

            var linePackages = item.DeliveredQuantity > 0
                ? item.DeliveredQuantity
                : (item.ReceivedQuantity ?? item.Quantity);
            if (linePackages <= 0)
                continue;

            var deliveryUnitPrice = item.ReceivedUnitPrice ?? item.UnitPrice;
            var uom = string.IsNullOrWhiteSpace(item.ComponentUom)
                ? (string.IsNullOrWhiteSpace(ingredient.RecipeUom) ? purchase.Uom : ingredient.RecipeUom)
                : item.ComponentUom.Trim();

            // Infer this receipt's package count. Prefer the posted qty when the row
            // still carries the delivery-package unit price (partial shipments).
            decimal deliveryPackageQty;
            if (deliveryUnitPrice > 0
                && NearlyEqual(purchase.UnitPrice, deliveryUnitPrice)
                && purchase.Quantity > 0
                && purchase.Quantity <= linePackages + 0.0001m)
            {
                deliveryPackageQty = purchase.Quantity;
            }
            else if (NearlyEqual(purchase.Quantity, linePackages))
            {
                deliveryPackageQty = linePackages;
            }
            else if (purchase.Quantity > linePackages + 0.0001m)
            {
                // Already converted to PCU (qty ≫ packages) — use PO line package count.
                deliveryPackageQty = linePackages;
            }
            else
            {
                continue;
            }

            if (!IngredientUomBridge.NeedsDeliveryToPrincipalConversion(
                    ingredient,
                    purchase.Quantity,
                    purchase.UnitPrice,
                    deliveryPackageQty,
                    deliveryUnitPrice,
                    item.VendorProductId))
            {
                // Already PCU — still backfill document amount / residual when missing.
                if (purchase.DocumentAmount <= 0 && Math.Abs(purchase.RoundingResidual) <= 0.00005m)
                {
                    var tagged = IngredientUomBridge.ToInboundPrincipal(
                        ingredient,
                        deliveryPackageQty,
                        uom,
                        deliveryUnitPrice,
                        item.VendorProductId,
                        string.IsNullOrWhiteSpace(item.Unit) ? item.DeliveryPackage : item.Unit);
                    if (NearlyEqual(tagged.Quantity, purchase.Quantity))
                    {
                        purchase.DocumentAmount = tagged.DocumentAmount;
                        purchase.RoundingResidual = tagged.RoundingResidual;
                        rewritten++;
                        rewrittenPurchaseIds.Add(purchase.Id);
                    }
                }
                continue;
            }

            var inbound = IngredientUomBridge.ToInboundPrincipal(
                ingredient,
                deliveryPackageQty,
                uom,
                deliveryUnitPrice,
                item.VendorProductId,
                string.IsNullOrWhiteSpace(item.Unit) ? item.DeliveryPackage : item.Unit);

            if (NearlyEqual(inbound.Quantity, purchase.Quantity) && NearlyEqual(inbound.UnitPrice, purchase.UnitPrice)
                && UomCanonical.Equals(inbound.Uom, purchase.Uom)
                && NearlyEqual(inbound.DocumentAmount, purchase.DocumentAmount)
                && NearlyEqual(inbound.RoundingResidual, purchase.RoundingResidual))
                continue;

            purchase.Quantity = inbound.Quantity;
            purchase.UnitPrice = inbound.UnitPrice;
            purchase.Uom = inbound.Uom;
            purchase.DocumentAmount = inbound.DocumentAmount;
            purchase.RoundingResidual = inbound.RoundingResidual;
            rewritten++;
            rewrittenPurchaseIds.Add(purchase.Id);
            logger.LogInformation(
                "Rewrote under-converted stock purchase {PurchaseId} for component {ComponentId}: {Packages} pkg → {Qty} {Uom} @ {Price} (doc {Doc}, residual {Residual}).",
                purchase.Id,
                purchase.ComponentId,
                deliveryPackageQty,
                inbound.Quantity,
                inbound.Uom,
                inbound.UnitPrice,
                inbound.DocumentAmount,
                inbound.RoundingResidual);
        }

        if (rewritten > 0)
        {
            await db.SaveChangesAsync(cancellationToken);
            // Keep FIFO batches on the same PCU qty/UOM — otherwise credit notes / issues
            // still see the old package residual (e.g. Short by 3787.79 when reversing 1 tub).
            foreach (var purchase in purchases.Where(p => rewrittenPurchaseIds.Contains(p.Id)))
            {
                try
                {
                    await fifoBatches.SyncBatchFromPurchaseAsync(purchase, cancellationToken);
                }
                catch (Exception ex)
                {
                    logger.LogWarning(
                        ex,
                        "Failed syncing FIFO batch after rewriting purchase {PurchaseId}.",
                        purchase.Id);
                }
            }
        }

        return rewritten;
    }

    static bool NearlyEqual(decimal a, decimal b, decimal tolerance = 0.00015m)
        => Math.Abs(a - b) <= Math.Max(tolerance, Math.Abs(a) * 0.0001m);
}
