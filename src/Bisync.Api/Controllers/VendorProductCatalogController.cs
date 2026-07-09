using System.Text.Json;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/vendorproducts")]
public class VendorProductCatalogController(BisyncDbContext db) : ControllerBase
{
    static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    [HttpGet("catalog")]
    public async Task<ActionResult<IEnumerable<object>>> GetCatalog([FromQuery] string? vendorExternalId)
    {
        var query = db.VendorProducts.AsNoTracking().Where(p => p.Active);
        if (!string.IsNullOrWhiteSpace(vendorExternalId))
            query = query.Where(p => p.VendorExternalId == vendorExternalId.Trim());

        var rows = await query
            .OrderBy(p => p.Group)
            .ThenBy(p => p.ProductName)
            .ToListAsync();

        var priceMap = await db.VendorProductPrices.AsNoTracking()
            .ToDictionaryAsync(p => p.ExternalId, p => p.DeliveryPrice);

        return Ok(rows.Select(p => ToDto(p, priceMap)));
    }

    [HttpGet("catalog/{externalId}")]
    public async Task<ActionResult<object>> GetOne(string externalId)
    {
        var row = await db.VendorProducts.AsNoTracking()
            .FirstOrDefaultAsync(p => p.ExternalId == externalId);
        if (row is null || !row.Active)
            return NotFound();

        var price = await db.VendorProductPrices.AsNoTracking()
            .FirstOrDefaultAsync(p => p.ExternalId == externalId);

        var priceMap = price is null
            ? new Dictionary<string, decimal>()
            : new Dictionary<string, decimal> { [externalId] = price.DeliveryPrice };

        return Ok(ToDto(row, priceMap));
    }

    [HttpPost("catalog")]
    public async Task<ActionResult<object>> Create([FromBody] VendorProductUpsertRequest request)
    {
        var externalId = request.Id?.Trim().ToUpperInvariant() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(externalId))
            return BadRequest(new { message = "Vendor product id is required." });

        if (await db.VendorProducts.AnyAsync(p => p.ExternalId == externalId))
            return Conflict(new { message = "Vendor product id already exists." });

        var entity = MapToEntity(request, externalId);
        db.VendorProducts.Add(entity);
        await db.SaveChangesAsync();

        return Ok(ToDto(entity, new Dictionary<string, decimal>()));
    }

    [HttpPut("catalog/{externalId}")]
    public async Task<ActionResult<object>> Update(string externalId, [FromBody] VendorProductUpsertRequest request)
    {
        var row = await db.VendorProducts.FirstOrDefaultAsync(p => p.ExternalId == externalId);
        if (row is null)
            return NotFound();

        ApplyUpsert(row, request);
        row.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        var price = await db.VendorProductPrices.AsNoTracking()
            .FirstOrDefaultAsync(p => p.ExternalId == externalId);
        var priceMap = price is null
            ? new Dictionary<string, decimal>()
            : new Dictionary<string, decimal> { [externalId] = price.DeliveryPrice };

        return Ok(ToDto(row, priceMap));
    }

    [HttpPost("catalog/{externalId}/deactivate")]
    public async Task<IActionResult> Deactivate(string externalId)
    {
        var row = await db.VendorProducts.FirstOrDefaultAsync(p => p.ExternalId == externalId);
        if (row is null)
            return NotFound();

        row.Active = false;
        row.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("catalog/{externalId}/reactivate")]
    public async Task<IActionResult> Reactivate(string externalId)
    {
        var row = await db.VendorProducts.FirstOrDefaultAsync(p => p.ExternalId == externalId);
        if (row is null)
            return NotFound();

        row.Active = true;
        row.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return NoContent();
    }

    static VendorProduct MapToEntity(VendorProductUpsertRequest request, string externalId)
    {
        var entity = new VendorProduct { ExternalId = externalId };
        ApplyUpsert(entity, request);
        entity.UpdatedAt = DateTime.UtcNow;
        return entity;
    }

    static void ApplyUpsert(VendorProduct row, VendorProductUpsertRequest request)
    {
        row.VendorExternalId = request.VendorExternalId?.Trim() ?? row.VendorExternalId;
        row.VendorName = request.VendorName?.Trim() ?? row.VendorName;
        row.ProductName = request.ProductName?.Trim() ?? row.ProductName;
        row.Group = request.Group?.Trim() ?? row.Group;
        row.Specification = request.Specification?.Trim() ?? row.Specification;
        row.ImageUrl = request.ImageUrl?.Trim() ?? row.ImageUrl;
        row.DeliveryPrice = request.DeliveryPrice ?? row.DeliveryPrice;
        row.DeliveryJson = string.IsNullOrWhiteSpace(request.DeliveryJson)
            ? row.DeliveryJson
            : request.DeliveryJson.Trim();
        row.ProductPolicyTag = request.ProductPolicyTag?.Trim() ?? row.ProductPolicyTag;
        row.IsPrivate = request.IsPrivate ?? row.IsPrivate;
        row.PrivateLocationIdsJson = string.IsNullOrWhiteSpace(request.PrivateLocationIdsJson)
            ? (request.PrivateLocationIds is { Count: > 0 }
                ? JsonSerializer.Serialize(request.PrivateLocationIds, JsonOptions)
                : row.PrivateLocationIdsJson)
            : request.PrivateLocationIdsJson.Trim();
        if (request.Active.HasValue)
            row.Active = request.Active.Value;
    }

    static object ToDto(VendorProduct row, IReadOnlyDictionary<string, decimal> priceMap)
    {
        var deliveryPrice = priceMap.TryGetValue(row.ExternalId, out var reconciled)
            ? reconciled
            : row.DeliveryPrice;

        string[] privateLocationIds;
        try
        {
            privateLocationIds = JsonSerializer.Deserialize<string[]>(row.PrivateLocationIdsJson, JsonOptions) ?? [];
        }
        catch
        {
            privateLocationIds = [];
        }

        object delivery;
        try
        {
            delivery = JsonSerializer.Deserialize<object>(row.DeliveryJson, JsonOptions) ?? new { };
        }
        catch
        {
            delivery = new { };
        }

        return new
        {
            id = row.ExternalId,
            group = row.Group,
            vendorExternalId = row.VendorExternalId,
            vendorName = row.VendorName,
            productName = row.ProductName,
            specification = row.Specification,
            imageUrl = string.IsNullOrWhiteSpace(row.ImageUrl) ? null : row.ImageUrl,
            deliveryPrice,
            delivery,
            productPolicyTag = string.IsNullOrWhiteSpace(row.ProductPolicyTag) ? null : row.ProductPolicyTag,
            isPrivate = row.IsPrivate,
            privateLocationIds,
            active = row.Active,
            updatedAt = row.UpdatedAt,
        };
    }
}

public class VendorProductUpsertRequest
{
    public string? Id { get; set; }
    public string? VendorExternalId { get; set; }
    public string? VendorName { get; set; }
    public string? ProductName { get; set; }
    public string? Group { get; set; }
    public string? Specification { get; set; }
    public string? ImageUrl { get; set; }
    public decimal? DeliveryPrice { get; set; }
    public string? DeliveryJson { get; set; }
    public string? ProductPolicyTag { get; set; }
    public bool? IsPrivate { get; set; }
    public List<string>? PrivateLocationIds { get; set; }
    public string? PrivateLocationIdsJson { get; set; }
    public bool? Active { get; set; }
}
