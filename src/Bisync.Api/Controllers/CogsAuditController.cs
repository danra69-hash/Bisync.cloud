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

    static List<string> ParseLocationIds(string? locationIds) =>
        string.IsNullOrWhiteSpace(locationIds)
            ? []
            : locationIds
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
}
