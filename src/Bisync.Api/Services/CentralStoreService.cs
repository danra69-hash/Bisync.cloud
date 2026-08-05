using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

public class CentralStoreService(
    BisyncDbContext db,
    ComponentStockService componentStock,
    ComponentFifoCostingService fifoCosting)
{
    public const string RefStoreIssue = "store_issue";
    public const string RefStoreHoldIn = "store_hold_in";

    public async Task<CentralStoreConfig?> GetConfigAsync(
        int companyId,
        CancellationToken cancellationToken = default)
    {
        return await db.CentralStoreConfigs
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.CompanyId == companyId, cancellationToken);
    }

    public async Task<CentralStoreConfig?> GetActiveConfigAsync(
        int companyId,
        CancellationToken cancellationToken = default)
    {
        var config = await GetConfigAsync(companyId, cancellationToken);
        if (config is null || !config.Active) return null;
        if (string.IsNullOrWhiteSpace(config.StoreLocationExternalId)
            || string.IsNullOrWhiteSpace(config.KitchenLocationExternalId))
            return null;
        return config;
    }

    public async Task<CentralStoreConfig> ActivateAsync(
        int companyId,
        string storeLocationExternalId,
        string kitchenLocationExternalId,
        CancellationToken cancellationToken = default)
    {
        var store = storeLocationExternalId.Trim().ToLowerInvariant();
        var kitchen = kitchenLocationExternalId.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(store) || string.IsNullOrWhiteSpace(kitchen))
            throw new InvalidOperationException("Store and kitchen locations are required.");
        if (string.Equals(store, kitchen, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Store and kitchen locations must be different.");

        var config = await db.CentralStoreConfigs
            .FirstOrDefaultAsync(c => c.CompanyId == companyId, cancellationToken);
        if (config is null)
        {
            config = new CentralStoreConfig { CompanyId = companyId };
            db.CentralStoreConfigs.Add(config);
        }

        config.Active = true;
        config.StoreLocationExternalId = store;
        config.KitchenLocationExternalId = kitchen;
        config.ActivatedAt ??= DateTime.UtcNow;
        config.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return config;
    }

    public async Task<CentralStoreConfig> DeactivateAsync(
        int companyId,
        CancellationToken cancellationToken = default)
    {
        var config = await db.CentralStoreConfigs
            .FirstOrDefaultAsync(c => c.CompanyId == companyId, cancellationToken);
        if (config is null)
        {
            config = new CentralStoreConfig { CompanyId = companyId, Active = false };
            db.CentralStoreConfigs.Add(config);
        }
        else
        {
            config.Active = false;
            config.UpdatedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync(cancellationToken);
        return config;
    }

    public async Task<StoreRequisition> CreateRequisitionFromToProduceAsync(
        Product product,
        decimal batchQty,
        CentralStoreConfig config,
        IReadOnlyList<ProduceComponentRequirement> requirements,
        CancellationToken cancellationToken = default)
    {
        if (batchQty <= 0)
            throw new InvalidOperationException("Batch quantity must be greater than zero.");

        var lines = requirements
            .Where(r => r.RequiredQty > 0)
            .GroupBy(r => r.ComponentId, StringComparer.OrdinalIgnoreCase)
            .Select(g =>
            {
                var first = g.First();
                return new StoreRequisitionLine
                {
                    ComponentId = first.ComponentId,
                    ComponentName = first.ComponentName,
                    Uom = first.Uom,
                    RequiredQty = DecimalRounding.ToDb(g.Sum(x => x.RequiredQty)),
                };
            })
            .ToList();

        if (lines.Count == 0)
            throw new InvalidOperationException("No component requirements to requisition from store.");

        var entry = new StoreRequisition
        {
            CompanyId = product.CompanyId,
            ProductId = product.Id,
            ProductName = product.Name ?? product.ProductId ?? $"Product {product.Id}",
            IsSubProduct = product.IsSubProduct,
            BatchQty = DecimalRounding.ToDb(batchQty),
            StoreLocationExternalId = config.StoreLocationExternalId,
            KitchenLocationExternalId = config.KitchenLocationExternalId,
            Status = StoreRequisition.StatusPending,
            RequestedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            Lines = lines,
        };

        db.StoreRequisitions.Add(entry);
        await db.SaveChangesAsync(cancellationToken);

        entry.RequisitionNumber = $"SR-{DateTime.UtcNow:yyyyMMdd}-{entry.Id}";
        await db.SaveChangesAsync(cancellationToken);
        return entry;
    }

    public async Task<StoreRequisition> IssueAsync(
        int requisitionId,
        int companyId,
        string? issuedBy,
        CancellationToken cancellationToken = default)
    {
        var req = await db.StoreRequisitions
            .Include(r => r.Lines)
            .FirstOrDefaultAsync(r => r.Id == requisitionId && r.CompanyId == companyId, cancellationToken)
            ?? throw new InvalidOperationException("Store requisition not found.");

        if (!string.Equals(req.Status, StoreRequisition.StatusPending, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Only pending requisitions can be issued.");

        var store = req.StoreLocationExternalId;
        var kitchen = req.KitchenLocationExternalId;
        var asOf = DateTime.UtcNow;

        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            foreach (var line in req.Lines)
            {
                if (line.RequiredQty <= 0) continue;

                var onHand = await componentStock.GetOnHandAsync(
                    line.ComponentId, store, line.Uom, cancellationToken);
                if (line.RequiredQty > onHand + StockCardFifoEngine.QtyEpsilon)
                    throw new InvalidOperationException(
                        $"Insufficient store stock for {line.ComponentName}: need {line.RequiredQty:0.####} {line.Uom}, have {onHand:0.####}.");

                var unitPrice = await fifoCosting.ResolveOutboundUnitPriceAsOfAsync(
                    line.ComponentId,
                    store,
                    line.Uom,
                    line.RequiredQty,
                    companyId,
                    asOf,
                    cancellationToken);

                await componentStock.RecordDeductionAsync(
                    line.ComponentId,
                    line.ComponentName,
                    store,
                    line.RequiredQty,
                    line.Uom,
                    $"Store issue — {req.RequisitionNumber}",
                    RefStoreIssue,
                    req.Id,
                    companyId,
                    cancellationToken,
                    createdAt: asOf,
                    unitPriceOverride: unitPrice);

                componentStock.RecordAddition(
                    line.ComponentId,
                    line.ComponentName,
                    kitchen,
                    line.RequiredQty,
                    line.Uom,
                    $"Store hold in — {req.RequisitionNumber}",
                    RefStoreHoldIn,
                    req.Id,
                    companyId,
                    createdAt: asOf,
                    unitPrice: unitPrice);

                line.IssuedQty = line.RequiredQty;
                line.UnitPrice = StockCardFifoEngine.RoundUnitPrice(unitPrice);

                db.ProductionStockHolds.Add(new ProductionStockHold
                {
                    CompanyId = companyId,
                    LocationExternalId = kitchen,
                    ComponentId = line.ComponentId,
                    ComponentName = line.ComponentName,
                    Uom = line.Uom,
                    Quantity = line.RequiredQty,
                    UnitPrice = line.UnitPrice,
                    StoreRequisitionId = req.Id,
                    StoreRequisitionLineId = line.Id,
                    ProductId = req.ProductId,
                    ProductName = req.ProductName,
                    Status = ProductionStockHold.StatusHeld,
                    CreatedAt = asOf,
                });
            }

            req.Status = StoreRequisition.StatusIssued;
            req.IssuedAt = asOf;
            req.IssuedBy = (issuedBy ?? string.Empty).Trim();
            await db.SaveChangesAsync(cancellationToken);
            await tx.CommitAsync(cancellationToken);
        }
        catch
        {
            await tx.RollbackAsync(cancellationToken);
            throw;
        }

        return req;
    }

    /// <summary>
    /// After production deducts kitchen stock, mark matching hold rows depleted.
    /// </summary>
    public async Task DepleteHoldsForProductionAsync(
        int productId,
        int? companyId,
        IReadOnlyList<string> kitchenLocationIds,
        IReadOnlyList<(string ComponentId, string Uom, decimal Qty)> usages,
        CancellationToken cancellationToken = default)
    {
        if (usages.Count == 0 || kitchenLocationIds.Count == 0) return;

        var locs = kitchenLocationIds
            .Select(l => l.Trim().ToLowerInvariant())
            .Where(l => l.Length > 0)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var holds = await db.ProductionStockHolds
            .Where(h => h.Status == ProductionStockHold.StatusHeld)
            .Where(h => h.ProductId == productId || productId <= 0)
            .Where(h => companyId == null || h.CompanyId == companyId)
            .Where(h => locs.Contains(h.LocationExternalId))
            .OrderBy(h => h.CreatedAt)
            .ThenBy(h => h.Id)
            .ToListAsync(cancellationToken);

        if (holds.Count == 0) return;

        var now = DateTime.UtcNow;
        foreach (var usage in usages)
        {
            var remaining = usage.Qty;
            if (remaining <= 0) continue;
            var uomNorm = (usage.Uom ?? string.Empty).Trim().ToUpperInvariant();

            foreach (var hold in holds.Where(h =>
                         string.Equals(h.ComponentId, usage.ComponentId, StringComparison.OrdinalIgnoreCase)
                         && (string.IsNullOrEmpty(uomNorm)
                             || string.Equals(h.Uom, usage.Uom, StringComparison.OrdinalIgnoreCase)
                             || string.Equals(h.Uom.Trim().ToUpperInvariant(), uomNorm, StringComparison.Ordinal))))
            {
                if (remaining <= StockCardFifoEngine.QtyEpsilon) break;
                if (hold.Quantity <= StockCardFifoEngine.QtyEpsilon) continue;

                var take = Math.Min(hold.Quantity, remaining);
                hold.Quantity = DecimalRounding.ToDb(hold.Quantity - take);
                remaining -= take;
                if (hold.Quantity <= StockCardFifoEngine.QtyEpsilon)
                {
                    hold.Quantity = 0;
                    hold.Status = ProductionStockHold.StatusDepleted;
                    hold.DepletedAt = now;
                }
            }
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    public static object MapConfig(CentralStoreConfig? c) => c is null
        ? new
        {
            active = false,
            storeLocationExternalId = "",
            kitchenLocationExternalId = "",
            activatedAt = (DateTime?)null,
            updatedAt = (DateTime?)null,
        }
        : new
        {
            id = c.Id,
            companyId = c.CompanyId,
            active = c.Active,
            storeLocationExternalId = c.StoreLocationExternalId,
            kitchenLocationExternalId = c.KitchenLocationExternalId,
            activatedAt = c.ActivatedAt,
            updatedAt = c.UpdatedAt,
        };

    public static object MapRequisition(StoreRequisition r) => new
    {
        id = r.Id,
        companyId = r.CompanyId,
        requisitionNumber = r.RequisitionNumber,
        productId = r.ProductId,
        productName = r.ProductName,
        isSubProduct = r.IsSubProduct,
        batchQty = r.BatchQty,
        storeLocationExternalId = r.StoreLocationExternalId,
        kitchenLocationExternalId = r.KitchenLocationExternalId,
        status = r.Status,
        requestedAt = r.RequestedAt,
        issuedAt = r.IssuedAt,
        issuedBy = r.IssuedBy,
        createdAt = r.CreatedAt,
        lines = r.Lines.Select(l => new
        {
            id = l.Id,
            componentId = l.ComponentId,
            componentName = l.ComponentName,
            uom = l.Uom,
            requiredQty = l.RequiredQty,
            issuedQty = l.IssuedQty,
            unitPrice = l.UnitPrice,
        }).ToList(),
    };

    public static object MapHold(ProductionStockHold h) => new
    {
        id = h.Id,
        companyId = h.CompanyId,
        locationExternalId = h.LocationExternalId,
        componentId = h.ComponentId,
        componentName = h.ComponentName,
        uom = h.Uom,
        quantity = h.Quantity,
        unitPrice = h.UnitPrice,
        storeRequisitionId = h.StoreRequisitionId,
        storeRequisitionLineId = h.StoreRequisitionLineId,
        productId = h.ProductId,
        productName = h.ProductName,
        status = h.Status,
        createdAt = h.CreatedAt,
        depletedAt = h.DepletedAt,
    };
}
