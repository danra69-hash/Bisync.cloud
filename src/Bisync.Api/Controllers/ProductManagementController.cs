using System.Text.Json;
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

        var producedLogs = await db.ProductProductionLogs
            .AsNoTracking()
            .Where(l => productIds.Contains(l.ProductId) && l.EntryType == "produced")
            .OrderByDescending(l => l.CreatedAt)
            .ThenByDescending(l => l.Id)
            .ToListAsync();

        await EnsureBatchNumbersAsync(producedLogs, visibleProducts);

        producedLogs = await db.ProductProductionLogs
            .AsNoTracking()
            .Where(l => productIds.Contains(l.ProductId) && l.EntryType == "produced")
            .OrderByDescending(l => l.CreatedAt)
            .ThenByDescending(l => l.Id)
            .ToListAsync();

        var result = new List<object>();
        foreach (var product in visibleProducts)
        {
            stockByProduct.TryGetValue(product.Id, out var rows);
            rows ??= [];
            var summary = BuildSummaryData(product, rows);

            var productLogs = producedLogs
                .Where(l => l.ProductId == product.Id && LogMatchesLocations(l, locationIdList))
                .ToList();

            result.Add(MapBatchRow(summary, log: null));

            foreach (var log in productLogs)
            {
                result.Add(MapBatchRow(summary, log));
            }
        }

        return Ok(result);
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

        return Ok(await MapSummaryAsync(product, updatedRows));
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

        if (request.BatchQty <= 0)
            return BadRequest(new { message = "Enter a quantity greater than zero." });

        var productionDate = ResolveProductionDate(request.ProductionDate);
        var stockRows = await EnsureStockRowsAsync(productId, locationIds);
        foreach (var row in stockRows)
        {
            row.ToProduceQty += request.BatchQty;
            row.UpdatedAt = DateTime.UtcNow;
        }

        await AddProductionLogAsync(
            productId,
            "to_produce",
            request.BatchQty,
            productionDate,
            locationIds,
            product.CompanyId);

        product.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        var updatedRows = await db.ProductB2bLocationStocks
            .AsNoTracking()
            .Where(s => s.ProductId == productId && locationIds.Contains(s.LocationExternalId))
            .ToListAsync();

        return Ok(await MapSummaryAsync(product, updatedRows));
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

        if (request.BatchQty <= 0)
            return BadRequest(new { message = "Enter a quantity greater than zero." });

        var productionDate = ResolveProductionDate(request.ProductionDate);
        var expiryDate = ResolveOptionalDate(request.ExpiryDate);
        if (string.IsNullOrEmpty(expiryDate) && product.ExpiryPeriodDays > 0
            && DateOnly.TryParse(productionDate, out var parsedProductionDate))
        {
            expiryDate = parsedProductionDate.AddDays(product.ExpiryPeriodDays).ToString("yyyy-MM-dd");
        }

        if (product.IsSubProduct)
        {
            try
            {
                var result = await productionInventory.ProduceSubProductBatchesAsync(
                    productId,
                    locationIds,
                    request.BatchQty,
                    request.OverrideStock);

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
                            isSufficient = false,
                        }),
                        components = result.Components.Select(c => new
                        {
                            c.LocationExternalId,
                            c.ComponentId,
                            c.ComponentName,
                            requiredQty = c.RequiredQty,
                            onHandQty = c.OnHandQty,
                            c.Uom,
                            isSufficient = c.IsSufficient,
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
                row.ProducedQty += request.BatchQty;
                row.ToProduceQty = Math.Max(0, row.ToProduceQty - request.BatchQty);
                if (!string.IsNullOrEmpty(expiryDate))
                    row.ExpiryDate = MergeEarliestExpiry(row.ExpiryDate, expiryDate);
                row.UpdatedAt = DateTime.UtcNow;
            }

            product.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
        }

        if (product.IsSubProduct && !string.IsNullOrEmpty(expiryDate))
        {
            var stockRows = await EnsureStockRowsAsync(productId, locationIds);
            foreach (var row in stockRows)
            {
                row.ExpiryDate = MergeEarliestExpiry(row.ExpiryDate, expiryDate);
                row.UpdatedAt = DateTime.UtcNow;
            }

            await db.SaveChangesAsync();
        }

        await AddProductionLogAsync(
            productId,
            "produced",
            request.BatchQty,
            productionDate,
            locationIds,
            product.CompanyId,
            expiryDate);
        await db.SaveChangesAsync();

        var updatedRows = await db.ProductB2bLocationStocks
            .AsNoTracking()
            .Where(s => s.ProductId == productId && locationIds.Contains(s.LocationExternalId))
            .ToListAsync();

        product = await db.Products.AsNoTracking().FirstAsync(p => p.Id == productId);
        return Ok(await MapSummaryAsync(product, updatedRows));
    }

    [HttpPatch("batches/{batchLogId:int}")]
    public async Task<ActionResult<object>> PatchBatch(int batchLogId, [FromBody] PatchProductionBatchRequest request)
    {
        if (request.BatchQty <= 0)
            return BadRequest(new { message = "Enter a quantity greater than zero." });

        var log = await db.ProductProductionLogs.AsNoTracking()
            .FirstOrDefaultAsync(l => l.Id == batchLogId);
        if (log is null || !string.Equals(log.EntryType, "produced", StringComparison.OrdinalIgnoreCase))
            return NotFound();

        var productionDate = ResolveProductionDate(request.ProductionDate ?? log.ProductionDate);
        var expiryDate = ResolveOptionalDate(request.ExpiryDate);
        if (string.IsNullOrEmpty(expiryDate))
            return BadRequest(new { message = "Select an expiry date." });

        if (DateOnly.TryParse(productionDate, out var parsedProduction)
            && DateOnly.TryParse(expiryDate, out var parsedExpiry)
            && parsedExpiry < parsedProduction)
        {
            return BadRequest(new { message = "Expiry date must be on or after the production date." });
        }

        var product = await db.Products.AsNoTracking().FirstAsync(p => p.Id == log.ProductId);
        if (string.IsNullOrEmpty(expiryDate) && product.ExpiryPeriodDays > 0
            && DateOnly.TryParse(productionDate, out var prodDate))
        {
            expiryDate = prodDate.AddDays(product.ExpiryPeriodDays).ToString("yyyy-MM-dd");
        }

        try
        {
            var result = await productionInventory.AdjustProducedBatchAsync(
                batchLogId,
                request.BatchQty,
                productionDate,
                expiryDate,
                request.OverrideStock);

            if (!result.Success)
            {
                return Conflict(new
                {
                    message = "Insufficient component stock to increase this batch.",
                    shortages = result.Shortages.Select(s => new
                    {
                        s.LocationExternalId,
                        s.ComponentId,
                        s.ComponentName,
                        requiredQty = s.RequiredQty,
                        onHandQty = s.OnHandQty,
                        s.Uom,
                        isSufficient = false,
                    }),
                    components = result.Components.Select(c => new
                    {
                        c.LocationExternalId,
                        c.ComponentId,
                        c.ComponentName,
                        requiredQty = c.RequiredQty,
                        onHandQty = c.OnHandQty,
                        c.Uom,
                        isSufficient = c.IsSufficient,
                    }),
                });
            }
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }

        var locationIds = NormalizeLocationIds(
            PurchaseOrderWorkflow.DeserializeLocationIds(log.LocationIdsJson));
        var updatedRows = await db.ProductB2bLocationStocks
            .AsNoTracking()
            .Where(s => s.ProductId == log.ProductId && locationIds.Contains(s.LocationExternalId))
            .ToListAsync();

        product = await db.Products.AsNoTracking().FirstAsync(p => p.Id == log.ProductId);
        return Ok(await MapSummaryAsync(product, updatedRows));
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
    public Task<ActionResult<object>> Produced(int productId, [FromBody] ProductManagementActionRequest request) =>
        Produce(productId, new ProduceBatchRequest
        {
            LocationExternalIds = request.LocationExternalIds,
            BatchQty = request.BatchQty,
            ProductionDate = request.ProductionDate,
            ExpiryDate = request.ExpiryDate,
            OverrideStock = request.OverrideStock,
        });

    static string ResolveProductionDate(string? productionDate)
    {
        if (!string.IsNullOrWhiteSpace(productionDate)
            && DateOnly.TryParse(productionDate.Trim(), out _))
        {
            return productionDate.Trim();
        }

        return DateOnly.FromDateTime(DateTime.UtcNow).ToString("yyyy-MM-dd");
    }

    static string? ResolveOptionalDate(string? dateValue)
    {
        if (string.IsNullOrWhiteSpace(dateValue))
            return null;

        return DateOnly.TryParse(dateValue.Trim(), out _)
            ? dateValue.Trim()
            : null;
    }

    async Task AddProductionLogAsync(
        int productId,
        string entryType,
        decimal quantity,
        string productionDate,
        IReadOnlyList<string> locationIds,
        int? companyId,
        string? expiryDate = null)
    {
        var batchNumber = string.Empty;
        if (string.Equals(entryType, "produced", StringComparison.OrdinalIgnoreCase))
        {
            var product = await db.Products.AsNoTracking().FirstAsync(p => p.Id == productId);
            batchNumber = await BatchNumberGenerator.GenerateAsync(db, productId, product.ProductId);
        }

        db.ProductProductionLogs.Add(new ProductProductionLog
        {
            ProductId = productId,
            EntryType = entryType,
            Quantity = quantity,
            ProductionDate = productionDate,
            ExpiryDate = expiryDate ?? string.Empty,
            BatchNumber = batchNumber,
            LocationIdsJson = JsonSerializer.Serialize(locationIds),
            CompanyId = companyId,
            CreatedAt = DateTime.UtcNow,
        });
    }

    async Task<object> MapSummaryAsync(Product product, IReadOnlyList<ProductB2bLocationStock> rows)
    {
        return MapSummary(product, rows);
    }

    static string? ResolveEarliestExpiry(IReadOnlyList<ProductB2bLocationStock> rows)
    {
        DateOnly? earliest = null;
        foreach (var row in rows)
        {
            if (string.IsNullOrWhiteSpace(row.ExpiryDate))
                continue;
            if (!DateOnly.TryParse(row.ExpiryDate.Trim(), out var parsed))
                continue;
            earliest = earliest is null || parsed < earliest ? parsed : earliest;
        }

        return earliest?.ToString("yyyy-MM-dd");
    }

    static string MergeEarliestExpiry(string? current, string newest)
    {
        var candidates = new List<ProductB2bLocationStock>();
        if (!string.IsNullOrWhiteSpace(current))
            candidates.Add(new ProductB2bLocationStock { ExpiryDate = current.Trim() });
        if (!string.IsNullOrWhiteSpace(newest))
            candidates.Add(new ProductB2bLocationStock { ExpiryDate = newest.Trim() });
        return ResolveEarliestExpiry(candidates) ?? newest.Trim();
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

    async Task EnsureBatchNumbersAsync(
        IReadOnlyList<ProductProductionLog> logs,
        IReadOnlyList<Product> products)
    {
        var productsById = products.ToDictionary(p => p.Id);
        var missing = logs
            .Where(l => string.IsNullOrWhiteSpace(l.BatchNumber))
            .Select(l => l.Id)
            .ToList();
        if (missing.Count == 0)
            return;

        var tracked = await db.ProductProductionLogs
            .Where(l => missing.Contains(l.Id))
            .ToListAsync();

        var changed = false;
        foreach (var log in tracked)
        {
            if (!productsById.TryGetValue(log.ProductId, out var product))
                continue;
            log.BatchNumber = await BatchNumberGenerator.GenerateAsync(db, log.ProductId, product.ProductId);
            changed = true;
        }

        if (changed)
            await db.SaveChangesAsync();
    }

    static bool LogMatchesLocations(ProductProductionLog log, IReadOnlyList<string> locationIds)
    {
        if (locationIds.Count == 0)
            return false;

        List<string> logLocs;
        try
        {
            logLocs = JsonSerializer.Deserialize<List<string>>(log.LocationIdsJson) ?? [];
        }
        catch
        {
            logLocs = [];
        }

        if (logLocs.Count == 0)
            return true;

        return logLocs.Any(locationIds.Contains);
    }

    sealed record ProductManagementSummaryData(
        int ProductId,
        string BatchUnit,
        string PackageUnit,
        decimal BatchSize,
        bool IsSubProduct,
        decimal InStock,
        decimal SalesPerDay,
        decimal ToProduceQty,
        decimal ProducedQty,
        string? ExpiryDate);

    static ProductManagementSummaryData BuildSummaryData(Product product, IReadOnlyList<ProductB2bLocationStock> rows)
    {
        var batchUnit = ResolveBatchUnit(product);
        return new ProductManagementSummaryData(
            product.Id,
            batchUnit,
            batchUnit,
            GetBatchSize(product),
            product.IsSubProduct,
            rows.Sum(r => r.InStock),
            rows.Sum(r => r.SalesPerDay),
            rows.Sum(r => r.ToProduceQty),
            rows.Sum(r => r.ProducedQty),
            ResolveEarliestExpiry(rows));
    }

    static object MapBatchRow(ProductManagementSummaryData summary, ProductProductionLog? log) =>
        new
        {
            productId = summary.ProductId,
            batchUnit = summary.BatchUnit,
            packageUnit = summary.PackageUnit,
            batchSize = summary.BatchSize,
            isSubProduct = summary.IsSubProduct,
            inStock = summary.InStock,
            salesPerDay = summary.SalesPerDay,
            toProduceQty = summary.ToProduceQty,
            producedQty = summary.ProducedQty,
            isSummaryRow = log is null,
            batchLogId = log?.Id,
            batchNumber = string.IsNullOrWhiteSpace(log?.BatchNumber) ? null : log!.BatchNumber.Trim(),
            productionDate = string.IsNullOrWhiteSpace(log?.ProductionDate) ? null : log!.ProductionDate.Trim(),
            expiryDate = string.IsNullOrWhiteSpace(log?.ExpiryDate) ? null : log!.ExpiryDate.Trim(),
            batchQty = log is null ? (decimal?)null : log.Quantity,
        };

    static object MapSummary(Product product, IReadOnlyList<ProductB2bLocationStock> rows)
    {
        var summary = BuildSummaryData(product, rows);
        return new
        {
            productId = summary.ProductId,
            batchUnit = summary.BatchUnit,
            packageUnit = summary.PackageUnit,
            batchSize = summary.BatchSize,
            isSubProduct = summary.IsSubProduct,
            inStock = summary.InStock,
            salesPerDay = summary.SalesPerDay,
            toProduceQty = summary.ToProduceQty,
            producedQty = summary.ProducedQty,
            expiryDate = summary.ExpiryDate,
        };
    }
}
