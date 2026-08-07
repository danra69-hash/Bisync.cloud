using Bisync.Api.Data;
using Bisync.Api.Services;
using Bisync.Api.Tenancy;
using Microsoft.AspNetCore.Mvc;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/tag-suggestions")]
public class TagSuggestionsController(
    BisyncDbContext db,
    ComponentVendorTagSuggestionService suggestions,
    ITenantContext tenant) : ControllerBase
{
    /// <summary>
    /// Vendor-product tag suggestions for one component name (probability ≥ 50%).
    /// Engaged vendors are listed before untact (unengaged) vendors.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<object>> GetForComponent(
        [FromQuery] int? companyId = null,
        [FromQuery] string? componentName = null,
        [FromQuery] string? locationIds = null,
        CancellationToken cancellationToken = default)
    {
        var cid = TenantQuery.ResolveCompanyId(tenant, companyId);
        if (cid is null)
            return BadRequest(new { message = "Company is required." });

        var name = (componentName ?? string.Empty).Trim();
        if (name.Length == 0)
            return BadRequest(new { message = "Component name is required." });

        var locs = (locationIds ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToList();

        var rows = await suggestions.LookupForComponentAsync(cid.Value, name, locs, db, cancellationToken);
        return Ok(new
        {
            componentName = name,
            minProbability = ComponentVendorTagSuggestionService.MinProbability,
            count = rows.Count,
            suggestions = rows,
        });
    }

    /// <summary>
    /// Batch suggestion counts keyed by component name (for My Component list badges).
    /// </summary>
    [HttpPost("counts")]
    public async Task<ActionResult<object>> Counts(
        [FromBody] TagSuggestionCountsRequest request,
        CancellationToken cancellationToken = default)
    {
        var cid = TenantQuery.ResolveCompanyId(tenant, request.CompanyId);
        if (cid is null)
            return BadRequest(new { message = "Company is required." });

        var names = (request.ComponentNames ?? [])
            .Where(n => !string.IsNullOrWhiteSpace(n))
            .Select(n => n.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var counts = await suggestions.CountSuggestionsAsync(cid.Value, names, db, cancellationToken);
        return Ok(new { counts });
    }
}

public class TagSuggestionCountsRequest
{
    public int? CompanyId { get; set; }
    public List<string>? ComponentNames { get; set; }
}
