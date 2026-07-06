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



        var unitPrice = unitPriceOverride ?? await fifoCosting.ResolveOutboundUnitPriceAsync(

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

            CreatedAt = createdAt ?? DateTime.UtcNow,

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

        int? companyId,

        DateTime? createdAt = null,

        decimal unitPrice = 0)

    {

        if (quantity <= 0) return;



        db.InventoryMovements.Add(new InventoryMovement

        {

            ComponentId = componentId,

            ComponentName = componentName,

            LocationExternalId = locationExternalId,

            QtyDelta = quantity,

            Uom = uom.Trim(),

            UnitPrice = unitPrice > 0 ? StockCardFifoEngine.RoundUnitPrice(unitPrice) : 0,

            Reason = reason,

            ReferenceType = referenceType,

            ReferenceId = referenceId,

            CompanyId = companyId,

            CreatedAt = createdAt ?? DateTime.UtcNow,

        });

    }



    static bool MatchesLocation(string locationIdsJson, string locationExternalId)
        => StockLocationRules.PurchaseMatchesLocation(locationIdsJson, locationExternalId);



    static string NormalizeUom(string uom) => uom.Trim().ToUpperInvariant();

}


