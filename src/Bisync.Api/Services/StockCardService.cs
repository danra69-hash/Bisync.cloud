using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

public class StockCardService(BisyncDbContext db)
{
    public async Task<IReadOnlyList<StockCardListRow>> ListAsync(
        int? companyId,
        IReadOnlyList<string> locationIds,
        string? itemTypeFilter,
        string uomMode,
        CancellationToken cancellationToken = default)
    {
        if (locationIds.Count == 0)
            return [];

        var rows = new List<StockCardListRow>();
        var mode = NormalizeUomMode(uomMode);

        var ingredients = await db.Ingredients.AsNoTracking()
            .Where(i => i.Active)
            .OrderBy(i => i.Group)
            .ThenBy(i => i.Name)
            .ToListAsync(cancellationToken);

        if (ShouldInclude(itemTypeFilter, "component"))
        {
            foreach (var ingredient in ingredients)
            {
                if (!MatchesIngredientLocations(ingredient, locationIds))
                    continue;

                var displayUom = ResolveComponentUom(ingredient, mode);
                var summary = await SummarizeComponentAsync(
                    ingredient,
                    displayUom,
                    locationIds,
                    companyId,
                    cancellationToken);

                rows.Add(new StockCardListRow
                {
                    ItemType = "component",
                    ItemKey = ingredient.ComponentId,
                    Group = ingredient.Group,
                    Name = ingredient.Name,
                    InboundQty = summary.InboundQty,
                    OutboundQty = summary.OutboundQty,
                    AdjustmentQty = summary.AdjustmentQty,
                    OnHandQty = summary.OnHandQty,
                    AverageCogs = summary.AverageCogs,
                    Uom = displayUom,
                    RecipeUom = ingredient.RecipeUom,
                    InventoryUom = ingredient.InventoryUom,
                });
            }
        }

        IQueryable<Product> productQuery = db.Products.AsNoTracking().Where(p => p.Active);
        if (companyId is int cid)
            productQuery = productQuery.Where(p => p.CompanyId == null || p.CompanyId == cid);

        var products = await productQuery
            .OrderBy(p => p.Group)
            .ThenBy(p => p.Name)
            .ToListAsync(cancellationToken);

        foreach (var product in products)
        {
            if (!MatchesProductLocations(product, locationIds))
                continue;

            if (product.IsSubProduct)
            {
                if (!ShouldInclude(itemTypeFilter, "sub-product"))
                    continue;

                var displayUom = ResolveProductUom(product);
                var summary = await SummarizeProductAsync(product.Id, locationIds, cancellationToken);
                rows.Add(new StockCardListRow
                {
                    ItemType = "sub-product",
                    ItemKey = product.Id.ToString(),
                    Group = product.Group,
                    Name = product.Name,
                    InboundQty = summary.InboundQty,
                    OutboundQty = summary.OutboundQty,
                    AdjustmentQty = summary.AdjustmentQty,
                    OnHandQty = summary.OnHandQty,
                    AverageCogs = product.IsSubProduct && product.YieldQuantity > 0
                        ? Math.Round(product.TotalCost / product.YieldQuantity, 4)
                        : product.TotalCost,
                    Uom = displayUom,
                    RecipeUom = product.YieldUom,
                    InventoryUom = product.YieldUom,
                });
                continue;
            }

            if (!ShouldInclude(itemTypeFilter, "product"))
                continue;

            if (product.PosEnabled && !product.B2bEnabled && !product.B2cEnabled)
                continue;

            var productUom = ResolveProductUom(product);
            var productSummary = await SummarizeProductAsync(product.Id, locationIds, cancellationToken);
            rows.Add(new StockCardListRow
            {
                ItemType = "product",
                ItemKey = product.Id.ToString(),
                Group = product.Group,
                Name = product.Name,
                InboundQty = productSummary.InboundQty,
                OutboundQty = productSummary.OutboundQty,
                AdjustmentQty = productSummary.AdjustmentQty,
                OnHandQty = productSummary.OnHandQty,
                AverageCogs = product.Rrp > 0 ? product.Rrp : product.TotalCost,
                Uom = productUom,
                RecipeUom = product.B2bPackageUnit,
                InventoryUom = product.B2bPackageUnit,
            });
        }

        return rows;
    }

