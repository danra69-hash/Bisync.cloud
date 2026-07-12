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
    ITenantContext tenant) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> List(
        [FromQuery] int? companyId = null,
        [FromQuery] string? locationIds = null,
        [FromQuery] string? month = null,
        [FromQuery] string? status = null)
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

        if (!string.IsNullOrWhiteSpace(status))
        {
            var st = status.Trim().ToLowerInvariant();
            query = query.Where(t => t.Status == st);
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

    [HttpGet("pending-inbound")]
    public async Task<ActionResult<IEnumerable<object>>> PendingInbound(
        [FromQuery] int? companyId = null,
        [FromQuery] string? locationIds = null)
    {
        var cid = TenantQuery.ResolveCompanyId(tenant, companyId);
        if (cid is null && !TenantQuery.AllowsAllCompanies(tenant, cid))
            return Ok(Array.Empty<object>());

        var locs = (locationIds ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        IQueryable<Models.TransferEntry> query = db.TransferEntries.AsNoTracking()
            .Where(t => t.Status == Models.TransferEntry.StatusPending);
        if (cid is int id)
            query = query.Where(t => t.CompanyId == id);
        if (locs.Count > 0)
            query = query.Where(t => locs.Contains(t.ToLocationExternalId));

        var rows = await query
            .OrderBy(t => t.TransferDate)
            .ThenBy(t => t.Id)
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

        var available = await transfers.GetAvailableAsync(
            cid,
            itemType,
            itemKey,
            locationExternalId,
            uom ?? string.Empty);

        return Ok(new
        {
            availableQty = available,
            uom = uom ?? string.Empty,
        });
    }

    [HttpPost]
    public async Task<ActionResult<object>> Initiate([FromBody] CreateTransferRequest request)
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
            var entry = await transfers.InitiateAsync(
                companyId.Value,
                request.FromLocationExternalId,
                request.ToLocationExternalId,
                request.ItemType,
                request.ItemKey,
                request.ItemName ?? string.Empty,
                request.Quantity,
                request.Uom ?? string.Empty,
                transferDate,
                request.InitiatedBy);
            return Ok(Map(entry));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{id:int}/receive")]
    public async Task<ActionResult<object>> Receive(int id, [FromBody] ReceiveTransferRequest? request)
    {
        var companyId = TenantQuery.ResolveCompanyId(tenant, request?.CompanyId);
        if (companyId is null)
            return BadRequest(new { message = "Company is required." });

        DateOnly? receivedDate = null;
        if (!string.IsNullOrWhiteSpace(request?.ReceivedDate))
        {
            if (!DateOnly.TryParse(request.ReceivedDate, out var parsed))
                return BadRequest(new { message = "Invalid received date." });
            receivedDate = parsed;
        }

        try
        {
            var entry = await transfers.ConfirmReceiveAsync(
                id,
                companyId.Value,
                request?.ReceivedBy,
                request?.ReceivedQuantity,
                receivedDate);
            return Ok(Map(entry));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{id:int}/reject")]
    public async Task<ActionResult<object>> Reject(int id, [FromBody] RejectTransferRequest? request)
    {
        var companyId = TenantQuery.ResolveCompanyId(tenant, request?.CompanyId);
        if (companyId is null)
            return BadRequest(new { message = "Company is required." });

        try
        {
            var entry = await transfers.RejectAsync(id, companyId.Value, request?.RejectedBy);
            return Ok(Map(entry));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{id:int}/cancel")]
    public async Task<ActionResult<object>> Cancel(int id, [FromBody] RejectTransferRequest? request, [FromQuery] int? companyId = null)
    {
        var cid = TenantQuery.ResolveCompanyId(tenant, request?.CompanyId ?? companyId);
        if (cid is null)
            return BadRequest(new { message = "Company is required." });

        try
        {
            var entry = await transfers.RejectAsync(id, cid.Value, request?.RejectedBy);
            return Ok(Map(entry));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    static object Map(Models.TransferEntry t)
    {
        var qty = t.ReceivedQuantity ?? t.Quantity;
        var unitPrice = t.UnitPrice;
        return new
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
            unitPrice,
            totalValue = Math.Round(unitPrice * qty, 2, MidpointRounding.AwayFromZero),
            transferDate = t.TransferDate.ToString("yyyy-MM-dd"),
            status = t.Status,
            initiatedBy = t.InitiatedBy,
            receivedBy = t.ReceivedBy,
            receivedAt = t.ReceivedAt,
            receivedQuantity = t.ReceivedQuantity,
            rejectedBy = t.RejectedBy,
            rejectedAt = t.RejectedAt,
            createdAt = t.CreatedAt,
        };
    }
}
