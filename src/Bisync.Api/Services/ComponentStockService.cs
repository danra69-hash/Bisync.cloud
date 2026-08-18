using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace Bisync.Api.Services;

public class ComponentStockService(
    BisyncDbContext db,
    FifoBatchIssueService fifoBatches,
    AccountingBridgeService accountingBridge)
{
    public async Task<decimal> GetOnHandAsync(
        string componentId,
        string locationExternalId,
        string uom,
        CancellationToken cancellationToken = default)
    {
        var normalizedUom = NormalizeUom(uom);
        var purchases = await db.InventoryPurchases
            .AsNoTracking()
            .Where(p => p.ComponentId == componentId)
            .ToListAsync(cancellationToken);

        var purchaseQty = purchases
            .Where(p => StockLocationRules.PurchaseMatchesLocation(p.LocationIdsJson, locationExternalId))
            .Where(p => NormalizeUom(p.Uom) == normalizedUom)
            .Sum(p => p.Quantity);

        var movementRows = await db.InventoryMovements
            .AsNoTracking()
            .Where(m => m.ComponentId == componentId)
            .ToListAsync(cancellationToken);

        var movementQty = movementRows
            .Where(m => StockLocationRules.MovementMatchesLocation(m.LocationExternalId, locationExternalId))
            .Where(m => NormalizeUom(m.Uom) == normalizedUom)
            .Sum(m => m.QtyDelta);

        return purchaseQty + movementQty;
    }

    public void RecordDeduction(
        string componentId,
        string componentName,
        string locationExternalId,
        decimal quantity,
        string uom,
        string reason,
        string referenceType,
        int referenceId,
        int? companyId)
    {
        RecordDeductionAsync(
            componentId,
            componentName,
            locationExternalId,
            quantity,
            uom,
            reason,
            referenceType,
            referenceId,
            companyId).GetAwaiter().GetResult();
    }

    public async Task RecordDeductionAsync(
        string componentId,
        string componentName,
        string locationExternalId,
        decimal quantity,
        string uom,
        string reason,
        string referenceType,
        int referenceId,
        int? companyId,
        CancellationToken cancellationToken = default,
        DateTime? createdAt = null,
        decimal? unitPriceOverride = null)
    {
        if (quantity <= 0)
            return;

        var ownsTx = db.Database.CurrentTransaction is null;
        await using var tx = ownsTx
            ? await db.Database.BeginTransactionAsync(cancellationToken)
            : null;

        try
        {
            var issue = await fifoBatches.IssueAsync(
                componentId,
                locationExternalId,
                uom,
                quantity,
                referenceType,
                referenceId.ToString(),
                companyId,
                cancellationToken);

            var unitPrice = unitPriceOverride ?? issue.UnitPrice;

            db.InventoryMovements.Add(new InventoryMovement
            {
                ComponentId = componentId,
                ComponentName = componentName,
                LocationExternalId = locationExternalId,
                QtyDelta = -quantity,
                Uom = uom.Trim(),
                UnitPrice = StockCardFifoEngine.RoundUnitPrice(unitPrice),
                Reason = $"{reason} [fifo:{issue.TransactionId:N}]",
                ReferenceType = referenceType,
                ReferenceId = referenceId,
                CompanyId = companyId,
                CreatedAt = createdAt ?? DateTime.UtcNow,
            });

            if (ownsTx)
            {
                await db.SaveChangesAsync(cancellationToken);
                await tx!.CommitAsync(cancellationToken);
            }

            if (companyId is > 0)
            {
                await accountingBridge.OnFifoIssueAsync(
                    companyId.Value,
                    locationExternalId,
                    componentId,
                    componentName,
                    quantity,
                    uom,
                    unitPrice,
                    referenceType,
                    referenceId,
                    cancellationToken);
            }
        }
        catch
        {
            if (ownsTx && tx is not null)
                await tx.RollbackAsync(cancellationToken);
            throw;
        }
    }

    public void RecordAddition(
        string componentId,
        string componentName,
        string locationExternalId,
        decimal quantity,
        string uom,
        string reason,
        string referenceType,
        int referenceId,
        int? companyId,
        DateTime? createdAt = null,
        decimal unitPrice = 0)
    {
        if (quantity <= 0) return;

        var at = createdAt ?? DateTime.UtcNow;
        var price = unitPrice > 0 ? StockCardFifoEngine.RoundUnitPrice(unitPrice) : 0m;

        db.InventoryMovements.Add(new InventoryMovement
        {
            ComponentId = componentId,
            ComponentName = componentName,
            LocationExternalId = locationExternalId,
            QtyDelta = quantity,
            Uom = uom.Trim(),
            UnitPrice = price,
            Reason = reason,
            ReferenceType = referenceType,
            ReferenceId = referenceId,
            CompanyId = companyId,
            CreatedAt = at,
        });

        // Cost-segregated inbound batch (guide step 1 / overage step 6).
        fifoBatches.RecordReceiptBatchAsync(
            componentId,
            locationExternalId,
            uom,
            quantity,
            price,
            at,
            sourcePurchaseId: null,
            companyId).GetAwaiter().GetResult();
    }

    static string NormalizeUom(string uom) => uom.Trim().ToUpperInvariant();
}
