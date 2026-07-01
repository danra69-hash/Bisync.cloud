using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

public static class PurchaseOrderShareService
{
    public static void EnsureShareToken(PurchaseOrder order)
    {
        if (string.IsNullOrWhiteSpace(order.VendorShareToken))
            order.VendorShareToken = Guid.NewGuid().ToString("N");
    }

    public static async Task EnsureShareTokensAsync(BisyncDbContext db, IEnumerable<PurchaseOrder> orders)
    {
        var changed = false;
        foreach (var order in orders)
        {
            if (string.IsNullOrWhiteSpace(order.VendorShareToken))
            {
                order.VendorShareToken = Guid.NewGuid().ToString("N");
                changed = true;
            }
        }

        if (changed)
            await db.SaveChangesAsync();
    }

    public static async Task BackfillMissingShareTokensAsync(BisyncDbContext db, IEnumerable<int> orderIds)
    {
        var ids = orderIds.Distinct().ToList();
        if (ids.Count == 0) return;

        var orders = await db.PurchaseOrders
            .Where(p => ids.Contains(p.Id) && (p.VendorShareToken == null || p.VendorShareToken == ""))
            .ToListAsync();

        if (orders.Count == 0) return;

        foreach (var order in orders)
            order.VendorShareToken = Guid.NewGuid().ToString("N");

        await db.SaveChangesAsync();
    }
}
