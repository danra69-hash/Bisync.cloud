using Bisync.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/sales-data")]
public class SalesDataController(SalesDataService salesDataService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<SalesDataResult>> List(
        [FromQuery] int? companyId,
        [FromQuery] string? locationIds,
        [FromQuery] string? month,
        [FromQuery] string viewBy = "product",
        CancellationToken cancellationToken = default)
    {
        var locationIdList = ParseLocationIds(locationIds);
        if (locationIdList.Count == 0 || string.IsNullOrWhiteSpace(month))
            return Ok(new SalesDataResult());

        var result = await salesDataService.GetAsync(
            companyId,
            locationIdList,
            month.Trim(),
            viewBy,
            cancellationToken);

        return Ok(result);
    }

    static List<string> ParseLocationIds(string? locationIds) =>
        string.IsNullOrWhiteSpace(locationIds)
            ? []
            : locationIds
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
}
