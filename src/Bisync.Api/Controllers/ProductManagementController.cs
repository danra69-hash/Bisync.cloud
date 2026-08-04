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
    ProductionInventoryService productionInventory,
    B2bSalesOrderService salesOrderService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> List(
        [FromQuery] int? companyId,
        [FromQuery] string? locationIds,
        [FromQuery] string? view)
    {
        await salesOrderService.ReleaseExpiredLocksAsync();

        var locationIdList = ParseLocationIds(locationIds);
        if (locationIdList.Count == 0)
            return Ok(Array.Empty<object>());

        var subProductView = string.Equals(view, "sub-product", StringComparison.OrdinalIgnoreCase);
        IQueryable<Product> productQuery = db.Products
            .AsNoTracking()
            .Where(p => p.Active && (subProductView
                ? p.IsSubProduct
                : !p.IsSubProduct && p.B2bEnabled));

        if (companyId is int id)
            productQuery = productQuery.Where(p => p.CompanyId == id);

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

        var lockExpiryByProduct = await ResolveLockExpiryDatesByProductAsync(productIds, locationIdList);
        var onOrderByProduct = await ResolveOnOrderQtyByProductAsync(productIds, locationIdList);

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

        var toProduceLogs = await db.ProductProductionLogs
            .AsNoTracking()
            .Where(l => productIds.Contains(l.ProductId) && l.EntryType == "to_produce")
            .OrderByDescending(l => l.CreatedAt)
            .ThenByDescending(l => l.Id)
            .ToListAsync();

        var utcNow = DateTime.UtcNow;
        var result = new List<object>();
        foreach (var product in visibleProducts)
        {
            stockByProduct.TryGetValue(product.Id, out var rows);
            rows ??= [];
            var summary = BuildSummaryData(product, rows, onOrderByProduct.GetValueOrDefault(product.Id));
            lockExpiryByProduct.TryGetValue(product.Id, out var lockExpiryDates);
            lockExpiryDates ??= [];

            var productLogs = producedLogs
                .Where(l => l.ProductId == product.Id && LogMatchesLocations(l, locationIdList))
                .ToList();

            var latestToProduce = toProduceLogs
                .Where(l => l.ProductId == product.Id && LogMatchesLocations(l, locationIdList))
                .OrderByDescending(l => l.CreatedAt)
                .ThenByDescending(l => l.Id)
                .FirstOrDefault();

            var incubatingLogs = productLogs
                .Where(l => IsInIncubation(product, l, utcNow))
                .ToList();
            var summaryIncubationQty = incubatingLogs.Sum(l => l.Quantity);
            string? summaryIncubationTimeLeft = null;
            if (incubatingLogs.Count > 0)
            {
                var earliestEnd = incubatingLogs
                    .Select(l => l.CreatedAt.AddHours(product.ActivationPeriodHours))
                    .Min();
                summaryIncubationTimeLeft = FormatIncubationTimeLeft(utcNow, earliestEnd);
            }

            result.Add(MapBatchRow(
                summary,
                product,
                log: null,
                latestToProduce,
                summaryIncubationQty > 0 ? summaryIncubationQty : null,
                summaryIncubationTimeLeft,
                lockExpiryDates));

            foreach (var log in productLogs)
            {
                result.Add(MapBatchRow(summary, product, log, latestToProduce));
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

        if (request.OrderLockPeriodDays is int lockDays)
        {
            product.OrderLockPeriodDays = Math.Clamp(lockDays, 1, 365);
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

    [HttpPost("{productId:int}/production-preview")]
    public async Task<ActionResult<object>> ProductionPreview(int productId, [FromBody] ProductionPreviewRequest request)
    {
        var product = await db.Products.AsNoTracking().FirstOrDefaultAsync(p => p.Id == productId);
        if (product is null)
            return NotFound();

        var locationIds = NormalizeLocationIds(request.LocationExternalIds);
        if (locationIds.Count == 0)
            return BadRequest(new { message = "Select at least one location." });

        if (request.BatchQty <= 0)
            return BadRequest(new { message = "Enter a quantity greater than zero." });

        try
        {
            var usages = ToUsageMap(request.ComponentUsages);
            var result = await productionInventory.PreviewRequirementsAsync(
                productId,
                locationIds,
                request.BatchQty,
                usages);

            return Ok(new
            {
                productId,
                batchQty = request.BatchQty,
                hasShortages = !result.Success,
                components = result.Components.Select(MapComponentLine),
                shortages = result.Shortages.Select(MapShortageLine),
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
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

        try
        {
            var preview = await productionInventory.PreviewRequirementsAsync(
                productId,
                locationIds,
                request.BatchQty);

            if (!request.OverrideStock && !preview.Success && preview.Components.Count > 0)
            {
                return Conflict(new
                {
                    message = "Insufficient component stock for the quantity to produce. Override to queue anyway.",
                    shortages = preview.Shortages.Select(MapShortageLine),
                    components = preview.Components.Select(MapComponentLine),
                });
            }
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }

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

        var usages = ToUsageMap(request.ComponentUsages);
        ProduceBatchResult? componentResult = null;

        if (product.IsSubProduct)
        {
            try
            {
                componentResult = await productionInventory.ProduceSubProductBatchesAsync(
                    productId,
                    locationIds,
                    request.BatchQty,
                    request.OverrideStock,
                    usages);

                if (!componentResult.Success)
                {
                    return Conflict(new
                    {
                        message = "Insufficient component stock for production.",
                        shortages = componentResult.Shortages.Select(MapShortageLine),
                        components = componentResult.Components.Select(MapComponentLine),
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
            try
            {
                componentResult = await productionInventory.DeductComponentsForProductionAsync(
                    productId,
                    locationIds,
                    request.BatchQty,
                    request.OverrideStock,
                    usages);

                if (!componentResult.Success)
                {
                    return Conflict(new
                    {
                        message = "Insufficient component stock for production.",
                        shortages = componentResult.Shortages.Select(MapShortageLine),
                        components = componentResult.Components.Select(MapComponentLine),
                    });
                }
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }

            // Primary stock qty adjusted after bi-product split below.
        }

        var biRequests = request.SubProductOutputs
            .Where(o => o.Quantity > 0 && (o.ProductId > 0 || !string.IsNullOrWhiteSpace(o.Name)))
            .ToList();
        var biTotalQty = biRequests.Sum(o => o.Quantity);
        if (biTotalQty > request.BatchQty)
            return BadRequest(new { message = "Bi-product quantities cannot exceed the produced quantity." });

        var primaryQty = request.BatchQty - biTotalQty;
        var baseUnitCost = product.IsSubProduct && product.YieldQuantity > 0
            ? product.TotalCost / product.YieldQuantity
            : product.TotalCost;
        var attribution = ProductionCostAttribution.Allocate(
            baseUnitCost,
            request.BatchQty,
            primaryQty,
            biRequests.Select((o, index) => new ProductionCostAttribution.BiLine(
                string.IsNullOrWhiteSpace(o.Name) ? $"bi-{index}" : o.Name.Trim(),
                o.Quantity,
                o.CostAttributionPct)).ToList());

        if (!product.IsSubProduct)
        {
            var stockRows = await EnsureStockRowsAsync(productId, locationIds);
            foreach (var row in stockRows)
            {
                row.InStock += primaryQty;
                row.ProducedQty += primaryQty;
                row.ToProduceQty = Math.Max(0, row.ToProduceQty - request.BatchQty);
                if (!string.IsNullOrEmpty(expiryDate))
                    row.ExpiryDate = MergeEarliestExpiry(row.ExpiryDate, expiryDate);
                row.UpdatedAt = DateTime.UtcNow;
            }

            product.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
        }
        else
        {
            // ProduceSubProductBatchesAsync already credited full BatchQty; carve bi qty out of primary.
            if (biTotalQty > 0)
            {
                var stockRows = await EnsureStockRowsAsync(productId, locationIds);
                foreach (var row in stockRows)
                {
                    row.InStock = Math.Max(0, row.InStock - biTotalQty);
                    row.ProducedQty = Math.Max(0, row.ProducedQty - biTotalQty);
                    row.UpdatedAt = DateTime.UtcNow;
                }

                await db.SaveChangesAsync();
            }

            if (!string.IsNullOrEmpty(expiryDate))
            {
                var stockRows = await EnsureStockRowsAsync(productId, locationIds);
                foreach (var row in stockRows)
                {
                    row.ExpiryDate = MergeEarliestExpiry(row.ExpiryDate, expiryDate);
                    row.UpdatedAt = DateTime.UtcNow;
                }

                await db.SaveChangesAsync();
            }
        }

        var biOutputs = new List<object>();
        for (var i = 0; i < biRequests.Count; i++)
        {
            var output = biRequests[i];
            var costLine = attribution.BiLines.ElementAtOrDefault(i);
            Product biProduct;
            try
            {
                biProduct = await ResolveOrCreateBiProductAsync(product, output);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            if (biProduct.Id == productId)
                return BadRequest(new { message = "Bi-product cannot target the same product being produced." });

            var biRows = await EnsureStockRowsAsync(biProduct.Id, locationIds);
            foreach (var row in biRows)
            {
                row.InStock += output.Quantity;
                row.ProducedQty += output.Quantity;
                if (!string.IsNullOrEmpty(expiryDate))
                    row.ExpiryDate = MergeEarliestExpiry(row.ExpiryDate, expiryDate);
                row.UpdatedAt = DateTime.UtcNow;
            }

            biProduct.UpdatedAt = DateTime.UtcNow;
            var biUnitCost = costLine?.UnitCost ?? 0;
            await AddProductionLogAsync(
                biProduct.Id,
                "produced",
                output.Quantity,
                productionDate,
                locationIds,
                biProduct.CompanyId,
                expiryDate,
                unitPrice: biUnitCost);
            biOutputs.Add(new
            {
                productId = biProduct.Id,
                productName = biProduct.Name,
                quantity = output.Quantity,
                attributionPct = output.CostAttributionPct,
                unitCost = biUnitCost,
                isBiSubProduct = biProduct.IsSubProduct,
                biSellable = biProduct.BiSellable,
            });
        }

        var usagesJson = SerializeComponentUsages(componentResult?.Components, request.ComponentUsages);
        var outputsJson = JsonSerializer.Serialize(new
        {
            primaryQty,
            primaryUnitCost = attribution.PrimaryUnitCost,
            batchTotalCost = attribution.BatchTotalCost,
            b2bQty = product.IsSubProduct ? 0m : primaryQty,
            subProductQty = product.IsSubProduct ? primaryQty : 0m,
            biProducts = biOutputs,
        });

        await AddProductionLogAsync(
            productId,
            "produced",
            primaryQty > 0 ? primaryQty : request.BatchQty,
            productionDate,
            locationIds,
            product.CompanyId,
            expiryDate,
            usagesJson,
            outputsJson,
            attribution.PrimaryUnitCost);
        await db.SaveChangesAsync();

        var updatedRows = await db.ProductB2bLocationStocks
            .AsNoTracking()
            .Where(s => s.ProductId == productId && locationIds.Contains(s.LocationExternalId))
            .ToListAsync();

        product = await db.Products.AsNoTracking().FirstAsync(p => p.Id == productId);
        return Ok(await MapSummaryAsync(product, updatedRows));
    }

    [HttpPost("{productId:int}/produced")]
    public Task<ActionResult<object>> Produced(int productId, [FromBody] ProduceBatchRequest request) =>
        Produce(productId, request);

    static object MapComponentLine(ProduceComponentRequirement c) => new
    {
        c.LocationExternalId,
        c.ComponentId,
        c.ComponentName,
        requiredQty = c.RequiredQty,
        onHandQty = c.OnHandQty,
        shortageQty = Math.Max(0, c.RequiredQty - c.OnHandQty),
        c.Uom,
        isSufficient = c.IsSufficient,
    };

    static object MapShortageLine(ProduceStockShortage s) => new
    {
        s.LocationExternalId,
        s.ComponentId,
        s.ComponentName,
        requiredQty = s.RequiredQty,
        onHandQty = s.OnHandQty,
        shortageQty = Math.Max(0, s.RequiredQty - s.OnHandQty),
        s.Uom,
        isSufficient = false,
    };

    static Dictionary<string, decimal>? ToUsageMap(IEnumerable<ProduceComponentUsageRequest>? usages)
    {
        if (usages is null) return null;
        var map = usages
            .Where(u => !string.IsNullOrWhiteSpace(u.ComponentId) && u.UsedQty >= 0)
            .GroupBy(u => u.ComponentId.Trim(), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.Sum(x => x.UsedQty), StringComparer.OrdinalIgnoreCase);
        return map.Count == 0 ? null : map;
    }

    static string SerializeComponentUsages(
        IReadOnlyList<ProduceComponentRequirement>? previewComponents,
        IEnumerable<ProduceComponentUsageRequest>? requestUsages)
    {
        var usageMap = ToUsageMap(requestUsages);
        if (previewComponents is { Count: > 0 })
        {
            var rows = previewComponents
                .GroupBy(c => c.ComponentId, StringComparer.OrdinalIgnoreCase)
                .Select(g =>
                {
                    var first = g.First();
                    var used = usageMap is not null && usageMap.TryGetValue(first.ComponentId, out var u)
                        ? u
                        : first.RequiredQty;
                    return new
                    {
                        componentId = first.ComponentId,
                        componentName = first.ComponentName,
                        uom = first.Uom,
                        requiredQty = first.RequiredQty,
                        usedQty = used,
                    };
                });
            return JsonSerializer.Serialize(rows);
        }

        if (usageMap is null) return "[]";
        return JsonSerializer.Serialize(usageMap.Select(kv => new
        {
            componentId = kv.Key,
            usedQty = kv.Value,
        }));
    }

    // --- helpers continue below (ResolveProductionDate etc.) ---

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
            request.QuantitySold,
            request.SalesChannel ?? "pos",
            request.VariableDetail);

        return NoContent();
    }

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
        string? expiryDate = null,
        string? componentUsagesJson = null,
        string? outputsJson = null,
        decimal? unitPrice = null)
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
            UnitPrice = unitPrice ?? 0,
            LocationIdsJson = JsonSerializer.Serialize(locationIds),
            ComponentUsagesJson = string.IsNullOrWhiteSpace(componentUsagesJson) ? "[]" : componentUsagesJson,
            OutputsJson = string.IsNullOrWhiteSpace(outputsJson) ? "{}" : outputsJson,
            CompanyId = companyId,
            CreatedAt = DateTime.UtcNow,
        });
    }

    async Task<object> MapSummaryAsync(Product product, IReadOnlyList<ProductB2bLocationStock> rows)
    {
        var locationIds = rows
            .Select(r => r.LocationExternalId)
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        var onOrderByProduct = locationIds.Count == 0
            ? new Dictionary<int, decimal>()
            : await ResolveOnOrderQtyByProductAsync([product.Id], locationIds);
        return MapSummary(product, rows, onOrderByProduct.GetValueOrDefault(product.Id));
    }

    async Task<Dictionary<int, decimal>> ResolveOnOrderQtyByProductAsync(
        IReadOnlyList<int> productIds,
        IReadOnlyList<string> locationIds)
    {
        if (productIds.Count == 0 || locationIds.Count == 0)
            return new Dictionary<int, decimal>();

        var locationSet = locationIds
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Select(id => id.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        if (locationSet.Count == 0)
            return new Dictionary<int, decimal>();

        // Load candidate lines then filter locations case-insensitively in memory.
        // Active Order qty must appear even when stock.OnOrderQty was never locked (e.g. draft→confirmed).
        var lines = await db.B2bSalesOrderLines.AsNoTracking()
            .Where(l => productIds.Contains(l.ProductId)
                && l.Status != "fulfilled"
                && l.Status != "released")
            .Join(
                db.B2bSalesOrders.AsNoTracking()
                    .Where(o => o.Status == "draft" || o.Status == "issued" || o.Status == "confirmed"),
                line => line.SalesOrderId,
                order => order.Id,
                (line, order) => new
                {
                    line.ProductId,
                    line.QuantityOrdered,
                    line.LocationExternalId,
                })
            .ToListAsync();

        return lines
            .Where(l => locationSet.Any(loc =>
                string.Equals(loc, l.LocationExternalId?.Trim(), StringComparison.OrdinalIgnoreCase)))
            .GroupBy(x => x.ProductId)
            .ToDictionary(g => g.Key, g => g.Sum(x => x.QuantityOrdered));
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

    async Task<Product> ResolveOrCreateBiProductAsync(Product parent, ProduceSubProductOutputRequest output)
    {
        if (output.ProductId > 0)
        {
            var existing = await db.Products.FirstOrDefaultAsync(p => p.Id == output.ProductId)
                ?? throw new InvalidOperationException($"Bi-product #{output.ProductId} was not found.");
            if (!existing.IsBiProduct && !existing.IsSubProduct)
                throw new InvalidOperationException($"{existing.Name} is not a bi-product or sub-product output.");
            return existing;
        }

        var name = (output.Name ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(name))
            throw new InvalidOperationException("Enter a bi-product name or select an existing product.");

        var isBiSub = output.IsBiSubProduct || parent.IsSubProduct;
        var productId = await ProductIdGenerator.GenerateAsync(db, name, isBiSub);
        var bi = new Product
        {
            ProductId = productId,
            Name = name,
            Category = parent.Category,
            Group = parent.Group,
            IsSubProduct = isBiSub,
            IsBiProduct = true,
            BiOfProductId = parent.Id,
            BiSellable = !isBiSub && output.BiSellable,
            B2cEnabled = false,
            B2bEnabled = !isBiSub && output.BiSellable,
            B2bPackageUnit = parent.B2bPackageUnit,
            YieldUom = parent.YieldUom,
            YieldQuantity = isBiSub ? 1 : 0,
            ExpiryPeriodDays = parent.ExpiryPeriodDays,
            ActivationPeriodHours = parent.ActivationPeriodHours,
            CompanyId = parent.CompanyId,
            LocationIdsJson = parent.LocationIdsJson,
            Active = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        db.Products.Add(bi);
        await db.SaveChangesAsync();
        return bi;
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

    sealed record OnOrderLockEntry(decimal Quantity, string LockExpiryDate);

    async Task<Dictionary<int, List<OnOrderLockEntry>>> ResolveLockExpiryDatesByProductAsync(
        IReadOnlyList<int> productIds,
        IReadOnlyList<string> locationIds)
    {
        if (productIds.Count == 0 || locationIds.Count == 0)
            return new Dictionary<int, List<OnOrderLockEntry>>();

        var locationSet = locationIds
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Select(id => id.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var lines = await db.B2bSalesOrderLines.AsNoTracking()
            .Where(l => productIds.Contains(l.ProductId)
                && l.Status != "fulfilled"
                && l.Status != "released")
            .Join(
                db.B2bSalesOrders.AsNoTracking().Where(o => o.Status == "issued"),
                line => line.SalesOrderId,
                order => order.Id,
                (line, order) => new
                {
                    line.ProductId,
                    line.LocationExternalId,
                    line.QuantityOrdered,
                    OrderId = order.Id,
                    order.LockExpiryDate,
                    order.LockPeriodDays,
                    order.CreatedAt,
                })
            .ToListAsync();

        return lines
            .Where(l => locationSet.Any(loc =>
                string.Equals(loc, l.LocationExternalId?.Trim(), StringComparison.OrdinalIgnoreCase)))
            .Select(l =>
            {
                var expiry = l.LockExpiryDate?.Trim() ?? string.Empty;
                if (string.IsNullOrWhiteSpace(expiry) && l.LockPeriodDays > 0)
                {
                    expiry = DateOnly.FromDateTime(l.CreatedAt).AddDays(l.LockPeriodDays).ToString("yyyy-MM-dd");
                }
                return new { l.ProductId, l.OrderId, l.QuantityOrdered, LockExpiryDate = expiry };
            })
            .Where(x => !string.IsNullOrWhiteSpace(x.LockExpiryDate))
            .GroupBy(x => x.ProductId)
            .ToDictionary(
                g => g.Key,
                g => g
                    .GroupBy(x => x.OrderId)
                    .Select(orderGroup => new OnOrderLockEntry(
                        orderGroup.Sum(x => x.QuantityOrdered),
                        orderGroup.Min(x => x.LockExpiryDate)!))
                    .OrderBy(x => x.LockExpiryDate)
                    .ThenBy(x => x.Quantity)
                    .ToList(),
                EqualityComparer<int>.Default);
    }

    sealed record ProductManagementSummaryData(
        int ProductId,
        string BatchUnit,
        string PackageUnit,
        decimal BatchSize,
        bool IsSubProduct,
        decimal InStock,
        decimal OnOrderQty,
        decimal SalesPerDay,
        decimal ToProduceQty,
        decimal ProducedQty,
        string? ExpiryDate);

    static ProductManagementSummaryData BuildSummaryData(
        Product product,
        IReadOnlyList<ProductB2bLocationStock> rows,
        decimal? onOrderQtyOverride = null)
    {
        var batchUnit = ResolveBatchUnit(product);
        return new ProductManagementSummaryData(
            product.Id,
            batchUnit,
            batchUnit,
            GetBatchSize(product),
            product.IsSubProduct,
            rows.Sum(r => r.InStock),
            onOrderQtyOverride ?? rows.Sum(r => r.OnOrderQty),
            rows.Sum(r => r.SalesPerDay),
            rows.Sum(r => r.ToProduceQty),
            rows.Sum(r => r.ProducedQty),
            ResolveEarliestExpiry(rows));
    }

    static bool IsInIncubation(Product product, ProductProductionLog log, DateTime utcNow) =>
        product.ActivationPeriodHours > 0
        && utcNow < log.CreatedAt.AddHours(product.ActivationPeriodHours);

    static string? FormatIncubationTimeLeft(DateTime utcNow, DateTime activationEndsAt)
    {
        if (activationEndsAt <= utcNow)
            return null;

        var remaining = activationEndsAt - utcNow;
        if (remaining.TotalHours >= 1)
            return $"{(int)remaining.TotalHours}h {remaining.Minutes}m";

        var minutes = Math.Max(1, (int)Math.Ceiling(remaining.TotalMinutes));
        return $"{minutes}m";
    }

    static string? ResolveDateRequested(ProductManagementSummaryData summary, ProductProductionLog? latestToProduce)
    {
        if (summary.ToProduceQty <= 0 || latestToProduce is null)
            return null;

        if (!string.IsNullOrWhiteSpace(latestToProduce.ProductionDate))
            return latestToProduce.ProductionDate.Trim();

        return DateOnly.FromDateTime(latestToProduce.CreatedAt).ToString("yyyy-MM-dd");
    }

    static object MapBatchRow(
        ProductManagementSummaryData summary,
        Product product,
        ProductProductionLog? log,
        ProductProductionLog? latestToProduce,
        decimal? summaryIncubationQty = null,
        string? summaryIncubationTimeLeft = null,
        IReadOnlyList<OnOrderLockEntry>? onOrderLocks = null)
    {
        var utcNow = DateTime.UtcNow;
        decimal? incubationQty = summaryIncubationQty;
        string? incubationTimeLeft = summaryIncubationTimeLeft;

        if (log is not null)
        {
            incubationQty = null;
            incubationTimeLeft = null;
            if (IsInIncubation(product, log, utcNow))
            {
                incubationQty = log.Quantity;
                incubationTimeLeft = FormatIncubationTimeLeft(
                    utcNow,
                    log.CreatedAt.AddHours(product.ActivationPeriodHours));
            }
        }

        var locks = log is null
            ? (onOrderLocks ?? Array.Empty<OnOrderLockEntry>())
            : Array.Empty<OnOrderLockEntry>();

        return new
        {
            productId = summary.ProductId,
            batchUnit = summary.BatchUnit,
            packageUnit = summary.PackageUnit,
            batchSize = summary.BatchSize,
            isSubProduct = summary.IsSubProduct,
            inStock = summary.InStock,
            onOrderQty = summary.OnOrderQty,
            orderLockPeriodDays = product.OrderLockPeriodDays > 0 ? product.OrderLockPeriodDays : 7,
            lockExpiryDate = locks.Count > 0 ? locks[0].LockExpiryDate : null,
            onOrderLocks = locks.Select(l => new
            {
                quantity = l.Quantity,
                lockExpiryDate = l.LockExpiryDate,
            }),
            salesPerDay = summary.SalesPerDay,
            toProduceQty = summary.ToProduceQty,
            producedQty = summary.ProducedQty,
            isSummaryRow = log is null,
            batchLogId = log?.Id,
            batchNumber = string.IsNullOrWhiteSpace(log?.BatchNumber) ? null : log!.BatchNumber.Trim(),
            productionDate = string.IsNullOrWhiteSpace(log?.ProductionDate) ? null : log!.ProductionDate.Trim(),
            expiryDate = string.IsNullOrWhiteSpace(log?.ExpiryDate) ? null : log!.ExpiryDate.Trim(),
            batchQty = log is null ? (decimal?)null : log.Quantity,
            incubationQty,
            incubationTimeLeft,
            dateRequested = log is null ? ResolveDateRequested(summary, latestToProduce) : null,
        };
    }

    static object MapSummary(
        Product product,
        IReadOnlyList<ProductB2bLocationStock> rows,
        decimal? onOrderQtyOverride = null)
    {
        var summary = BuildSummaryData(product, rows, onOrderQtyOverride);
        return new
        {
            productId = summary.ProductId,
            batchUnit = summary.BatchUnit,
            packageUnit = summary.PackageUnit,
            batchSize = summary.BatchSize,
            isSubProduct = summary.IsSubProduct,
            inStock = summary.InStock,
            onOrderQty = summary.OnOrderQty,
            orderLockPeriodDays = product.OrderLockPeriodDays > 0 ? product.OrderLockPeriodDays : 7,
            salesPerDay = summary.SalesPerDay,
            toProduceQty = summary.ToProduceQty,
            producedQty = summary.ProducedQty,
            expiryDate = summary.ExpiryDate,
        };
    }
}
