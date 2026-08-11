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
    /// When set (stock-card detail), create any missing purchases for that component
    /// and rewrite every under-converted purchase for that component.
    /// </param>
    public async Task<int> HealMissingReceivedStockAsync(
        CancellationToken cancellationToken = default,
        bool fullScan = false,
        string? componentId = null)
    {
        var missingHealed = await HealMissingAsync(fullScan, cancellationToken);
        // Stock-card detail: also create any missing purchases for THIS component
        // (global newest-120 page can miss an older BBQ line while sibling lines posted).
        if (!string.IsNullOrWhiteSpace(componentId))
            missingHealed += await HealMissingForComponentAsync(componentId.Trim(), cancellationToken);
        var rewritten = await HealUnderConvertedAsync(fullScan, cancellationToken);
        if (!string.IsNullOrWhiteSpace(componentId))
            rewritten += await HealUnderConvertedForComponentAsync(componentId.Trim(), cancellationToken);
        return missingHealed + rewritten;
    }

    /// <summary>
    /// Creates InventoryPurchases for received PO lines of <paramref name="componentId"/>
    /// that still have no purchase row (partial/legacy receive gaps).
    /// </summary>
    async Task<int> HealMissingForComponentAsync(string componentId, CancellationToken cancellationToken)
    {
        var unpostedItemIds = await db.PurchaseOrderItems.AsNoTracking()
            .Where(i =>
                i.ComponentId == componentId
                && !i.IsReturnableDeposit
                && (i.DeliveredQuantity > 0 || (i.ReceivedQuantity ?? 0m) > 0))
            .Where(i => !db.InventoryPurchases.Any(p =>
                p.PurchaseOrderItemId == i.Id && p.PurchaseOrderItemId > 0))
            .Select(i => i.PurchaseOrderId)
            .Distinct()
            .ToListAsync(cancellationToken);

        if (unpostedItemIds.Count == 0)
            return 0;

        var eligibleOrderIds = await db.PurchaseOrders.AsNoTracking()
            .Where(o =>
                unpostedItemIds.Contains(o.Id)
                && (o.Status == PurchaseOrderWorkflow.StatusReceived
                    || o.Status == PurchaseOrderWorkflow.StatusPartiallyDelivered
                    || o.Status == PurchaseOrderWorkflow.StatusReconciled)
                && !o.IsPreCommitted)
            .OrderByDescending(o => o.Id)
            .Select(o => o.Id)
            .Take(200)
            .ToListAsync(cancellationToken);

        if (eligibleOrderIds.Count == 0)
            return 0;

        // Reuse page healer by temporarily scoping candidates — process these order ids directly.
        return await HealMissingOrdersAsync(eligibleOrderIds, cancellationToken);
    }

    async Task<int> HealMissingAsync(bool fullScan, CancellationToken cancellationToken)
    {
        // Newest first so recent receives (BBQ / multi-line POs) heal before ancient backlog.
        // fullScan pages until drained; opportunistic stock-card opens take one page.
        const int pageSize = 120;
        var totalHealed = 0;
        var guard = 0;
        while (guard++ < (fullScan ? 40 : 1))
        {
            var pageHealed = await HealMissingPageAsync(pageSize, cancellationToken);
            totalHealed += pageHealed;
            if (!fullScan || pageHealed == 0)
                break;
        }

        return totalHealed;
    }

    async Task<int> HealMissingPageAsync(int take, CancellationToken cancellationToken)
    {
        // 1) Received POs with no InventoryPurchases at all (legacy receive-before-stock).
        var fullyMissingIds = await db.PurchaseOrders.AsNoTracking()
            .Where(o =>
                (o.Status == PurchaseOrderWorkflow.StatusReceived
                    || o.Status == PurchaseOrderWorkflow.StatusPartiallyDelivered
                    || o.Status == PurchaseOrderWorkflow.StatusReconciled)
                && !o.IsPreCommitted)
            .Where(o => !db.InventoryPurchases.Any(p => p.PurchaseOrderId == o.Id))
            .OrderByDescending(o => o.Id)
            .Select(o => o.Id)
            .Take(take)
            .ToListAsync(cancellationToken);

        // 2) Received POs where some lines posted but others never did.
        var partialCandidateIds = await db.PurchaseOrders.AsNoTracking()
            .Where(o =>
                (o.Status == PurchaseOrderWorkflow.StatusReceived
                    || o.Status == PurchaseOrderWorkflow.StatusPartiallyDelivered
                    || o.Status == PurchaseOrderWorkflow.StatusReconciled)
                && !o.IsPreCommitted)
            .Where(o => db.InventoryPurchases.Any(p => p.PurchaseOrderId == o.Id))
            .OrderByDescending(o => o.Id)
            .Select(o => o.Id)
            .Take(take)
            .ToListAsync(cancellationToken);

        var orderIds = fullyMissingIds
            .Concat(partialCandidateIds)
            .Distinct()
            .OrderByDescending(id => id)
            .Take(take)
            .ToList();

        return await HealMissingOrdersAsync(orderIds, cancellationToken);
    }

    async Task<int> HealMissingOrdersAsync(List<int> orderIds, CancellationToken cancellationToken)
    {
        if (orderIds.Count == 0)
            return 0;

        var candidates = await db.PurchaseOrders
            .Include(o => o.Items)
            .Where(o => orderIds.Contains(o.Id))
            .ToListAsync(cancellationToken);

        var postedItemIds = await db.InventoryPurchases.AsNoTracking()
            .Where(p => orderIds.Contains(p.PurchaseOrderId) && p.PurchaseOrderItemId > 0)
            .Select(p => p.PurchaseOrderItemId)
            .Distinct()
            .ToListAsync(cancellationToken);
        var postedItemIdSet = postedItemIds.ToHashSet();

        var healed = 0;
        foreach (var order in candidates.OrderByDescending(o => o.Id))
        {
            var lines = order.Items
                .Where(i => !i.IsReturnableDeposit)
                .Where(i => !postedItemIdSet.Contains(i.Id))
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
                        postedItemIdSet.Add(item.Id);
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
                    postedItemIdSet.Add(item.Id);
                }

                await db.SaveChangesAsync(cancellationToken);

                var healedItemIds = lines.Select(l => l.Item.Id).ToList();
                var receiptPurchases = await db.InventoryPurchases
                    .Where(p => p.PurchaseOrderId == order.Id && healedItemIds.Contains(p.PurchaseOrderItemId))
                    .ToListAsync(cancellationToken);
                foreach (var purchase in receiptPurchases)
                    await fifoBatches.RecordReceiptFromPurchaseAsync(purchase, cancellationToken);

                await transaction.CommitAsync(cancellationToken);
                healed += lines.Count;
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

            // CN-settled freebies keep PO delivery price at 0 but already carry a revalued
            // unit price on the purchase — preserve extended value across PCU conversion.
            var preserveRevalued = deliveryUnitPrice <= StockCardFifoEngine.QtyEpsilon
                && purchase.UnitPrice > StockCardFifoEngine.QtyEpsilon
                && purchase.Quantity > 0
                && inbound.Quantity > 0;
            var revaluedUnitPrice = preserveRevalued
                ? DecimalRounding.ToDb((purchase.Quantity * purchase.UnitPrice) / inbound.Quantity)
                : inbound.UnitPrice;
            var revaluedDocument = preserveRevalued
                ? DecimalRounding.ToDb(purchase.Quantity * purchase.UnitPrice)
                : inbound.DocumentAmount;
            var revaluedResidual = preserveRevalued
                ? DecimalRounding.ToDb((inbound.Quantity * revaluedUnitPrice) - revaluedDocument)
                : inbound.RoundingResidual;

            if (NearlyEqual(inbound.Quantity, purchase.Quantity) && NearlyEqual(revaluedUnitPrice, purchase.UnitPrice)
                && UomCanonical.Equals(inbound.Uom, purchase.Uom)
                && NearlyEqual(revaluedDocument, purchase.DocumentAmount)
                && NearlyEqual(revaluedResidual, purchase.RoundingResidual))
                continue;

            purchase.Quantity = inbound.Quantity;
            purchase.UnitPrice = revaluedUnitPrice;
            purchase.Uom = inbound.Uom;
            purchase.DocumentAmount = revaluedDocument;
            purchase.RoundingResidual = revaluedResidual;
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
