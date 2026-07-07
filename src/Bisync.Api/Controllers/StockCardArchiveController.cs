using Bisync.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/stock-card-archive")]
public class StockCardArchiveController(
    StockCardArchiveService archiveService,
    IConfiguration configuration) : ControllerBase
{
    [HttpGet("status")]
    public async Task<ActionResult<object>> Status(CancellationToken cancellationToken)
    {
        var archiveConnection = configuration.GetConnectionString("ArchiveConnection");
        var cutoff = archiveService.ResolveArchiveCutoffUtc();

        return Ok(new
        {
            archiveConnection,
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