    public async Task<StockCardDetail?> GetDetailAsync(
        string itemType,
        string itemKey,
        int? companyId,
        IReadOnlyList<string> locationIds,
        string uomMode,
        string period,
        CancellationToken cancellationToken = default)
    {
        if (locationIds.Count == 0)
            return null;

        var periodStart = ResolvePeriodStart(period);
        var mode = NormalizeUomMode(uomMode);
        var normalizedType = itemType.Trim().ToLowerInvariant();

        if (normalizedType is "component" or "smart-component" or "smart component")
        {
            var ingredient = await db.Ingredients.AsNoTracking()
                .FirstOrDefaultAsync(i => i.ComponentId == itemKey, cancellationToken);
            if (ingredient is null)
                return null;

            var displayUom = ResolveComponentUom(ingredient, mode);
            var fifoResult = await BuildComponentFifoResultAsync(
                ingredient,
                displayUom,
                locationIds,
                companyId,
                cancellationToken);
            var entries = fifoResult.Events.Select(MapFifoToLedgerEntry).ToList();

            return BuildDetail(
                "component",
                itemKey,
                ingredient.Group,
                ingredient.Name,
                displayUom,
                ingredient.RecipeUom,
                ingredient.InventoryUom,
                entries,
                periodStart,
                fifoResult.AverageCogs);
        }

        if (!int.TryParse(itemKey, out var productId))
            return null;

        var product = await db.Products.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == productId, cancellationToken);
        if (product is null)
            return null;

        if (companyId is int cid && product.CompanyId is not null && product.CompanyId != cid)
            return null;

        if (!MatchesProductLocations(product, locationIds))
            return null;

        var typeLabel = product.IsSubProduct ? "sub-product" : "product";
        if (product.IsSubProduct && !ShouldInclude(typeLabel, "sub-product"))
            return null;
        if (!product.IsSubProduct && product.PosEnabled && !product.B2bEnabled && !product.B2cEnabled)
            return null;

        var productUom = ResolveProductUom(product);
        var productEntries = await BuildProductLedgerAsync(
            product,
            locationIds,
            periodStart,
            cancellationToken);

