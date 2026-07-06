using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Bisync.Api.Services;

public class StockCardArchiveService(
    BisyncDbContext db,
    StockCardArchiveDbContext archiveDb,
    IOptions<StockCardArchiveOptions> options,
    ILogger<StockCardArchiveService> logger)
{
    public int RetentionYears => Math.Max(1, options.Value.RetentionYears);

    public DateTime ResolveArchiveCutoffUtc()
        => DateTime.UtcNow.Date.AddYears(-RetentionYears);

    public async Task<IReadOnlyList<StockCardArchiveRun>> GetRecentRunsAsync(
        int take,
        CancellationToken cancellationToken = default) =>
        await archiveDb.ArchiveRuns
            .AsNoTracking()
            .OrderByDescending(r => r.RanAt)
            .Take(Math.Max(1, take))
            .ToListAsync(cancellationToken);

    public async Task<StockCardArchiveRun> ArchiveExpiredRecordsAsync(CancellationToken cancellationToken = default)
    {
        var cutoff = ResolveArchiveCutoffUtc();
        var archivedAt = DateTime.UtcNow;
        var consolidationTotals = new Dictionary<ConsolidationKey, decimal>();
        var consolidationPrices = new Dictionary<ConsolidationKey, decimal>();

        var archivedMovementIds = await archiveDb.ArchivedInventoryMovements
            .Select(m => m.OriginalId)
            .ToListAsync(cancellationToken);
        var archivedPurchaseIds = await archiveDb.ArchivedInventoryPurchases
            .Select(p => p.OriginalId)
            .ToListAsync(cancellationToken);
        var archivedLogIds = await archiveDb.ArchivedProductProductionLogs
            .Select(l => l.OriginalId)
            .ToListAsync(cancellationToken);

        var archivedMovementIdSet = archivedMovementIds.ToHashSet();
        var archivedPurchaseIdSet = archivedPurchaseIds.ToHashSet();
        var archivedLogIdSet = archivedLogIds.ToHashSet();

        var expiredMovements = (await db.InventoryMovements
            .Where(m => m.CreatedAt < cutoff)
            .Where(m => m.ReferenceType != "stock_card_archive_opening")
            .OrderBy(m => m.Id)
            .ToListAsync(cancellationToken))
            .Where(m => !archivedMovementIdSet.Contains(m.Id))
            .ToList();

        var expiredPurchases = (await db.InventoryPurchases
            .Where(p => p.DateCreatedInStock < cutoff)
            .OrderBy(p => p.Id)
            .ToListAsync(cancellationToken))
            .Where(p => !archivedPurchaseIdSet.Contains(p.Id))
            .ToList();

        var expiredLogs = (await db.ProductProductionLogs
            .Where(l => l.CreatedAt < cutoff)
            .OrderBy(l => l.Id)
            .ToListAsync(cancellationToken))
            .Where(l => !archivedLogIdSet.Contains(l.Id))
            .ToList();

        if (expiredMovements.Count == 0 && expiredPurchases.Count == 0 && expiredLogs.Count == 0)
        {
            logger.LogInformation("Stock card archive: no records older than {Cutoff:u}", cutoff);
            return await RecordRunAsync(cutoff, archivedAt, 0, 0, 0, 0, "No records to archive.", cancellationToken);
        }

        foreach (var movement in expiredMovements)
        {
            archiveDb.ArchivedInventoryMovements.Add(MapMovement(movement, archivedAt));
            AddConsolidation(
                consolidationTotals,
                consolidationPrices,
                movement.ComponentId,
                movement.ComponentName,
                movement.LocationExternalId,
                movement.Uom,
                movement.CompanyId,
                movement.QtyDelta,
                movement.UnitPrice);
        }

        foreach (var purchase in expiredPurchases)
        {
            archiveDb.ArchivedInventoryPurchases.Add(MapPurchase(purchase, archivedAt));

            var locations = PurchaseOrderWorkflow.DeserializeLocationIds(purchase.LocationIdsJson);
            if (locations.Count == 0)
            {
                AddConsolidation(
                    consolidationTotals,
                    consolidationPrices,
                    purchase.ComponentId,
                    purchase.ComponentName,
                    StockLocationRules.SharedLocationId,
                    purchase.Uom,
                    purchase.CompanyId,
                    purchase.Quantity,
                    purchase.UnitPrice);
            }
            else
            {
                foreach (var locationId in locations)
                {
                    AddConsolidation(
                        consolidationTotals,
                        consolidationPrices,
                        purchase.ComponentId,
                        purchase.ComponentName,
                        locationId,
                        purchase.Uom,
                        purchase.CompanyId,
                        purchase.Quantity,
                        purchase.UnitPrice);
                }
            }
        }

        foreach (var log in expiredLogs)
            archiveDb.ArchivedProductProductionLogs.Add(MapProductionLog(log, archivedAt));

        await archiveDb.SaveChangesAsync(cancellationToken);

        var consolidationCount = await InsertConsolidationMovementsAsync(
            consolidationTotals,
            consolidationPrices,
            cutoff,
            cancellationToken);

        db.InventoryMovements.RemoveRange(expiredMovements);
        db.InventoryPurchases.RemoveRange(expiredPurchases);
        db.ProductProductionLogs.RemoveRange(expiredLogs);
        await db.SaveChangesAsync(cancellationToken);

        var notes =
            $"Archived to {StockCardArchivePaths.ArchiveFileName}. Cutoff {cutoff:yyyy-MM-dd}.";
        logger.LogInformation(
            "Stock card archive complete: {Movements} movements, {Purchases} purchases, {Logs} production logs, {Consolidations} consolidation movements.",
            expiredMovements.Count,
            expiredPurchases.Count,
            expiredLogs.Count,
            consolidationCount);

        return await RecordRunAsync(
            cutoff,
            archivedAt,
            expiredMovements.Count,
            expiredPurchases.Count,
            expiredLogs.Count,
            consolidationCount,
            notes,
            cancellationToken);
    }

    async Task<int> InsertConsolidationMovementsAsync(
        Dictionary<ConsolidationKey, decimal> totals,
        Dictionary<ConsolidationKey, decimal> prices,
        DateTime cutoff,
        CancellationToken cancellationToken)
    {
        var created = 0;

        foreach (var (key, qtyDelta) in totals)
        {
            if (qtyDelta == 0)
                continue;

            var alreadyExists = await db.InventoryMovements.AnyAsync(
                m => m.ReferenceType == "stock_card_archive_opening"
                     && m.ComponentId == key.ComponentId
                     && m.LocationExternalId == key.LocationExternalId
                     && m.Uom == key.Uom
                     && m.CompanyId == key.CompanyId,
                cancellationToken);
            if (alreadyExists)
                continue;

            prices.TryGetValue(key, out var unitPrice);
            db.InventoryMovements.Add(new InventoryMovement
            {
                ComponentId = key.ComponentId,
                ComponentName = key.ComponentName,
                LocationExternalId = key.LocationExternalId,
                QtyDelta = qtyDelta,
                Uom = key.Uom,
                UnitPrice = unitPrice,
                Reason = $"Stock card archive opening balance (pre-{cutoff:yyyy-MM-dd})",
                ReferenceType = "stock_card_archive_opening",
                ReferenceId = 0,
                CompanyId = key.CompanyId,
                CreatedAt = cutoff,
            });
            created++;
        }

        if (created > 0)
            await db.SaveChangesAsync(cancellationToken);

        return created;
    }

    async Task<StockCardArchiveRun> RecordRunAsync(
        DateTime cutoff,
        DateTime archivedAt,
        int movements,
        int purchases,
        int logs,
        int consolidations,
        string notes,
        CancellationToken cancellationToken)
    {
        var run = new StockCardArchiveRun
        {
            RanAt = archivedAt,
            ArchiveCutoff = cutoff,
            MovementsArchived = movements,
            PurchasesArchived = purchases,
            ProductionLogsArchived = logs,
            ConsolidationMovementsCreated = consolidations,
            Notes = notes,
        };
        archiveDb.ArchiveRuns.Add(run);
        await archiveDb.SaveChangesAsync(cancellationToken);
        return run;
    }

    static void AddConsolidation(
        Dictionary<ConsolidationKey, decimal> totals,
        Dictionary<ConsolidationKey, decimal> prices,
        string componentId,
        string componentName,
        string locationExternalId,
        string uom,
        int? companyId,
        decimal qtyDelta,
        decimal unitPrice)
    {
        var key = new ConsolidationKey(
            componentId,
            componentName,
            locationExternalId,
            uom.Trim(),
            companyId);

        totals[key] = totals.GetValueOrDefault(key) + qtyDelta;
        if (unitPrice > 0)
            prices[key] = unitPrice;
    }

    static ArchivedInventoryMovement MapMovement(InventoryMovement movement, DateTime archivedAt) =>
        new()
        {
            OriginalId = movement.Id,
            ArchivedAt = archivedAt,
            ComponentId = movement.ComponentId,
            ComponentName = movement.ComponentName,
            LocationExternalId = movement.LocationExternalId,
            QtyDelta = movement.QtyDelta,
            Uom = movement.Uom,
            Reason = movement.Reason,
            ReferenceType = movement.ReferenceType,
            ReferenceId = movement.ReferenceId,
            CompanyId = movement.CompanyId,
            UnitPrice = movement.UnitPrice,
            CreatedAt = movement.CreatedAt,
        };

    static ArchivedInventoryPurchase MapPurchase(InventoryPurchase purchase, DateTime archivedAt) =>
        new()
        {
            OriginalId = purchase.Id,
            ArchivedAt = archivedAt,
            ComponentId = purchase.ComponentId,
            ComponentName = purchase.ComponentName,
            Quantity = purchase.Quantity,
            Uom = purchase.Uom,
            UnitPrice = purchase.UnitPrice,
            DateOrdered = purchase.DateOrdered,
            DateCreatedInStock = purchase.DateCreatedInStock,
            PurchaseOrderId = purchase.PurchaseOrderId,
            PurchaseOrderItemId = purchase.PurchaseOrderItemId,
            CompanyId = purchase.CompanyId,
            LocationIdsJson = purchase.LocationIdsJson,
        };

    static ArchivedProductProductionLog MapProductionLog(ProductProductionLog log, DateTime archivedAt) =>
        new()
        {
            OriginalId = log.Id,
            ArchivedAt = archivedAt,
            ProductId = log.ProductId,
            EntryType = log.EntryType,
            Quantity = log.Quantity,
            ProductionDate = log.ProductionDate,
            ExpiryDate = log.ExpiryDate,
            BatchNumber = log.BatchNumber,
            LocationIdsJson = log.LocationIdsJson,
            CompanyId = log.CompanyId,
            CreatedAt = log.CreatedAt,
        };

    readonly record struct ConsolidationKey(
        string ComponentId,
        string ComponentName,
        string LocationExternalId,
        string Uom,
        int? CompanyId);
}
