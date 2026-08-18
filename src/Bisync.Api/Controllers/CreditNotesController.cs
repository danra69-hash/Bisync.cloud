using System.ComponentModel.DataAnnotations;
using Bisync.Api.Data;
using Bisync.Api.Services;
using Bisync.Api.Tenancy;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/credit-notes")]
public class CreditNotesController(
    BisyncDbContext db,
    CreditNoteService creditNotes,
    ITenantContext tenant) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> List(
        [FromQuery] int? companyId = null,
        [FromQuery] string? locationIds = null,
        CancellationToken cancellationToken = default)
    {
        // Drop junk tiny-qty rows (e.g. 0.0010) before the page reads them.
        try
        {
            await creditNotes.PurgeErroneousTinyQuantityAsync(cancellationToken);
        }
        catch
        {
            // Listing must still succeed; purge is best-effort.
        }

        var cid = TenantQuery.ResolveCompanyId(tenant, companyId);
        if (cid is null && !TenantQuery.AllowsAllCompanies(tenant, cid))
            return Ok(Array.Empty<object>());

        var locs = (locationIds ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(l => l.Trim().ToLowerInvariant())
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        IQueryable<Models.CreditNote> query = db.CreditNotes.AsNoTracking();
        if (cid is int id)
            query = query.Where(c => c.CompanyId == id);
        if (locs.Count > 0)
            query = query.Where(c => locs.Contains(c.LocationExternalId));

        var rows = await query
            .OrderByDescending(c => c.CreditNoteDate)
            .ThenByDescending(c => c.Id)
            .Take(500)
            .ToListAsync(cancellationToken);

        return Ok(rows.Select(CreditNoteService.Map));
    }

    [HttpGet("po-search")]
    public async Task<ActionResult<IEnumerable<object>>> SearchPurchaseOrders(
        [FromQuery] int? companyId = null,
        [FromQuery] string? q = null)
    {
        var cid = TenantQuery.ResolveCompanyId(tenant, companyId);
        if (cid is null)
            return BadRequest(new { message = "Company is required." });

        var rows = await creditNotes.SearchPurchaseOrdersAsync(cid.Value, q);
        return Ok(rows);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<object>> Get(int id, [FromQuery] int? companyId = null)
    {
        var cid = TenantQuery.ResolveCompanyId(tenant, companyId);
        var query = db.CreditNotes.AsNoTracking().Where(c => c.Id == id);
        if (cid is int companyFilter)
            query = query.Where(c => c.CompanyId == companyFilter);

        var row = await query.FirstOrDefaultAsync();
        if (row is null) return NotFound();
        return Ok(CreditNoteService.Map(row));
    }

    [HttpPost]
    public async Task<ActionResult<object>> Create([FromBody] CreateCreditNoteRequest request)
    {
        var cid = TenantQuery.ResolveCompanyId(tenant, request.CompanyId);
        if (cid is null)
            return BadRequest(new { message = "Company is required." });
        if (request.PurchaseOrderId <= 0 || request.PurchaseOrderItemId <= 0)
            return BadRequest(new { message = "Purchase order and line are required." });
        if (!DateOnly.TryParse(request.CreditNoteDate, out var date))
            return BadRequest(new { message = "Credit note date is required (yyyy-MM-dd)." });

        try
        {
            var entry = await creditNotes.CreateAsync(
                cid.Value,
                request.PurchaseOrderId,
                request.PurchaseOrderItemId,
                request.Quantity,
                request.CreditNoteNumber,
                date,
                request.LocationExternalId);
            return Ok(CreditNoteService.Map(entry));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = $"Failed to save credit note: {ex.Message}" });
        }
    }

    [HttpPatch("{id:int}")]
    public async Task<ActionResult<object>> UpdateNumber(int id, [FromBody] UpdateCreditNoteNumberRequest request)
    {
        var cid = TenantQuery.ResolveCompanyId(tenant, request.CompanyId);
        if (cid is null)
            return BadRequest(new { message = "Company is required." });

        try
        {
            var entry = await creditNotes.UpdateNumberAsync(id, cid.Value, request.CreditNoteNumber ?? string.Empty);
            return Ok(CreditNoteService.Map(entry));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{id:int}/cancel")]
    public async Task<ActionResult<object>> Cancel(int id, [FromBody] CancelCreditNoteRequest request)
    {
        var cid = TenantQuery.ResolveCompanyId(tenant, request.CompanyId);
        if (cid is null)
            return BadRequest(new { message = "Company is required." });

        try
        {
            var entry = await creditNotes.CancelAsync(
                id,
                cid.Value,
                request.CancelPoNumber ?? string.Empty,
                request.CancelDoOrInvoiceNumber ?? string.Empty,
                request.CancelledBy);
            return Ok(CreditNoteService.Map(entry));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>Permanently delete a credit note and reverse its stock outbound.</summary>
    [HttpDelete("{id:int}")]
    public async Task<ActionResult> Delete(int id, [FromQuery] int? companyId = null)
    {
        var cid = TenantQuery.ResolveCompanyId(tenant, companyId);
        try
        {
            await creditNotes.DeleteCompletelyAsync(id, cid);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}

public class CreateCreditNoteRequest
{
    public int? CompanyId { get; set; }
    [Required]
    public int PurchaseOrderId { get; set; }
    [Required]
    public int PurchaseOrderItemId { get; set; }
    [Range(0.01, double.MaxValue)]
    public decimal Quantity { get; set; }
    public string? CreditNoteNumber { get; set; }
    [Required]
    public string CreditNoteDate { get; set; } = string.Empty;
    public string? LocationExternalId { get; set; }
}

public class UpdateCreditNoteNumberRequest
{
    public int? CompanyId { get; set; }
    public string? CreditNoteNumber { get; set; }
}

public class CancelCreditNoteRequest
{
    public int? CompanyId { get; set; }
    [Required]
    public string CancelPoNumber { get; set; } = string.Empty;
    [Required]
    public string CancelDoOrInvoiceNumber { get; set; } = string.Empty;
    public string? CancelledBy { get; set; }
}
