using Bisync.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/inventory-counts")]
public class InventoryCountSessionsController(InventoryCountService inventoryCountService) : ControllerBase
{
    [HttpGet("active")]
    public async Task<ActionResult<object>> GetActive(
        [FromQuery] string sessionType,
        [FromQuery] int? companyId,
        [FromQuery] string? locationIds,
        [FromQuery] string? period,
        [FromQuery] string? uomMode = "inventory")
    {
        var locationIdList = ParseLocationIds(locationIds);
        if (locationIdList.Count == 0)
            return Ok(null);

        var session = await inventoryCountService.GetActiveSessionAsync(
            sessionType,
            companyId,
            locationIdList,
            period ?? string.Empty,
            uomMode ?? "inventory");

        if (session is null)
            return new JsonResult((object?)null);

        return Ok(MapSession(session));
    }

    [HttpGet("history")]
    public async Task<ActionResult<IEnumerable<object>>> ListHistory(
        [FromQuery] string? sessionType,
        [FromQuery] int? companyId,
        [FromQuery] string? locationIds)
    {
        var locationIdList = ParseLocationIds(locationIds);
        if (locationIdList.Count == 0)
            return Ok(Array.Empty<object>());

        var sessions = await inventoryCountService.ListHistoryAsync(sessionType, companyId, locationIdList);
        return Ok(sessions.Select(MapSummary));
    }

    [HttpGet("{sessionId:int}")]
    public async Task<ActionResult<object>> GetSession(
        int sessionId,
        [FromQuery] int? companyId,
        [FromQuery] string? locationIds)
    {
        var locationIdList = ParseLocationIds(locationIds);
        if (locationIdList.Count == 0)
            return BadRequest(new { message = "Select at least one location." });

        var session = await inventoryCountService.GetSessionAsync(sessionId, companyId, locationIdList);
        if (session is null)
            return NotFound();

        return Ok(MapSession(session));
    }

    [HttpPost("save")]
    public async Task<ActionResult<object>> Save([FromBody] SaveInventoryCountBody body)
    {
        var locationIdList = ParseLocationIds(body.LocationIds);
        var result = await inventoryCountService.SaveAsync(
            body.SessionType ?? InventoryCountWorkflow.TypeSpot,
            body.CompanyId,
            locationIdList,
            body.PeriodMonth ?? string.Empty,
            body.UomMode ?? "inventory",
            body.ItemTypeFilter ?? "all",
            body.GroupFilter ?? "All",
            body.CountDate ?? string.Empty,
            body.SavedBy ?? string.Empty,
            body.Lines ?? []);

        if (!result.Success)
            return BadRequest(new { message = result.Message });

        return Ok(new { success = true, session = MapSession(result.Session!) });
    }

    [HttpPost("{sessionId:int}/confirm")]
    public async Task<ActionResult<object>> Confirm(int sessionId, [FromBody] ConfirmInventoryCountBody body)
    {
        var result = await inventoryCountService.ConfirmAsync(
            sessionId,
            body.ConfirmedBy ?? string.Empty,
            body.EffectiveDate);
        if (!result.Success)
            return BadRequest(new { message = result.Message });

        return Ok(new { success = true, session = MapSession(result.Session!) });
    }

    static object MapSession(InventoryCountSessionDto session) => new
    {
        session.Id,
        sessionType = session.SessionType,
        status = session.Status,
        periodMonth = session.PeriodMonth,
        uomMode = session.UomMode,
        itemTypeFilter = session.ItemTypeFilter,
        groupFilter = session.GroupFilter,
        countDate = session.CountDate,
        effectiveDate = session.EffectiveDate,
        adjustmentsAppliedAt = session.AdjustmentsAppliedAt,
        savedAt = session.SavedAt,
        savedBy = session.SavedBy,
        confirmDeadlineAt = session.ConfirmDeadlineAt,
        confirmedAt = session.ConfirmedAt,
        confirmedBy = session.ConfirmedBy,
        isAutoConfirmed = session.IsAutoConfirmed,
        canSave = session.CanSave,
        canConfirm = session.CanConfirm,
        isReadOnly = session.IsReadOnly,
        lines = session.Lines.Select(l => new
        {
            itemType = l.ItemType,
            itemKey = l.ItemKey,
            itemName = l.ItemName,
            groupName = l.GroupName,
            uom = l.Uom,
            systemQty = l.SystemQty,
            countedQty = l.CountedQty,
            varianceQty = l.VarianceQty,
            variancePct = l.VariancePct,
        }),
    };

    static object MapSummary(InventoryCountSessionSummaryDto session) => new
    {
        session.Id,
        sessionType = session.SessionType,
        status = session.Status,
        periodMonth = session.PeriodMonth,
        uomMode = session.UomMode,
        itemTypeFilter = session.ItemTypeFilter,
        groupFilter = session.GroupFilter,
        countDate = session.CountDate,
        effectiveDate = session.EffectiveDate,
        savedAt = session.SavedAt,
        savedBy = session.SavedBy,
        confirmDeadlineAt = session.ConfirmDeadlineAt,
        confirmedAt = session.ConfirmedAt,
        confirmedBy = session.ConfirmedBy,
        isAutoConfirmed = session.IsAutoConfirmed,
        canConfirm = session.CanConfirm,
        lineCount = session.LineCount,
        totalVarianceQty = session.TotalVarianceQty,
        variancePct = session.VariancePct,
    };

    static List<string> ParseLocationIds(string? locationIds) =>
        string.IsNullOrWhiteSpace(locationIds)
            ? []
            : locationIds.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();

    public sealed class SaveInventoryCountBody
    {
        public string? SessionType { get; set; }
        public int? CompanyId { get; set; }
        public string? LocationIds { get; set; }
        public string? PeriodMonth { get; set; }
        public string? UomMode { get; set; }
        public string? ItemTypeFilter { get; set; }
        public string? GroupFilter { get; set; }
        public string? CountDate { get; set; }
        public string? SavedBy { get; set; }
        public List<InventoryCountSaveLineRequest>? Lines { get; set; }
    }

    public sealed class ConfirmInventoryCountBody
    {
        public string? ConfirmedBy { get; set; }
        public string? EffectiveDate { get; set; }
    }
}
