using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Bisync.Api.Services;

public class StockCardService(
    BisyncDbContext db,
    ComponentStockService componentStock,
    ComponentFifoCostingService fifoCosting,
    IServiceScopeFactory scopeFactory)
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

        var stockPeriod = ResolvePeriod(period);
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
                });
            }
        }

        IQueryable<Product> productQuery = db.Products.AsNoTracking().Where(p => p.Active);
        if (companyId is int cid)
            productQuery = productQuery.Where(p => p.CompanyId == cid);

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
        string? period = null,
        CancellationToken cancellationToken = default)
    {
        if (locationIds.Count == 0)
            return null;

        var stockPeriod = ResolvePeriod(period);
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
                .FirstOrDefaultAsync(i => i.ComponentId == itemKey, cancellationToken);
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
        if (asOfEnd > DateTime.UtcNow)
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

            if (!isInbound && quantity > snapshot.OnHandQty)
                return StockCardAdjustmentResult.Fail($"Cannot deplete {quantity} {displayUom}. Only {snapshot.OnHandQty} on hand on that date.");

            var reasonText = $"Inventory adjustment — {trimmedReason}";
            if (isInbound)
            {
                var inboundUomResolved = ResolveInboundAdjustmentUom(
                    ingredient.RecipeUom,
                    ingredient.InventoryUom,
                    displayUom,
                    inboundUom);
                if (inboundUomResolved is null)
                    return StockCardAdjustmentResult.Fail("Select a valid UOM for this component.");

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
                    occurredAt);
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
            await TryRevisedCogsAuditAfterAdjustmentAsync(
                companyId, locationExternalId, adjustmentDate, uomMode, trimmedReason, cancellationToken);
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

        if (!isInbound && quantity > productSnapshot.OnHandQty)
            return StockCardAdjustmentResult.Fail($"Cannot deplete {quantity} {productSnapshot.Uom}. Only {productSnapshot.OnHandQty} on hand on that date.");

        var entryType = isInbound ? "adjustment_in" : "adjustment_out";
        var productUom = ResolveProductUom(product);
        if (isInbound && !string.IsNullOrWhiteSpace(inboundUom)
            && !string.Equals(NormalizeUom(inboundUom), NormalizeUom(productUom), StringComparison.OrdinalIgnoreCase))
            return StockCardAdjustmentResult.Fail("UOM does not match this product.");

        db.ProductProductionLogs.Add(new ProductProductionLog
        {
            ProductId = product.Id,
            EntryType = entryType,
            Quantity = quantity,
            ProductionDate = productionDate,
            BatchNumber = trimmedReason,
            UnitPrice = 0,
            LocationIdsJson = System.Text.Json.JsonSerializer.Serialize(new[] { locationExternalId }),
            CompanyId = product.CompanyId,
            CreatedAt = occurredAt,
        });

        await ApplyProductLocationStockDeltaAsync(product.Id, locationExternalId, signedQty, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        await TryRevisedCogsAuditAfterAdjustmentAsync(
            companyId, locationExternalId, adjustmentDate, uomMode, trimmedReason, cancellationToken);
        return StockCardAdjustmentResult.Ok();
    }

    async Task TryRevisedCogsAuditAfterAdjustmentAsync(
        int? companyId,
        string locationExternalId,
        DateOnly adjustmentDate,
        string uomMode,
        string reason,
        CancellationToken cancellationToken)
    {
        try
        {
            // New scope avoids circular DI with CogsAuditService → StockCardService.
            using var scope = scopeFactory.CreateScope();
            var snapshots = scope.ServiceProvider.GetRequiredService<SystemCogsAuditSnapshotService>();
            await snapshots.SnapshotRevisedAfterAdjustmentAsync(
                companyId,
                locationExternalId,
                adjustmentDate,
                uomMode,
                reason,
                cancellationToken);
        }
        catch
        {
            // Adjustment already committed — revised audit is best-effort.
        }
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
            if (signedQty <= 0)
                return;

            db.ProductB2bLocationStocks.Add(new ProductB2bLocationStock
            {
                ProductId = productId,
                LocationExternalId = locationExternalId,
                InStock = signedQty,
                UpdatedAt = DateTime.UtcNow,
            });
            return;
        }

        stockRow.InStock = Math.Max(0, stockRow.InStock + signedQty);
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
            Reason = beforePeriod.Count > 0
                ? "B/F from previous period end inventory (FIFO)"
                : "B/F — no eligible history in the last 2 years",
            RunningBalance = balanceForward,
            AverageCogsAfter = balanceForwardAvgCogs,
            FifoPolicy = "FIFO",
        });

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
            Entries = ledger,
        };
    }

    static bool IsInboundSummaryType(string entryType) =>
        entryType is "purchase" or "cash_purchase" or "transfer_in" or "adjustment_in" or "inbound";

    static bool IsOutboundSummaryType(string entryType) =>
        entryType is "production" or "pos_sale" or "online_order" or "offline_order" or "wastage" or "transfer_out" or "adjustment_out" or "outbound";

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
        return new StockCardLedgerEntry
        {
            Id = enriched.Event.Id,
            OccurredAt = enriched.Event.OccurredAt,
            EntryType = enriched.Event.EntryType,
            Quantity = quantity,
            SignedQty = enriched.Event.SignedQty,
            Uom = enriched.Event.Uom,
            UnitPrice = unitPrice,
            Subtotal = quantity > 0 && unitPrice > 0 ? RoundLineSubtotal(quantity, unitPrice) : 0,
            Reason = enriched.Event.Reason,
            ReferenceNumber = enriched.Event.ReferenceNumber,
            FifoDetail = enriched.FifoDetail,
            RunningBalance = enriched.RunningBalance,
            AverageCogsAfter = enriched.AverageCogsAfter,
            FifoPolicy = "FIFO",
            SplitIndex = enriched.SplitIndex,
        };
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
        var normalizedUom = NormalizeUom(displayUom);
        var purchases = preloadedPurchases;

        if (companyId is int cid)
            purchases = purchases.Where(p => p.CompanyId is null || p.CompanyId == cid).ToList();

        purchases = purchases
            .Where(p => LocationMatchesAny(p.LocationIdsJson, locationIds))
            .Where(p => NormalizeUom(p.Uom) == normalizedUom)
            .ToList();

        var movements = preloadedMovements;

        if (companyId is int companyFilter)
            movements = movements.Where(m => m.CompanyId is null || m.CompanyId == companyFilter).ToList();

        movements = movements
            .Where(m => StockLocationRules.MovementMatchesAny(m.LocationExternalId, locationIds))
            .Where(m => NormalizeUom(m.Uom) == normalizedUom)
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
                events.Add(new FifoEvent
                {
                    Id = log.Id,
                    OccurredAt = occurredAt,
                    EntryType = "inbound",
                    Quantity = log.Quantity,
                    SignedQty = log.Quantity,
                    Uom = uom,
                    UnitPrice = productionUnitPrice,
                    Reason = string.IsNullOrWhiteSpace(log.BatchNumber)
                        ? "Production recorded"
                        : $"Production batch {log.BatchNumber}",
                    ReferenceNumber = log.BatchNumber ?? string.Empty,
                    SourceLabel = "Production",
                });
                continue;
            }

            if (IsProductSaleEntryType(log.EntryType) || IsProductWastageEntryType(log.EntryType))
            {
                var entryType = log.EntryType.Trim().ToLowerInvariant();
                events.Add(new FifoEvent
                {
                    Id = log.Id,
                    OccurredAt = occurredAt,
                    EntryType = entryType,
                    Quantity = log.Quantity,
                    SignedQty = -log.Quantity,
                    Uom = uom,
                    UnitPrice = 0,
                    Reason = FormatProductSaleReason(entryType, product.Name),
                    ReferenceNumber = log.BatchNumber ?? string.Empty,
                    SourceLabel = entryType,
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
                    UnitPrice = 0,
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
        var normalizedUom = NormalizeUom(displayUom);
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
        if (poNumbersOverride is not null)
        {
            poNumbers = poNumbersOverride;
        }
        else
        {
            var poIds = purchases.Where(p => p.PurchaseOrderId > 0).Select(p => p.PurchaseOrderId).Distinct().ToList();
            poNumbers = poIds.Count == 0
                ? new Dictionary<int, string>()
                : await db.PurchaseOrders.AsNoTracking()
                    .Where(p => poIds.Contains(p.Id))
                    .ToDictionaryAsync(p => p.Id, p => p.PoNumber, cancellationToken);
        }

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
                UnitPrice = entryType is "adjustment_in" or "adjustment_out"
                    ? 0
                    : movement.UnitPrice > 0
                        ? movement.UnitPrice
                        : ResolveComponentFallbackPrice(ingredient, displayUom),
                Reason = FormatMovementReason(movement, productionProduct),
                ReferenceNumber = ResolveMovementReferenceNumber(movement, productionProduct),
                SourceLabel = entryType,
            });
        }

        return events;
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

    static string FormatProductSaleReason(string entryType, string productName)
    {
        return entryType.Trim().ToLowerInvariant() switch
        {
            "online_order" => $"Online order — {productName}",
            "offline_order" => $"Offline order — {productName}",
            "wastage" => $"Wastage — {productName}",
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

    const int HistoryRetentionYears = 2;

    static StockCardPeriod ResolvePeriod(string? period)
    {
        var now = DateTime.UtcNow;
        var archiveCutoff = now.Date.AddYears(-HistoryRetentionYears);
        var earliestMonth = new DateTime(archiveCutoff.Year, archiveCutoff.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        int year;
        int month;
        if (string.IsNullOrWhiteSpace(period)
            || string.Equals(period, "month", StringComparison.OrdinalIgnoreCase))
        {
            year = now.Year;
            month = now.Month;
        }
        else if (!TryParseMonthKey(period.Trim(), out year, out month))
        {
            year = now.Year;
            month = now.Month;
        }

        var monthStart = new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc);
        if (monthStart < earliestMonth)
            monthStart = earliestMonth;

        var isCurrentMonth = monthStart.Year == now.Year && monthStart.Month == now.Month;
        var periodEnd = isCurrentMonth
            ? now
            : monthStart.AddMonths(1).AddSeconds(-1);

        return new StockCardPeriod(
            $"{monthStart:yyyy-MM}",
            monthStart,
            periodEnd,
            archiveCutoff,
            isCurrentMonth);
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
    public IReadOnlyList<StockCardLedgerEntry> Entries { get; init; } = [];
}

public sealed record StockCardPeriod(
    string MonthKey,
    DateTime MonthStart,
    DateTime PeriodEnd,
    DateTime ArchiveCutoff,
    bool IsCurrentMonth);

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
    public string Reason { get; init; } = string.Empty;
    public string ReferenceNumber { get; init; } = string.Empty;
    public string FifoDetail { get; init; } = string.Empty;
    public decimal RunningBalance { get; init; }
    public decimal AverageCogsAfter { get; init; }
    public string FifoPolicy { get; init; } = "FIFO";
    public int SplitIndex { get; init; }
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
