using Bisync.Api.Data;
using Bisync.Api.Models;
using Bisync.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

public class ComponentStockService(
    BisyncDbContext db,
    ComponentFifoCostingService fifoCosting)
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
            .Where(p => MatchesLocation(p.LocationIdsJson, locationExternalId))
            .Where(p => NormalizeUom(p.Uom) == normalizedUom)
            .Sum(p => p.Quantity);

        var movementRows = await db.InventoryMovements
            .AsNoTracking()
            .Where(m =>
                m.ComponentId == componentId
                && m.LocationExternalId == locationExternalId)
            .ToListAsync(cancellationToken);

        var movementQty = movementRows
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
        CancellationToken cancellationToken = default)
    {
        if (quantity <= 0)
            return;

        var unitPrice = await fifoCosting.ResolveOutboundUnitPriceAsync(
            componentId,
            locationExternalId,
            uom,
            quantity,
            companyId,
            cancellationToken);

        db.InventoryMovements.Add(new InventoryMovement
        {
            ComponentId = componentId,
            ComponentName = componentName,
            LocationExternalId = locationExternalId,
            QtyDelta = -quantity,
            Uom = uom.Trim(),
            UnitPrice = unitPrice,
            Reason = reason,
            ReferenceType = referenceType,
            ReferenceId = referenceId,
            CompanyId = companyId,
            CreatedAt = DateTime.UtcNow,
        });
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
        int? companyId)
    {
        if (quantity <= 0) return;

        db.InventoryMovements.Add(new InventoryMovement
        {
            ComponentId = componentId,
            ComponentName = componentName,
            LocationExternalId = locationExternalId,
            QtyDelta = quantity,
            Uom = uom.Trim(),
            Reason = reason,
            ReferenceType = referenceType,
            ReferenceId = referenceId,
            CompanyId = companyId,
            CreatedAt = DateTime.UtcNow,
        });
    }

    static bool MatchesLocation(string locationIdsJson, string locationExternalId)
    {
        var ids = PurchaseOrderWorkflow.DeserializeLocationIds(locationIdsJson);
        return ids.Count == 0 || ids.Contains(locationExternalId);
    }

    static string NormalizeUom(string uom) => uom.Trim().ToUpperInvariant();
}
