using System.Globalization;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

public class StockCardService(
    BisyncDbContext db,
    ComponentStockService componentStock,
    ComponentFifoCostingService fifoCosting)
{
    public async Task<IReadOnlyList<StockCardListRow>> ListAsync(
        int? companyId,
        IReadOnlyList<string> locationIds,
        string? itemTypeFilter,
        string uomMode,
        string? period = null,
        CancellationToken cancellationToken = default)
    {
        if (locationIds.Count == 0)
            return [];

        var stockPeriod = await ResolvePeriodAsync(period, companyId, cancellationToken);
        var rows = new List<StockCardListRow>();
        var mode = NormalizeUomMode(uomMode);

        var ingredients = await db.Ingredients.AsNoTracking()
            .Where(i => i.Active)
            .OrderBy(i => i.Group)
            .ThenBy(i => i.Name)
            .ToListAsync(cancellationToken);

        if (ShouldInclude(itemTypeFilter, "component"))
        {
            var visibleIngredients = ingredients
                .Where(i => MatchesIngredientLocations(i, locationIds))
                .ToList();

            // Also surface components that already have inbound stock at the selected locations,
            // even when the ingredient catalog location filter would exclude them (common after receive).
            var purchasedComponentIds = await db.InventoryPurchases.AsNoTracking()
                .Where(p => p.DateCreatedInStock >= stockPeriod.ArchiveCutoff
                    && p.DateCreatedInStock <= stockPeriod.PeriodEnd
                    && (companyId == null || p.CompanyId == null || p.CompanyId == companyId))
                .Select(p => new { p.ComponentId, p.LocationIdsJson, p.LocationExternalId })
                .ToListAsync(cancellationToken);
            var purchasedAtLocation = purchasedComponentIds
                .Where(p =>
                    StockLocationRules.PurchaseMatchesAny(p.LocationIdsJson, locationIds)
                    || (!string.IsNullOrWhiteSpace(p.LocationExternalId)
                        && locationIds.Any(id => id.Equals(p.LocationExternalId, StringComparison.OrdinalIgnoreCase))))
                .Select(p => p.ComponentId)
                .Where(id => !string.IsNullOrWhiteSpace(id))
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
            if (purchasedAtLocation.Count > 0)
            {
                foreach (var ingredient in ingredients)
                {
                    if (!purchasedAtLocation.Contains(ingredient.ComponentId))
                        continue;
                    if (visibleIngredients.Any(v =>
                            v.ComponentId.Equals(ingredient.ComponentId, StringComparison.OrdinalIgnoreCase)))
                        continue;
                    visibleIngredients.Add(ingredient);
                }
            }

            var componentIds = visibleIngredients.Select(i => i.ComponentId).ToList();

            // Batch-load purchases/movements for all components at once to avoid N+1 round-trips.
            var allPurchases = componentIds.Count == 0
                ? new List<InventoryPurchase>()
                : await db.InventoryPurchases.AsNoTracking()
                    .Where(p => componentIds.Contains(p.ComponentId)
                        && p.DateCreatedInStock >= stockPeriod.ArchiveCutoff
                        && p.DateCreatedInStock <= stockPeriod.PeriodEnd)
                    .ToListAsync(cancellationToken);
            var allMovements = componentIds.Count == 0
                ? new List<InventoryMovement>()
                : await db.InventoryMovements.AsNoTracking()
                    .Where(m => componentIds.Contains(m.ComponentId)
                        && m.CreatedAt >= stockPeriod.ArchiveCutoff
                        && m.CreatedAt <= stockPeriod.PeriodEnd)
                    .ToListAsync(cancellationToken);

            var purchasesByComponent = allPurchases.ToLookup(p => p.ComponentId);
            var movementsByComponent = allMovements.ToLookup(m => m.ComponentId);

            var poIds = allPurchases
                .Where(p => p.PurchaseOrderId > 0)
                .Select(p => p.PurchaseOrderId)
                .Distinct()
                .ToList();
            var poNumbers = poIds.Count == 0
                ? new Dictionary<int, string>()
                : await db.PurchaseOrders.AsNoTracking()
                    .Where(p => poIds.Contains(p.Id))
                    .ToDictionaryAsync(p => p.Id, p => p.PoNumber, cancellationToken);
            var productionProducts = await LoadProductionProductsForMovementsAsync(allMovements, cancellationToken);

            foreach (var ingredient in visibleIngredients)
            {
                var displayUom = ResolveComponentUom(ingredient, mode);
                var summary = await SummarizeComponentAsync(
                    ingredient,
                    displayUom,
                    locationIds,
                    companyId,
                    stockPeriod,
                    purchasesByComponent[ingredient.ComponentId].ToList(),
                    movementsByComponent[ingredient.ComponentId].ToList(),
                    poNumbers,
                    productionProducts,
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
                    OnHandAverageCogs = summary.OnHandAverageCogs,
                    Uom = displayUom,
                    RecipeUom = ingredient.RecipeUom,
                    InventoryUom = ingredient.InventoryUom,
                    LastChangedAt = ResolveComponentLastChangedAt(
                        purchasesByComponent[ingredient.ComponentId],
                        movementsByComponent[ingredient.ComponentId],
                        locationIds,
                        companyId),
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

        var visibleProducts = products
            .Where(p => MatchesProductLocations(p, locationIds))
            .ToList();
        var productIds = visibleProducts.Select(p => p.Id).ToList();

        // Batch-load production logs for all products at once to avoid N+1 round-trips.
        var allLogs = productIds.Count == 0
            ? new List<ProductProductionLog>()
            : await db.ProductProductionLogs.AsNoTracking()
                .Where(l => productIds.Contains(l.ProductId))
                .OrderBy(l => l.CreatedAt)
                .ThenBy(l => l.Id)
                .ToListAsync(cancellationToken);
        var logsByProduct = allLogs.ToLookup(l => l.ProductId);

        foreach (var product in visibleProducts)
        {
            if (product.IsSubProduct)
            {
                if (!ShouldInclude(itemTypeFilter, "sub-product"))
                    continue;

                var displayUom = ResolveProductUom(product);
                var summary = SummarizeProduct(product, locationIds, stockPeriod, logsByProduct[product.Id].ToList());
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
                    AverageCogs = summary.AverageCogs,
                    OnHandAverageCogs = summary.OnHandAverageCogs,
                    Uom = displayUom,
                    RecipeUom = product.YieldUom,
                    InventoryUom = product.YieldUom,
                    LastChangedAt = ResolveProductLastChangedAt(
                        logsByProduct[product.Id],
                        locationIds,
                        stockPeriod),
                });
                continue;
            }

            if (!ShouldInclude(itemTypeFilter, "product"))
                continue;

            if (product.PosEnabled && !product.B2bEnabled && !product.B2cEnabled)
                continue;

            var productUom = ResolveProductUom(product);
            var productSummary = SummarizeProduct(product, locationIds, stockPeriod, logsByProduct[product.Id].ToList());
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
                AverageCogs = productSummary.AverageCogs,
                OnHandAverageCogs = productSummary.OnHandAverageCogs,
                Uom = productUom,
                RecipeUom = product.B2bPackageUnit,
                InventoryUom = product.B2bPackageUnit,
                LastChangedAt = ResolveProductLastChangedAt(
                    logsByProduct[product.Id],
                    locationIds,
                    stockPeriod),
            });
        }

        // Always list latest stock activity first for List + Card views.
        return rows
            .OrderByDescending(r => r.LastChangedAt ?? DateTime.MinValue)
            .ThenBy(r => r.Name, StringComparer.OrdinalIgnoreCase)
            .ThenBy(r => r.ItemKey, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    public async Task<StockCardDetail?> GetDetailAsync(
        string itemType,
        string itemKey,
        int? companyId,
        IReadOnlyList<string> locationIds,
        string uomMode,
        string? period = null,
        CancellationToken cancellationToken = default)
    {
        if (locationIds.Count == 0)
            return null;

        var stockPeriod = await ResolvePeriodAsync(period, companyId, cancellationToken);
        var mode = NormalizeUomMode(uomMode);
        var normalizedType = itemType.Trim().ToLowerInvariant();

        if (normalizedType is "component" or "smart-component" or "smart component")
        {
            var ingredient = await db.Ingredients.AsNoTracking()
                .FirstOrDefaultAsync(i =>
                    i.ComponentId == itemKey
                    && (companyId == null || i.CompanyId == companyId),
                    cancellationToken);
            if (ingredient is null)
                return null;

            var displayUom = ResolveComponentUom(ingredient, mode);
            var fifoResult = await BuildComponentFifoResultAsync(
                ingredient,
                displayUom,
                locationIds,
                companyId,
                stockPeriod,
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
                stockPeriod,
                fifoResult.AverageCogs,
                fifoResult.RemainingLayers);
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
        var productFifoResult = await BuildProductFifoResultAsync(
            product,
            locationIds,
            stockPeriod,
            cancellationToken);
        var productEntries = productFifoResult.Events.Select(MapFifoToLedgerEntry).ToList();

        return BuildDetail(
            typeLabel,
            itemKey,
            product.Group,
            product.Name,
            productUom,
            product.IsSubProduct ? product.YieldUom : product.B2bPackageUnit,
            product.IsSubProduct ? product.YieldUom : product.B2bPackageUnit,
            productEntries,
            stockPeriod,
            productFifoResult.AverageCogs,
            productFifoResult.RemainingLayers);
    }

    public async Task<StockCardAsOfSnapshot?> GetAsOfSnapshotAsync(
        string itemType,
        string itemKey,
        int? companyId,
        string locationExternalId,
        IReadOnlyList<string> locationIds,
        string uomMode,
        DateTime asOfDate,
        CancellationToken cancellationToken = default)
    {
        if (locationIds.Count == 0 || string.IsNullOrWhiteSpace(locationExternalId))
            return null;

        var asOfEnd = EndOfUtcDay(asOfDate);
        var archiveCutoff = DateTime.UtcNow.Date.AddYears(-HistoryRetentionYears);
        if (asOfEnd < archiveCutoff)
            return null;

        var normalizedType = itemType.Trim().ToLowerInvariant();
        var mode = NormalizeUomMode(uomMode);

        if (normalizedType is "component" or "smart-component" or "smart component")
        {
            var ingredient = await db.Ingredients.AsNoTracking()
                .FirstOrDefaultAsync(i =>
                    i.ComponentId == itemKey
                    && (companyId == null || i.CompanyId == companyId),
                    cancellationToken);
            if (ingredient is null)
                return null;

            var displayUom = ResolveComponentUom(ingredient, mode);
            var period = BuildOpenEndedPeriod(asOfEnd);
            var events = await BuildComponentFifoEventsAsync(
                ingredient,
                displayUom,
                [locationExternalId],
                companyId,
                period,
                cancellationToken);
            var filtered = events.Where(e => e.OccurredAt <= asOfEnd).ToList();
            var snapshot = StockCardFifoEngine.Simulate(filtered);
            var suggestedAdjustmentInUnitPrice = StockCardFifoEngine.ResolveAdjustmentInUnitPriceAsOf(
                events,
                asOfEnd);

            return new StockCardAsOfSnapshot
            {
                AsOfDate = DateOnly.FromDateTime(asOfEnd),
                LocationExternalId = locationExternalId,
                Uom = displayUom,
                OnHandQty = snapshot.OnHandQty,
                Layers = MapOnHandLayers(snapshot.RemainingLayers),
                SuggestedAdjustmentInUnitPrice = suggestedAdjustmentInUnitPrice,
            };
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

        var productUom = ResolveProductUom(product);
        var productPeriod = BuildOpenEndedPeriod(asOfEnd);
        var productEvents = await BuildProductFifoEventsAsync(
            product,
            [locationExternalId],
            productPeriod,
            cancellationToken);
        var productFiltered = productEvents.Where(e => e.OccurredAt <= asOfEnd).ToList();
        var productSnapshot = StockCardFifoEngine.Simulate(productFiltered);
        var suggestedProductAdjustmentInUnitPrice = StockCardFifoEngine.ResolveAdjustmentInUnitPriceAsOf(
            productEvents,
            asOfEnd);

        return new StockCardAsOfSnapshot
        {
            AsOfDate = DateOnly.FromDateTime(asOfEnd),
            LocationExternalId = locationExternalId,
            Uom = productUom,
            OnHandQty = productSnapshot.OnHandQty,
            Layers = MapOnHandLayers(productSnapshot.RemainingLayers),
            SuggestedAdjustmentInUnitPrice = suggestedProductAdjustmentInUnitPrice,
        };
    }

    public async Task<StockCardAdjustmentResult> CreateAdjustmentAsync(
        string itemType,
        string itemKey,
        int? companyId,
        string locationExternalId,
        IReadOnlyList<string> locationIds,
        string uomMode,
        DateOnly adjustmentDate,
        decimal quantity,
        string direction,
        string reason,
        string? inboundUom = null,
        decimal? inboundUnitPrice = null,
        bool allowNegativeStock = false,
        CancellationToken cancellationToken = default)
    {
        if (locationIds.Count == 0 || string.IsNullOrWhiteSpace(locationExternalId))
            return StockCardAdjustmentResult.Fail("Select a location.");

        if (!locationIds.Contains(locationExternalId, StringComparer.OrdinalIgnoreCase))
            return StockCardAdjustmentResult.Fail("Selected location is not in the current filter.");

        if (quantity <= 0)
            return StockCardAdjustmentResult.Fail("Quantity must be greater than zero.");

        var trimmedReason = reason.Trim();
        if (string.IsNullOrWhiteSpace(trimmedReason))
            return StockCardAdjustmentResult.Fail("Reason is required.");

        var isInbound = direction.Trim().Equals("in", StringComparison.OrdinalIgnoreCase)
            || direction.Trim().Equals("+", StringComparison.OrdinalIgnoreCase);
        var isOutbound = direction.Trim().Equals("out", StringComparison.OrdinalIgnoreCase)
            || direction.Trim().Equals("-", StringComparison.OrdinalIgnoreCase);
        if (!isInbound && !isOutbound)
            return StockCardAdjustmentResult.Fail("Direction must be in or out.");

        var signedQty = isInbound ? quantity : -quantity;
        var asOfEnd = EndOfUtcDay(adjustmentDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc));
        var archiveCutoff = DateTime.UtcNow.Date.AddYears(-HistoryRetentionYears);
        if (asOfEnd < archiveCutoff)
            return StockCardAdjustmentResult.Fail("Adjustment date is outside the retained history window.");
        // Compare calendar dates — end-of-day is always > UtcNow until midnight, which wrongly
        // blocked same-day adjustments for the entire day.
        if (adjustmentDate > DateOnly.FromDateTime(DateTime.UtcNow))
            return StockCardAdjustmentResult.Fail("Adjustment date cannot be in the future.");

        var normalizedType = itemType.Trim().ToLowerInvariant();
        var occurredAt = asOfEnd;
        var productionDate = adjustmentDate.ToString("yyyy-MM-dd");

        if (normalizedType is "component" or "smart-component" or "smart component")
        {
            var ingredient = await db.Ingredients.AsNoTracking()
                .FirstOrDefaultAsync(i => i.ComponentId == itemKey, cancellationToken);
            if (ingredient is null)
                return StockCardAdjustmentResult.Fail("Component not found.");

            var displayUom = ResolveComponentUom(ingredient, NormalizeUomMode(uomMode));
            var snapshot = await GetAsOfSnapshotAsync(
                itemType,
                itemKey,
                companyId,
                locationExternalId,
                locationIds,
                uomMode,
                adjustmentDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc),
                cancellationToken);
            if (snapshot is null)
                return StockCardAdjustmentResult.Fail("Unable to resolve stock for the selected date.");

            if (!isInbound && !allowNegativeStock && quantity > snapshot.OnHandQty)
                return StockCardAdjustmentResult.Fail($"Cannot deplete {quantity} {displayUom}. Only {snapshot.OnHandQty} on hand on that date.");

            var reasonText = trimmedReason.StartsWith("Inventory Adjustment", StringComparison.OrdinalIgnoreCase)
                ? trimmedReason
                : $"Inventory adjustment — {trimmedReason}";
            if (isInbound)
            {
                var inboundUomResolved = ResolveInboundAdjustmentUom(
                    ingredient.RecipeUom,
                    ingredient.InventoryUom,
                    displayUom,
                    inboundUom);
                if (inboundUomResolved is null)
                    return StockCardAdjustmentResult.Fail("Select a valid UOM for this component.");

                var resolvedInboundPrice = inboundUnitPrice is decimal asserted && asserted > 0
                    ? StockCardFifoEngine.RoundUnitPrice(asserted)
                    : StockCardFifoEngine.ResolveLifoAverageUnitPrice(
                        snapshot.Layers.Select(l => (l.Quantity, l.UnitPrice, l.SortOrder)).ToList(),
                        quantity);

                componentStock.RecordAddition(
                    ingredient.ComponentId,
                    ingredient.Name,
                    locationExternalId,
                    quantity,
                    inboundUomResolved,
                    reasonText,
                    "inventory_adjustment",
                    referenceId: 0,
                    companyId,
                    occurredAt,
                    unitPrice: resolvedInboundPrice);
            }
            else
            {
                var unitPrice = await fifoCosting.ResolveOutboundUnitPriceAsOfAsync(
                    ingredient.ComponentId,
                    locationExternalId,
                    displayUom,
                    quantity,
                    companyId,
                    asOfEnd,
                    cancellationToken);

                await componentStock.RecordDeductionAsync(
                    ingredient.ComponentId,
                    ingredient.Name,
                    locationExternalId,
                    quantity,
                    displayUom,
                    reasonText,
                    "inventory_adjustment",
                    referenceId: 0,
                    companyId,
                    cancellationToken,
                    occurredAt,
                    unitPrice);
            }

            await db.SaveChangesAsync(cancellationToken);
            return StockCardAdjustmentResult.Ok();
        }

        if (!int.TryParse(itemKey, out var productId))
            return StockCardAdjustmentResult.Fail("Invalid product key.");

        var product = await db.Products.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == productId, cancellationToken);
        if (product is null)
            return StockCardAdjustmentResult.Fail("Product not found.");

        if (companyId is int productCompanyId && product.CompanyId is not null && product.CompanyId != productCompanyId)
            return StockCardAdjustmentResult.Fail("Product not found for this company.");

        if (!MatchesProductLocations(product, locationIds))
            return StockCardAdjustmentResult.Fail("Product is not available at the selected locations.");

        var productSnapshot = await GetAsOfSnapshotAsync(
            itemType,
            itemKey,
            companyId,
            locationExternalId,
            locationIds,
            uomMode,
            adjustmentDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc),
            cancellationToken);
        if (productSnapshot is null)
            return StockCardAdjustmentResult.Fail("Unable to resolve stock for the selected date.");

        if (!isInbound && !allowNegativeStock && quantity > productSnapshot.OnHandQty)
            return StockCardAdjustmentResult.Fail($"Cannot deplete {quantity} {productSnapshot.Uom}. Only {productSnapshot.OnHandQty} on hand on that date.");

        var entryType = isInbound ? "adjustment_in" : "adjustment_out";
        var productUom = ResolveProductUom(product);
        if (isInbound && !string.IsNullOrWhiteSpace(inboundUom)
            && !string.Equals(NormalizeUom(inboundUom), NormalizeUom(productUom), StringComparison.OrdinalIgnoreCase))
            return StockCardAdjustmentResult.Fail("UOM does not match this product.");

        var productInboundPrice = isInbound
            ? (inboundUnitPrice is decimal pAsserted && pAsserted > 0
                ? StockCardFifoEngine.RoundUnitPrice(pAsserted)
                : StockCardFifoEngine.ResolveLifoAverageUnitPrice(
                    productSnapshot.Layers.Select(l => (l.Quantity, l.UnitPrice, l.SortOrder)).ToList(),
                    quantity))
            : 0m;

        db.ProductProductionLogs.Add(new ProductProductionLog
        {
            ProductId = product.Id,
            EntryType = entryType,
            Quantity = quantity,
            ProductionDate = productionDate,
            BatchNumber = trimmedReason,
            UnitPrice = productInboundPrice,
            LocationIdsJson = System.Text.Json.JsonSerializer.Serialize(new[] { locationExternalId }),
            CompanyId = product.CompanyId,
            CreatedAt = occurredAt,
        });

        await ApplyProductLocationStockDeltaAsync(product.Id, locationExternalId, signedQty, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        return StockCardAdjustmentResult.Ok();
    }

    async Task ApplyProductLocationStockDeltaAsync(
        int productId,
        string locationExternalId,
        decimal signedQty,
        CancellationToken cancellationToken)
    {
        var stockRow = await db.ProductB2bLocationStocks
            .FirstOrDefaultAsync(
                s => s.ProductId == productId && s.LocationExternalId == locationExternalId,
                cancellationToken);

        if (stockRow is null)
        {
            db.ProductB2bLocationStocks.Add(new ProductB2bLocationStock
            {
                ProductId = productId,
                LocationExternalId = locationExternalId,
                InStock = signedQty,
                UpdatedAt = DateTime.UtcNow,
            });
            return;
        }

        // Allow negative finished-goods balances (oversell → priced when inbound arrives).
        stockRow.InStock += signedQty;
        stockRow.UpdatedAt = DateTime.UtcNow;
    }

    static StockCardPeriod BuildOpenEndedPeriod(DateTime asOfEnd)
    {
        var monthStart = new DateTime(asOfEnd.Year, asOfEnd.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var archiveCutoff = DateTime.UtcNow.Date.AddYears(-HistoryRetentionYears);
        return new StockCardPeriod(
            $"{monthStart:yyyy-MM}",
            monthStart,
            asOfEnd,
            archiveCutoff,
            monthStart.Year == DateTime.UtcNow.Year && monthStart.Month == DateTime.UtcNow.Month);
    }

    static DateTime EndOfUtcDay(DateTime date)
    {
        var day = date.Kind == DateTimeKind.Utc ? date.Date : date.ToUniversalTime().Date;
        return day.AddDays(1).AddTicks(-1);
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
        StockCardPeriod period,
        decimal currentAverageCogs,
        IReadOnlyList<FifoLayer>? remainingLayers = null)
    {
        var eligibleOrdered = entries
            .Where(e => e.OccurredAt >= period.ArchiveCutoff && e.OccurredAt <= period.PeriodEnd)
            .OrderBy(e => e.OccurredAt)
            .ThenBy(e => e.Id)
            .ThenBy(e => e.SplitIndex)
            .ToList();

        decimal cumulative = 0;
        var eligible = new List<StockCardLedgerEntry>(eligibleOrdered.Count);
        foreach (var entry in eligibleOrdered)
        {
            cumulative += entry.SignedQty;
            eligible.Add(entry with { RunningBalance = cumulative });
        }

        var beforePeriod = eligible.Where(e => e.OccurredAt < period.MonthStart).ToList();
        var inPeriod = eligible
            .Where(e => e.OccurredAt >= period.MonthStart && e.OccurredAt <= period.PeriodEnd)
            .OrderBy(e => e.OccurredAt)
            .ThenBy(e => e.Id)
            .ThenBy(e => e.SplitIndex)
            .ToList();

        var balanceForward = beforePeriod.Count > 0
            ? beforePeriod[^1].RunningBalance
            : 0m;
        var balanceForwardAvgCogs = beforePeriod.Count > 0
            ? beforePeriod[^1].AverageCogsAfter
            : currentAverageCogs;
        var running = balanceForward;
        var ledger = new List<StockCardLedgerEntry>();

        var bfReason = period.CarryForwardDate is DateOnly cfDate
            ? beforePeriod.Count > 0
                ? $"B/F from physical inventory C/F ({cfDate:yyyy-MM-dd})"
                : $"B/F — physical inventory C/F ({cfDate:yyyy-MM-dd}), no prior ledger rows"
            : beforePeriod.Count > 0
                ? "B/F from previous period end inventory (FIFO)"
                : "B/F — no eligible history in the last 2 years";

        ledger.Add(new StockCardLedgerEntry
        {
            Id = 0,
            OccurredAt = period.MonthStart,
            EntryType = "balance_forward",
            Quantity = Math.Abs(balanceForward),
            SignedQty = balanceForward,
            Uom = uom,
            UnitPrice = StockCardFifoEngine.RoundUnitPrice(balanceForwardAvgCogs),
            Subtotal = balanceForward > 0
                ? RoundLineSubtotal(balanceForward, balanceForwardAvgCogs)
                : 0,
            Reason = bfReason,
            RunningBalance = balanceForward,
            AverageCogsAfter = balanceForwardAvgCogs,
            FifoPolicy = "FIFO",
            IsNegativeBalance = balanceForward < 0,
            InboundSequenceNo = balanceForward > 0 ? 0 : 0,
            OriginalQuantity = Math.Abs(balanceForward),
            DepletedQuantity = 0,
        });

        foreach (var entry in inPeriod)
        {
            running += entry.SignedQty;
            ledger.Add(entry with
            {
                RunningBalance = running,
                IsNegativeBalance = running < 0,
            });
        }

        var inbound = inPeriod.Where(e => IsInboundSummaryType(e.EntryType)).Sum(e => e.Quantity);
        var outbound = inPeriod.Where(e => IsOutboundSummaryType(e.EntryType)).Sum(e => e.Quantity);
        var adjustment = inPeriod
            .Where(e => e.EntryType is "adjustment_in" or "adjustment_out" or "adjustment")
            .Sum(e => e.SignedQty);

        var averageCogs = ComputeOutboundAveragePrice(ledger, period.MonthStart, period.PeriodEnd);
        if (averageCogs <= 0 && outbound <= 0)
            averageCogs = balanceForwardAvgCogs > 0 ? balanceForwardAvgCogs : currentAverageCogs;

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
            AverageCogs = averageCogs,
            OnHandAverageCogs = remainingLayers is { Count: > 0 }
                ? StockCardFifoEngine.ComputeAverageCogs(remainingLayers)
                : 0,
            OnHandLayers = MapOnHandLayers(remainingLayers),
            FifoPolicy = "FIFO",
            PeriodMonth = period.MonthKey,
            PeriodStart = period.MonthStart,
            PeriodEnd = period.PeriodEnd,
            ArchiveCutoff = period.ArchiveCutoff,
            IsCurrentMonth = period.IsCurrentMonth,
            HistoryRetentionYears = HistoryRetentionYears,
            HasNegativeStock = running < 0 || ledger.Any(e => e.IsShortage || e.IsNegativeBalance),
            InventoryCarryForwardDate = period.CarryForwardDate,
            Entries = ledger,
        };
    }

    static bool IsInboundSummaryType(string entryType) =>
        entryType is "purchase" or "cash_purchase" or "transfer_in" or "adjustment_in" or "inbound" or "split_use_in" or "store_hold_in";

    static bool IsOutboundSummaryType(string entryType) =>
        // split_use is composition of inbound (not a true outbound leave).
        entryType is "production" or "pos_sale" or "online_order" or "offline_order" or "wastage" or "credit_note" or "store_issue" or "transfer_out" or "adjustment_out" or "outbound";

    static decimal ComputeOutboundAveragePrice(
        IEnumerable<StockCardLedgerEntry> entries,
        DateTime periodStart,
        DateTime periodEnd)
    {
        var outbound = entries
            .Where(e => e.OccurredAt >= periodStart
                && e.OccurredAt <= periodEnd
                && IsOutboundSummaryType(e.EntryType))
            .ToList();

        if (outbound.Count == 0)
            return 0;

        // Spreadsheet logic: sum of line subtotals (qty × UOM price) ÷ total outbound qty
        var totalQty = outbound.Sum(e => e.Quantity);
        if (totalQty <= 0)
            return 0;

        var totalSubtotal = outbound.Sum(e => RoundLineSubtotal(e.Quantity, e.UnitPrice));
        return StockCardFifoEngine.RoundUnitPrice(totalSubtotal / totalQty);
    }

    static decimal RoundLineSubtotal(decimal quantity, decimal unitPrice) =>
        StockCardFifoEngine.RoundUnitPrice(quantity * StockCardFifoEngine.RoundUnitPrice(unitPrice));

    static IReadOnlyList<StockCardOnHandLayer> MapOnHandLayers(IReadOnlyList<FifoLayer>? layers)
    {
        if (layers is null || layers.Count == 0)
            return [];

        return layers
            .Where(l => l.Quantity > 0)
            .GroupBy(l => StockCardFifoEngine.RoundUnitPrice(l.UnitPrice))
            .Select(g => new StockCardOnHandLayer
            {
                Quantity = g.Sum(l => l.Quantity),
                UnitPrice = g.Key,
                SortOrder = g.Min(l => l.ReceivedAt),
            })
            .OrderBy(l => l.SortOrder)
            .ThenBy(l => l.UnitPrice)
            .ToList();
    }

    static StockCardLedgerEntry MapFifoToLedgerEntry(FifoEnrichedEvent enriched)
    {
        var unitPrice = StockCardFifoEngine.RoundUnitPrice(enriched.UnitPrice);
        var quantity = enriched.Event.Quantity;
        var pcuExtended = quantity > 0 && unitPrice > 0 ? RoundLineSubtotal(quantity, unitPrice) : 0m;
        var hasDocumentAuthority = enriched.Event.DocumentAmount > 0
            || Math.Abs(enriched.Event.RoundingResidual) > 0.00005m;
        var documentAmount = hasDocumentAuthority
            ? DecimalRounding.ToDb(enriched.Event.DocumentAmount)
            : pcuExtended;
        var roundingResidual = enriched.Event.RoundingResidual;
        // Inbound + credit-note outbound: financial subtotal = document amount (PO/CN authority).
        var isInbound = enriched.Event.SignedQty > 0
            && enriched.Event.EntryType is "purchase" or "cash_purchase" or "split_use_in" or "inbound" or "transfer_in" or "adjustment_in" or "balance_forward";
        var isCreditNoteOutbound = enriched.Event.SignedQty < 0
            && enriched.Event.EntryType == "credit_note";
        var subtotal = hasDocumentAuthority && (isInbound || isCreditNoteOutbound)
            ? documentAmount
            : pcuExtended;

        return new StockCardLedgerEntry
        {
            Id = enriched.Event.Id,
            OccurredAt = enriched.Event.OccurredAt,
            EntryType = enriched.Event.EntryType,
            Quantity = quantity,
            SignedQty = enriched.Event.SignedQty,
            Uom = enriched.Event.Uom,
            UnitPrice = unitPrice,
            Subtotal = subtotal,
            DocumentAmount = documentAmount,
            RoundingResidual = roundingResidual,
            ExtendedAtUnitPrice = pcuExtended,
            Reason = enriched.Event.Reason,
            ReferenceNumber = enriched.Event.ReferenceNumber,
            FifoDetail = enriched.FifoDetail,
            RunningBalance = enriched.RunningBalance,
            AverageCogsAfter = enriched.AverageCogsAfter,
            FifoPolicy = "FIFO",
            SplitIndex = enriched.SplitIndex,
            IsShortage = enriched.IsShortage,
            IsCogsBackfilled = enriched.IsCogsBackfilled,
            IsNegativeBalance = enriched.IsNegativeBalance,
            InboundSequenceNo = enriched.InboundSequenceNo,
            OriginalQuantity = enriched.OriginalQuantity > 0 ? enriched.OriginalQuantity : quantity,
            DepletedQuantity = enriched.DepletedQuantity,
            SourceInboundSequenceNo = enriched.SourceInboundSequenceNo,
        };
    }

    static (decimal DocumentAmount, decimal RoundingResidual) ResolvePurchaseDocumentAmounts(
        InventoryPurchase purchase,
        decimal stockQty,
        decimal stockUnitPrice,
        IReadOnlyDictionary<int, PurchaseOrderItem> poItemsById)
    {
        _ = poItemsById;
        if (purchase.DocumentAmount > 0 || Math.Abs(purchase.RoundingResidual) > 0.00005m)
            return (DecimalRounding.ToDb(purchase.DocumentAmount), DecimalRounding.ToDb(purchase.RoundingResidual));

        var fallback = stockQty > 0 && stockUnitPrice > 0
            ? DecimalRounding.ToDb(stockQty * stockUnitPrice)
            : 0m;
        return (fallback, 0m);
    }

    async Task<StockMovementSummary> SummarizeComponentAsync(
        Ingredient ingredient,
        string displayUom,
        IReadOnlyList<string> locationIds,
        int? companyId,
        StockCardPeriod period,
        List<InventoryPurchase> preloadedPurchases,
        List<InventoryMovement> preloadedMovements,
        IReadOnlyDictionary<int, string> poNumbers,
        IReadOnlyDictionary<int, Product> productionProducts,
        CancellationToken cancellationToken)
    {
        var purchases = preloadedPurchases;

        if (companyId is int cid)
            purchases = purchases.Where(p => p.CompanyId is null || p.CompanyId == cid).ToList();

        // Load PO lines so delivery-package rows (CN freebie tub) can convert to display UOM.
        var summarizeItemIds = purchases
            .Where(p => p.PurchaseOrderItemId > 0)
            .Select(p => p.PurchaseOrderItemId)
            .Distinct()
            .ToList();
        var summarizePoItems = summarizeItemIds.Count == 0
            ? new Dictionary<int, PurchaseOrderItem>()
            : await db.PurchaseOrderItems.AsNoTracking()
                .Where(i => summarizeItemIds.Contains(i.Id))
                .ToDictionaryAsync(i => i.Id, cancellationToken);

        purchases = purchases
            .Where(p => PurchaseMatchesSelectedLocations(p, locationIds))
            .Select(p =>
            {
                summarizePoItems.TryGetValue(p.PurchaseOrderItemId, out var poItem);
                return TryResolvePurchaseForDisplay(
                        ingredient,
                        p,
                        poItem,
                        displayUom,
                        out var qty,
                        out var price)
                    ? ClonePurchaseWithQty(p, qty, price, displayUom)
                    : null;
            })
            .Where(p => p is not null)
            .Select(p => p!)
            .ToList();

        var movements = preloadedMovements;

        if (companyId is int companyFilter)
            movements = movements.Where(m => m.CompanyId is null || m.CompanyId == companyFilter).ToList();

        movements = movements
            .Where(m => StockLocationRules.MovementMatchesAny(m.LocationExternalId, locationIds))
            .Where(m => CanNormalizePurchaseUom(ingredient, m.Uom, displayUom))
            .Select(m => NormalizeMovementToDisplayUom(ingredient, m, displayUom))
            .ToList();

        var fifoResult = await BuildComponentFifoResultAsync(
            ingredient,
            displayUom,
            locationIds,
            companyId,
            period,
            cancellationToken,
            purchases,
            movements,
            poNumbers,
            productionProducts);

        var monthPurchases = purchases
            .Where(p => p.DateCreatedInStock >= period.MonthStart)
            .Sum(p => p.Quantity);
        var monthMovements = movements.Where(m => m.CreatedAt >= period.MonthStart).ToList();
        var inboundMove = monthMovements.Where(m => m.QtyDelta > 0 && !IsAdjustmentMovement(m)).Sum(m => m.QtyDelta);
        var outbound = monthMovements.Where(m => m.QtyDelta < 0 && !IsAdjustmentMovement(m)).Sum(m => -m.QtyDelta);
        var adjustment = monthMovements.Where(m => IsAdjustmentMovement(m)).Sum(m => m.QtyDelta);
        var onHand = fifoResult.OnHandQty;
        var monthEntries = fifoResult.Events
            .Select(MapFifoToLedgerEntry)
            .Where(e => e.OccurredAt >= period.MonthStart && e.OccurredAt <= period.PeriodEnd)
            .ToList();
        var averageCogs = ComputeOutboundAveragePrice(monthEntries, period.MonthStart, period.PeriodEnd);
        if (averageCogs <= 0)
            averageCogs = fifoResult.AverageCogs;

        return new StockMovementSummary
        {
            InboundQty = monthPurchases + inboundMove,
            OutboundQty = outbound,
            AdjustmentQty = adjustment,
            OnHandQty = onHand,
            AverageCogs = averageCogs,
            OnHandAverageCogs = StockCardFifoEngine.ComputeAverageCogs(fifoResult.RemainingLayers),
        };
    }

    StockMovementSummary SummarizeProduct(
        Product product,
        IReadOnlyList<string> locationIds,
        StockCardPeriod period,
        List<ProductProductionLog> preloadedLogs)
    {
        var events = BuildProductFifoEvents(product, locationIds, period, preloadedLogs);
        var fifoResult = StockCardFifoEngine.Simulate(events);

        var logs = preloadedLogs
            .Where(l => LogMatchesAnyLocation(l.LocationIdsJson, locationIds))
            .Where(l =>
            {
                var occurredAt = ParseProductionDate(l.ProductionDate) ?? l.CreatedAt;
                return occurredAt >= period.ArchiveCutoff && occurredAt <= period.PeriodEnd;
            })
            .ToList();

        var monthLogs = logs.Where(l =>
        {
            var occurredAt = ParseProductionDate(l.ProductionDate) ?? l.CreatedAt;
            return occurredAt >= period.MonthStart;
        }).ToList();

        var inbound = monthLogs
            .Where(l => string.Equals(l.EntryType, "produced", StringComparison.OrdinalIgnoreCase))
            .Sum(l => l.Quantity);
        var outbound = monthLogs
            .Where(l => IsProductSaleEntryType(l.EntryType) || IsProductWastageEntryType(l.EntryType))
            .Sum(l => l.Quantity);
        var adjustment = monthLogs
            .Where(l => IsProductAdjustmentEntryType(l.EntryType))
            .Sum(l => string.Equals(l.EntryType, "adjustment_in", StringComparison.OrdinalIgnoreCase) ? l.Quantity : -l.Quantity);
        var onHand = fifoResult.OnHandQty;
        var monthEntries = fifoResult.Events
            .Select(MapFifoToLedgerEntry)
            .Where(e => e.OccurredAt >= period.MonthStart && e.OccurredAt <= period.PeriodEnd)
            .ToList();
        var averageCogs = ComputeOutboundAveragePrice(monthEntries, period.MonthStart, period.PeriodEnd);
        if (averageCogs <= 0)
            averageCogs = fifoResult.AverageCogs;

        return new StockMovementSummary
        {
            InboundQty = inbound,
            OutboundQty = outbound,
            AdjustmentQty = adjustment,
            OnHandQty = onHand,
            AverageCogs = averageCogs,
            OnHandAverageCogs = StockCardFifoEngine.ComputeAverageCogs(fifoResult.RemainingLayers),
        };
    }

    async Task<FifoSimulationResult> BuildProductFifoResultAsync(
        Product product,
        IReadOnlyList<string> locationIds,
        StockCardPeriod period,
        CancellationToken cancellationToken)
    {
        var events = await BuildProductFifoEventsAsync(product, locationIds, period, cancellationToken);
        return StockCardFifoEngine.Simulate(events);
    }

    async Task<List<FifoEvent>> BuildProductFifoEventsAsync(
        Product product,
        IReadOnlyList<string> locationIds,
        StockCardPeriod period,
        CancellationToken cancellationToken)
    {
        var logs = await db.ProductProductionLogs.AsNoTracking()
            .Where(l => l.ProductId == product.Id)
            .OrderBy(l => l.CreatedAt)
            .ThenBy(l => l.Id)
            .ToListAsync(cancellationToken);

        return BuildProductFifoEvents(product, locationIds, period, logs);
    }

    static List<FifoEvent> BuildProductFifoEvents(
        Product product,
        IReadOnlyList<string> locationIds,
        StockCardPeriod period,
        List<ProductProductionLog> logs)
    {
        var events = new List<FifoEvent>();
        var uom = ResolveProductUom(product);
        var productionUnitPrice = ResolveProductUnitPrice(product);

        foreach (var log in logs.Where(l => LogMatchesAnyLocation(l.LocationIdsJson, locationIds)))
        {
            var occurredAt = ParseProductionDate(log.ProductionDate) ?? log.CreatedAt;
            if (occurredAt < period.ArchiveCutoff || occurredAt > period.PeriodEnd)
                continue;

            if (string.Equals(log.EntryType, "produced", StringComparison.OrdinalIgnoreCase))
            {
                var inboundUnitPrice = log.UnitPrice > 0 ? log.UnitPrice : productionUnitPrice;
                events.Add(new FifoEvent
                {
                    Id = log.Id,
                    OccurredAt = occurredAt,
                    EntryType = "inbound",
                    Quantity = log.Quantity,
                    SignedQty = log.Quantity,
                    Uom = uom,
                    UnitPrice = inboundUnitPrice,
                    Reason = string.IsNullOrWhiteSpace(log.BatchNumber)
                        ? "Production recorded"
                        : $"Production batch {log.BatchNumber}",
                    ReferenceNumber = log.BatchNumber ?? string.Empty,
                    SourceLabel = "Production",
                });
                continue;
            }

            if (IsProductSaleEntryType(log.EntryType))
            {
                var entryType = log.EntryType.Trim().ToLowerInvariant();
                var saleReason = FormatProductSaleReason(entryType, product.Name, log.BatchNumber);
                var unitPrice = TryParsePrepaidUnitRpp(log.BatchNumber);
                events.Add(new FifoEvent
                {
                    Id = log.Id,
                    OccurredAt = occurredAt,
                    EntryType = entryType,
                    Quantity = log.Quantity,
                    SignedQty = -log.Quantity,
                    Uom = uom,
                    UnitPrice = unitPrice,
                    Reason = saleReason,
                    ReferenceNumber = log.BatchNumber ?? string.Empty,
                    SourceLabel = entryType,
                });
                continue;
            }

            if (IsProductWastageEntryType(log.EntryType))
            {
                events.Add(new FifoEvent
                {
                    Id = log.Id,
                    OccurredAt = occurredAt,
                    EntryType = "wastage",
                    Quantity = log.Quantity,
                    SignedQty = -log.Quantity,
                    Uom = uom,
                    UnitPrice = 0,
                    Reason = string.IsNullOrWhiteSpace(log.BatchNumber)
                        ? $"Wastage — {product.Name}"
                        : $"Wastage — {log.BatchNumber}",
                    ReferenceNumber = log.BatchNumber ?? string.Empty,
                    SourceLabel = "wastage",
                });
                continue;
            }

            if (IsProductAdjustmentEntryType(log.EntryType))
            {
                var entryType = log.EntryType.Trim().ToLowerInvariant();
                events.Add(new FifoEvent
                {
                    Id = log.Id,
                    OccurredAt = occurredAt,
                    EntryType = entryType,
                    Quantity = log.Quantity,
                    SignedQty = entryType == "adjustment_in" ? log.Quantity : -log.Quantity,
                    Uom = uom,
                    UnitPrice = entryType == "adjustment_in" && log.UnitPrice > 0
                        ? log.UnitPrice
                        : 0,
                    Reason = string.IsNullOrWhiteSpace(log.BatchNumber)
                        ? $"Inventory adjustment — {product.Name}"
                        : $"Inventory adjustment — {log.BatchNumber}",
                    ReferenceNumber = log.BatchNumber ?? string.Empty,
                    SourceLabel = entryType,
                });
            }
        }

        return events;
    }

    static decimal ResolveProductUnitPrice(Product product)
    {
        if (product.IsSubProduct && product.YieldQuantity > 0)
            return StockCardFifoEngine.RoundUnitPrice(product.TotalCost / product.YieldQuantity);

        if (product.Rrp > 0)
            return StockCardFifoEngine.RoundUnitPrice(product.Rrp);

        return StockCardFifoEngine.RoundUnitPrice(product.TotalCost);
    }

    async Task<FifoSimulationResult> BuildComponentFifoResultAsync(
        Ingredient ingredient,
        string displayUom,
        IReadOnlyList<string> locationIds,
        int? companyId,
        StockCardPeriod period,
        CancellationToken cancellationToken,
        List<InventoryPurchase>? purchasesOverride = null,
        List<InventoryMovement>? movementsOverride = null,
        IReadOnlyDictionary<int, string>? poNumbersOverride = null,
        IReadOnlyDictionary<int, Product>? productionProductsOverride = null)
    {
        var events = await BuildComponentFifoEventsAsync(
            ingredient,
            displayUom,
            locationIds,
            companyId,
            period,
            cancellationToken,
            purchasesOverride,
            movementsOverride,
            poNumbersOverride,
            productionProductsOverride);
        return StockCardFifoEngine.Simulate(events);
    }

    async Task<List<FifoEvent>> BuildComponentFifoEventsAsync(
        Ingredient ingredient,
        string displayUom,
        IReadOnlyList<string> locationIds,
        int? companyId,
        StockCardPeriod period,
        CancellationToken cancellationToken,
        List<InventoryPurchase>? purchasesOverride = null,
        List<InventoryMovement>? movementsOverride = null,
        IReadOnlyDictionary<int, string>? poNumbersOverride = null,
        IReadOnlyDictionary<int, Product>? productionProductsOverride = null)
    {
        var purchases = purchasesOverride ?? await db.InventoryPurchases.AsNoTracking()
            .Where(p => p.ComponentId == ingredient.ComponentId)
            .ToListAsync(cancellationToken);

        if (companyId is int cid)
            purchases = purchases.Where(p => p.CompanyId is null || p.CompanyId == cid).ToList();

        if (purchasesOverride is null)
        {
            purchases = purchases
                .Where(p => p.DateCreatedInStock >= period.ArchiveCutoff && p.DateCreatedInStock <= period.PeriodEnd)
                .ToList();
        }

        IReadOnlyDictionary<int, string> poNumbers;
        Dictionary<int, PurchaseOrderItem> poItemsById;
        if (poNumbersOverride is not null)
        {
            poNumbers = poNumbersOverride;
            poItemsById = new Dictionary<int, PurchaseOrderItem>();
        }
        else
        {
            var poIds = purchases.Where(p => p.PurchaseOrderId > 0).Select(p => p.PurchaseOrderId).Distinct().ToList();
            poNumbers = poIds.Count == 0
                ? new Dictionary<int, string>()
                : await db.PurchaseOrders.AsNoTracking()
                    .Where(p => poIds.Contains(p.Id))
                    .ToDictionaryAsync(p => p.Id, p => p.PoNumber, cancellationToken);

            var itemIds = purchases.Where(p => p.PurchaseOrderItemId > 0).Select(p => p.PurchaseOrderItemId).Distinct().ToList();
            poItemsById = itemIds.Count == 0
                ? new Dictionary<int, PurchaseOrderItem>()
                : await db.PurchaseOrderItems.AsNoTracking()
                    .Where(i => itemIds.Contains(i.Id))
                    .ToDictionaryAsync(i => i.Id, cancellationToken);
        }

        var events = new List<FifoEvent>();

        foreach (var purchase in purchases)
        {
            if (!PurchaseMatchesSelectedLocations(purchase, locationIds))
                continue;

            poItemsById.TryGetValue(purchase.PurchaseOrderItemId, out var poItem);
            if (!TryResolvePurchaseForDisplay(
                    ingredient,
                    purchase,
                    poItem,
                    displayUom,
                    out var convertedQty,
                    out var convertedPrice))
                continue;

            var entryType = purchase.PurchaseOrderId > 0 ? "purchase" : "cash_purchase";
            var poNumber = purchase.PurchaseOrderId > 0 && poNumbers.TryGetValue(purchase.PurchaseOrderId, out var num)
                ? num
                : string.Empty;

            // Child Split Use lines are composition of the parent receipt — not a new PO inbound.
            var isSplitChild = !string.IsNullOrWhiteSpace(purchase.SplitParentComponentId)
                && !string.IsNullOrWhiteSpace(purchase.SplitLineKey)
                && purchase.SplitLineKey is not ("__gross__" or "__nett__");
            if (isSplitChild)
                entryType = "split_use_in";

            var (documentAmount, roundingResidual) = ResolvePurchaseDocumentAmounts(
                purchase,
                convertedQty,
                convertedPrice,
                poItemsById);

            var residualNote = IngredientUomBridge.FormatRoundingResidualNote(
                roundingResidual,
                documentAmount,
                DecimalRounding.ToDb(convertedQty * convertedPrice),
                convertedPrice);

            var reason = isSplitChild
                ? $"Split from {purchase.SplitParentComponentId}"
                    + (string.IsNullOrWhiteSpace(poNumber) ? string.Empty : $" — PO {poNumber}")
                : !string.IsNullOrWhiteSpace(purchase.Remarks)
                    ? $"{purchase.Remarks.Trim()}"
                        + (string.IsNullOrWhiteSpace(poNumber) ? string.Empty : $" — PO {poNumber}")
                    : entryType == "purchase"
                        ? $"Purchase received — PO {poNumber}"
                        : entryType == "cash_purchase"
                            ? "Cash purchase"
                            : "Stock inbound";
            if (!string.IsNullOrWhiteSpace(residualNote))
                reason = $"{reason} · {residualNote}";

            var sourceLabel = isSplitChild
                ? $"Split from {purchase.SplitParentComponentId}"
                : entryType == "purchase" || entryType == "split_use_in"
                    ? (string.IsNullOrWhiteSpace(poNumber) ? "Purchase" : $"PO {poNumber}")
                    : "Cash purchase";

            events.Add(new FifoEvent
            {
                Id = purchase.Id,
                OccurredAt = purchase.DateCreatedInStock,
                EntryType = entryType,
                Quantity = convertedQty,
                SignedQty = convertedQty,
                Uom = displayUom,
                UnitPrice = convertedPrice,
                Reason = reason,
                ReferenceNumber = poNumber,
                SourceLabel = sourceLabel,
                DocumentAmount = documentAmount,
                RoundingResidual = roundingResidual,
            });
        }

        var movements = movementsOverride ?? await db.InventoryMovements.AsNoTracking()
            .Where(m => m.ComponentId == ingredient.ComponentId)
            .ToListAsync(cancellationToken);

        if (companyId is int companyFilter)
            movements = movements.Where(m => m.CompanyId is null || m.CompanyId == companyFilter).ToList();

        if (movementsOverride is null)
        {
            movements = movements
                .Where(m => StockLocationRules.MovementMatchesAny(m.LocationExternalId, locationIds))
                .ToList();
        }

        if (movementsOverride is null)
        {
            movements = movements
                .Where(m => m.CreatedAt >= period.ArchiveCutoff && m.CreatedAt <= period.PeriodEnd)
                .ToList();
        }

        var productionProducts = productionProductsOverride
            ?? await LoadProductionProductsForMovementsAsync(movements, cancellationToken);

        var creditNoteIds = movements
            .Where(m => string.Equals(
                (m.ReferenceType ?? string.Empty).Trim(),
                CreditNoteService.ReferenceType,
                StringComparison.OrdinalIgnoreCase)
                && m.ReferenceId > 0)
            .Select(m => m.ReferenceId)
            .Distinct()
            .ToList();
        var creditNotesById = creditNoteIds.Count == 0
            ? new Dictionary<int, CreditNote>()
            : await db.CreditNotes.AsNoTracking()
                .Where(c => creditNoteIds.Contains(c.Id))
                .ToDictionaryAsync(c => c.Id, cancellationToken);

        foreach (var movement in movements)
        {
            if (!TryNormalizeStockQty(
                    ingredient,
                    movement.Uom,
                    displayUom,
                    Math.Abs(movement.QtyDelta),
                    movement.UnitPrice,
                    out var convertedAbsQty,
                    out var convertedPrice))
                continue;

            var entryType = ClassifyMovementEntryType(movement);
            var signedQty = movement.QtyDelta < 0 ? -convertedAbsQty : convertedAbsQty;
            var productionProduct = TryResolveProductionProduct(movement, productionProducts);

            decimal documentAmount = 0m;
            decimal roundingResidual = 0m;
            var reason = FormatMovementReason(movement, productionProduct);
            if (entryType == "credit_note"
                && movement.ReferenceId > 0
                && creditNotesById.TryGetValue(movement.ReferenceId, out var creditNote))
            {
                documentAmount = CreditNoteService.ResolveDocumentAmount(creditNote);
                roundingResidual = CreditNoteService.ResolveRoundingResidual(creditNote);
                var extended = CreditNoteService.ResolveExtendedAtUnitPrice(creditNote);
                var residualNote = IngredientUomBridge.FormatRoundingResidualNote(
                    roundingResidual,
                    documentAmount,
                    extended,
                    creditNote.StockUnitPrice > 0 ? creditNote.StockUnitPrice : convertedPrice);
                if (!string.IsNullOrWhiteSpace(residualNote))
                    reason = $"{reason} · {residualNote}";
            }

            events.Add(new FifoEvent
            {
                Id = movement.Id,
                OccurredAt = movement.CreatedAt,
                EntryType = entryType,
                Quantity = convertedAbsQty,
                SignedQty = signedQty,
                Uom = displayUom,
                UnitPrice = entryType is "adjustment_out"
                    ? 0
                    : convertedPrice > 0
                        ? convertedPrice
                        : entryType is "adjustment_in"
                            ? 0
                            : ResolveComponentFallbackPrice(ingredient, displayUom),
                Reason = reason,
                ReferenceNumber = ResolveMovementReferenceNumber(movement, productionProduct),
                SourceLabel = entryType,
                DocumentAmount = documentAmount,
                RoundingResidual = roundingResidual,
            });
        }

        return events;
    }

    static bool CanNormalizePurchaseUom(Ingredient ingredient, string sourceUom, string displayUom)
        => TryNormalizeStockQty(ingredient, sourceUom, displayUom, 1m, 1m, out _, out _);

    /// <summary>
    /// BBQ / CN-freebie path: purchases often remain in delivery packages (tub) while the
    /// stock card displays Recipe UOM (Gr). Direct tub→Gr fails and previously dropped the
    /// inbound while credit_note movements in Gr still showed — convert via principal first.
    /// </summary>
    static bool TryResolvePurchaseForDisplay(
        Ingredient ingredient,
        InventoryPurchase purchase,
        PurchaseOrderItem? poItem,
        string displayUom,
        out decimal convertedQty,
        out decimal convertedPrice)
    {
        if (TryNormalizeStockQty(
                ingredient,
                purchase.Uom,
                displayUom,
                purchase.Quantity,
                purchase.UnitPrice,
                out convertedQty,
                out convertedPrice))
            return true;

        var deliveryBasis = poItem is null
            ? purchase.Uom
            : (string.IsNullOrWhiteSpace(poItem.Unit) ? poItem.DeliveryPackage : poItem.Unit);
        decimal? pathPrincipal = null;
        string? pathPrincipalUom = null;
        if (DeliveryPrincipalResolver.TryResolveFromDeliveryPath(
                deliveryBasis,
                ingredient,
                out var resolvedPrincipal,
                out var resolvedUom))
        {
            pathPrincipal = resolvedPrincipal;
            pathPrincipalUom = resolvedUom;
        }

        var packageQty = purchase.Quantity;
        var packagePrice = purchase.UnitPrice;
        if (poItem is not null)
        {
            var linePackages = poItem.DeliveredQuantity > 0
                ? poItem.DeliveredQuantity
                : (poItem.ReceivedQuantity ?? poItem.Quantity);
            var deliveryUnitPrice = poItem.ReceivedUnitPrice ?? poItem.UnitPrice;
            if (linePackages > 0
                && NearlyEqualQty(purchase.Quantity, linePackages)
                && (deliveryUnitPrice <= StockCardFifoEngine.QtyEpsilon
                    || NearlyEqualQty(purchase.UnitPrice, deliveryUnitPrice)
                    || purchase.UnitPrice <= StockCardFifoEngine.QtyEpsilon))
            {
                packageQty = linePackages;
                // Prefer a non-zero delivery price so principal conversion yields a stock rate;
                // CN-revalued freebies may already carry a package-level extended value.
                packagePrice = deliveryUnitPrice > StockCardFifoEngine.QtyEpsilon
                    ? deliveryUnitPrice
                    : (purchase.UnitPrice > StockCardFifoEngine.QtyEpsilon
                        ? purchase.UnitPrice
                        : deliveryUnitPrice);
            }
        }

        var priorExtended = DecimalRounding.ToDb(purchase.Quantity * purchase.UnitPrice);
        var inbound = IngredientUomBridge.ToInboundPrincipal(
            ingredient,
            packageQty,
            string.IsNullOrWhiteSpace(deliveryBasis) ? purchase.Uom : deliveryBasis,
            packagePrice > StockCardFifoEngine.QtyEpsilon ? packagePrice : purchase.UnitPrice,
            poItem?.VendorProductId,
            deliveryBasis,
            pathPrincipal,
            pathPrincipalUom);

        // Preserve CN-revalued extended value when conversion used a $0 freebie delivery price.
        if (priorExtended > StockCardFifoEngine.QtyEpsilon
            && inbound.Quantity > 0
            && inbound.DocumentAmount <= StockCardFifoEngine.QtyEpsilon)
        {
            var preservedPrice = DecimalRounding.ToDb(priorExtended / inbound.Quantity);
            if (TryNormalizeStockQty(
                    ingredient,
                    inbound.Uom,
                    displayUom,
                    inbound.Quantity,
                    preservedPrice,
                    out convertedQty,
                    out convertedPrice))
                return true;
        }

        if (TryNormalizeStockQty(
                ingredient,
                inbound.Uom,
                displayUom,
                inbound.Quantity,
                inbound.UnitPrice,
                out convertedQty,
                out convertedPrice))
            return true;

        // Last resort: if principal conversion produced recipe/inventory UOM, accept it even
        // when display mode aliases differ slightly — keep the whole receive visible.
        if (inbound.Quantity > 0
            && (UomCanonical.Equals(inbound.Uom, displayUom)
                || UomCanonical.Equals(inbound.Uom, ingredient.RecipeUom)
                || UomCanonical.Equals(inbound.Uom, ingredient.InventoryUom)))
        {
            convertedQty = inbound.Quantity;
            convertedPrice = inbound.UnitPrice > 0
                ? inbound.UnitPrice
                : (priorExtended > 0 ? DecimalRounding.ToDb(priorExtended / inbound.Quantity) : purchase.UnitPrice);
            return true;
        }

        convertedQty = 0;
        convertedPrice = 0;
        return false;
    }

    static bool NearlyEqualQty(decimal a, decimal b, decimal tolerance = 0.00015m)
        => Math.Abs(a - b) <= Math.Max(tolerance, Math.Abs(a) * 0.0001m);

    static InventoryPurchase ClonePurchaseWithQty(
        InventoryPurchase purchase,
        decimal quantity,
        decimal unitPrice,
        string uom)
        => new()
        {
            Id = purchase.Id,
            ComponentId = purchase.ComponentId,
            ComponentName = purchase.ComponentName,
            Quantity = quantity,
            Uom = uom,
            UnitPrice = unitPrice,
            DocumentAmount = purchase.DocumentAmount,
            RoundingResidual = purchase.RoundingResidual,
            DateOrdered = purchase.DateOrdered,
            DateCreatedInStock = purchase.DateCreatedInStock,
            PurchaseOrderId = purchase.PurchaseOrderId,
            PurchaseOrderItemId = purchase.PurchaseOrderItemId,
            ProductExpiryDate = purchase.ProductExpiryDate,
            Remarks = purchase.Remarks,
            CompanyId = purchase.CompanyId,
            LocationIdsJson = purchase.LocationIdsJson,
            LocationExternalId = purchase.LocationExternalId,
            SplitSourceType = purchase.SplitSourceType,
            SplitSourceId = purchase.SplitSourceId,
            SplitLineKey = purchase.SplitLineKey,
            SplitParentComponentId = purchase.SplitParentComponentId,
        };

    /// <summary>
    /// Match purchases by LocationIdsJson, with LocationExternalId fallback so CN movements
    /// (matched on ExternalId) and their offsetting inbound stay on the same stock card.
    /// Empty LocationIdsJson matches any selected location (same as PurchaseMatchesAny) so a
    /// whole receive is not wiped to inbound=0 when only ExternalId is set/mismatched.
    /// </summary>
    static bool PurchaseMatchesSelectedLocations(
        InventoryPurchase purchase,
        IReadOnlyList<string> locationIds)
    {
        var locs = PurchaseOrderWorkflow.DeserializeLocationIds(purchase.LocationIdsJson);
        if (locs.Count == 0)
            return true;

        if (LocationListMatches(locs, locationIds))
            return true;

        return StockLocationRules.MovementMatchesAny(purchase.LocationExternalId, locationIds);
    }

    static bool TryNormalizeStockQty(
        Ingredient ingredient,
        string sourceUom,
        string displayUom,
        decimal quantity,
        decimal unitPrice,
        out decimal convertedQty,
        out decimal convertedPrice)
    {
        var source = NormalizeUom(sourceUom);
        var display = NormalizeUom(displayUom);
        if (source == display)
        {
            convertedQty = quantity;
            convertedPrice = unitPrice;
            return true;
        }

        return IngredientUomBridge.TryConvertToUom(
            ingredient,
            quantity,
            unitPrice,
            sourceUom,
            displayUom,
            out convertedQty,
            out convertedPrice);
    }

    static InventoryPurchase NormalizePurchaseToDisplayUom(
        Ingredient ingredient,
        InventoryPurchase purchase,
        string displayUom)
    {
        if (!TryNormalizeStockQty(
                ingredient,
                purchase.Uom,
                displayUom,
                purchase.Quantity,
                purchase.UnitPrice,
                out var qty,
                out var price))
            return purchase;

        if (NormalizeUom(purchase.Uom) == NormalizeUom(displayUom)
            && qty == purchase.Quantity
            && price == purchase.UnitPrice)
            return purchase;

        return new InventoryPurchase
        {
            Id = purchase.Id,
            ComponentId = purchase.ComponentId,
            ComponentName = purchase.ComponentName,
            Quantity = qty,
            Uom = displayUom,
            UnitPrice = price,
            DateOrdered = purchase.DateOrdered,
            DateCreatedInStock = purchase.DateCreatedInStock,
            PurchaseOrderId = purchase.PurchaseOrderId,
            PurchaseOrderItemId = purchase.PurchaseOrderItemId,
            ProductExpiryDate = purchase.ProductExpiryDate,
            Remarks = purchase.Remarks,
            CompanyId = purchase.CompanyId,
            LocationIdsJson = purchase.LocationIdsJson,
            LocationExternalId = purchase.LocationExternalId,
            SplitSourceType = purchase.SplitSourceType,
            SplitSourceId = purchase.SplitSourceId,
            SplitLineKey = purchase.SplitLineKey,
            SplitParentComponentId = purchase.SplitParentComponentId,
        };
    }

    static InventoryMovement NormalizeMovementToDisplayUom(
        Ingredient ingredient,
        InventoryMovement movement,
        string displayUom)
    {
        var absQty = Math.Abs(movement.QtyDelta);
        if (!TryNormalizeStockQty(
                ingredient,
                movement.Uom,
                displayUom,
                absQty,
                movement.UnitPrice,
                out var convertedAbs,
                out var convertedPrice))
            return movement;

        if (NormalizeUom(movement.Uom) == NormalizeUom(displayUom)
            && convertedAbs == absQty
            && convertedPrice == movement.UnitPrice)
            return movement;

        var signed = movement.QtyDelta < 0 ? -convertedAbs : convertedAbs;
        return new InventoryMovement
        {
            Id = movement.Id,
            ComponentId = movement.ComponentId,
            ComponentName = movement.ComponentName,
            QtyDelta = signed,
            Uom = displayUom,
            UnitPrice = convertedPrice,
            CreatedAt = movement.CreatedAt,
            CompanyId = movement.CompanyId,
            LocationExternalId = movement.LocationExternalId,
            Reason = movement.Reason,
            ReferenceType = movement.ReferenceType,
            ReferenceId = movement.ReferenceId,
        };
    }

    static bool IsProductSaleEntryType(string entryType)
    {
        var normalized = entryType.Trim().ToLowerInvariant();
        return normalized is "pos_sale" or "online_order" or "offline_order";
    }

    static bool IsProductWastageEntryType(string entryType)
    {
        var normalized = entryType.Trim().ToLowerInvariant();
        return normalized is "wastage";
    }

    static bool IsProductAdjustmentEntryType(string entryType)
    {
        var normalized = entryType.Trim().ToLowerInvariant();
        return normalized is "adjustment_in" or "adjustment_out";
    }

    static string FormatProductSaleReason(string entryType, string productName, string? batchNumber = null)
    {
        if (!string.IsNullOrWhiteSpace(batchNumber)
            && batchNumber.Contains("prepaid", StringComparison.OrdinalIgnoreCase))
        {
            return batchNumber.Trim();
        }

        return entryType.Trim().ToLowerInvariant() switch
        {
            "online_order" => $"Online order — {productName}",
            "offline_order" => $"Offline order — {productName}",
            _ => $"POS sales — {productName}",
        };
    }

    static decimal TryParsePrepaidUnitRpp(string? batchNumber)
    {
        if (string.IsNullOrWhiteSpace(batchNumber)
            || !batchNumber.Contains("prepaid", StringComparison.OrdinalIgnoreCase))
        {
            return 0m;
        }

        // Expected fragment: "— RPP 12.5 —"
        var marker = "RPP ";
        var idx = batchNumber.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
        if (idx < 0) return 0m;
        var slice = batchNumber[(idx + marker.Length)..].TrimStart();
        var end = 0;
        while (end < slice.Length && (char.IsDigit(slice[end]) || slice[end] is '.' or ','))
            end++;
        if (end <= 0) return 0m;
        var raw = slice[..end].Replace(',', '.');
        return decimal.TryParse(raw, System.Globalization.NumberStyles.Number,
            System.Globalization.CultureInfo.InvariantCulture, out var parsed)
            ? parsed
            : 0m;
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
        if (refType == "credit_note" || reason.Contains("credit note"))
            return "credit_note";
        if (refType is "store_issue" or "store_hold_in" || reason.Contains("store issue") || reason.Contains("store hold"))
            return refType == "store_hold_in" || reason.Contains("store hold in") ? "store_hold_in" : "store_issue";
        if (refType == "split_use" || reason.Contains("split use"))
            return "split_use";
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

        var entryType = ClassifyMovementEntryType(movement);
        if (entryType == "credit_note")
        {
            var raw = (movement.Reason ?? string.Empty).Trim();
            if (raw.Length > 0)
            {
                var fifoIdx = raw.IndexOf("[fifo:", StringComparison.OrdinalIgnoreCase);
                if (fifoIdx >= 0)
                    raw = raw[..fifoIdx].Trim();
                raw = raw.Replace('_', ' ').Trim();
                if (raw.Length > 0)
                    return raw;
            }
            return "Credit note";
        }

        if (!string.IsNullOrWhiteSpace(movement.Reason))
            return movement.Reason.Replace('_', ' ');

        return entryType switch
        {
            "transfer_in" => "Transfer in",
            "transfer_out" => "Transfer out",
            "pos_sale" => "POS sales depletion",
            "online_order" => "Online order sales depletion",
            "offline_order" => "Offline order sales depletion",
            "wastage" => "Wastage",
            "credit_note" => "Credit note",
            "store_issue" => "Central Store issue",
            "store_hold_in" => "Production stock hold",
            "split_use" => "Sub-component composition",
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

        var refType = (movement.ReferenceType ?? string.Empty).Trim().ToLowerInvariant();
        if (refType == "credit_note" && movement.ReferenceId > 0)
        {
            // Stock Card outbound shows this as the credit-note transaction id.
            var fifoTx = TryParseFifoTransactionId(movement.Reason);
            return fifoTx is Guid tx
                ? $"CN-{movement.ReferenceId} · TX {tx.ToString("N")[..8].ToUpperInvariant()}"
                : $"CN-{movement.ReferenceId}";
        }

        return movement.ReferenceId > 0 ? movement.ReferenceId.ToString() : string.Empty;
    }

    static Guid? TryParseFifoTransactionId(string? reason)
    {
        if (string.IsNullOrWhiteSpace(reason))
            return null;
        var marker = "[fifo:";
        var start = reason.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
        if (start < 0)
            return null;
        start += marker.Length;
        var end = reason.IndexOf(']', start);
        if (end <= start)
            return null;
        var hex = reason[start..end].Trim();
        return Guid.TryParseExact(hex, "N", out var id) ? id : null;
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

    static string NormalizeUom(string uom) => UomCanonical.Normalize(uom);

    static string? ResolveInboundAdjustmentUom(
        string recipeUom,
        string inventoryUom,
        string defaultUom,
        string? requestedUom)
    {
        var allowed = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            recipeUom.Trim(),
            inventoryUom.Trim(),
        };

        if (string.IsNullOrWhiteSpace(requestedUom))
            return allowed.Contains(defaultUom.Trim()) ? defaultUom.Trim() : null;

        var trimmed = requestedUom.Trim();
        return allowed.Contains(trimmed) ? trimmed : null;
    }

    static bool ShouldInclude(string? itemTypeFilter, string itemType)
    {
        if (string.IsNullOrWhiteSpace(itemTypeFilter) || itemTypeFilter.Equals("all", StringComparison.OrdinalIgnoreCase))
            return true;
        return itemTypeFilter.Replace(' ', '-').Equals(itemType, StringComparison.OrdinalIgnoreCase);
    }

    static DateTime? ResolveComponentLastChangedAt(
        IEnumerable<InventoryPurchase> purchases,
        IEnumerable<InventoryMovement> movements,
        IReadOnlyList<string> locationIds,
        int? companyId)
    {
        DateTime? last = null;

        foreach (var purchase in purchases)
        {
            if (companyId is int cid && purchase.CompanyId is int pcid && pcid != cid)
                continue;
            if (!PurchaseMatchesSelectedLocations(purchase, locationIds))
                continue;
            if (last is null || purchase.DateCreatedInStock > last)
                last = purchase.DateCreatedInStock;
        }

        foreach (var movement in movements)
        {
            if (companyId is int cid && movement.CompanyId is int mcid && mcid != cid)
                continue;
            if (!StockLocationRules.MovementMatchesAny(movement.LocationExternalId, locationIds))
                continue;
            if (last is null || movement.CreatedAt > last)
                last = movement.CreatedAt;
        }

        return last;
    }

    static DateTime? ResolveProductLastChangedAt(
        IEnumerable<ProductProductionLog> logs,
        IReadOnlyList<string> locationIds,
        StockCardPeriod period)
    {
        DateTime? last = null;

        foreach (var log in logs)
        {
            if (!LogMatchesAnyLocation(log.LocationIdsJson, locationIds))
                continue;
            var occurredAt = ParseProductionDate(log.ProductionDate) ?? log.CreatedAt;
            if (occurredAt < period.ArchiveCutoff || occurredAt > period.PeriodEnd)
                continue;
            if (last is null || occurredAt > last)
                last = occurredAt;
        }

        return last;
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
        return selectedLocations.Any(selected =>
            itemLocations.Any(item => item.Equals(selected, StringComparison.OrdinalIgnoreCase)));
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

    const int HistoryRetentionYears = 2;

    static StockCardPeriod ResolvePeriod(string? period, Company? company = null)
    {
        var nowLocal = OrgClock.NowLocal(company);
        var archiveCutoffLocal = DateOnly.FromDateTime(nowLocal).AddYears(-HistoryRetentionYears);
        var archiveCutoff = OrgClock.StartOfLocalDayUtc(archiveCutoffLocal, company);

        int year;
        int month;
        if (string.IsNullOrWhiteSpace(period)
            || string.Equals(period, "month", StringComparison.OrdinalIgnoreCase))
        {
            year = nowLocal.Year;
            month = nowLocal.Month;
        }
        else if (TryParseWeekKey(period.Trim(), out var weekYear, out var weekNumber))
        {
            var weekStartDate = ISOWeek.ToDateTime(weekYear, weekNumber, DayOfWeek.Monday);
            var weekStartLocal = DateOnly.FromDateTime(weekStartDate);
            var weekStart = OrgClock.StartOfLocalDayUtc(weekStartLocal, company);
            if (weekStart < archiveCutoff)
                weekStart = archiveCutoff;
            var weekEnd = OrgClock.EndOfLocalDayUtc(weekStartLocal.AddDays(6), company);
            var nowUtc = DateTime.UtcNow;
            if (weekEnd > nowUtc)
                weekEnd = nowUtc;
            return new StockCardPeriod(
                $"{weekYear:D4}-W{weekNumber:D2}",
                weekStart,
                weekEnd,
                archiveCutoff,
                weekEnd >= nowUtc.Date);
        }
        else if (!TryParseMonthKey(period.Trim(), out year, out month))
        {
            year = nowLocal.Year;
            month = nowLocal.Month;
        }

        var monthStartLocal = new DateOnly(year, month, 1);
        var monthStart = OrgClock.StartOfLocalDayUtc(monthStartLocal, company);
        if (monthStart < archiveCutoff)
        {
            monthStartLocal = new DateOnly(archiveCutoffLocal.Year, archiveCutoffLocal.Month, 1);
            monthStart = OrgClock.StartOfLocalDayUtc(monthStartLocal, company);
        }

        var isCurrentMonth = monthStartLocal.Year == nowLocal.Year && monthStartLocal.Month == nowLocal.Month;
        var periodEnd = isCurrentMonth
            ? DateTime.UtcNow
            : OrgClock.EndOfLocalDayUtc(monthStartLocal.AddMonths(1).AddDays(-1), company);

        return new StockCardPeriod(
            $"{monthStartLocal:yyyy-MM}",
            monthStart,
            periodEnd,
            archiveCutoff,
            isCurrentMonth);
    }

    /// <summary>
    /// Company-local calendar month window, shifted when prior-month full inventory was consolidated
    /// on a later EffectiveDate (C/F). Next period starts the day after EffectiveDate;
    /// prior period extends through end of EffectiveDate.
    /// </summary>
    async Task<StockCardPeriod> ResolvePeriodAsync(
        string? period,
        int? companyId,
        CancellationToken cancellationToken)
    {
        Company? company = null;
        if (companyId is int cid && cid > 0)
        {
            company = await db.Companies.AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == cid, cancellationToken);
        }

        var basePeriod = ResolvePeriod(period, company);
        // Carry-forward inventory shifts apply to calendar months only.
        if (basePeriod.MonthKey.Contains('W', StringComparison.OrdinalIgnoreCase))
            return basePeriod;

        var carryForward = await FindCarryForwardEffectiveDateAsync(
            basePeriod.MonthKey,
            companyId,
            cancellationToken);

        if (carryForward is null)
            return basePeriod;

        var cf = carryForward.Value;
        if (!TryParseMonthKey(basePeriod.MonthKey, out var viewYear, out var viewMonth))
            return basePeriod with { CarryForwardDate = cf.EffectiveDate };

        var monthStartLocal = new DateOnly(viewYear, viewMonth, 1);
        var nextMonthStartLocal = monthStartLocal.AddMonths(1);

        // Viewing the inventory's own PeriodMonth: extend PeriodEnd through EffectiveDate.
        if (string.Equals(cf.PeriodMonth, basePeriod.MonthKey, StringComparison.OrdinalIgnoreCase))
        {
            var extendedEnd = OrgClock.EndOfLocalDayUtc(cf.EffectiveDate, company);
            if (extendedEnd <= basePeriod.PeriodEnd)
                return basePeriod with { CarryForwardDate = cf.EffectiveDate };

            var now = DateTime.UtcNow;
            var cappedEnd = extendedEnd > now ? now : extendedEnd;
            var localNow = OrgClock.NowLocal(company);
            return basePeriod with
            {
                PeriodEnd = cappedEnd,
                CarryForwardDate = cf.EffectiveDate,
                IsCurrentMonth = DateOnly.FromDateTime(localNow) <= cf.EffectiveDate
                    || (localNow.Year == viewYear && localNow.Month == viewMonth),
            };
        }

        // Viewing the month after a late C/F: start day after EffectiveDate.
        if (cf.EffectiveDate >= monthStartLocal && cf.EffectiveDate < nextMonthStartLocal)
        {
            var shiftedStart = OrgClock.StartOfLocalDayUtc(cf.EffectiveDate.AddDays(1), company);
            if (shiftedStart <= basePeriod.PeriodEnd)
            {
                return basePeriod with
                {
                    MonthStart = shiftedStart,
                    CarryForwardDate = cf.EffectiveDate,
                };
            }
        }

        return basePeriod with { CarryForwardDate = cf.EffectiveDate };
    }

    async Task<(string PeriodMonth, DateOnly EffectiveDate)?> FindCarryForwardEffectiveDateAsync(
        string viewingMonthKey,
        int? companyId,
        CancellationToken cancellationToken)
    {
        if (!TryParseMonthKey(viewingMonthKey, out var year, out var month))
            return null;

        var viewingStart = new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc);
        var priorKey = viewingStart.AddMonths(-1).ToString("yyyy-MM");

        var sessions = await db.InventoryCountSessions.AsNoTracking()
            .Where(s => s.SessionType == InventoryCountWorkflow.TypeFull
                && (s.Status == InventoryCountWorkflow.StatusConfirmed
                    || s.Status == InventoryCountWorkflow.StatusAutoConfirmed)
                && (s.PeriodMonth == viewingMonthKey || s.PeriodMonth == priorKey)
                && s.EffectiveDate != "")
            .ToListAsync(cancellationToken);

        if (companyId is int cid)
            sessions = sessions.Where(s => s.CompanyId is null || s.CompanyId == cid).ToList();

        (string PeriodMonth, DateOnly EffectiveDate)? best = null;
        foreach (var session in sessions)
        {
            if (!DateOnly.TryParse(session.EffectiveDate, out var effective))
                continue;

            // Prefer the session that owns this viewing month, else prior-month C/F into this month.
            if (best is null
                || string.Equals(session.PeriodMonth, viewingMonthKey, StringComparison.OrdinalIgnoreCase)
                || (string.Equals(session.PeriodMonth, priorKey, StringComparison.OrdinalIgnoreCase)
                    && effective >= DateOnly.FromDateTime(viewingStart)
                    && (best.Value.EffectiveDate < effective
                        || !string.Equals(best.Value.PeriodMonth, viewingMonthKey, StringComparison.OrdinalIgnoreCase))))
            {
                best = (session.PeriodMonth, effective);
            }
        }

        return best;
    }

    static bool TryParseMonthKey(string value, out int year, out int month)
    {
        year = 0;
        month = 0;
        if (DateOnly.TryParse($"{value}-01", out var parsed))
        {
            year = parsed.Year;
            month = parsed.Month;
            return true;
        }

        return false;
    }

    static bool TryParseWeekKey(string value, out int year, out int week)
    {
        year = 0;
        week = 0;
        if (string.IsNullOrWhiteSpace(value))
            return false;
        var match = System.Text.RegularExpressions.Regex.Match(
            value.Trim(),
            @"^(?<y>\d{4})-W(?<w>\d{1,2})$",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        if (!match.Success)
            return false;
        if (!int.TryParse(match.Groups["y"].Value, NumberStyles.Integer, CultureInfo.InvariantCulture, out year))
            return false;
        if (!int.TryParse(match.Groups["w"].Value, NumberStyles.Integer, CultureInfo.InvariantCulture, out week))
            return false;
        return year is >= 2000 and <= 2100 && week is >= 1 and <= 53;
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
    public decimal OnHandAverageCogs { get; init; }
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
    public decimal OnHandAverageCogs { get; init; }
    public string Uom { get; init; } = string.Empty;
    public string RecipeUom { get; init; } = string.Empty;
    public string InventoryUom { get; init; } = string.Empty;
    /// <summary>Most recent stock activity for this item in the selected locations/period.</summary>
    public DateTime? LastChangedAt { get; init; }
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
    public decimal OnHandAverageCogs { get; init; }
    public IReadOnlyList<StockCardOnHandLayer> OnHandLayers { get; init; } = [];
    public string FifoPolicy { get; init; } = "FIFO";
    public string PeriodMonth { get; init; } = string.Empty;
    public DateTime PeriodStart { get; init; }
    public DateTime PeriodEnd { get; init; }
    public DateTime ArchiveCutoff { get; init; }
    public bool IsCurrentMonth { get; init; }
    public int HistoryRetentionYears { get; init; } = 2;
    public bool HasNegativeStock { get; init; }
    /// <summary>Prior month physical inventory effective date when C/F shifted this period start.</summary>
    public DateOnly? InventoryCarryForwardDate { get; init; }
    public IReadOnlyList<StockCardLedgerEntry> Entries { get; init; } = [];
}

public sealed record StockCardPeriod(
    string MonthKey,
    DateTime MonthStart,
    DateTime PeriodEnd,
    DateTime ArchiveCutoff,
    bool IsCurrentMonth,
    DateOnly? CarryForwardDate = null);

public sealed record StockCardLedgerEntry
{
    public int Id { get; init; }
    public DateTime OccurredAt { get; init; }
    public string EntryType { get; init; } = string.Empty;
    public decimal Quantity { get; init; }
    public decimal SignedQty { get; init; }
    public string Uom { get; init; } = string.Empty;
    public decimal UnitPrice { get; init; }
    public decimal Subtotal { get; init; }
    /// <summary>PO/cash document line amount (authority) for inbound rows.</summary>
    public decimal DocumentAmount { get; init; }
    /// <summary>PCU extended (qty × 4dp price) − document amount.</summary>
    public decimal RoundingResidual { get; init; }
    /// <summary>qty × 4dp unit price before residual true-up.</summary>
    public decimal ExtendedAtUnitPrice { get; init; }
    public string Reason { get; init; } = string.Empty;
    public string ReferenceNumber { get; init; } = string.Empty;
    public string FifoDetail { get; init; } = string.Empty;
    public decimal RunningBalance { get; init; }
    public decimal AverageCogsAfter { get; init; }
    public string FifoPolicy { get; init; } = "FIFO";
    public int SplitIndex { get; init; }
    public bool IsShortage { get; init; }
    public bool IsCogsBackfilled { get; init; }
    public bool IsNegativeBalance { get; init; }
    public int InboundSequenceNo { get; init; }
    public decimal OriginalQuantity { get; init; }
    public decimal DepletedQuantity { get; init; }
    public int SourceInboundSequenceNo { get; init; }
}

public sealed record StockCardOnHandLayer
{
    public decimal Quantity { get; init; }
    public decimal UnitPrice { get; init; }
    public DateTime SortOrder { get; init; }
}

public sealed class StockCardAsOfSnapshot
{
    public DateOnly AsOfDate { get; init; }
    public string LocationExternalId { get; init; } = string.Empty;
    public string Uom { get; init; } = string.Empty;
    public decimal OnHandQty { get; init; }
    public IReadOnlyList<StockCardOnHandLayer> Layers { get; init; } = [];
    public decimal SuggestedAdjustmentInUnitPrice { get; init; }
}

public sealed class StockCardAdjustmentResult
{
    public bool Success { get; init; }
    public string? Message { get; init; }

    public static StockCardAdjustmentResult Ok() => new() { Success = true };
    public static StockCardAdjustmentResult Fail(string message) => new() { Success = false, Message = message };
}
