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
    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> List([FromQuery] int? companyId)
    {
        IQueryable<Product> query = db.Products
            .AsNoTracking()
            .Include(p => p.Items);

        if (companyId is int id)
            query = query.Where(p => p.CompanyId == null || p.CompanyId == id);

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
        var product = new Product
        {
            ProductId = productId,
            Name = request.Name.Trim(),
            Category = request.Category?.Trim() ?? string.Empty,
            Group = request.Group?.Trim() ?? string.Empty,
            IsSubProduct = request.IsSubProduct,
            B2cEnabled = request.B2cEnabled,
            B2bEnabled = request.B2bEnabled,
            TotalCost = items.Sum(i => i.Subtotal),
            CompanyId = request.CompanyId,
            LocationIdsJson = PurchaseOrderWorkflow.SerializeLocationIds(request.LocationExternalIds ?? []),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Items = items,
        };

        db.Products.Add(product);
        await db.SaveChangesAsync();

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
        product.B2cEnabled = request.B2cEnabled;
        product.B2bEnabled = request.B2bEnabled;
        product.CompanyId = request.CompanyId;
        product.LocationIdsJson = PurchaseOrderWorkflow.SerializeLocationIds(request.LocationExternalIds ?? []);
        product.UpdatedAt = DateTime.UtcNow;

        db.ProductComponentItems.RemoveRange(product.Items);
        product.Items = MapItems(request.Items);
        product.TotalCost = product.Items.Sum(i => i.Subtotal);

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
        if (!request.B2cEnabled && !request.B2bEnabled)
            return "Select at least one channel: B2C or B2B.";
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

        return null;
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
        totalCost = product.TotalCost,
        companyId = product.CompanyId,
        locationExternalIds = PurchaseOrderWorkflow.DeserializeLocationIds(product.LocationIdsJson),
        createdAt = product.CreatedAt,
        updatedAt = product.UpdatedAt,
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
    };
}
