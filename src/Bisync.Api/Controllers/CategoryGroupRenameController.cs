using Bisync.Api.Data;
using Bisync.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

/// <summary>
/// Remount RMS Category / Group renames onto products, components, and POS configs.
/// </summary>
[ApiController]
[Route("api/companies/{companyId:int}/category-groups")]
public class CategoryGroupRenameController(BisyncDbContext db) : ControllerBase
{
    public sealed class RenameCategoryGroupRequest
    {
        /// <summary>category | group</summary>
        public string Kind { get; set; } = "group";
        public string From { get; set; } = string.Empty;
        public string To { get; set; } = string.Empty;
    }

    /// <summary>
    /// Remap a renamed RMS category or group across ingredients, products, and POS.
    /// Hierarchy / catalog JSON are remounted in the same transaction.
    /// </summary>
    [HttpPost("rename")]
    public async Task<ActionResult<object>> Rename(
        int companyId,
        [FromBody] RenameCategoryGroupRequest request,
        CancellationToken cancellationToken)
    {
        if (companyId <= 0)
            return BadRequest(new { message = "Company is required." });

        var exists = await db.Companies.AsNoTracking().AnyAsync(c => c.Id == companyId, cancellationToken);
        if (!exists)
            return NotFound(new { message = "Company not found." });

        var kind = (request.Kind ?? string.Empty).Trim();
        var from = (request.From ?? string.Empty).Trim();
        var to = (request.To ?? string.Empty).Trim();
        if (from.Length == 0 || to.Length == 0)
            return BadRequest(new { message = "Both from and to names are required." });
        if (string.Equals(from, to, StringComparison.Ordinal))
            return BadRequest(new { message = "New name must differ from the current name." });

        try
        {
            var counts = await CategoryGroupRenameService.RemapAsync(
                db, companyId, kind, from, to, cancellationToken);
            return Ok(new
            {
                companyId,
                kind,
                from,
                to,
                total = counts.Total,
                counts = new
                {
                    ingredients = counts.Ingredients,
                    products = counts.Products,
                    modifierAttachments = counts.ModifierAttachments,
                    deviceSetupRules = counts.DeviceSetupRules,
                    promotions = counts.Promotions,
                    taxServiceConfigs = counts.TaxServiceConfigs,
                    hierarchyConfigs = counts.HierarchyConfigs,
                    catalogConfigs = counts.CatalogConfigs,
                    sampleRequests = counts.SampleRequests,
                },
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
