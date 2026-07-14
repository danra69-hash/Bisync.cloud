using Bisync.Api.Contracts;
using Bisync.Api.Data;
using Bisync.Api.Services;
using Bisync.Api.Tenancy;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/wastage")]
public class WastageController(
    BisyncDbContext db,
    WastageService wastage,
    ITenantContext tenant) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> List(
        [FromQuery] int? companyId = null,
        [FromQuery] string? locationIds = null,
        [FromQuery] string? month = null,
        [FromQuery] string? date = null,
        [FromQuery] string? itemType = null)
    {
        var cid = TenantQuery.ResolveCompanyId(tenant, companyId);
        if (cid is null && !TenantQuery.AllowsAllCompanies(tenant, cid))
            return Ok(Array.Empty<object>());

        var locs = (locationIds ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        IQueryable<Models.WastageEntry> query = db.WastageEntries.AsNoTracking();
        if (cid is int id)
            query = query.Where(w => w.CompanyId == id);
        if (locs.Count > 0)
            query = query.Where(w => locs.Contains(w.LocationExternalId));

        if (!string.IsNullOrWhiteSpace(date) && DateOnly.TryParse(date.Trim(), out var day))
        {
            query = query.Where(w => w.WastedDate == day);
        }
        else if (!string.IsNullOrWhiteSpace(month)
            && DateOnly.TryParse($"{month.Trim()}-01", out var monthStart))
        {
            var monthEnd = monthStart.AddMonths(1);
            query = query.Where(w => w.WastedDate >= monthStart && w.WastedDate < monthEnd);
        }
        else
        {
            // Default: last 2 years live window
            var earliest = DateOnly.FromDateTime(DateTime.UtcNow.Date.AddYears(-2));
            query = query.Where(w => w.WastedDate >= earliest);
        }

        var typeFilter = NormalizeListItemType(itemType);
        if (typeFilter is not null)
            query = query.Where(w => w.ItemType == typeFilter);

        var rows = await query
            .OrderByDescending(w => w.WastedDate)
            .ThenByDescending(w => w.Id)
            .ToListAsync();

        return Ok(rows.Select(Map));
    }

    static string? NormalizeListItemType(string? itemType)
    {
        var t = (itemType ?? string.Empty).Trim().ToLowerInvariant();
        return t switch
        {
            "product" => "product",
            "sub-product" or "subproduct" or "sub_product" => "sub-product",
            "component" or "smart-component" or "smart_component" => "component",
            _ => null,
        };
    }

    [HttpGet("reasons")]
    public async Task<ActionResult<IEnumerable<string>>> Reasons(
        [FromQuery] int? companyId = null,
        [FromQuery] string? q = null,
        [FromQuery] int take = 20)
    {
        var cid = TenantQuery.ResolveCompanyId(tenant, companyId);
        IQueryable<Models.WastageEntry> query = db.WastageEntries.AsNoTracking();
        if (cid is int id)
            query = query.Where(w => w.CompanyId == id);

        var term = (q ?? string.Empty).Trim().ToLowerInvariant();
        if (term.Length > 0)
            query = query.Where(w => w.Reason.ToLower().Contains(term));

        var reasons = await query
            .Where(w => w.Reason != "")
            .GroupBy(w => w.Reason)
            .Select(g => new { Reason = g.Key, Count = g.Count() })
            .OrderByDescending(x => x.Count)
            .ThenBy(x => x.Reason)
            .Take(Math.Clamp(take, 1, 50))
            .Select(x => x.Reason)
            .ToListAsync();

        return Ok(reasons);
    }

    [HttpGet("value")]
    public async Task<ActionResult<object>> EstimateValue(
        [FromQuery] int? companyId = null,
        [FromQuery] string? locationExternalId = null,
        [FromQuery] string? itemType = null,
        [FromQuery] string? itemKey = null,
        [FromQuery] decimal quantity = 0,
        [FromQuery] string? uom = null,
        [FromQuery] string? wastedDate = null)
    {
        var cid = TenantQuery.ResolveCompanyId(tenant, companyId);
        if (cid is null)
            return BadRequest(new { message = "Company is required." });
        if (string.IsNullOrWhiteSpace(locationExternalId))
            return BadRequest(new { message = "Location is required." });
        if (string.IsNullOrWhiteSpace(itemKey))
            return BadRequest(new { message = "Item is required." });
        if (quantity <= 0)
            return Ok(new { unitPrice = 0m, totalValue = 0m, uom = uom ?? string.Empty });
        if (!DateOnly.TryParse(wastedDate, out var day))
            return BadRequest(new { message = "Valid wastedDate (yyyy-MM-dd) is required." });

        try
        {
            var (unitPrice, totalValue, resolvedUom) = await wastage.EstimateValueAsync(
                cid.Value,
                locationExternalId,
                itemType ?? "component",
                itemKey,
                quantity,
                uom ?? string.Empty,
                day);
            return Ok(new
            {
                unitPrice,
                totalValue,
                uom = resolvedUom,
                wastedDate = day.ToString("yyyy-MM-dd"),
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost]
    public async Task<ActionResult<object>> CreateManual([FromBody] CreateWastageRequest request)
    {
        var companyId = TenantQuery.ResolveCompanyId(tenant, request.CompanyId);
        if (companyId is null)
            return BadRequest(new { message = "Company is required." });
        if (string.IsNullOrWhiteSpace(request.LocationExternalId))
            return BadRequest(new { message = "Location is required." });
        if (request.Quantity <= 0)
            return BadRequest(new { message = "Quantity must be greater than zero." });
        if (string.IsNullOrWhiteSpace(request.Reason))
            return BadRequest(new { message = "Reason is required." });
        if (string.IsNullOrWhiteSpace(request.ItemKey))
            return BadRequest(new { message = "Item is required." });

        if (!DateOnly.TryParse(request.WastedDate, out var wastedDate))
            return BadRequest(new { message = "Invalid wasted date." });

        var earliest = DateOnly.FromDateTime(DateTime.UtcNow.Date.AddYears(-2));
        if (wastedDate < earliest)
            return BadRequest(new { message = "Wasted date is outside the 2-year live history window." });
        if (wastedDate > DateOnly.FromDateTime(DateTime.UtcNow.Date))
            return BadRequest(new { message = "Wasted date cannot be in the future." });

        try
        {
            var entry = await wastage.CreateManualAsync(
                companyId.Value,
                request.LocationExternalId,
                request.ItemType,
                request.ItemKey,
                request.ItemName ?? string.Empty,
                request.Quantity,
                request.Uom ?? string.Empty,
                wastedDate,
                request.Reason);
            return Ok(Map(entry));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// POS void/refund intake (ready for POS module). Creates POS wastage and depletes BOM components.
    /// </summary>
    [HttpPost("pos")]
    public async Task<ActionResult<object>> CreatePos([FromBody] CreatePosWastageRequest request)
    {
        var companyId = TenantQuery.ResolveCompanyId(tenant, request.CompanyId);
        if (companyId is null)
            return BadRequest(new { message = "Company is required." });
        if (request.ProductId <= 0)
            return BadRequest(new { message = "Product is required." });
        if (request.Quantity <= 0)
            return BadRequest(new { message = "Quantity must be greater than zero." });
        if (string.IsNullOrWhiteSpace(request.LocationExternalId))
            return BadRequest(new { message = "Location is required." });

        var wastedDate = DateOnly.FromDateTime(DateTime.UtcNow.Date);
        if (!string.IsNullOrWhiteSpace(request.WastedDate)
            && DateOnly.TryParse(request.WastedDate, out var parsed))
        {
            wastedDate = parsed;
        }

        try
        {
            var entry = await wastage.CreatePosWastageAsync(
                companyId.Value,
                request.LocationExternalId,
                request.ProductId,
                request.Quantity,
                request.CheckNo ?? string.Empty,
                request.Reason ?? "POS void/refund",
                wastedDate);
            return Ok(Map(entry));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    static object Map(Models.WastageEntry w) => new
    {
        w.Id,
        companyId = w.CompanyId,
        locationExternalId = w.LocationExternalId,
        source = w.Source,
        itemType = w.ItemType,
        itemKey = w.ItemKey,
        itemName = w.ItemName,
        quantity = w.Quantity,
        uom = w.Uom,
        wastedDate = w.WastedDate.ToString("yyyy-MM-dd"),
        reason = w.Reason,
        posCheckNo = w.PosCheckNo,
        isPos = string.Equals(w.Source, WastageService.SourcePos, StringComparison.OrdinalIgnoreCase),
        createdAt = w.CreatedAt,
    };
}
