using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

/// <summary>
/// Bridges operator purchase orders to online vendors' Active Sales inbox,
/// and materializes approved online POs as vendor-side sales summaries.
/// </summary>
public static class OnlineVendorOrderBridge
{
    public static async Task NotifyOnlineVendorOfPurchaseOrderAsync(BisyncDbContext db, PurchaseOrder order)
    {
        var vendor = await FindOperatorVendorAsync(db, order);
        if (vendor is null || !VendorEngagementService.IsOnlineVendor(vendor))
            return;
        if (!VendorEngagementService.IsFullyEngaged(vendor))
            return;

        var linkedCompanyId = vendor.LinkedCompanyId
            ?? await VendorEngagementService.ResolveLinkedCompanyIdAsync(db, vendor);
        if (linkedCompanyId is null)
            return;

        if (vendor.LinkedCompanyId is null)
        {
            vendor.LinkedCompanyId = linkedCompanyId;
            await db.SaveChangesAsync();
        }

        await UserNotificationService.NotifyCompanyUsersAsync(
            db,
            linkedCompanyId.Value,
            UserNotificationService.TypeInboundPurchaseOrder,
            $"New purchase order {order.PoNumber}",
            $"{order.VendorName} received PO {order.PoNumber} from {(string.IsNullOrWhiteSpace(order.InitiatedBy) ? "operator" : order.InitiatedBy)}. Approve it under Operation → Active Sales.",
            purchaseOrderId: order.Id);
    }

    public static async Task<Vendor?> FindOperatorVendorAsync(BisyncDbContext db, PurchaseOrder order)
    {
        if (!string.IsNullOrWhiteSpace(order.VendorExternalId))
        {
            var byExternal = await db.Vendors
                .FirstOrDefaultAsync(v => v.ExternalId == order.VendorExternalId.Trim());
            if (byExternal is not null) return byExternal;
        }

        var name = order.VendorName?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(name)) return null;

        return await db.Vendors
            .FirstOrDefaultAsync(v => v.Name.ToLower() == name.ToLower());
    }

    public static async Task<List<PurchaseOrder>> ListInboundForVendorCompanyAsync(
        BisyncDbContext db,
        int vendorCompanyId)
    {
        var vendorNames = await db.Vendors.AsNoTracking()
            .Where(v => v.LinkedCompanyId == vendorCompanyId
                && v.Type.ToLower() == "online"
                && v.Engaged)
            .Select(v => v.Name)
            .ToListAsync();

        var vendorExternalIds = await db.Vendors.AsNoTracking()
            .Where(v => v.LinkedCompanyId == vendorCompanyId
                && v.Type.ToLower() == "online"
                && v.Engaged)
            .Select(v => v.ExternalId)
            .ToListAsync();

        if (vendorNames.Count == 0 && vendorExternalIds.Count == 0)
            return [];

        var nameSet = vendorNames.Select(n => n.ToLower()).ToHashSet();
        var externalSet = vendorExternalIds.Select(e => e.ToLower()).ToHashSet();

        var candidates = await db.PurchaseOrders
            .AsNoTracking()
            .Include(p => p.Items)
            .Where(p => p.VendorAcceptedAt == null
                && p.Status != PurchaseOrderWorkflow.StatusReconciled
                && p.Status != PurchaseOrderWorkflow.StatusReceived
                && p.Status != PurchaseOrderWorkflow.StatusPendingApproval)
            .OrderByDescending(p => p.Id)
            .ToListAsync();

        return candidates
            .Where(p =>
                (!string.IsNullOrWhiteSpace(p.VendorExternalId) && externalSet.Contains(p.VendorExternalId.ToLower()))
                || nameSet.Contains((p.VendorName ?? string.Empty).ToLower()))
            .ToList();
    }

    public static async Task<B2bSalesOrder?> MaterializeSalesSummaryAsync(
        BisyncDbContext db,
        PurchaseOrder order,
        int vendorCompanyId)
    {
        var existing = await db.B2bSalesOrders
            .Include(o => o.Lines)
            .FirstOrDefaultAsync(o => o.SourcePurchaseOrderId == order.Id && o.CompanyId == vendorCompanyId);
        if (existing is not null)
            return existing;

        var products = await db.Products.AsNoTracking()
            .Where(p => p.CompanyId == vendorCompanyId && p.Active && p.B2bEnabled)
            .ToListAsync();

        var locationId = PurchaseOrderWorkflow.DeserializeLocationIds(order.LocationIdsJson)
            .FirstOrDefault() ?? string.Empty;

        // Prefer a location belonging to the vendor company when available.
        var vendorLocation = await db.Locations.AsNoTracking()
            .Where(l => l.CompanyId == vendorCompanyId)
            .OrderBy(l => l.Id)
            .Select(l => l.ExternalId)
            .FirstOrDefaultAsync();
        if (!string.IsNullOrWhiteSpace(vendorLocation))
            locationId = vendorLocation;

        var lines = new List<B2bSalesOrderLine>();
        foreach (var item in order.Items)
        {
            var match = products.FirstOrDefault(p =>
                string.Equals(p.Name.Trim(), item.Name.Trim(), StringComparison.OrdinalIgnoreCase)
                || string.Equals(p.Name.Trim(), (item.ComponentName ?? string.Empty).Trim(), StringComparison.OrdinalIgnoreCase));

            if (match is null)
                continue;

            lines.Add(new B2bSalesOrderLine
            {
                ProductId = match.Id,
                ProductName = match.Name,
                LocationExternalId = locationId,
                QuantityOrdered = item.Quantity,
                QuantityLocked = 0,
                Uom = string.IsNullOrWhiteSpace(item.DeliveryPackage) ? item.Unit : item.DeliveryPackage,
                Rrp = item.UnitPrice,
                Status = "open",
            });
        }

        if (lines.Count == 0)
            return null;

        var count = await db.B2bSalesOrders.CountAsync(o => o.CompanyId == vendorCompanyId);
        var buyerCompany = order.CompanyId is int cid
            ? await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cid)
            : null;

        var salesOrder = new B2bSalesOrder
        {
            CompanyId = vendorCompanyId,
            OrderNumber = $"SO-{vendorCompanyId:D3}-{count + 1:D5}",
            CustomerExternalId = buyerCompany is null ? $"PO-{order.Id}" : $"CO-{buyerCompany.Id}",
            CustomerName = buyerCompany?.Name ?? order.InitiatedBy ?? "Online buyer",
            Source = "online_order",
            SourcePurchaseOrderId = order.Id,
            Status = "confirmed",
            LockPeriodDays = 0,
            IssuedDate = order.OrderDate.ToString("yyyy-MM-dd"),
            LockExpiryDate = string.Empty,
            CustomerAcceptedAt = DateTime.UtcNow,
            CustomerAcceptedBy = order.VendorAcceptedBy,
            ShareToken = Guid.NewGuid().ToString("N"),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Lines = lines,
        };

        db.B2bSalesOrders.Add(salesOrder);
        await db.SaveChangesAsync();
        return salesOrder;
    }
}
