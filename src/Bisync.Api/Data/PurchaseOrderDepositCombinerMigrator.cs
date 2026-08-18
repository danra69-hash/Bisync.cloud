using Bisync.Api.Models;
using Bisync.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Bisync.Api.Data;

/// <summary>
/// Idempotent migrator: merge duplicate returnable-deposit lines on existing POs
/// using the same key as create-time combine (name + UOM + unit price).
/// </summary>
public static class PurchaseOrderDepositCombinerMigrator
{
    /// <summary>
    /// Combine duplicate deposit lines within <paramref name="db"/>.
    /// Returns the number of PurchaseOrderItem rows removed.
    /// </summary>
    public static async Task<int> ApplyAsync(
        BisyncDbContext db,
        ILogger? logger = null,
        CancellationToken cancellationToken = default)
    {
        if (!await DatabaseSchemaHelper.TableExistsAsync(db, "PurchaseOrderItems"))
            return 0;

        var hasDepositFlag = await DatabaseSchemaHelper.ColumnExistsAsync(db, "PurchaseOrderItems", "IsReturnableDeposit");
        if (!hasDepositFlag)
            return 0;

        var deposits = await db.PurchaseOrderItems.AsNoTracking()
            .Where(i => i.IsReturnableDeposit)
            .Select(i => new
            {
                i.Id,
                i.PurchaseOrderId,
                i.Name,
                i.ReturnableItemName,
                i.Unit,
                i.ComponentUom,
                i.UnitPrice,
            })
            .ToListAsync(cancellationToken);

        if (deposits.Count < 2)
            return 0;

        var poIds = deposits
            .GroupBy(i => i.PurchaseOrderId)
            .Where(g =>
            {
                var keys = g.Select(i =>
                {
                    var name = string.IsNullOrWhiteSpace(i.ReturnableItemName)
                        ? (i.Name ?? string.Empty).Trim()
                        : i.ReturnableItemName.Trim();
                    var uom = string.IsNullOrWhiteSpace(i.Unit)
                        ? (i.ComponentUom ?? string.Empty).Trim()
                        : i.Unit.Trim();
                    return $"{name.ToLowerInvariant()}|{uom.ToLowerInvariant()}|{i.UnitPrice:0.####}";
                }).ToList();
                return keys.Count != keys.Distinct(StringComparer.OrdinalIgnoreCase).Count();
            })
            .Select(g => g.Key)
            .OrderBy(id => id)
            .ToList();

        if (poIds.Count == 0)
            return 0;

        var removed = 0;
        foreach (var poId in poIds)
        {
            try
            {
                removed += await CombineOrderAsync(db, poId, cancellationToken);
            }
            catch (Exception ex)
            {
                logger?.LogWarning(ex, "Failed combining returnable deposits on PO {PurchaseOrderId}", poId);
            }
        }

        if (removed > 0)
            logger?.LogInformation(
                "Combined returnable deposit lines on {OrderCount} PO(s); removed {RemovedCount} duplicate line(s).",
                poIds.Count,
                removed);

        return removed;
    }

    /// <summary>
    /// Run combine on each distinct provisioned tenant operational DB.
    /// Shared/control DB should call <see cref="ApplyAsync"/> separately (e.g. via SchemaPatcher).
    /// </summary>
    public static async Task<int> ApplyAcrossProvisionedTenantsAsync(
        BisyncDbContext controlDb,
        ILogger? logger = null,
        CancellationToken cancellationToken = default)
    {
        var total = 0;
        var connections = await controlDb.TenantConnections.AsNoTracking()
            .Where(t => t.IsActive)
            .Select(t => new { t.CompanyId, t.ConnectionString })
            .ToListAsync(cancellationToken);

        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var conn in connections)
        {
            if (string.IsNullOrWhiteSpace(conn.ConnectionString))
                continue;
            if (!seen.Add(conn.ConnectionString.Trim()))
                continue;

            try
            {
                var options = new DbContextOptionsBuilder<BisyncDbContext>()
                    .UseNpgsql(conn.ConnectionString)
                    .Options;
                await using var ops = new BisyncDbContext(options);
                total += await ApplyAsync(ops, logger, cancellationToken);
            }
            catch (Exception ex)
            {
                logger?.LogWarning(
                    ex,
                    "Returnable deposit combine failed for provisioned company {CompanyId}",
                    conn.CompanyId);
            }
        }

