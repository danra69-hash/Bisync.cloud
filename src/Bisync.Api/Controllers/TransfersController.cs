using Bisync.Api.Contracts;
using Bisync.Api.Data;
using Bisync.Api.Services;
using Bisync.Api.Tenancy;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/transfers")]
public class TransfersController(
    BisyncDbContext db,
    TransferService transfers,
    ComponentStockService componentStock,
    ITenantContext tenant) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> List(
        [FromQuery] int? companyId = null,
        [FromQuery] string? locationIds = null,
        [FromQuery] string? month = null)
    {
        var cid = TenantQuery.ResolveCompanyId(tenant, companyId);
        if (cid is null && !TenantQuery.AllowsAllCompanies(tenant, cid))
            return Ok(Array.Empty<object>());

        var locs = (locationIds ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        IQueryable<Models.TransferEntry> query = db.TransferEntries.AsNoTracking();
        if (cid is int id)
            query = query.Where(t => t.CompanyId == id);
        if (locs.Count > 0)
        {
            query = query.Where(t =>
                locs.Contains(t.FromLocationExternalId) || locs.Contains(t.ToLocationExternalId));
        }

        if (!string.IsNullOrWhiteSpace(month)
            && DateOnly.TryParse($"{month.Trim()}-01", out var monthStart))
        {
            var monthEnd = monthStart.AddMonths(1);
            query = query.Where(t => t.TransferDate >= monthStart && t.TransferDate < monthEnd);
        }
        else
        {
            var earliest = DateOnly.FromDateTime(DateTime.UtcNow.Date.AddYears(-2));
            query = query.Where(t => t.TransferDate >= earliest);
        }

        var rows = await query
            .OrderByDescending(t => t.TransferDate)
            .ThenByDescending(t => t.Id)
            .ToListAsync();

        return Ok(rows.Select(Map));
    }

    [HttpGet("available")]
    public async Task<ActionResult<object>> Available(
        [FromQuery] string itemType,
        [FromQuery] string itemKey,
        [FromQuery] string locationExternalId,
        [FromQuery] string uom,
        [FromQuery] int? companyId = null)
    {
        var cid = TenantQuery.ResolveCompanyId(tenant, companyId);
        if (string.IsNullOrWhiteSpace(itemKey) || string.IsNullOrWhiteSpace(locationExternalId))
            return BadRequest(new { message = "Item and location are required." });

        var type = (itemType ?? "component").Trim().ToLowerInvariant();
        if (type is "product" or "sub-product" or "subproduct" or "sub_product")
        {
            if (!int.TryParse(itemKey, out var productId))
                return BadRequest(new { message = "Invalid product id." });

            var stock = await db.ProductB2bLocationStocks.AsNoTracking()
                .FirstOrDefaultAsync(s =>
                    s.ProductId == productId
                    && s.LocationExternalId == locationExternalId.Trim());
            return Ok(new
            {
                availableQty = stock?.InStock ?? 0m,
                uom = uom ?? "pcs",
            });
        }

        var ingredient = await db.Ingredients.AsNoTracking()
            .FirstOrDefaultAsync(i => i.ComponentId == itemKey && (cid == null || i.CompanyId == cid))
            ?? await db.Ingredients.AsNoTracking()
                .FirstOrDefaultAsync(i => i.ComponentId == itemKey);

        var moveUom = uom ?? string.Empty;
        if (ingredient is not null)
        {
            (_, moveUom) = IngredientUomBridge.ToInventoryPreferred(ingredient, 1, moveUom);
        }

        var onHand = await componentStock.GetOnHandAsync(
            itemKey.Trim(),
            locationExternalId.Trim(),
            string.IsNullOrWhiteSpace(moveUom) ? (uom ?? "") : moveUom);

        return Ok(new
        {
            availableQty = onHand,
            uom = string.IsNullOrWhiteSpace(moveUom) ? uom : moveUom,
        });
    }

    [HttpPost]
    public async Task<ActionResult<object>> Create([FromBody] CreateTransferRequest request)
    {
        var companyId = TenantQuery.ResolveCompanyId(tenant, request.CompanyId);
        if (companyId is null)
            return BadRequest(new { message = "Company is required." });
        if (request.Quantity <= 0)
            return BadRequest(new { message = "Transfer quantity must be greater than zero." });
        if (string.IsNullOrWhiteSpace(request.ItemKey))
            return BadRequest(new { message = "Item is required." });

        if (!DateOnly.TryParse(request.TransferDate, out var transferDate))
            return BadRequest(new { message = "Invalid transfer date." });

        var earliest = DateOnly.FromDateTime(DateTime.UtcNow.Date.AddYears(-2));
        if (transferDate < earliest)
            return BadRequest(new { message = "Transfer date is outside the 2-year live history window." });
        if (transferDate > DateOnly.FromDateTime(DateTime.UtcNow.Date))
            return BadRequest(new { message = "Transfer date cannot be in the future." });

        try
        {
            var entry = await transfers.CreateAsync(
                companyId.Value,
                request.FromLocationExternalId,
                request.ToLocationExternalId,
                request.ItemType,
                request.ItemKey,
                request.ItemName ?? string.Empty,
                request.Quantity,
                request.Uom ?? string.Empty,
                transferDate);
            return Ok(Map(entry));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    static object Map(Models.TransferEntry t) => new
    {
        t.Id,
        companyId = t.CompanyId,
        fromLocationExternalId = t.FromLocationExternalId,
        toLocationExternalId = t.ToLocationExternalId,
        itemType = t.ItemType,
        itemKey = t.ItemKey,
        itemName = t.ItemName,
        quantity = t.Quantity,
        uom = t.Uom,
        transferDate = t.TransferDate.ToString("yyyy-MM-dd"),
        createdAt = t.CreatedAt,
    };
}
