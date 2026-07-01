using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

public static class VendorProductPriceService
{
    public static async Task<List<object>> ApplyReconciledPricesAsync(
        BisyncDbContext db,
        IEnumerable<PurchaseOrderItem> items,
        int purchaseOrderId)
    {
        var updated = new List<object>();

        foreach (var item in items)
        {
            var vendorProductId = item.VendorProductId?.Trim() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(vendorProductId)) continue;

            var issuedPrice = item.IssuedUnitPrice > 0 ? item.IssuedUnitPrice : item.UnitPrice;
            var reconciledPrice = item.ReconciledUnitPrice ?? issuedPrice;
            if (Math.Abs(reconciledPrice - issuedPrice) < 0.0001m) continue;

            var row = await db.VendorProductPrices.FirstOrDefaultAsync(p => p.ExternalId == vendorProductId);
            if (row is null)
            {
                row = new VendorProductPrice
                {
                    ExternalId = vendorProductId,
                    DeliveryPrice = reconciledPrice,
                    UpdatedAt = DateTime.UtcNow,
                    LastPurchaseOrderId = purchaseOrderId,
                };
                db.VendorProductPrices.Add(row);
            }
            else
            {
                row.DeliveryPrice = reconciledPrice;
                row.UpdatedAt = DateTime.UtcNow;
                row.LastPurchaseOrderId = purchaseOrderId;
            }

            updated.Add(new { id = vendorProductId, deliveryPrice = reconciledPrice });
        }

        return updated;
    }
}
