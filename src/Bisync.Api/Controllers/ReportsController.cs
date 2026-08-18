using Bisync.Api.Services;
using Bisync.Api.Tenancy;
using Microsoft.AspNetCore.Mvc;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/reports")]
public class ReportsController(ReportsService reports, ITenantContext tenant) : ControllerBase
{
    [HttpGet("itemized-sales-summary")]
    public Task<ActionResult<ReportPayload>> ItemizedSalesSummary(
        [FromQuery] int? companyId,
        [FromQuery] string? locationIds,
        [FromQuery] string? month,
        CancellationToken cancellationToken = default)
        => Run(companyId, locationIds, month, (cid, locs, period, ct) =>
            reports.ItemizedSalesSummaryAsync(cid, locs, period, ct), cancellationToken);

    [HttpGet("inventory-summary")]
    public async Task<ActionResult<ReportPayload>> InventorySummary(
        [FromQuery] int? companyId,
        [FromQuery] string? locationIds,
        [FromQuery] string? period,
        [FromQuery] string itemType = "component",
        CancellationToken cancellationToken = default)
    {
        var cid = TenantQuery.ResolveCompanyId(tenant, companyId);
        var locs = ParseLocationIds(locationIds);
        if (locs.Count == 0 || string.IsNullOrWhiteSpace(period))
            return Ok(new ReportPayload("Inventory Summary", period ?? "", new(), []));

        var payload = await reports.InventorySummaryAsync(cid, locs, period.Trim(), itemType, cancellationToken);
        return Ok(payload);
    }

    [HttpGet("detailed-purchase-summary")]
    public Task<ActionResult<ReportPayload>> DetailedPurchaseSummary(
        [FromQuery] int? companyId,
        [FromQuery] string? locationIds,
        [FromQuery] string? month,
        CancellationToken cancellationToken = default)
        => Run(companyId, locationIds, month, (cid, locs, period, ct) =>
            reports.DetailedPurchaseSummaryAsync(cid, locs, period, ct), cancellationToken);

    [HttpGet("production")]
    public Task<ActionResult<ReportPayload>> Production(
        [FromQuery] int? companyId,
        [FromQuery] string? locationIds,
        [FromQuery] string? month,
        CancellationToken cancellationToken = default)
        => Run(companyId, locationIds, month, (cid, locs, period, ct) =>
            reports.ProductionReportAsync(cid, locs, period, ct), cancellationToken);

    [HttpGet("wastage")]
    public Task<ActionResult<ReportPayload>> Wastage(
        [FromQuery] int? companyId,
        [FromQuery] string? locationIds,
        [FromQuery] string? month,
        CancellationToken cancellationToken = default)
        => Run(companyId, locationIds, month, (cid, locs, period, ct) =>
            reports.WastageReportAsync(cid, locs, period, ct), cancellationToken);

    [HttpGet("ops-expenses-analysis")]
    public async Task<ActionResult<ReportPayload>> OpsExpensesAnalysis(
        [FromQuery] int? companyId,
        [FromQuery] string? locationIds,
        [FromQuery] string? period,
        [FromQuery] string? categories = null,
        [FromQuery] string? groups = null,
        CancellationToken cancellationToken = default)
    {
        var cid = TenantQuery.ResolveCompanyId(tenant, companyId);
        var locs = ParseLocationIds(locationIds);
        if (locs.Count == 0 || string.IsNullOrWhiteSpace(period))
            return Ok(new ReportPayload("Ops Expenses Analysis", period ?? "", new(), []));

        var payload = await reports.OpsExpensesAnalysisAsync(
            cid,
            locs,
            period.Trim(),
            categories,
            groups,
            cancellationToken);
        return Ok(payload);
    }

    [HttpGet("bcg-matrix")]
    public Task<ActionResult<ReportPayload>> BcgMatrix(
        [FromQuery] int? companyId,
        [FromQuery] string? locationIds,
        [FromQuery] string? month,
        CancellationToken cancellationToken = default)
        => Run(companyId, locationIds, month, (cid, locs, period, ct) =>
            reports.BcgMatrixAsync(cid, locs, period, ct), cancellationToken);

    async Task<ActionResult<ReportPayload>> Run(
        int? companyId,
        string? locationIds,
        string? month,
        Func<int?, IReadOnlyList<string>, string, CancellationToken, Task<ReportPayload>> action,
        CancellationToken cancellationToken)
    {
        var cid = TenantQuery.ResolveCompanyId(tenant, companyId);
        var locs = ParseLocationIds(locationIds);
        if (locs.Count == 0 || string.IsNullOrWhiteSpace(month))
            return Ok(new ReportPayload("Report", month ?? "", new(), []));

        var payload = await action(cid, locs, month.Trim(), cancellationToken);
        return Ok(payload);
    }

    static List<string> ParseLocationIds(string? locationIds) =>
        string.IsNullOrWhiteSpace(locationIds)
            ? []
            : locationIds
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
}
