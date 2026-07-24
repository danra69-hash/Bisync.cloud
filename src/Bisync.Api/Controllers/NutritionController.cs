using Bisync.Api.Data;
using Bisync.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/nutrition")]
public class NutritionController(
    BisyncDbContext db,
    NutritionLibrarySyncService syncService,
    ProductNutrientEstimateService estimateService,
    IOptions<NutritionLibraryOptions> options) : ControllerBase
{
    const string PortalUrl = "https://fdc.nal.usda.gov/";

    [HttpGet("library/status")]
    public async Task<ActionResult<object>> LibraryStatus(CancellationToken cancellationToken)
    {
        await syncService.EnsureReadyAsync(cancellationToken);
        var meta = await syncService.GetStatusAsync(cancellationToken);
        var foodCount = await db.NutritionLibraryFoods.CountAsync(cancellationToken);
        var opts = options.Value;
        return Ok(MapStatus(meta, foodCount, opts));
    }

    [HttpPost("library/sync")]
    public async Task<ActionResult<object>> SyncLibrary(
        [FromQuery] bool force = false,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var meta = await syncService.SyncAsync(force, cancellationToken);
            var foodCount = await db.NutritionLibraryFoods.CountAsync(cancellationToken);
            return Ok(MapStatus(meta, foodCount, options.Value));
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("products/{productId:int}")]
    public async Task<ActionResult<object>> ProductNutrients(
        int productId,
        [FromQuery] bool force = false,
        CancellationToken cancellationToken = default)
    {
        await syncService.EnsureReadyAsync(cancellationToken);
        var estimate = await estimateService.GetOrCalculateAsync(productId, force, cancellationToken);
        if (estimate is null) return NotFound(new { message = "Product not found." });
        var meta = await syncService.GetStatusAsync(cancellationToken);
        return Ok(ProductNutrientEstimateService.MapEstimate(estimate, meta));
    }

    static object MapStatus(Models.NutritionLibraryMeta meta, int foodCount, NutritionLibraryOptions opts) => new
    {
        version = meta.Version,
        sourceLabel = meta.SourceLabel,
        citation = meta.Citation,
        basis = meta.Basis,
        entryCount = Math.Max(meta.EntryCount, foodCount),
        lastSyncedAt = meta.LastSyncedAt,
        lastCheckedAt = meta.LastCheckedAt,
        lastSyncStatus = meta.LastSyncStatus,
        lastSyncError = meta.LastSyncError,
        changedOnLastSync = meta.ChangedOnLastSync,
        portalUrl = PortalUrl,
        foundationZipUrl = opts.FoundationZipUrl,
        srLegacyZipUrl = opts.SrLegacyZipUrl,
        checkIntervalHours = opts.CheckIntervalHours,
    };
}
