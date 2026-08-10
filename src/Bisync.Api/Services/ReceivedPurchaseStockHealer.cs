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
    /// <param name="fullScan">
    /// When true (startup), walk all PO-linked purchases in pages.
    /// When false (stock-card list), only heal the newest page for low latency.
    /// </param>
    /// <param name="componentId">
    /// When set (stock-card detail), also rewrite every under-converted purchase for that component.
    /// </param>
    public async Task<int> HealMissingReceivedStockAsync(
        CancellationToken cancellationToken = default,
        bool fullScan = false,
        string? componentId = null)
    {
        var missingHealed = await HealMissingAsync(cancellationToken);
        var rewritten = await HealUnderConvertedAsync(fullScan, cancellationToken);
        if (!string.IsNullOrWhiteSpace(componentId))
            rewritten += await HealUnderConvertedForComponentAsync(componentId.Trim(), cancellationToken);
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
                    var deliveryBasis = string.IsNullOrWhiteSpace(item.Unit)
                        ? item.DeliveryPackage
                        : item.Unit;
                    var uom = string.IsNullOrWhiteSpace(deliveryBasis)
                        ? (string.IsNullOrWhiteSpace(item.ComponentUom) ? item.Unit : item.ComponentUom.Trim())
                        : deliveryBasis.Trim();

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
                        var (pathPrincipal, pathPrincipalUom) = await ResolveDeliveryPathPrincipalAsync(
                            parent,
                            item.VendorProductId,
                            deliveryBasis,
                            cancellationToken);
                        var inbound = IngredientUomBridge.ToInboundPrincipal(
                            parent,
                            qty,
                            uom,
                            price,
                            item.VendorProductId,
                            deliveryBasis,
                            pathPrincipal,
                            pathPrincipalUom);
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
    /// Processes in pages until a full pass finds nothing left to rewrite.
    /// </summary>
    async Task<int> HealUnderConvertedAsync(bool fullScan, CancellationToken cancellationToken)
    {
        const int pageSize = 500;
        if (!fullScan)
        {
            // Newest first — fixes recent bad receives when opening Stock Card list.
            return await HealPurchaseListAsync(
                await db.InventoryPurchases
                    .Where(p => p.PurchaseOrderId > 0 && p.PurchaseOrderItemId > 0)
                    .OrderByDescending(p => p.Id)
                    .Take(pageSize)
                    .ToListAsync(cancellationToken),
                cancellationToken);
        }

        var totalRewritten = 0;
        var offset = 0;
        while (offset < 20_000)
        {
            var page = await db.InventoryPurchases
                .Where(p => p.PurchaseOrderId > 0 && p.PurchaseOrderItemId > 0)
                .OrderBy(p => p.Id)
                .Skip(offset)
                .Take(pageSize)
                .ToListAsync(cancellationToken);
            if (page.Count == 0)
                break;
            totalRewritten += await HealPurchaseListAsync(page, cancellationToken);
            if (page.Count < pageSize)
                break;
            offset += pageSize;
        }

        return totalRewritten;
    }

    async Task<int> HealUnderConvertedForComponentAsync(
        string componentId,
        CancellationToken cancellationToken)
    {
        var purchases = await db.InventoryPurchases
            .Where(p =>
                p.PurchaseOrderId > 0
                && p.PurchaseOrderItemId > 0
                && p.ComponentId == componentId)
            .OrderBy(p => p.Id)
            .ToListAsync(cancellationToken);
        return await HealPurchaseListAsync(purchases, cancellationToken);
    }

    async Task<int> HealPurchaseListAsync(
        List<InventoryPurchase> purchases,
        CancellationToken cancellationToken)
    {
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

        var vendorProductIds = items.Values
            .Select(i => i.VendorProductId)
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        var vendorProducts = vendorProductIds.Count == 0
            ? new Dictionary<string, VendorProduct>(StringComparer.OrdinalIgnoreCase)
            : await db.VendorProducts.AsNoTracking()
                .Where(v => vendorProductIds.Contains(v.ExternalId))
                .ToDictionaryAsync(v => v.ExternalId, StringComparer.OrdinalIgnoreCase, cancellationToken);

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
            var deliveryBasis = string.IsNullOrWhiteSpace(item.Unit)
                ? item.DeliveryPackage
                : item.Unit;
            var uom = !string.IsNullOrWhiteSpace(deliveryBasis)
                ? deliveryBasis.Trim()
                : (string.IsNullOrWhiteSpace(item.ComponentUom)
                    ? (string.IsNullOrWhiteSpace(ingredient.RecipeUom) ? purchase.Uom : ingredient.RecipeUom)
                    : item.ComponentUom.Trim());

            decimal? pathPrincipal = null;
            string? pathPrincipalUom = null;
            var vpId = (item.VendorProductId ?? string.Empty).Trim();
            if (!string.IsNullOrEmpty(vpId)
                && vendorProducts.TryGetValue(vpId, out var vendorProduct)
                && DeliveryPrincipalResolver.TryResolveFromVendorProduct(
                    vendorProduct,
                    ingredient,
                    out var resolvedPrincipal,
                    out var resolvedUom))
            {
                pathPrincipal = resolvedPrincipal;
                pathPrincipalUom = resolvedUom;
            }
            else if (DeliveryPrincipalResolver.TryResolveFromDeliveryPath(
                         deliveryBasis,
                         ingredient,
                         out var pathFromLabel,
                         out var pathFromLabelUom))
            {
                pathPrincipal = pathFromLabel;
                pathPrincipalUom = pathFromLabelUom;
            }

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
            else if (deliveryUnitPrice > 0
                     && purchase.Quantity > 0
                     && purchase.Quantity < linePackages
                     && NearlyEqual(purchase.Quantity * purchase.UnitPrice, purchase.Quantity * deliveryUnitPrice))
            {
                deliveryPackageQty = purchase.Quantity;
            }
            else
            {
                // Partial receipt stored under-converted with PCU-ish price — still heal from posted qty.
                deliveryPackageQty = purchase.Quantity;
            }

            if (!IngredientUomBridge.NeedsDeliveryToPrincipalConversion(
                    ingredient,
                    purchase.Quantity,
                    purchase.UnitPrice,
                    deliveryPackageQty,
                    deliveryUnitPrice,
                    item.VendorProductId,
                    pathPrincipal,
                    pathPrincipalUom))
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
                        deliveryBasis,
                        pathPrincipal,
                        pathPrincipalUom);
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
                deliveryBasis,
                pathPrincipal,
                pathPrincipalUom);

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

    async Task<(decimal? Principal, string? Uom)> ResolveDeliveryPathPrincipalAsync(
        Ingredient ingredient,
        string? vendorProductId,
        string? deliveryBasis,
        CancellationToken cancellationToken)
    {
        var vpId = (vendorProductId ?? string.Empty).Trim();
        if (!string.IsNullOrEmpty(vpId))
        {
            var vendorProduct = await db.VendorProducts.AsNoTracking()
                .FirstOrDefaultAsync(v => v.ExternalId == vpId, cancellationToken);
            if (DeliveryPrincipalResolver.TryResolveFromVendorProduct(
                    vendorProduct,
                    ingredient,
                    out var resolvedPrincipal,
                    out var resolvedUom))
                return (resolvedPrincipal, resolvedUom);
        }

        if (DeliveryPrincipalResolver.TryResolveFromDeliveryPath(
                deliveryBasis,
                ingredient,
                out var pathPrincipal,
                out var pathUom))
            return (pathPrincipal, pathUom);

        return (null, null);
    }

    static bool NearlyEqual(decimal a, decimal b, decimal tolerance = 0.00015m)
        => Math.Abs(a - b) <= Math.Max(tolerance, Math.Abs(a) * 0.0001m);
}
