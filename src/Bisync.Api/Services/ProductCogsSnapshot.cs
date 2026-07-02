using Bisync.Api.Models;

namespace Bisync.Api.Services;

public static class ProductCogsSnapshot
{
    public static void CaptureIfChanged(Product product, decimal newTotalCost, decimal newPackagingCost, decimal newRrp)
    {
        var costChanged = product.TotalCost != newTotalCost || product.PackagingCost != newPackagingCost;
        var rrpChanged = product.Rrp != newRrp;
        if (!costChanged && !rrpChanged)
            return;

        product.PreviousTotalCost = product.TotalCost;
        product.PreviousPackagingCost = product.PackagingCost;
        product.PreviousRrp = product.Rrp;
    }
}
