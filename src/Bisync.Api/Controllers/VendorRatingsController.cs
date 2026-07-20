using Bisync.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/vendor-ratings")]
public class VendorRatingsController(VendorRatingService ratings) : ControllerBase
{
    public class UpsertOfflineRatingRequest
    {
        public string Delivery { get; set; } = string.Empty;
        public string ProductAccuracy { get; set; } = string.Empty;
        public string ProductQuality { get; set; } = string.Empty;
        public string HygieneCleanliness { get; set; } = string.Empty;
        public string Notes { get; set; } = string.Empty;
        public string UpdatedBy { get; set; } = string.Empty;
        public int? CompanyId { get; set; }
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<VendorRatingSummaryDto>>> Summaries(CancellationToken ct)
    {
        return Ok(await ratings.GetSummariesAsync(ct));
    }

    [HttpGet("{vendorExternalId}")]
    public async Task<ActionResult<VendorRatingDetailDto>> Detail(string vendorExternalId, CancellationToken ct)
    {
        var detail = await ratings.GetDetailAsync(vendorExternalId, ct);
        if (detail is null) return NotFound();
        return Ok(detail);
    }

    [HttpPut("{vendorExternalId}")]
    public async Task<ActionResult<VendorRatingDetailDto>> UpsertOffline(
        string vendorExternalId,
        [FromBody] UpsertOfflineRatingRequest body,
        CancellationToken ct)
    {
        try
        {
            var detail = await ratings.UpsertOfflineAsync(
                vendorExternalId,
                body.Delivery,
                body.ProductAccuracy,
                body.ProductQuality,
                body.HygieneCleanliness,
                body.Notes,
                body.UpdatedBy,
                body.CompanyId,
                ct);
            if (detail is null) return NotFound();
            return Ok(detail);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
