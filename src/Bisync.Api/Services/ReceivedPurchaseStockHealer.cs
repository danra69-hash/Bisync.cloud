using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

/// <summary>
/// Heals Received / Partially Delivered POs that never got InventoryPurchases
/// (e.g. received before receive-posts-stock policy). Posts pending-consolidation stock
/// so ops on-hand appears on the Stock Card.
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

                    if (parent is not null)
                        (qty, uom) = IngredientUomBridge.ToInventoryPreferred(parent, qty, uom);

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
                            PurchaseOrderWorkflow.StockRemarkReceivedPending);
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
}