        return total;
    }

    static async Task<int> CombineOrderAsync(
        BisyncDbContext db,
        int purchaseOrderId,
        CancellationToken cancellationToken)
    {
        var items = await db.PurchaseOrderItems
            .Where(i => i.PurchaseOrderId == purchaseOrderId && i.IsReturnableDeposit)
            .OrderBy(i => i.Id)
            .ToListAsync(cancellationToken);

        if (items.Count < 2)
            return 0;

        var groups = items
            .GroupBy(PurchaseOrderWorkflow.ReturnableDepositCombineKey, StringComparer.OrdinalIgnoreCase)
            .Where(g => g.Count() > 1)
            .ToList();

        if (groups.Count == 0)
            return 0;

        var removeIds = new List<int>();
        var remap = new Dictionary<int, int>();

        foreach (var group in groups)
        {
            var ordered = group.OrderBy(i => i.Id).ToList();
            var keeper = ordered[0];
            NormalizeDepositLine(keeper);

            foreach (var duplicate in ordered.Skip(1))
            {
                MergeDepositInto(keeper, duplicate);
                removeIds.Add(duplicate.Id);
                remap[duplicate.Id] = keeper.Id;
            }
        }

        if (removeIds.Count == 0)
            return 0;

        if (remap.Count > 0)
            await RemapReferencesAsync(db, remap, cancellationToken);

        var toRemove = items.Where(i => removeIds.Contains(i.Id)).ToList();
        db.PurchaseOrderItems.RemoveRange(toRemove);
        await db.SaveChangesAsync(cancellationToken);
        return removeIds.Count;
    }

    static void NormalizeDepositLine(PurchaseOrderItem item)
    {
        var name = string.IsNullOrWhiteSpace(item.ReturnableItemName)
            ? item.Name.Trim()
            : item.ReturnableItemName.Trim();
        var uom = string.IsNullOrWhiteSpace(item.Unit) ? item.ComponentUom.Trim() : item.Unit.Trim();
        item.Name = name;
        item.ComponentName = name;
        item.ReturnableItemName = name;
        item.Unit = uom;
        item.ComponentUom = string.IsNullOrWhiteSpace(item.ComponentUom) ? uom : item.ComponentUom;
        item.DeliveryPackage = string.IsNullOrWhiteSpace(item.DeliveryPackage) ? uom : item.DeliveryPackage;
        item.VendorProductId = string.Empty;
        item.ComponentId = string.Empty;
    }

    static void MergeDepositInto(PurchaseOrderItem keeper, PurchaseOrderItem duplicate)
    {
        keeper.Quantity += duplicate.Quantity;
        keeper.DeliveredQuantity += duplicate.DeliveredQuantity;
        keeper.DrawnQuantity += duplicate.DrawnQuantity;
        keeper.TaxAmount += duplicate.TaxAmount;
        keeper.ReceivedQuantity = SumNullable(keeper.ReceivedQuantity, duplicate.ReceivedQuantity);
        keeper.ReconciledQuantity = SumNullable(keeper.ReconciledQuantity, duplicate.ReconciledQuantity);

        if (keeper.ReceivedUnitPrice is null && duplicate.ReceivedUnitPrice is not null)
            keeper.ReceivedUnitPrice = duplicate.ReceivedUnitPrice;
        if (keeper.ReconciledUnitPrice is null && duplicate.ReconciledUnitPrice is not null)
            keeper.ReconciledUnitPrice = duplicate.ReconciledUnitPrice;
        if (keeper.ReceivedTemperature is null && duplicate.ReceivedTemperature is not null)
            keeper.ReceivedTemperature = duplicate.ReceivedTemperature;
        if (string.IsNullOrWhiteSpace(keeper.ProductExpiryDate)
            && !string.IsNullOrWhiteSpace(duplicate.ProductExpiryDate))
            keeper.ProductExpiryDate = duplicate.ProductExpiryDate;
        if (string.IsNullOrWhiteSpace(keeper.HalalCertNo)
            && !string.IsNullOrWhiteSpace(duplicate.HalalCertNo))
            keeper.HalalCertNo = duplicate.HalalCertNo;
        if (keeper.IssuedUnitPrice == 0 && duplicate.IssuedUnitPrice != 0)
            keeper.IssuedUnitPrice = duplicate.IssuedUnitPrice;
    }

    static decimal? SumNullable(decimal? a, decimal? b)
    {
        if (a is null && b is null)
            return null;
        return (a ?? 0m) + (b ?? 0m);
    }

    static async Task RemapReferencesAsync(
        BisyncDbContext db,
        Dictionary<int, int> remap,
        CancellationToken cancellationToken)
    {
        var victimIds = remap.Keys.ToList();

        if (await DatabaseSchemaHelper.TableExistsAsync(db, "CreditNotes")
            && await DatabaseSchemaHelper.ColumnExistsAsync(db, "CreditNotes", "PurchaseOrderItemId"))
        {
            var notes = await db.CreditNotes
                .Where(c => victimIds.Contains(c.PurchaseOrderItemId))
                .ToListAsync(cancellationToken);
            foreach (var note in notes)
            {
                if (remap.TryGetValue(note.PurchaseOrderItemId, out var keeperId))
                    note.PurchaseOrderItemId = keeperId;
            }
        }

        if (await DatabaseSchemaHelper.TableExistsAsync(db, "InventoryPurchases")
            && await DatabaseSchemaHelper.ColumnExistsAsync(db, "InventoryPurchases", "PurchaseOrderItemId"))
        {
            var purchases = await db.InventoryPurchases
                .Where(p => victimIds.Contains(p.PurchaseOrderItemId))
                .ToListAsync(cancellationToken);
            foreach (var purchase in purchases)
            {
                if (remap.TryGetValue(purchase.PurchaseOrderItemId, out var keeperId))
                    purchase.PurchaseOrderItemId = keeperId;
            }
        }
    }
}
