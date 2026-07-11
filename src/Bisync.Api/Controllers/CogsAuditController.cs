using Bisync.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Bisync.Api.Controllers;

/// <summary>
/// System Configuration · COGS Audit — period FIFO summary and dated ledgers.
/// Debit = stock in (+), Credit = stock out (−), Shortage = ME Debit(+) + ME Credit(−).
/// </summary>
[ApiController]
[Route("api/cogs-audit")]
public class CogsAuditController(
    CogsAuditService cogsAudit,
    IndependentCogsAuditService independentAudit,
    SystemCogsAuditHistoryStore systemHistory) : ControllerBase
{
    [HttpGet("summary")]
    public async Task<ActionResult<CogsAuditSummaryResult>> Summary(
        [FromQuery] int? companyId,
        [FromQuery] string? locationIds,
        [FromQuery] string? period = null,
        [FromQuery] string? uomMode = "inventory",
        [FromQuery] string? itemType = "component")
    {
        var locations = ParseLocationIds(locationIds);
        if (locations.Count == 0)
            return BadRequest(new { message = "Select at least one location." });

        var result = await cogsAudit.GetSummaryAsync(
            companyId,
            locations,
            period,
            uomMode ?? "inventory",
            itemType ?? "component");
        return Ok(result);
    }

    [HttpGet("detail/{itemType}/{itemKey}")]
    public async Task<ActionResult<CogsAuditDetailResult>> Detail(
        string itemType,
        string itemKey,
        [FromQuery] int? companyId,
        [FromQuery] string? locationIds,
        [FromQuery] string? period = null,
        [FromQuery] string? uomMode = "inventory")
    {
        var locations = ParseLocationIds(locationIds);
        if (locations.Count == 0)
            return BadRequest(new { message = "Select at least one location." });

        var detail = await cogsAudit.GetDetailAsync(
            itemType,
            itemKey,
            companyId,
            locations,
            period,
            uomMode ?? "inventory");

        if (detail is null)
            return NotFound(new { message = "Ingredient not found for the selected filters." });

        return Ok(detail);
    }

    [HttpGet("periods")]
    public async Task<ActionResult<IEnumerable<string>>> Periods([FromQuery] int? companyId)
    {
        var periods = await cogsAudit.ListAvailablePeriodsAsync(companyId);
        return Ok(periods);
    }

    /// <summary>
    /// Independent Audit — requires a CSV upload (ingredient stock ledger export).
    /// Filters to the selected month (yyyy-MM) and builds FIFO Debit(+)/Credit(−) summary.
    /// </summary>
    [HttpPost("independent")]
    [RequestSizeLimit(512L * 1024 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = 512L * 1024 * 1024)]
    public async Task<ActionResult<IndependentAuditUploadResult>> IndependentAudit(
        [FromForm] IFormFile? file,
        [FromForm] string? period,
        CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { message = "CSV file is required for Independent Audit." });

        var name = file.FileName ?? "";
        if (!name.EndsWith(".csv", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(file.ContentType, "text/csv", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(file.ContentType, "application/vnd.ms-excel", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "Upload a .csv file." });
        }

        if (string.IsNullOrWhiteSpace(period))
            return BadRequest(new { message = "Month (period yyyy-MM) is required." });

        try
        {
            await using var stream = file.OpenReadStream();
            var result = await independentAudit.RunFromCsvAsync(stream, name, period.Trim(), cancellationToken);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("independent/history")]
    public ActionResult<IEnumerable<IndependentAuditHistoryEntry>> IndependentHistory([FromQuery] int take = 50)
    {
        return Ok(independentAudit.ListHistory(take));
    }

    [HttpGet("system/history")]
    public ActionResult<IEnumerable<SystemCogsAuditHistoryEntry>> SystemHistory([FromQuery] int take = 100)
    {
        return Ok(systemHistory.List(take));
    }

    [HttpGet("system/history/{runId}")]
    public ActionResult<SystemCogsAuditHistoryFile> SystemHistoryDetail(string runId)
    {
        var file = systemHistory.Load(runId);
        if (file is null)
            return NotFound(new { message = "System COGS audit history run not found." });
        return Ok(file);
    }

    [HttpPost("independent/history/{sessionId}/open")]
    public ActionResult<IndependentAuditUploadResult> OpenIndependentHistory(string sessionId)
    {
        var session = independentAudit.OpenHistory(sessionId);
        if (session is null)
            return NotFound(new { message = "History run not found." });
        return Ok(session);
    }

    [HttpDelete("independent/history/{sessionId}")]
    public ActionResult DeleteIndependentHistory(string sessionId)
    {
        if (!independentAudit.DeleteHistory(sessionId))
            return NotFound(new { message = "History run not found." });
        return NoContent();
    }

    [HttpGet("independent/{sessionId}")]
    public ActionResult<IndependentAuditUploadResult> IndependentSession(string sessionId)
    {
        var session = independentAudit.GetSession(sessionId);
        if (session is null)
            return NotFound(new { message = "Independent audit session expired or not found. Upload the CSV again or open it from History." });
        return Ok(session);
    }

    [HttpGet("independent/{sessionId}/detail/{ingredientId}")]
    public ActionResult<CogsAuditDetailResult> IndependentDetail(string sessionId, string ingredientId)
    {
        var detail = independentAudit.GetDetail(sessionId, ingredientId);
        if (detail is null)
            return NotFound(new { message = "Ingredient not found in this independent audit session." });
        return Ok(detail);
    }

    static List<string> ParseLocationIds(string? locationIds) =>
        string.IsNullOrWhiteSpace(locationIds)
            ? []
            : locationIds
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
}