        return BuildDetail(
            typeLabel,
            itemKey,
            product.Group,
            product.Name,
            productUom,
            product.IsSubProduct ? product.YieldUom : product.B2bPackageUnit,
            product.IsSubProduct ? product.YieldUom : product.B2bPackageUnit,
            productEntries,
            periodStart,
            product.IsSubProduct && product.YieldQuantity > 0
                ? Math.Round(product.TotalCost / product.YieldQuantity, 4)
                : product.TotalCost);
    }

    static StockCardDetail BuildDetail(
        string itemType,
        string itemKey,
        string group,
        string name,
        string uom,
        string recipeUom,
        string inventoryUom,
        List<StockCardLedgerEntry> entries,
        DateTime periodStart,
        decimal currentAverageCogs)
    {
        var beforePeriod = periodStart == DateTime.MinValue
            ? []
            : entries.Where(e => e.OccurredAt < periodStart).ToList();
        var inPeriod = periodStart == DateTime.MinValue
            ? entries.OrderBy(e => e.OccurredAt).ThenBy(e => e.Id).ToList()
            : entries.Where(e => e.OccurredAt >= periodStart).OrderBy(e => e.OccurredAt).ThenBy(e => e.Id).ToList();

        var balanceForward = beforePeriod.Count > 0
            ? beforePeriod[^1].RunningBalance
            : 0m;
        var running = balanceForward;
        var ledger = new List<StockCardLedgerEntry>();

        if (periodStart != DateTime.MinValue)
        {
            ledger.Add(new StockCardLedgerEntry
            {
                Id = 0,
                OccurredAt = periodStart,
                EntryType = "balance_forward",
                Quantity = Math.Abs(balanceForward),
                SignedQty = balanceForward,
                Uom = uom,
                UnitPrice = currentAverageCogs,
                Reason = "B/F from previous period end inventory (FIFO)",
                RunningBalance = balanceForward,
                AverageCogsAfter = beforePeriod.Count > 0 ? beforePeriod[^1].AverageCogsAfter : currentAverageCogs,
                FifoPolicy = "FIFO",
            });
        }

        foreach (var entry in inPeriod)
        {
            running += entry.SignedQty;
            ledger.Add(entry with { RunningBalance = running });
        }

        var inbound = inPeriod.Where(e => IsInboundSummaryType(e.EntryType)).Sum(e => e.Quantity);
        var outbound = inPeriod.Where(e => IsOutboundSummaryType(e.EntryType)).Sum(e => e.Quantity);
        var adjustment = inPeriod
            .Where(e => e.EntryType is "adjustment_in" or "adjustment_out" or "adjustment")
            .Sum(e => e.SignedQty);

        return new StockCardDetail
        {
            ItemType = itemType,
            ItemKey = itemKey,
            Group = group,
            Name = name,
            Uom = uom,
            RecipeUom = recipeUom,
            InventoryUom = inventoryUom,
            BalanceForward = balanceForward,
            InboundQty = inbound,
            OutboundQty = outbound,
            AdjustmentQty = adjustment,
            OnHandQty = running,
            AverageCogs = currentAverageCogs,
            FifoPolicy = "FIFO",
            PeriodStart = periodStart,
            Entries = ledger,
        };
    }

    static bool IsInboundSummaryType(string entryType) =>
        entryType is "purchase" or "cash_purchase" or "transfer_in" or "adjustment_in" or "inbound";

    static bool IsOutboundSummaryType(string entryType) =>
        entryType is "production" or "pos_sale" or "online_order" or "offline_order" or "wastage" or "transfer_out" or "adjustment_out" or "outbound";

    static StockCardLedgerEntry MapFifoToLedgerEntry(FifoEnrichedEvent enriched) =>
        new()
        {
            Id = enriched.Event.Id,
            OccurredAt = enriched.Event.OccurredAt,
            EntryType = enriched.Event.EntryType,
            Quantity = enriched.Event.Quantity,
            SignedQty = enriched.Event.SignedQty,
            Uom = enriched.Event.Uom,
            UnitPrice = enriched.UnitPrice,
            Reason = enriched.Event.Reason,
            ReferenceNumber = enriched.Event.ReferenceNumber,
            FifoDetail = enriched.FifoDetail,
            RunningBalance = enriched.RunningBalance,
            AverageCogsAfter = enriched.AverageCogsAfter,
            FifoPolicy = "FIFO",
        };

    async Task<StockMovementSummary> SummarizeComponentAsync(
        Ingredient ingredient,
        string displayUom,
        IReadOnlyList<string> locationIds,
        int? companyId,
        CancellationToken cancellationToken)
    {
        var normalizedUom = NormalizeUom(displayUom);
        var purchases = await db.InventoryPurchases.AsNoTracking()
            .Where(p => p.ComponentId == ingredient.ComponentId)
            .ToListAsync(cancellationToken);

        if (companyId is int cid)
            purchases = purchases.Where(p => p.CompanyId is null || p.CompanyId == cid).ToList();

        var inboundPurchase = purchases
            .Where(p => LocationMatchesAny(p.LocationIdsJson, locationIds))
            .Where(p => NormalizeUom(p.Uom) == normalizedUom)
            .Sum(p => p.Quantity);

        var movements = await db.InventoryMovements.AsNoTracking()
            .Where(m => m.ComponentId == ingredient.ComponentId && locationIds.Contains(m.LocationExternalId))
            .ToListAsync(cancellationToken);

        if (companyId is int companyFilter)
            movements = movements.Where(m => m.CompanyId is null || m.CompanyId == companyFilter).ToList();

        movements = movements.Where(m => NormalizeUom(m.Uom) == normalizedUom).ToList();

        var onHand = inboundPurchase + movements.Sum(m => m.QtyDelta);
        var fifoResult = await BuildComponentFifoResultAsync(
            ingredient,
            displayUom,
            locationIds,
            companyId,
            cancellationToken,
            purchases,
            movements);

        var inboundMove = movements.Where(m => m.QtyDelta > 0 && !IsAdjustmentMovement(m)).Sum(m => m.QtyDelta);
        var outbound = movements.Where(m => m.QtyDelta < 0 && !IsAdjustmentMovement(m)).Sum(m => -m.QtyDelta);
        var adjustment = movements.Where(m => IsAdjustmentMovement(m)).Sum(m => m.QtyDelta);

        return new StockMovementSummary
        {
            InboundQty = inboundPurchase + inboundMove,
            OutboundQty = outbound,
            AdjustmentQty = adjustment,
            OnHandQty = onHand,
            AverageCogs = fifoResult.AverageCogs,
        };
    }

    async Task<StockMovementSummary> SummarizeProductAsync(
        int productId,
        IReadOnlyList<string> locationIds,
        CancellationToken cancellationToken)
    {
        var stockRows = await db.ProductB2bLocationStocks.AsNoTracking()
            .Where(s => s.ProductId == productId && locationIds.Contains(s.LocationExternalId))
            .ToListAsync(cancellationToken);

        var logs = await db.ProductProductionLogs.AsNoTracking()
            .Where(l => l.ProductId == productId)
            .ToListAsync(cancellationToken);

        logs = logs.Where(l => LogMatchesAnyLocation(l.LocationIdsJson, locationIds)).ToList();

        var inbound = logs.Where(l => string.Equals(l.EntryType, "produced", StringComparison.OrdinalIgnoreCase))
            .Sum(l => l.Quantity);
        var outbound = 0m;
        var adjustment = 0m;
        var onHand = stockRows.Sum(s => s.InStock);

        return new StockMovementSummary
        {
            InboundQty = inbound,
            OutboundQty = outbound,
            AdjustmentQty = adjustment,
            OnHandQty = onHand,
        };
    }

    async Task<FifoSimulationResult> BuildComponentFifoResultAsync(
        Ingredient ingredient,
        string displayUom,
        IReadOnlyList<string> locationIds,
        int? companyId,
        CancellationToken cancellationToken,
        List<InventoryPurchase>? purchasesOverride = null,
        List<InventoryMovement>? movementsOverride = null)
    {
        var normalizedUom = NormalizeUom(displayUom);
        var purchases = purchasesOverride ?? await db.InventoryPurchases.AsNoTracking()
            .Where(p => p.ComponentId == ingredient.ComponentId)
            .ToListAsync(cancellationToken);

        if (companyId is int cid)
            purchases = purchases.Where(p => p.CompanyId is null || p.CompanyId == cid).ToList();

        var poIds = purchases.Where(p => p.PurchaseOrderId > 0).Select(p => p.PurchaseOrderId).Distinct().ToList();
        var poNumbers = poIds.Count == 0
            ? new Dictionary<int, string>()
            : await db.PurchaseOrders.AsNoTracking()
                .Where(p => poIds.Contains(p.Id))
                .ToDictionaryAsync(p => p.Id, p => p.PoNumber, cancellationToken);

        var events = new List<FifoEvent>();

        foreach (var purchase in purchases)
        {
            if (!LocationMatchesAny(purchase.LocationIdsJson, locationIds))
                continue;
            if (NormalizeUom(purchase.Uom) != normalizedUom)
                continue;

            var entryType = purchase.PurchaseOrderId > 0 ? "purchase" : "cash_purchase";
            var poNumber = purchase.PurchaseOrderId > 0 && poNumbers.TryGetValue(purchase.PurchaseOrderId, out var num)
                ? num
                : string.Empty;

            events.Add(new FifoEvent
            {
                Id = purchase.Id,
                OccurredAt = purchase.DateCreatedInStock,
                EntryType = entryType,
                Quantity = purchase.Quantity,
                SignedQty = purchase.Quantity,
                Uom = purchase.Uom,
                UnitPrice = purchase.UnitPrice,
                Reason = entryType == "purchase"
                    ? $"Purchase received — PO {poNumber}"
                    : "Cash purchase",
                ReferenceNumber = poNumber,
                SourceLabel = entryType == "purchase" ? $"PO {poNumber}" : "Cash purchase",
            });
        }

        var movements = movementsOverride ?? await db.InventoryMovements.AsNoTracking()
            .Where(m => m.ComponentId == ingredient.ComponentId && locationIds.Contains(m.LocationExternalId))
            .ToListAsync(cancellationToken);

        if (companyId is int companyFilter)
            movements = movements.Where(m => m.CompanyId is null || m.CompanyId == companyFilter).ToList();

        var productionProducts = await LoadProductionProductsForMovementsAsync(movements, cancellationToken);

        foreach (var movement in movements.Where(m => NormalizeUom(m.Uom) == normalizedUom))
        {
            var entryType = ClassifyMovementEntryType(movement);
            var qty = Math.Abs(movement.QtyDelta);
            var productionProduct = TryResolveProductionProduct(movement, productionProducts);
            events.Add(new FifoEvent
            {
                Id = movement.Id,
                OccurredAt = movement.CreatedAt,
                EntryType = entryType,
                Quantity = qty,
                SignedQty = movement.QtyDelta,
                Uom = movement.Uom,
                UnitPrice = movement.UnitPrice > 0
                    ? movement.UnitPrice
                    : ResolveComponentFallbackPrice(ingredient, displayUom),
                Reason = FormatMovementReason(movement, productionProduct),
                ReferenceNumber = ResolveMovementReferenceNumber(movement, productionProduct),
                SourceLabel = entryType,
            });
        }

        return StockCardFifoEngine.Simulate(events);
    }

    async Task<List<StockCardLedgerEntry>> BuildProductLedgerAsync(
        Product product,
        IReadOnlyList<string> locationIds,
        DateTime periodStart,
        CancellationToken cancellationToken)
    {
        var entries = new List<StockCardLedgerEntry>();
        var logs = await db.ProductProductionLogs.AsNoTracking()
            .Where(l => l.ProductId == product.Id)
            .OrderBy(l => l.CreatedAt)
            .ToListAsync(cancellationToken);

        foreach (var log in logs.Where(l => LogMatchesAnyLocation(l.LocationIdsJson, locationIds)))
        {
            if (string.Equals(log.EntryType, "produced", StringComparison.OrdinalIgnoreCase))
            {
                var occurredAt = ParseProductionDate(log.ProductionDate) ?? log.CreatedAt;
                entries.Add(new StockCardLedgerEntry
                {
                    Id = log.Id,
                    OccurredAt = occurredAt,
                    EntryType = "inbound",
                    Quantity = log.Quantity,
                    SignedQty = log.Quantity,
                    Uom = ResolveProductUom(product),
                    UnitPrice = product.IsSubProduct
                        ? (product.YieldQuantity > 0 ? product.TotalCost / product.YieldQuantity : product.TotalCost)
                        : product.Rrp,
                    Reason = string.IsNullOrWhiteSpace(log.BatchNumber)
                        ? "Production recorded"
                        : $"Production batch {log.BatchNumber}",
                });
                continue;
            }

            if (IsProductSaleEntryType(log.EntryType))
            {
                entries.Add(new StockCardLedgerEntry
                {
                    Id = log.Id,
                    OccurredAt = log.CreatedAt,
                    EntryType = log.EntryType.Trim().ToLowerInvariant(),
                    Quantity = log.Quantity,
                    SignedQty = -log.Quantity,
                    Uom = ResolveProductUom(product),
                    UnitPrice = product.IsSubProduct && product.YieldQuantity > 0
                        ? product.TotalCost / product.YieldQuantity
                        : product.TotalCost,
                    Reason = FormatProductSaleReason(log.EntryType, product.Name),
                });
            }
        }

        return entries;
    }

    static bool IsProductSaleEntryType(string entryType)
    {
        var normalized = entryType.Trim().ToLowerInvariant();
        return normalized is "pos_sale" or "online_order" or "offline_order";
    }

    static string FormatProductSaleReason(string entryType, string productName)
    {
        return entryType.Trim().ToLowerInvariant() switch
        {
            "online_order" => $"Online order — {productName}",
            "offline_order" => $"Offline order — {productName}",
            _ => $"POS sales — {productName}",
        };
    }

    static string ClassifyMovementEntryType(InventoryMovement movement)
    {
        var refType = movement.ReferenceType.Trim().ToLowerInvariant();
        var reason = movement.Reason.Trim().ToLowerInvariant();

        if (refType == "transfer_in" || reason.Contains("transfer in"))
            return "transfer_in";
        if (refType == "transfer_out" || reason.Contains("transfer out"))
            return "transfer_out";
        if (refType == "pos_sale" || reason.Contains("pos sale"))
            return "pos_sale";
        if (refType == "online_order" || reason.Contains("online order"))
            return "online_order";
        if (refType == "offline_order" || reason.Contains("offline order"))
            return "offline_order";
        if (refType == "wastage" || reason.Contains("wastage") || reason.Contains("spoilage"))
            return "wastage";
        if (refType == "inventory_adjustment" || IsAdjustmentMovement(movement))
            return movement.QtyDelta >= 0 ? "adjustment_in" : "adjustment_out";
        if (reason.Contains("production") || refType is "production" or "sub_product_batch")
            return "production";

        return movement.QtyDelta >= 0 ? "inbound" : "outbound";
    }

    static bool IsAdjustmentMovement(InventoryMovement movement)
    {
        var refType = movement.ReferenceType.Trim().ToLowerInvariant();
        return refType == "inventory_adjustment" || IsAdjustmentReason(movement.Reason);
    }

    static string FormatMovementReason(InventoryMovement movement, Product? productionProduct = null)
    {
        if (productionProduct is not null && ShouldEnrichProductionReason(movement))
            return FormatProductionDeductionReason(productionProduct, movement);

        if (!string.IsNullOrWhiteSpace(movement.Reason))
            return movement.Reason.Replace('_', ' ');

        return ClassifyMovementEntryType(movement) switch
        {
            "transfer_in" => "Transfer in",
            "transfer_out" => "Transfer out",
            "pos_sale" => "POS sales depletion",
            "online_order" => "Online order sales depletion",
            "offline_order" => "Offline order sales depletion",
            "wastage" => "Wastage",
            "production" => productionProduct is null
                ? "Production"
                : FormatProductionDeductionReason(productionProduct, movement),
            "adjustment_in" => "Inventory adjustment (inbound)",
            "adjustment_out" => "Inventory adjustment (outbound)",
            _ => string.IsNullOrWhiteSpace(movement.ReferenceType) ? "Stock movement" : movement.ReferenceType.Replace('_', ' '),
        };
    }

    static bool ShouldEnrichProductionReason(InventoryMovement movement)
    {
        if (ClassifyMovementEntryType(movement) != "production")
            return false;

        if (string.IsNullOrWhiteSpace(movement.Reason))
            return true;

        var normalized = movement.Reason.Trim().ToLowerInvariant().Replace('_', ' ');
        return normalized is "production"
            or "production override"
            or "batch edit"
            or "batch edit override";
    }

    static string FormatProductionDeductionReason(Product product, InventoryMovement movement)
    {
        var kind = product.IsSubProduct ? "Sub-product" : "Product";
        var codeSuffix = string.IsNullOrWhiteSpace(product.ProductId)
            ? string.Empty
            : $" ({product.ProductId.Trim()})";
        var reason = movement.Reason.Trim().ToLowerInvariant().Replace('_', ' ');
        var overrideStock = reason.Contains("override", StringComparison.Ordinal);
        var batchEdit = reason.Contains("batch", StringComparison.Ordinal);

        return batchEdit switch
        {
            true when overrideStock =>
                $"Production batch adjustment (override) — {product.Name.Trim()}{codeSuffix} ({kind})",
            true =>
                $"Production batch adjustment — {product.Name.Trim()}{codeSuffix} ({kind})",
            _ when overrideStock =>
                $"Production override — {product.Name.Trim()}{codeSuffix} ({kind})",
            _ =>
                $"Production — {product.Name.Trim()}{codeSuffix} ({kind})",
        };
    }

    static Product? TryResolveProductionProduct(
        InventoryMovement movement,
        IReadOnlyDictionary<int, Product> productionProducts)
    {
        if (movement.ReferenceId <= 0 || productionProducts.Count == 0)
            return null;

        return productionProducts.TryGetValue(movement.ReferenceId, out var product)
            ? product
            : null;
    }

    static string ResolveMovementReferenceNumber(InventoryMovement movement, Product? productionProduct)
    {
        if (productionProduct is not null && !string.IsNullOrWhiteSpace(productionProduct.ProductId))
            return productionProduct.ProductId.Trim();

        return movement.ReferenceId > 0 ? movement.ReferenceId.ToString() : string.Empty;
    }

    async Task<Dictionary<int, Product>> LoadProductionProductsForMovementsAsync(
        IReadOnlyList<InventoryMovement> movements,
        CancellationToken cancellationToken)
    {
        var productIds = new HashSet<int>();
        var batchLogIds = new List<int>();

        foreach (var movement in movements)
        {
            if (ClassifyMovementEntryType(movement) != "production" && !IsProductionBatchReturn(movement))
                continue;
            if (movement.ReferenceId <= 0)
                continue;

            if (IsProductionBatchReturn(movement))
                batchLogIds.Add(movement.ReferenceId);
            else
                productIds.Add(movement.ReferenceId);
        }

        if (productIds.Count == 0 && batchLogIds.Count == 0)
            return new Dictionary<int, Product>();

        var products = productIds.Count == 0
            ? new Dictionary<int, Product>()
            : await db.Products.AsNoTracking()
                .Where(p => productIds.Contains(p.Id))
                .ToDictionaryAsync(p => p.Id, cancellationToken);

        var unresolvedReferenceIds = productIds.Where(id => !products.ContainsKey(id)).ToList();
        unresolvedReferenceIds.AddRange(batchLogIds);

        if (unresolvedReferenceIds.Count > 0)
        {
            var logs = await db.ProductProductionLogs.AsNoTracking()
                .Where(l => unresolvedReferenceIds.Contains(l.Id))
                .Select(l => new { l.Id, l.ProductId })
                .ToListAsync(cancellationToken);

            var missingProductIds = logs
                .Select(l => l.ProductId)
                .Distinct()
                .Where(id => !products.ContainsKey(id))
                .ToList();

            if (missingProductIds.Count > 0)
            {
                var extraProducts = await db.Products.AsNoTracking()
                    .Where(p => missingProductIds.Contains(p.Id))
                    .ToDictionaryAsync(p => p.Id, cancellationToken);

                foreach (var pair in extraProducts)
                    products[pair.Key] = pair.Value;
            }

            foreach (var log in logs)
            {
                if (products.TryGetValue(log.ProductId, out var product))
                    products[log.Id] = product;
            }
        }

        return products;
    }

    static bool IsProductionBatchReturn(InventoryMovement movement)
        => movement.ReferenceType.Trim().Equals("production_batch", StringComparison.OrdinalIgnoreCase);

    static bool IsAdjustmentReason(string reason)
        => reason.Contains("adjust", StringComparison.OrdinalIgnoreCase);

    static decimal ResolveComponentFallbackPrice(Ingredient ingredient, string displayUom)
    {
        var normalized = NormalizeUom(displayUom);
        var recipe = NormalizeUom(ingredient.RecipeUom);
        if (normalized == recipe)
            return ingredient.LastPriceRecipe;
        return ingredient.LastPriceInventory;
    }

    static string ResolveComponentUom(Ingredient ingredient, string mode)
        => string.Equals(mode, "recipe", StringComparison.OrdinalIgnoreCase)
            ? ingredient.RecipeUom
            : ingredient.InventoryUom;

    static string ResolveProductUom(Product product)
    {
        if (product.IsSubProduct && product.YieldQuantity > 0 && !string.IsNullOrWhiteSpace(product.YieldUom))
        {
            var qty = product.YieldQuantity % 1 == 0
                ? product.YieldQuantity.ToString("0")
                : product.YieldQuantity.ToString("0.##");
            return $"{qty} {product.YieldUom.Trim()}";
        }

        return string.IsNullOrWhiteSpace(product.B2bPackageUnit) ? "pcs" : product.B2bPackageUnit.Trim();
    }

    static string NormalizeUomMode(string uomMode)
        => string.Equals(uomMode, "recipe", StringComparison.OrdinalIgnoreCase) ? "recipe" : "inventory";

    static string NormalizeUom(string uom) => uom.Trim().ToUpperInvariant();

    static bool ShouldInclude(string? itemTypeFilter, string itemType)
    {
        if (string.IsNullOrWhiteSpace(itemTypeFilter) || itemTypeFilter.Equals("all", StringComparison.OrdinalIgnoreCase))
            return true;
        return itemTypeFilter.Replace(' ', '-').Equals(itemType, StringComparison.OrdinalIgnoreCase);
    }

    static bool MatchesIngredientLocations(Ingredient ingredient, IReadOnlyList<string> locationIds)
    {
        var locs = PurchaseOrderWorkflow.DeserializeLocationIds(ingredient.LocationsJson);
        return LocationListMatches(locs, locationIds);
    }

    static bool MatchesProductLocations(Product product, IReadOnlyList<string> locationIds)
    {
        var locs = PurchaseOrderWorkflow.DeserializeLocationIds(product.LocationIdsJson);
        return LocationListMatches(locs, locationIds);
    }

    static bool LocationMatchesAny(string locationIdsJson, IReadOnlyList<string> locationIds)
    {
        var locs = PurchaseOrderWorkflow.DeserializeLocationIds(locationIdsJson);
        return LocationListMatches(locs, locationIds);
    }

    static bool LocationListMatches(IReadOnlyList<string> itemLocations, IReadOnlyList<string> selectedLocations)
    {
        if (itemLocations.Count == 0)
            return true;
        if (itemLocations.Any(l => l.Equals("all", StringComparison.OrdinalIgnoreCase)))
            return true;
        return selectedLocations.Any(itemLocations.Contains);
    }

    static bool LogMatchesAnyLocation(string locationIdsJson, IReadOnlyList<string> locationIds)
    {
        try
        {
            var locs = System.Text.Json.JsonSerializer.Deserialize<List<string>>(locationIdsJson) ?? [];
            if (locs.Count == 0)
                return true;
            return locationIds.Any(locs.Contains);
        }
        catch
        {
            return true;
        }
    }

    static DateTime ResolvePeriodStart(string period)
    {
        if (string.Equals(period, "all", StringComparison.OrdinalIgnoreCase))
            return DateTime.MinValue;

        var now = DateTime.UtcNow;
        if (string.Equals(period, "week", StringComparison.OrdinalIgnoreCase))
        {
            var diff = (7 + (now.DayOfWeek - DayOfWeek.Monday)) % 7;
            var monday = now.Date.AddDays(-diff);
            return monday;
        }

        return new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
    }

    static DateTime? ParseProductionDate(string productionDate)
    {
        if (string.IsNullOrWhiteSpace(productionDate))
            return null;
        if (DateOnly.TryParse(productionDate.Trim(), out var parsed))
            return parsed.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        return null;
    }
}

