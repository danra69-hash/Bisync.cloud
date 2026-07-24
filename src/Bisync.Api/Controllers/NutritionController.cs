using Bisync.Api.Data;
using Bisync.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/nutrition")]
public class NutritionController(
    BisyncDbContext db,
    NutritionLibrarySyncService syncService,
    ProductNutrientEstimateService estimateService) : ControllerBase
{
    [HttpGet("library/status")]
    public async Task<ActionResult<object>> LibraryStatus(CancellationToken cancellationToken)
    {
        await syncService.EnsureReadyAsync(cancellationToken);
        var meta = await syncService.GetStatusAsync(cancellationToken);
        var foodCount = await db.NutritionLibraryFoods.CountAsync(cancellationToken);
        return Ok(new
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
        });
    }

    [HttpPost("library/sync")]
    public async Task<ActionResult<object>> SyncLibrary(
        [FromQuery] bool force = false,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var meta = await syncService.SyncAsync(force, cancellationToken);
            return Ok(new
            {
                version = meta.Version,
                entryCount = meta.EntryCount,
                lastSyncedAt = meta.LastSyncedAt,
                lastSyncStatus = meta.LastSyncStatus,
                changedOnLastSync = meta.ChangedOnLastSync,
                lastSyncError = meta.LastSyncError,
            });
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
}
