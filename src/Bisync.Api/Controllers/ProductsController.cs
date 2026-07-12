using System.Text.Json;
using Bisync.Api.Contracts;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Bisync.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/products")]
public class ProductsController(BisyncDbContext db) : ControllerBase
{
    static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> List([FromQuery] int? companyId)
    {
        IQueryable<Product> query = db.Products
            .AsNoTracking()
            .Include(p => p.Items)
            .Include(p => p.PackagingItems)
            .Include(p => p.Aliases);

        if (companyId is int id)
            query = query.Where(p => p.CompanyId == id);

        var rows = await query
            .OrderByDescending(p => p.UpdatedAt)
            .ThenByDescending(p => p.Id)
            .ToListAsync();

        return Ok(rows.Select(MapProduct));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<object>> Get(int id)
    {
        var product = await db.Products
            .AsNoTracking()
            .Include(p => p.Items)
            .Include(p => p.PackagingItems)
            .Include(p => p.Aliases)
            .FirstOrDefaultAsync(p => p.Id == id);

        return product is null ? NotFound() : Ok(MapProduct(product));
    }

    [HttpPost]
    public async Task<ActionResult<object>> Create([FromBody] UpsertProductRequest request)
    {
        var validation = ValidateRequest(request);
        if (validation is not null)
            return BadRequest(new { message = validation });

        var productId = string.IsNullOrWhiteSpace(request.ProductId)
            ? await ProductIdGenerator.GenerateAsync(db, request.Name.Trim(), request.IsSubProduct)
            : request.ProductId.Trim();

        if (await db.Products.AnyAsync(p => p.ProductId == productId))
            return BadRequest(new { message = "Product ID already exists." });

        var items = MapItems(request.Items);
        var packagingItems = MapPackagingItems(request.PackagingItems);
        var product = new Product
        {
            ProductId = productId,
            Name = request.Name.Trim(),
            Category = request.Category?.Trim() ?? string.Empty,
            Group = request.Group?.Trim() ?? string.Empty,
            IsSubProduct = request.IsSubProduct,
            B2cEnabled = request.IsSubProduct ? false : request.B2cEnabled,
            B2bEnabled = request.IsSubProduct ? false : request.B2bEnabled,
            B2bPackageUnit = request.IsSubProduct
                ? "pcs"
                : (string.IsNullOrWhiteSpace(request.B2bPackageUnit) ? "pcs" : request.B2bPackageUnit.Trim()),
            B2bSalesConfigJson = request.IsSubProduct
                ? "{}"
                : (string.IsNullOrWhiteSpace(request.B2bSalesConfigJson) ? "{}" : request.B2bSalesConfigJson),
            Rrp = request.IsSubProduct ? 0 : (request.Rrp ?? 0),
            YieldQuantity = request.IsSubProduct ? (request.YieldQuantity ?? 0) : 0,
            YieldUom = request.IsSubProduct ? (request.YieldUom?.Trim() ?? string.Empty) : string.Empty,
            YieldAltUnitsJson = request.IsSubProduct || request.B2bEnabled
                ? (string.IsNullOrWhiteSpace(request.YieldAltUnitsJson) ? "[]" : request.YieldAltUnitsJson)
                : "[]",
            ExpiryPeriodDays = ResolveExpiryPeriodDays(request),
            ActivationPeriodHours = ResolveActivationPeriodHours(request),
            ParStock = request.ParStock ?? 0,
            ParStockUom = request.ParStockUom?.Trim() ?? string.Empty,
            PosEnabled = request.PosEnabled ?? false,
            Active = request.Active ?? true,
            TotalCost = items.Sum(i => i.Subtotal),
            PackagingCost = packagingItems.Sum(i => i.Subtotal),
            CompanyId = request.CompanyId,
            LocationIdsJson = PurchaseOrderWorkflow.SerializeLocationIds(request.LocationExternalIds ?? []),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Items = items,
            PackagingItems = packagingItems,
        };

        db.Products.Add(product);
        await db.SaveChangesAsync();

        var aliasRows = request.IsSubProduct ? [] : MapAliases(request.Aliases, product.Id);
        if (aliasRows.Count > 0)
        {
            db.ProductAliases.AddRange(aliasRows);
            await db.SaveChangesAsync();
        }

        product = await db.Products
            .AsNoTracking()
            .Include(p => p.Items)
            .Include(p => p.PackagingItems)
            .Include(p => p.Aliases)
            .FirstAsync(p => p.Id == product.Id);

        return Ok(MapProduct(product));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<object>> Update(int id, [FromBody] UpsertProductRequest request)
    {
        var validation = ValidateRequest(request);
        if (validation is not null)
            return BadRequest(new { message = validation });

        var product = await db.Products
            .Include(p => p.Items)
            .Include(p => p.PackagingItems)
            .Include(p => p.Aliases)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (product is null)
            return NotFound();

        var productId = string.IsNullOrWhiteSpace(request.ProductId)
            ? product.ProductId
            : request.ProductId.Trim();

        if (await db.Products.AnyAsync(p => p.ProductId == productId && p.Id != id))
            return BadRequest(new { message = "Product ID already exists." });

        product.ProductId = productId;
        product.Name = request.Name.Trim();
        product.Category = request.Category?.Trim() ?? string.Empty;
        product.Group = request.Group?.Trim() ?? string.Empty;
        product.IsSubProduct = request.IsSubProduct;
        product.B2cEnabled = request.IsSubProduct ? false : request.B2cEnabled;
        product.B2bEnabled = request.IsSubProduct ? false : request.B2bEnabled;
        if (!request.IsSubProduct)
        {
            product.B2bPackageUnit = string.IsNullOrWhiteSpace(request.B2bPackageUnit)
                ? product.B2bPackageUnit
                : request.B2bPackageUnit.Trim();
            product.B2bSalesConfigJson = string.IsNullOrWhiteSpace(request.B2bSalesConfigJson)
                ? "{}"
                : request.B2bSalesConfigJson;
        }
        else
        {
            product.B2bPackageUnit = "pcs";
            product.B2bSalesConfigJson = "{}";
        }
        if (request.IsSubProduct)
        {
            product.YieldQuantity = request.YieldQuantity ?? 0;
            product.YieldUom = request.YieldUom?.Trim() ?? string.Empty;
            product.YieldAltUnitsJson = string.IsNullOrWhiteSpace(request.YieldAltUnitsJson) ? "[]" : request.YieldAltUnitsJson;
        }
        else if (request.B2bEnabled)
        {
            product.YieldQuantity = 0;
            product.YieldUom = string.Empty;
            product.YieldAltUnitsJson = string.IsNullOrWhiteSpace(request.YieldAltUnitsJson) ? "[]" : request.YieldAltUnitsJson;
        }
        else
        {
            product.YieldQuantity = 0;
            product.YieldUom = string.Empty;
            product.YieldAltUnitsJson = "[]";
        }
        product.ExpiryPeriodDays = ResolveExpiryPeriodDays(request);
        product.ActivationPeriodHours = ResolveActivationPeriodHours(request);
        if (request.ParStock.HasValue) product.ParStock = request.ParStock.Value;
        if (request.ParStockUom is not null) product.ParStockUom = request.ParStockUom.Trim();
        if (request.PosEnabled.HasValue) product.PosEnabled = request.PosEnabled.Value;
        if (request.Active.HasValue) product.Active = request.Active.Value;
        product.CompanyId = request.CompanyId;
        product.LocationIdsJson = PurchaseOrderWorkflow.SerializeLocationIds(request.LocationExternalIds ?? []);
        product.UpdatedAt = DateTime.UtcNow;

        db.ProductComponentItems.RemoveRange(product.Items);
        product.Items = MapItems(request.Items);
        var newTotalCost = product.Items.Sum(i => i.Subtotal);

        db.ProductPackagingItems.RemoveRange(product.PackagingItems);
        product.PackagingItems = MapPackagingItems(request.PackagingItems);
        var newPackagingCost = product.PackagingItems.Sum(i => i.Subtotal);

        var newRrp = request.IsSubProduct ? 0m : (request.Rrp ?? product.Rrp);
        ProductCogsSnapshot.CaptureIfChanged(product, newTotalCost, newPackagingCost, newRrp);
        product.TotalCost = newTotalCost;
        product.PackagingCost = newPackagingCost;
        product.Rrp = newRrp;

        db.ProductAliases.RemoveRange(product.Aliases);
        product.Aliases = request.IsSubProduct ? [] : MapAliases(request.Aliases, product.Id);

        await db.SaveChangesAsync();

        product = await db.Products
            .AsNoTracking()
            .Include(p => p.Items)
            .Include(p => p.PackagingItems)
            .Include(p => p.Aliases)
            .FirstAsync(p => p.Id == product.Id);

        return Ok(MapProduct(product));
    }

    [HttpPatch("{id:int}")]
    public async Task<ActionResult<object>> Patch(int id, [FromBody] PatchProductRequest request)
    {
        var product = await db.Products
            .Include(p => p.Items)
            .Include(p => p.PackagingItems)
            .Include(p => p.Aliases)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (product is null)
            return NotFound();

        if (request.PosEnabled.HasValue)
            product.PosEnabled = request.PosEnabled.Value;
        if (request.PosDeliveryUnits is not null)
        {
            product.PosDeliveryUnitsJson = JsonSerializer.Serialize(
                request.PosDeliveryUnits
                    .Where(unit => !string.IsNullOrWhiteSpace(unit.UnitKey))
                    .Select(unit => new { unitKey = unit.UnitKey.Trim() })
                    .DistinctBy(unit => unit.unitKey),
                JsonOptions);
        }
        if (request.Active.HasValue)
            product.Active = request.Active.Value;
        if (request.Rrp.HasValue)
        {
            ProductCogsSnapshot.CaptureIfChanged(
                product,
                product.TotalCost,
                product.PackagingCost,
                request.Rrp.Value);
            product.Rrp = request.Rrp.Value;
        }
        if (request.LocationExternalIds is not null)
            product.LocationIdsJson = PurchaseOrderWorkflow.SerializeLocationIds(request.LocationExternalIds);
        if (request.ParStock.HasValue)
            product.ParStock = request.ParStock.Value;
        if (request.ParStockUom is not null)
            product.ParStockUom = request.ParStockUom.Trim();
        if (request.YieldAltUnitsJson is not null)
            product.YieldAltUnitsJson = string.IsNullOrWhiteSpace(request.YieldAltUnitsJson) ? "[]" : request.YieldAltUnitsJson;

        product.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        return Ok(MapProduct(product));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var product = await db.Products.FirstOrDefaultAsync(p => p.Id == id);
        if (product is null)
            return NotFound();

        db.Products.Remove(product);
        await db.SaveChangesAsync();
        return NoContent();
    }

    static string? ValidateRequest(UpsertProductRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return "Product name is required.";
        if (string.IsNullOrWhiteSpace(request.Category))
            return "Category is required.";
        if (string.IsNullOrWhiteSpace(request.Group))
            return "Group is required.";
        if (request.IsSubProduct)
        {
            if (request.YieldQuantity is null or <= 0)
                return "Sub-product yield quantity must be greater than zero.";
            if (string.IsNullOrWhiteSpace(request.YieldUom))
                return "Sub-product UOM is required.";
            if (request.ExpiryPeriodDays is null or <= 0)
                return "Sub-product expiry period (days) must be greater than zero.";
        }
        else if (!request.B2cEnabled && !request.B2bEnabled)
        {
            return "Select a product type: B2C or B2B.";
        }
        else if (request.B2cEnabled && request.B2bEnabled)
        {
            return "A product must be either B2C or B2B, not both.";
        }
        else if (request.B2bEnabled && (request.ExpiryPeriodDays is null or <= 0))
        {
            return "B2B product expiry period (days) must be greater than zero.";
        }
        if (request.Items is null || request.Items.Count == 0)
            return "Add at least one smart component to the product.";

        foreach (var item in request.Items)
        {
            if (string.IsNullOrWhiteSpace(item.ComponentId))
                return "Each line requires a smart component.";
            if (item.Quantity <= 0)
                return "Each line requires a quantity greater than zero.";
            if (item.ComponentUomPrice < 0)
                return "Component UOM price cannot be negative.";
        }

        foreach (var item in request.PackagingItems ?? [])
        {
            if (string.IsNullOrWhiteSpace(item.ComponentId))
                continue;
            if (item.Quantity <= 0)
                return "Each packaging line requires a quantity greater than zero.";
            if (item.ComponentUomPrice < 0)
                return "Packaging component UOM price cannot be negative.";
        }

        return null;
    }

    static int ResolveExpiryPeriodDays(UpsertProductRequest request)
    {
        if (!request.IsSubProduct && !request.B2bEnabled)
            return 0;
        return Math.Max(0, request.ExpiryPeriodDays ?? 0);
    }

    static int ResolveActivationPeriodHours(UpsertProductRequest request)
    {
        if (!request.IsSubProduct && !request.B2bEnabled)
            return 0;
        return Math.Max(0, request.ActivationPeriodHours ?? 0);
    }

    static List<ProductComponentItem> MapItems(List<UpsertProductComponentItemRequest> items)
        => items.Select((item, index) =>
        {
            var subtotal = item.Quantity * item.ComponentUomPrice;
            return new ProductComponentItem
            {
                ComponentId = item.ComponentId.Trim(),
                ComponentName = item.ComponentName?.Trim() ?? string.Empty,
                ComponentUom = item.ComponentUom?.Trim() ?? string.Empty,
                ComponentUomPrice = item.ComponentUomPrice,
                Quantity = item.Quantity,
                Subtotal = subtotal,
                SortOrder = index,
            };
        }).ToList();

    static List<ProductPackagingItem> MapPackagingItems(List<UpsertProductComponentItemRequest>? items)
        => (items ?? [])
            .Where(item => !string.IsNullOrWhiteSpace(item.ComponentId))
            .Select((item, index) =>
            {
                var subtotal = item.Quantity * item.ComponentUomPrice;
                return new ProductPackagingItem
                {
                    ComponentId = item.ComponentId.Trim(),
                    ComponentName = item.ComponentName?.Trim() ?? string.Empty,
                    ComponentUom = item.ComponentUom?.Trim() ?? string.Empty,
                    ComponentUomPrice = item.ComponentUomPrice,
                    Quantity = item.Quantity,
                    Subtotal = subtotal,
                    SortOrder = index,
                };
            }).ToList();

    static List<ProductAlias> MapAliases(List<UpsertProductAliasRequest>? aliases, int productId)
        => (aliases ?? [])
            .Select((item, index) => new ProductAlias
            {
                Id = item.Id ?? 0,
                ProductId = productId,
                Name = item.Name.Trim(),
                Rrp = item.Rrp,
                B2bSalesConfigJson = string.IsNullOrWhiteSpace(item.B2bSalesConfigJson) ? "{}" : item.B2bSalesConfigJson.Trim(),
                SortOrder = index,
            })
            .Where(item => !string.IsNullOrWhiteSpace(item.Name))
            .ToList();

    static object MapProduct(Product product) => new
    {
        product.Id,
        productId = product.ProductId,
        name = product.Name,
        category = product.Category,
        group = product.Group,
        isSubProduct = product.IsSubProduct,
        b2cEnabled = product.B2cEnabled,
        b2bEnabled = product.B2bEnabled,
        b2bPackageUnit = product.B2bPackageUnit,
        b2bSalesConfigJson = product.B2bSalesConfigJson,
        totalCost = product.TotalCost,
        packagingCost = product.PackagingCost,
        rrp = product.Rrp,
        previousTotalCost = product.PreviousTotalCost,
        previousPackagingCost = product.PreviousPackagingCost,
        previousRrp = product.PreviousRrp,
        yieldQuantity = product.YieldQuantity,
        yieldUom = product.YieldUom,
        yieldAltUnitsJson = product.YieldAltUnitsJson,
        expiryPeriodDays = product.ExpiryPeriodDays,
        activationPeriodHours = product.ActivationPeriodHours,
        parStock = product.ParStock,
        parStockUom = product.ParStockUom,
        posEnabled = product.PosEnabled,
        posDeliveryUnitsJson = product.PosDeliveryUnitsJson,
        active = product.Active,
        companyId = product.CompanyId,
        locationExternalIds = PurchaseOrderWorkflow.DeserializeLocationIds(product.LocationIdsJson),
        createdAt = product.CreatedAt,
        updatedAt = product.UpdatedAt,
        aliases = product.Aliases
            .OrderBy(a => a.SortOrder)
            .ThenBy(a => a.Id)
            .Select(a => new
            {
                a.Id,
                name = a.Name,
                rrp = a.Rrp,
                b2bSalesConfigJson = a.B2bSalesConfigJson,
                sortOrder = a.SortOrder,
            }),
        items = product.Items
            .OrderBy(i => i.SortOrder)
            .ThenBy(i => i.Id)
            .Select(i => new
            {
                i.Id,
                componentId = i.ComponentId,
                componentName = i.ComponentName,
                componentUom = i.ComponentUom,
                componentUomPrice = i.ComponentUomPrice,
                quantity = i.Quantity,
                subtotal = i.Subtotal,
                sortOrder = i.SortOrder,
            }),
        packagingItems = product.PackagingItems
            .OrderBy(i => i.SortOrder)
            .ThenBy(i => i.Id)
            .Select(i => new
            {
                i.Id,
                componentId = i.ComponentId,
                componentName = i.ComponentName,
                componentUom = i.ComponentUom,
                componentUomPrice = i.ComponentUomPrice,
                quantity = i.Quantity,
                subtotal = i.Subtotal,
                sortOrder = i.SortOrder,
            }),
    };
}
