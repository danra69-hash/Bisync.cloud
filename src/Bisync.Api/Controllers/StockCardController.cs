using Bisync.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/stock-cards")]
public class StockCardController(StockCardService stockCardService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> List(
        [FromQuery] int? companyId,
        [FromQuery] string? locationIds,
        [FromQuery] string? itemType = "all",
        [FromQuery] string? uomMode = "inventory",
        [FromQuery] string? period = null)
    {
        var locationIdList = ParseLocationIds(locationIds);
        if (locationIdList.Count == 0)
            return Ok(Array.Empty<object>());

        var rows = await stockCardService.ListAsync(companyId, locationIdList, itemType, uomMode ?? "inventory", period);
        return Ok(rows.Select(r => new
        {
            r.ItemType,
            r.ItemKey,
            r.Group,
            r.Name,
            inboundQty = r.InboundQty,
            outboundQty = r.OutboundQty,
            adjustmentQty = r.AdjustmentQty,
            onHandQty = r.OnHandQty,
            averageCogs = r.AverageCogs,
            uom = r.Uom,
            recipeUom = r.RecipeUom,
            inventoryUom = r.InventoryUom,
        }));
    }

    [HttpGet("{itemType}/{itemKey}")]
    public async Task<ActionResult<object>> Detail(
        string itemType,
        string itemKey,
        [FromQuery] int? companyId,
        [FromQuery] string? locationIds,
        [FromQuery] string? uomMode = "inventory",
        [FromQuery] string? period = null)
    {
        var locationIdList = ParseLocationIds(locationIds);
        if (locationIdList.Count == 0)
            return BadRequest(new { message = "Select at least one location." });

        var detail = await stockCardService.GetDetailAsync(
            itemType,
            itemKey,
            companyId,
            locationIdList,
            uomMode ?? "inventory",
            period);

        if (detail is null)
            return NotFound();

        return Ok(new
        {
            detail.ItemType,
            detail.ItemKey,
            detail.Group,
            detail.Name,
            uom = detail.Uom,
            recipeUom = detail.RecipeUom,
            inventoryUom = detail.InventoryUom,
            balanceForward = detail.BalanceForward,
            inboundQty = detail.InboundQty,
            outboundQty = detail.OutboundQty,
            adjustmentQty = detail.AdjustmentQty,
            onHandQty = detail.OnHandQty,
            averageCogs = detail.AverageCogs,
            fifoPolicy = detail.FifoPolicy,
            periodMonth = detail.PeriodMonth,
            periodStart = detail.PeriodStart,
            periodEnd = detail.PeriodEnd,
            archiveCutoff = detail.ArchiveCutoff,
            isCurrentMonth = detail.IsCurrentMonth,
            historyRetentionYears = detail.HistoryRetentionYears,
            entries = detail.Entries.Select(e => new
            {
                e.Id,
                occurredAt = e.OccurredAt,
                entryType = e.EntryType,
                quantity = e.Quantity,
                signedQty = e.SignedQty,
                uom = e.Uom,
                unitPrice = e.UnitPrice,
                reason = e.Reason,
                referenceNumber = e.ReferenceNumber,
                fifoDetail = e.FifoDetail,
                runningBalance = e.RunningBalance,
                averageCogsAfter = e.AverageCogsAfter,
                fifoPolicy = e.FifoPolicy,
            }),
        });
    }

    static List<string> ParseLocationIds(string? locationIds) =>
        string.IsNullOrWhiteSpace(locationIds)
            ? []
            : locationIds
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
}
