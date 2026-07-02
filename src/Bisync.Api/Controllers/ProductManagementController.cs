using Bisync.Api.Contracts;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Bisync.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/product-management")]
public class ProductManagementController(
    BisyncDbContext db,
    ProductionInventoryService productionInventory) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> List(
        [FromQuery] int? companyId,
        [FromQuery] string? locationIds)
    {
        var locationIdList = ParseLocationIds(locationIds);
        if (locationIdList.Count == 0)
            return Ok(Array.Empty<object>());

        IQueryable<Product> productQuery = db.Products
            .AsNoTracking()
            .Where(p => p.Active && ((!p.IsSubProduct && p.B2bEnabled) || p.IsSubProduct));

        if (companyId is int id)
            productQuery = productQuery.Where(p => p.CompanyId == null || p.CompanyId == id);

        var products = await productQuery
            .OrderByDescending(p => p.UpdatedAt)
            .ThenByDescending(p => p.Id)
            .ToListAsync();

        var visibleProducts = products
            .Where(p => ProductMatchesLocations(p, locationIdList))
            .ToList();

        if (visibleProducts.Count == 0)
            return Ok(Array.Empty<object>());

        var productIds = visibleProducts.Select(p => p.Id).ToList();
        var stockRows = await db.ProductB2bLocationStocks
            .AsNoTracking()
            .Where(s => productIds.Contains(s.ProductId) && locationIdList.Contains(s.LocationExternalId))
            .ToListAsync();

        var stockByProduct = stockRows
            .GroupBy(s => s.ProductId)
            .ToDictionary(g => g.Key, g => g.ToList());

        return Ok(visibleProducts.Select(product =>
        {
            stockByProduct.TryGetValue(product.Id, out var rows);
            rows ??= [];
            return MapSummary(product, rows);
        }));
    }

    [HttpPatch("{productId:int}")]
    public async Task<ActionResult<object>> Patch(int productId, [FromBody] PatchProductManagementRequest request)
    {
        var product = await db.Products.FirstOrDefaultAsync(p => p.Id == productId);
        if (product is null)
            return NotFound();

        var locationIds = NormalizeLocationIds(request.LocationExternalIds);
        if (locationIds.Count == 0)
            return BadRequest(new { message = "Select at least one location." });

        if (request.PackageUnit is not null && !product.IsSubProduct)
        {
            var unit = request.PackageUnit.Trim();
            if (string.IsNullOrWhiteSpace(unit))
                return BadRequest(new { message = "Package unit cannot be empty." });
            product.B2bPackageUnit = unit;
            product.UpdatedAt = DateTime.UtcNow;
        }

        var stockRows = await EnsureStockRowsAsync(productId, locationIds);
        foreach (var row in stockRows)
        {
            if (request.InStock.HasValue)
                row.InStock = request.InStock.Value;
            if (request.SalesPerDay.HasValue)
                row.SalesPerDay = request.SalesPerDay.Value;
            row.UpdatedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync();

        var updatedRows = await db.ProductB2bLocationStocks
            .AsNoTracking()
            .Where(s => s.ProductId == productId && locationIds.Contains(s.LocationExternalId))
            .ToListAsync();

        return Ok(MapSummary(product, updatedRows));
    }

    [HttpPost("{productId:int}/to-produce")]
    public async Task<ActionResult<object>> ToProduce(int productId, [FromBody] ProductManagementActionRequest request)
    {
        var product = await db.Products.FirstOrDefaultAsync(p => p.Id == productId);
        if (product is null)
            return NotFound();

        var locationIds = NormalizeLocationIds(request.LocationExternalIds);
        if (locationIds.Count == 0)
            return BadRequest(new { message = "Select at least one location." });

        var stockRows = await EnsureStockRowsAsync(productId, locationIds);
        foreach (var row in stockRows)
        {
            var targetBatches = row.SalesPerDay > 0 ? row.SalesPerDay : 1;
            row.ToProduceQty = Math.Max(0, targetBatches - row.InStock);
            row.UpdatedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync();

        var updatedRows = await db.ProductB2bLocationStocks
            .AsNoTracking()
            .Where(s => s.ProductId == productId && locationIds.Contains(s.LocationExternalId))
            .ToListAsync();

        return Ok(MapSummary(product, updatedRows));
    }

    [HttpPost("{productId:int}/produce")]
    public async Task<ActionResult<object>> Produce(int productId, [FromBody] ProduceBatchRequest request)
    {
        var product = await db.Products.FirstOrDefaultAsync(p => p.Id == productId);
        if (product is null)
            return NotFound();

        var locationIds = NormalizeLocationIds(request.LocationExternalIds);
        if (locationIds.Count == 0)
            return BadRequest(new { message = "Select at least one location." });

        if (product.IsSubProduct)
        {
            try
            {
                var result = await productionInventory.ProduceSubProductBatchesAsync(
                    productId,
                    locationIds,
                    request.BatchQty);

                if (!result.Success)
                {
                    return Conflict(new
                    {
                        message = "Insufficient component stock for production.",
                        shortages = result.Shortages.Select(s => new
                        {
                            s.LocationExternalId,
                            s.ComponentId,
                            s.ComponentName,
                            requiredQty = s.RequiredQty,
                            onHandQty = s.OnHandQty,
                            s.Uom,
                        }),
                    });
                }
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }
        else
        {
            var stockRows = await EnsureStockRowsAsync(productId, locationIds);
            foreach (var row in stockRows)
            {
                row.InStock += request.BatchQty;
                row.ToProduceQty = Math.Max(0, row.ToProduceQty - request.BatchQty);
                row.UpdatedAt = DateTime.UtcNow;
            }

            product.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
        }

        var updatedRows = await db.ProductB2bLocationStocks
            .AsNoTracking()
            .Where(s => s.ProductId == productId && locationIds.Contains(s.LocationExternalId))
            .ToListAsync();

        product = await db.Products.AsNoTracking().FirstAsync(p => p.Id == productId);
        return Ok(MapSummary(product, updatedRows));
    }

    [HttpPost("{productId:int}/record-sale")]
    public async Task<IActionResult> RecordSale(int productId, [FromBody] RecordProductSaleRequest request)
    {
        var product = await db.Products.AsNoTracking().FirstOrDefaultAsync(p => p.Id == productId);
        if (product is null)
            return NotFound();
        if (product.IsSubProduct)
            return BadRequest(new { message = "Record sales on the parent B2B product that uses this sub-product." });

        var locationIds = NormalizeLocationIds(request.LocationExternalIds);
        if (locationIds.Count == 0)
            return BadRequest(new { message = "Select at least one location." });

        await productionInventory.RecordParentProductSaleAsync(
            productId,
            locationIds,
            request.QuantitySold);

        return NoContent();
    }

    [HttpPost("{productId:int}/produced")]
    public async Task<ActionResult<object>> Produced(int productId, [FromBody] ProductManagementActionRequest request)
    {
        var product = await db.Products.FirstOrDefaultAsync(p => p.Id == productId);
        if (product is null)
            return NotFound();

        var locationIds = NormalizeLocationIds(request.LocationExternalIds);
        if (locationIds.Count == 0)
            return BadRequest(new { message = "Select at least one location." });

        var stockRows = await EnsureStockRowsAsync(productId, locationIds);
        var batchQty = stockRows.Sum(r => r.ToProduceQty);
        if (batchQty <= 0)
            batchQty = 1;

        return await Produce(productId, new ProduceBatchRequest
        {
            LocationExternalIds = locationIds,
            BatchQty = batchQty,
        });
    }

    static decimal GetBatchSize(Product product) =>
        product.IsSubProduct && product.YieldQuantity > 0 ? product.YieldQuantity : 1;

    static string ResolveBatchUnit(Product product) => ResolvePackageUnit(product);

    static string ResolvePackageUnit(Product product)
    {
        if (product.IsSubProduct && product.YieldQuantity > 0 && !string.IsNullOrWhiteSpace(product.YieldUom))
        {
            var qty = product.YieldQuantity % 1 == 0
                ? product.YieldQuantity.ToString("0")
                : product.YieldQuantity.ToString("0.##");
            return $"{qty} {product.YieldUom.Trim()}";
        }

        return string.IsNullOrWhiteSpace(product.B2bPackageUnit) ? "pcs" : product.B2bPackageUnit.Trim();
    }

    static List<string> ParseLocationIds(string? locationIds) =>
        string.IsNullOrWhiteSpace(locationIds)
            ? []
            : locationIds
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

    static List<string> NormalizeLocationIds(IEnumerable<string> locationIds) =>
        locationIds
            .Select(id => id.Trim())
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

    static bool ProductMatchesLocations(Product product, IReadOnlyList<string> locationIds)
    {
        var productLocs = PurchaseOrderWorkflow.DeserializeLocationIds(product.LocationIdsJson);
        if (productLocs.Count == 0)
            return true;
        return locationIds.Any(productLocs.Contains);
    }

    async Task<List<ProductB2bLocationStock>> EnsureStockRowsAsync(int productId, IReadOnlyList<string> locationIds)
    {
        var existing = await db.ProductB2bLocationStocks
            .Where(s => s.ProductId == productId && locationIds.Contains(s.LocationExternalId))
            .ToListAsync();

        var existingIds = existing.Select(s => s.LocationExternalId).ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var locationId in locationIds)
        {
            if (existingIds.Contains(locationId))
                continue;

            var row = new ProductB2bLocationStock
            {
                ProductId = productId,
                LocationExternalId = locationId,
                UpdatedAt = DateTime.UtcNow,
            };
            db.ProductB2bLocationStocks.Add(row);
            existing.Add(row);
        }

        if (existing.Count > existingIds.Count)
            await db.SaveChangesAsync();

        return existing;
    }

    static object MapSummary(Product product, IReadOnlyList<ProductB2bLocationStock> rows)
    {
        var batchUnit = ResolveBatchUnit(product);
        return new
        {
            productId = product.Id,
            batchUnit,
            packageUnit = batchUnit,
            batchSize = GetBatchSize(product),
            isSubProduct = product.IsSubProduct,
            inStock = rows.Sum(r => r.InStock),
            salesPerDay = rows.Sum(r => r.SalesPerDay),
            toProduceQty = rows.Sum(r => r.ToProduceQty),
        };
    }
}
