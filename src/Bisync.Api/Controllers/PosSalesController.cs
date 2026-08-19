using System.Globalization;
using System.Text.Json;
using Bisync.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/pos-sales")]
public class PosSalesController(PosSalesImportService importService) : ControllerBase
{
    [HttpGet("fields")]
    public ActionResult<object> Fields() => Ok(PosSalesImportService.SystemFields);

    [HttpGet("header-map")]
    public async Task<ActionResult<PosSalesHeaderMapDto?>> GetHeaderMap(
        [FromQuery] int companyId,
        [FromQuery] string? fingerprint = null,
        CancellationToken ct = default)
    {
        if (companyId <= 0) return BadRequest(new { message = "companyId is required." });
        var map = await importService.GetHeaderMapAsync(companyId, fingerprint, ct);
        return Ok(map);
    }

    [HttpPut("header-map")]
    public async Task<ActionResult<PosSalesHeaderMapDto>> SaveHeaderMap(
        [FromBody] SavePosSalesHeaderMapRequest request,
        CancellationToken ct = default)
    {
        if (request.CompanyId <= 0)
            return BadRequest(new { message = "companyId is required." });
        if (string.IsNullOrWhiteSpace(request.HeaderFingerprint))
            return BadRequest(new { message = "headerFingerprint is required." });
        if (request.Mapping is null || request.Mapping.Count == 0)
            return BadRequest(new { message = "mapping is required." });

        try
        {
            var saved = await importService.SaveHeaderMapAsync(
                request.CompanyId,
                request.HeaderFingerprint.Trim(),
                request.Mapping,
                request.UpdatedBy ?? string.Empty,
                ct);
            return Ok(saved);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("preview")]
    [RequestSizeLimit(30_000_000)]
    public async Task<ActionResult<PosSalesPreviewResult>> Preview(
        IFormFile file,
        [FromForm] int companyId,
        CancellationToken ct = default)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { message = "Upload a PDF, CSV, or Excel (.xlsx) detailed sales file." });
        if (companyId <= 0)
            return BadRequest(new { message = "companyId is required." });

        try
        {
            await using var stream = file.OpenReadStream();
            var preview = await importService.PreviewAsync(stream, file.FileName, companyId, ct);
            return Ok(preview);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("import")]
    [RequestSizeLimit(30_000_000)]
    public async Task<ActionResult<PosSalesImportResult>> Import(
        IFormFile file,
        [FromForm] int companyId,
        [FromForm] string locationExternalId,
        [FromForm] string? businessDate = null,
        [FromForm] string? mappingJson = null,
        [FromForm] string? createdBy = null,
        CancellationToken ct = default)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { message = "Upload a PDF, CSV, or Excel (.xlsx) detailed sales file." });
        if (companyId <= 0)
            return BadRequest(new { message = "companyId is required." });
        if (string.IsNullOrWhiteSpace(locationExternalId))
            return BadRequest(new { message = "locationExternalId is required." });

        DateOnly? dateOverride = null;
        if (!string.IsNullOrWhiteSpace(businessDate))
        {
            if (!DateOnly.TryParse(businessDate, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed))
                return BadRequest(new { message = "businessDate must be yyyy-MM-dd." });
            dateOverride = parsed;
        }

        Dictionary<string, string>? mapping = null;
        if (!string.IsNullOrWhiteSpace(mappingJson))
        {
            try
            {
                mapping = JsonSerializer.Deserialize<Dictionary<string, string>>(mappingJson);
            }
            catch
            {
                return BadRequest(new { message = "mappingJson must be a JSON object of header → field." });
            }
        }

        try
        {
            await using var stream = file.OpenReadStream();
            var result = await importService.ImportAsync(
                stream,
                file.FileName,
                companyId,
                locationExternalId.Trim(),
                dateOverride,
                mapping,
                createdBy ?? string.Empty,
                ct);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet]
    public async Task<ActionResult<PosSalesListResult>> List(
        [FromQuery] int companyId,
        [FromQuery] string? locationIds = null,
        [FromQuery] string? from = null,
        [FromQuery] string? to = null,
        CancellationToken ct = default)
    {
        if (companyId <= 0)
            return BadRequest(new { message = "companyId is required." });

        var locs = string.IsNullOrWhiteSpace(locationIds)
            ? []
            : locationIds.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

        DateOnly? fromDate = null;
        DateOnly? toDate = null;
        if (!string.IsNullOrWhiteSpace(from)
            && DateOnly.TryParse(from, CultureInfo.InvariantCulture, DateTimeStyles.None, out var f))
            fromDate = f;
        if (!string.IsNullOrWhiteSpace(to)
            && DateOnly.TryParse(to, CultureInfo.InvariantCulture, DateTimeStyles.None, out var t))
            toDate = t;

        var result = await importService.ListAsync(companyId, locs, fromDate, toDate, ct);
        return Ok(result);
    }
}

public sealed class SavePosSalesHeaderMapRequest
{
    public int CompanyId { get; set; }
    public string HeaderFingerprint { get; set; } = string.Empty;
    public Dictionary<string, string> Mapping { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public string? UpdatedBy { get; set; }
}