public sealed class StockMovementSummary
{
    public decimal InboundQty { get; init; }
    public decimal OutboundQty { get; init; }
    public decimal AdjustmentQty { get; init; }
    public decimal OnHandQty { get; init; }
    public decimal AverageCogs { get; init; }
}

public sealed class StockCardListRow
{
    public string ItemType { get; init; } = string.Empty;
    public string ItemKey { get; init; } = string.Empty;
    public string Group { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public decimal InboundQty { get; init; }
    public decimal OutboundQty { get; init; }
    public decimal AdjustmentQty { get; init; }
    public decimal OnHandQty { get; init; }
    public decimal AverageCogs { get; init; }
    public string Uom { get; init; } = string.Empty;
    public string RecipeUom { get; init; } = string.Empty;
    public string InventoryUom { get; init; } = string.Empty;
}

public sealed class StockCardDetail
{
    public string ItemType { get; init; } = string.Empty;
    public string ItemKey { get; init; } = string.Empty;
    public string Group { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string Uom { get; init; } = string.Empty;
    public string RecipeUom { get; init; } = string.Empty;
    public string InventoryUom { get; init; } = string.Empty;
    public decimal BalanceForward { get; init; }
    public decimal InboundQty { get; init; }
    public decimal OutboundQty { get; init; }
    public decimal AdjustmentQty { get; init; }
    public decimal OnHandQty { get; init; }
    public decimal AverageCogs { get; init; }
    public string FifoPolicy { get; init; } = "FIFO";
    public DateTime PeriodStart { get; init; }
    public IReadOnlyList<StockCardLedgerEntry> Entries { get; init; } = [];
}

public sealed record StockCardLedgerEntry
{
    public int Id { get; init; }
    public DateTime OccurredAt { get; init; }
    public string EntryType { get; init; } = string.Empty;
    public decimal Quantity { get; init; }
    public decimal SignedQty { get; init; }
    public string Uom { get; init; } = string.Empty;
    public decimal UnitPrice { get; init; }
    public string Reason { get; init; } = string.Empty;
    public string ReferenceNumber { get; init; } = string.Empty;
    public string FifoDetail { get; init; } = string.Empty;
    public decimal RunningBalance { get; init; }
    public decimal AverageCogsAfter { get; init; }
    public string FifoPolicy { get; init; } = "FIFO";
}
