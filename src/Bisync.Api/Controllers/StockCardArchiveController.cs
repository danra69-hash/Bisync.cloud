using Bisync.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/stock-card-archive")]
public class StockCardArchiveController(
    StockCardArchiveService archiveService,
    IConfiguration configuration,
    IHostEnvironment environment) : ControllerBase
{
    [HttpGet("status")]
    public async Task<ActionResult<object>> Status(CancellationToken cancellationToken)
    {
        var directory = StockCardArchivePaths.ResolveArchiveDirectory(configuration, environment);
        var databasePath = StockCardArchivePaths.ResolveArchiveDatabasePath(configuration, environment);
        var cutoff = archiveService.ResolveArchiveCutoffUtc();

        return Ok(new
        {
            archiveDirectory = directory,
            archiveDatabase = databasePath,
            archiveDatabaseExists = System.IO.File.Exists(databasePath),
            retentionYears = archiveService.RetentionYears,
            archiveCutoff = cutoff,
            runs = await archiveService.GetRecentRunsAsync(10, cancellationToken),
        });
    }

    [HttpPost("run")]
    public async Task<ActionResult<object>> Run(CancellationToken cancellationToken)
    {
        var result = await archiveService.ArchiveExpiredRecordsAsync(cancellationToken);
        return Ok(new
        {
            result.RanAt,
            result.ArchiveCutoff,
            result.MovementsArchived,
            result.PurchasesArchived,
            result.ProductionLogsArchived,
            result.ConsolidationMovementsCreated,
            result.Notes,
        });
    }
}
