using Bisync.Api.Data;
using Bisync.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/companies/{companyId:int}/uoms")]
public class UomRenameController(BisyncDbContext db) : ControllerBase
{
    public sealed class RenameUomRequest
    {
        public string From { get; set; } = string.Empty;
        public string To { get; set; } = string.Empty;
    }

    /// <summary>
    /// Remap a renamed UOM across components, products, vendor products, orders, and stock for one company.
    /// Catalog rename itself is owned by the client RevMgmt component-catalog config.
    /// </summary>
    [HttpPost("rename")]
    public async Task<ActionResult<object>> Rename(int companyId, [FromBody] RenameUomRequest request, CancellationToken cancellationToken)
    {
        if (companyId <= 0)
            return BadRequest(new { message = "Company is required." });

        var exists = await db.Companies.AsNoTracking().AnyAsync(c => c.Id == companyId, cancellationToken);
        if (!exists)
            return NotFound(new { message = "Company not found." });

        var from = (request.From ?? string.Empty).Trim();
        var to = (request.To ?? string.Empty).Trim();
        if (from.Length == 0 || to.Length == 0)
            return BadRequest(new { message = "Both from and to UOM names are required." });
        if (string.Equals(from, to, StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "New UOM name must differ from the current name." });

        try
        {
            var counts = await UomRenameService.RemapAsync(db, companyId, from, to, cancellationToken);
            return Ok(new
            {
                companyId,
                from,
                to,
                total = counts.Total,
                counts = new
                {
                    ingredients = counts.Ingredients,
                    products = counts.Products,
                    productBomLines = counts.ProductBomLines,
                    productPackagingLines = counts.ProductPackagingLines,
                    vendorProducts = counts.VendorProducts,
                    orderTemplateItems = counts.OrderTemplateItems,
                    purchaseOrderItems = counts.PurchaseOrderItems,
                    inventoryPurchases = counts.InventoryPurchases,
                    inventoryMovements = counts.InventoryMovements,
                    cashPurchases = counts.CashPurchases,
                    wastageEntries = counts.WastageEntries,
                    transferEntries = counts.TransferEntries,
                    inventoryCountLines = counts.InventoryCountLines,
                    quoteRequestLines = counts.QuoteRequestLines,
                    sampleRequests = counts.SampleRequests,
                    promotionProducts = counts.PromotionProducts,
                    returnableGoodsReturns = counts.ReturnableGoodsReturns,
                    b2bSalesOrderLines = counts.B2bSalesOrderLines,
                },
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
