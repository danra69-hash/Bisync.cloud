using System.ComponentModel.DataAnnotations;
using Bisync.Api.Data;
using Bisync.Api.Services;
using Bisync.Api.Tenancy;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/central-store")]
public class CentralStoreController(
    BisyncDbContext db,
    CentralStoreService centralStore,
    ITenantContext tenant) : ControllerBase
{
    [HttpGet("config")]
    public async Task<ActionResult<object>> GetConfig([FromQuery] int? companyId = null)
    {
        var cid = TenantQuery.ResolveCompanyId(tenant, companyId);
        if (cid is null)
            return BadRequest(new { message = "Company is required." });

        var config = await centralStore.GetConfigAsync(cid.Value);
        return Ok(CentralStoreService.MapConfig(config));
    }

    [HttpPost("activate")]
    public async Task<ActionResult<object>> Activate([FromBody] ActivateCentralStoreRequest request)
    {
        var cid = TenantQuery.ResolveCompanyId(tenant, request.CompanyId);
        if (cid is null)
            return BadRequest(new { message = "Company is required." });

        try
        {
            var config = await centralStore.ActivateAsync(
                cid.Value,
                request.StoreLocationExternalId ?? string.Empty,
                request.KitchenLocationExternalId ?? string.Empty);
            return Ok(CentralStoreService.MapConfig(config));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("deactivate")]
    public async Task<ActionResult<object>> Deactivate([FromBody] CompanyScopedRequest request)
    {
        var cid = TenantQuery.ResolveCompanyId(tenant, request.CompanyId);
        if (cid is null)
            return BadRequest(new { message = "Company is required." });

        var config = await centralStore.DeactivateAsync(cid.Value);
        return Ok(CentralStoreService.MapConfig(config));
    }

    [HttpGet("requisitions")]
    public async Task<ActionResult<IEnumerable<object>>> ListRequisitions(
        [FromQuery] int? companyId = null,
        [FromQuery] string? status = null)
    {
        var cid = TenantQuery.ResolveCompanyId(tenant, companyId);
        if (cid is null && !TenantQuery.AllowsAllCompanies(tenant, cid))
            return Ok(Array.Empty<object>());

        IQueryable<Models.StoreRequisition> query = db.StoreRequisitions
            .AsNoTracking()
            .Include(r => r.Lines);
        if (cid is int id)
            query = query.Where(r => r.CompanyId == id);
        if (!string.IsNullOrWhiteSpace(status))
        {
            var s = status.Trim().ToLowerInvariant();
            query = query.Where(r => r.Status == s);
        }

        var rows = await query
            .OrderByDescending(r => r.RequestedAt)
            .ThenByDescending(r => r.Id)
            .Take(200)
            .ToListAsync();

        return Ok(rows.Select(CentralStoreService.MapRequisition));
    }

    [HttpPost("requisitions/{id:int}/issue")]
    public async Task<ActionResult<object>> Issue(int id, [FromBody] IssueStoreRequisitionRequest request)
    {
        var cid = TenantQuery.ResolveCompanyId(tenant, request.CompanyId);
        if (cid is null)
            return BadRequest(new { message = "Company is required." });

        try
        {
            var req = await centralStore.IssueAsync(id, cid.Value, request.IssuedBy);
            return Ok(CentralStoreService.MapRequisition(req));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("stock-holds")]
    public async Task<ActionResult<IEnumerable<object>>> ListStockHolds(
        [FromQuery] int? companyId = null,
        [FromQuery] string? locationIds = null,
        [FromQuery] string? status = null)
    {
        var cid = TenantQuery.ResolveCompanyId(tenant, companyId);
        if (cid is null && !TenantQuery.AllowsAllCompanies(tenant, cid))
            return Ok(Array.Empty<object>());

        var locs = (locationIds ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(l => l.Trim().ToLowerInvariant())
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        IQueryable<Models.ProductionStockHold> query = db.ProductionStockHolds.AsNoTracking();
        if (cid is int id)
            query = query.Where(h => h.CompanyId == id);
        if (locs.Count > 0)
            query = query.Where(h => locs.Contains(h.LocationExternalId));

        var statusFilter = (status ?? "held").Trim().ToLowerInvariant();
        if (statusFilter is "held" or "depleted")
            query = query.Where(h => h.Status == statusFilter);
        else if (statusFilter != "all")
            query = query.Where(h => h.Status == Models.ProductionStockHold.StatusHeld);

        var rows = await query
            .OrderByDescending(h => h.CreatedAt)
            .ThenByDescending(h => h.Id)
            .Take(500)
            .ToListAsync();

        return Ok(rows.Select(CentralStoreService.MapHold));
    }
}

public class ActivateCentralStoreRequest
{
    public int? CompanyId { get; set; }
    [Required]
    public string StoreLocationExternalId { get; set; } = string.Empty;
    [Required]
    public string KitchenLocationExternalId { get; set; } = string.Empty;
}

public class CompanyScopedRequest
{
    public int? CompanyId { get; set; }
}

public class IssueStoreRequisitionRequest
{
    public int? CompanyId { get; set; }
    public string? IssuedBy { get; set; }
}
