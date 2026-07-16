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
            onHandAverageCogs = r.OnHandAverageCogs,
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
            onHandAverageCogs = detail.OnHandAverageCogs,
            onHandLayers = detail.OnHandLayers.Select(l => new
            {
                quantity = l.Quantity,
                unitPrice = l.UnitPrice,
            }),
            fifoPolicy = detail.FifoPolicy,
            periodMonth = detail.PeriodMonth,
            periodStart = detail.PeriodStart,
            periodEnd = detail.PeriodEnd,
            archiveCutoff = detail.ArchiveCutoff,
            isCurrentMonth = detail.IsCurrentMonth,
            historyRetentionYears = detail.HistoryRetentionYears,
            hasNegativeStock = detail.HasNegativeStock,
            inventoryCarryForwardDate = detail.InventoryCarryForwardDate,
            entries = detail.Entries.Select(e => new
            {
                e.Id,
                occurredAt = e.OccurredAt,
                entryType = e.EntryType,
                quantity = e.Quantity,
                signedQty = e.SignedQty,
                uom = e.Uom,
                unitPrice = e.UnitPrice,
                subtotal = e.Subtotal,
                reason = e.Reason,
                referenceNumber = e.ReferenceNumber,
                fifoDetail = e.FifoDetail,
                runningBalance = e.RunningBalance,
                averageCogsAfter = e.AverageCogsAfter,
                fifoPolicy = e.FifoPolicy,
                splitIndex = e.SplitIndex,
                isShortage = e.IsShortage,
                isCogsBackfilled = e.IsCogsBackfilled,
                isNegativeBalance = e.IsNegativeBalance,
            }),
        });
    }

    [HttpGet("{itemType}/{itemKey}/as-of")]
    public async Task<ActionResult<object>> AsOf(
        string itemType,
        string itemKey,
        [FromQuery] int? companyId,
        [FromQuery] string? locationIds,
        [FromQuery] string locationExternalId,
        [FromQuery] string? uomMode = "inventory",
        [FromQuery] string? asOfDate = null)
    {
        var locationIdList = ParseLocationIds(locationIds);
        if (locationIdList.Count == 0)
            return BadRequest(new { message = "Select at least one location." });
        if (string.IsNullOrWhiteSpace(locationExternalId))
            return BadRequest(new { message = "Location is required." });
        if (!DateOnly.TryParse(asOfDate, out var parsedDate))
            return BadRequest(new { message = "Valid asOfDate (yyyy-MM-dd) is required." });

        var snapshot = await stockCardService.GetAsOfSnapshotAsync(
            itemType,
            itemKey,
            companyId,
            locationExternalId,
            locationIdList,
            uomMode ?? "inventory",
            parsedDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc));

        if (snapshot is null)
            return NotFound();

        return Ok(new
        {
            asOfDate = snapshot.AsOfDate.ToString("yyyy-MM-dd"),
            locationExternalId = snapshot.LocationExternalId,
            uom = snapshot.Uom,
            onHandQty = snapshot.OnHandQty,
            layers = snapshot.Layers.Select(l => new
            {
                quantity = l.Quantity,
                unitPrice = l.UnitPrice,
            }),
            suggestedAdjustmentInUnitPrice = snapshot.SuggestedAdjustmentInUnitPrice,
        });
    }

    [HttpPost("{itemType}/{itemKey}/adjustments")]
    public async Task<ActionResult<object>> CreateAdjustment(
        string itemType,
        string itemKey,
        [FromBody] CreateStockAdjustmentBody body)
    {
        if (body is null)
            return BadRequest(new { message = "Request body is required." });

        var locationIdList = ParseLocationIds(body.LocationIds);
        if (locationIdList.Count == 0)
            return BadRequest(new { message = "Select at least one location." });
        if (string.IsNullOrWhiteSpace(body.LocationExternalId))
            return BadRequest(new { message = "Location is required." });
        if (!DateOnly.TryParse(body.AdjustmentDate, out var adjustmentDate))
            return BadRequest(new { message = "Valid adjustmentDate (yyyy-MM-dd) is required." });

        var result = await stockCardService.CreateAdjustmentAsync(
            itemType,
            itemKey,
            body.CompanyId,
            body.LocationExternalId,
            locationIdList,
            body.UomMode ?? "inventory",
            adjustmentDate,
            body.Quantity,
            body.Direction,
            body.Reason ?? string.Empty,
            body.InboundUom,
            body.InboundUnitPrice);

        if (!result.Success)
            return BadRequest(new { message = result.Message });

        return Ok(new { success = true });
    }

    public sealed class CreateStockAdjustmentBody
    {
        public int? CompanyId { get; set; }
        public string? LocationIds { get; set; }
        public string LocationExternalId { get; set; } = string.Empty;
        public string? UomMode { get; set; }
        public string AdjustmentDate { get; set; } = string.Empty;
        public decimal Quantity { get; set; }
        public string Direction { get; set; } = "in";
        public string? Reason { get; set; }
        public string? InboundUom { get; set; }
        public decimal? InboundUnitPrice { get; set; }
    }

    static List<string> ParseLocationIds(string? locationIds) =>
        string.IsNullOrWhiteSpace(locationIds)
            ? []
            : locationIds
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
}
