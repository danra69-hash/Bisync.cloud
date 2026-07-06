using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

/// <summary>
/// Resolves FIFO unit cost for component deductions at a single location.
/// Uses monthly B/F tranches: remaining stock at each calendar month boundary
/// collapses to one layer at average COGS; outbounds consume oldest tranche first.
/// </summary>
public class ComponentFifoCostingService(BisyncDbContext db)
{
    public async Task<decimal> ResolveOutboundUnitPriceAsync(
        string componentId,
        string locationExternalId,
        string uom,
        decimal quantity,
        int? companyId,
        CancellationToken cancellationToken = default)
    {
        return await ResolveOutboundUnitPriceAsOfAsync(
            componentId,
            locationExternalId,
            uom,
            quantity,
            companyId,
            asOfEnd: null,
            cancellationToken);
    }

    public async Task<decimal> ResolveOutboundUnitPriceAsOfAsync(
        string componentId,
        string locationExternalId,
        string uom,
        decimal quantity,
        int? companyId,
        DateTime? asOfEnd,
        CancellationToken cancellationToken = default)
    {
        if (quantity <= 0)
            return 0;

        var events = await LoadInboundEventsAsync(
            componentId,
            locationExternalId,
            uom,
            companyId,
            cancellationToken);

        if (asOfEnd is DateTime cutoff)
            events = events.Where(e => e.OccurredAt <= cutoff).ToList();

        var simulation = StockCardFifoEngine.Simulate(events);
        var layers = simulation.RemainingLayers.ToList();
        var consumed = StockCardFifoEngine.Consume(ref layers, quantity);
        return consumed.UnitPrice;
    }

    async Task<List<FifoEvent>> LoadInboundEventsAsync(
        string componentId,
        string locationExternalId,
        string uom,
        int? companyId,
        CancellationToken cancellationToken)
    {
        var normalizedUom = NormalizeUom(uom);
        var events = new List<FifoEvent>();

        var purchases = await db.InventoryPurchases.AsNoTracking()
            .Where(p => p.ComponentId == componentId)
            .ToListAsync(cancellationToken);

        if (companyId is int cid)
            purchases = purchases.Where(p => p.CompanyId is null || p.CompanyId == cid).ToList();

        foreach (var purchase in purchases)
        {
            if (!StockLocationRules.PurchaseMatchesLocation(purchase.LocationIdsJson, locationExternalId))
                continue;
            if (NormalizeUom(purchase.Uom) != normalizedUom)
                continue;

            events.Add(new FifoEvent
            {
                Id = purchase.Id,
                OccurredAt = purchase.DateCreatedInStock,
                EntryType = purchase.PurchaseOrderId > 0 ? "purchase" : "cash_purchase",
                Quantity = purchase.Quantity,
                SignedQty = purchase.Quantity,
                Uom = purchase.Uom,
                UnitPrice = purchase.UnitPrice,
            });
        }

        var movements = await db.InventoryMovements.AsNoTracking()
            .Where(m => m.ComponentId == componentId)
            .OrderBy(m => m.CreatedAt)
            .ThenBy(m => m.Id)
            .ToListAsync(cancellationToken);

        if (companyId is int companyFilter)
            movements = movements.Where(m => m.CompanyId is null || m.CompanyId == companyFilter).ToList();

        foreach (var movement in movements
                     .Where(m => StockLocationRules.MovementMatchesLocation(m.LocationExternalId, locationExternalId))
                     .Where(m => NormalizeUom(m.Uom) == normalizedUom))
        {
            var entryType = ClassifyMovement(movement);
            events.Add(new FifoEvent
            {
                Id = movement.Id,
                OccurredAt = movement.CreatedAt,
                EntryType = entryType,
                Quantity = Math.Abs(movement.QtyDelta),
                SignedQty = movement.QtyDelta,
                Uom = movement.Uom,
                UnitPrice = entryType is "adjustment_in" or "adjustment_out"
                    ? 0
                    : movement.UnitPrice,
            });
        }

        return events;
    }

    static string ClassifyMovement(InventoryMovement movement)
    {
        var refType = movement.ReferenceType.Trim().ToLowerInvariant();
        if (refType == "inventory_adjustment" || movement.Reason.Contains("adjust", StringComparison.OrdinalIgnoreCase))
            return movement.QtyDelta >= 0 ? "adjustment_in" : "adjustment_out";
        if (movement.QtyDelta >= 0 && refType is "transfer_in")
            return "transfer_in";
        if (movement.QtyDelta < 0)
            return refType is "pos_sale" or "online_order" or "offline_order" or "production"
                or "wastage" or "transfer_out"
                ? refType
                : "outbound";
        return "inbound";
    }

    static string NormalizeUom(string uom) => uom.Trim().ToUpperInvariant();
}
