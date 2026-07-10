using System.Text.Json;
using Bisync.Api.Contracts;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/sample-requests")]
public class SampleRequestsController(BisyncDbContext db) : ControllerBase
{
    static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> List([FromQuery] int? companyId = null)
    {
        var query = db.SampleRequests.AsNoTracking().AsQueryable();
        if (companyId is int cid)
            query = query.Where(s => s.CompanyId == cid);

        var rows = await query
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync();

        return Ok(rows.Select(MapSummary));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<object>> Get(int id)
    {
        var row = await db.SampleRequests.AsNoTracking().FirstOrDefaultAsync(s => s.Id == id);
        if (row is null) return NotFound(new { message = "Sample request not found." });
        return Ok(MapDetail(row));
    }

    [HttpPost]
    public async Task<ActionResult<object>> Create([FromBody] CreateSampleRequestDto request)
    {
        if (request.CompanyId <= 0)
            return BadRequest(new { message = "Company is required." });
        if (string.IsNullOrWhiteSpace(request.ContactPersonName))
            return BadRequest(new { message = "Contact person is required." });
        if (string.IsNullOrWhiteSpace(request.CustomerName))
            return BadRequest(new { message = "Customer name is required." });
        if (string.IsNullOrWhiteSpace(request.ProjectName))
            return BadRequest(new { message = "Project name is required." });
        if (request.ProductSamples.Count == 0 || request.ProductSamples.All(s => string.IsNullOrWhiteSpace(s.Name)))
            return BadRequest(new { message = "Add at least one product sample name." });
        if (request.RequestType == "modification" && string.IsNullOrWhiteSpace(request.ModificationDetails))
            return BadRequest(new { message = "Describe the modification required." });
        if (request.AllergenStatus == "free_from" && string.IsNullOrWhiteSpace(request.AllergenFreeFromDetail))
            return BadRequest(new { message = "Specify allergen-free details." });
        if (request.RegulatoryRequirement == "yes" && string.IsNullOrWhiteSpace(request.RegulatoryRequirementDetail))
            return BadRequest(new { message = "Specify regulatory requirement details." });

        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == request.CompanyId);
        if (company is null)
            return BadRequest(new { message = "Company not found." });

        var now = DateTime.UtcNow;
        var expectedSales = request.ExpectedQtyPerYear * request.ExpectedPrice;
        var samples = request.ProductSamples
            .Where(s => !string.IsNullOrWhiteSpace(s.Name))
            .Select(s => new SampleRequestProductSampleDto
            {
                Name = s.Name.Trim(),
                Description = s.Description?.Trim() ?? string.Empty,
            })
            .ToList();

        var row = new SampleRequest
        {
            RequestNumber = await NextRequestNumberAsync(request.DateRequested),
            CompanyId = request.CompanyId,
            DateRequested = request.DateRequested,
            ContactEmployeeId = request.ContactEmployeeId,
            ContactPersonName = request.ContactPersonName.Trim(),
            CompanyRequested = string.IsNullOrWhiteSpace(request.CompanyRequested)
                ? company.Name
                : request.CompanyRequested.Trim(),
            CustomerExternalId = request.CustomerExternalId?.Trim() ?? string.Empty,
            CustomerName = request.CustomerName.Trim(),
            IsNewCustomer = request.IsNewCustomer,
            ProjectScope = NormalizeProjectScope(request.ProjectScope),
            RequestType = NormalizeRequestType(request.RequestType),
            ModificationDetails = request.ModificationDetails?.Trim() ?? string.Empty,
            ProjectName = request.ProjectName.Trim(),
            DeliveryUnit = request.DeliveryUnit?.Trim() ?? string.Empty,
            ExpectedQtyPerYear = request.ExpectedQtyPerYear,
            ExpectedPrice = request.ExpectedPrice,
            ExpectedSalesAmountPerYear = expectedSales,
            ProductCategory = request.ProductCategory?.Trim() ?? string.Empty,
            ProductGroup = request.ProductGroup?.Trim() ?? string.Empty,
            ProductSamplesJson = JsonSerializer.Serialize(samples, JsonOptions),
            WaterSoluble = request.WaterSoluble,
            OilSoluble = request.OilSoluble,
            FlavourNatural = request.FlavourNatural,
            FlavourNaturalIdentical = request.FlavourNaturalIdentical,
            FlavourArtificial = request.FlavourArtificial,
            QuantityRequested = request.QuantityRequested,
            QuantityUom = request.QuantityUom?.Trim() ?? string.Empty,
            TargetProducts = request.TargetProducts?.Trim() ?? string.Empty,
            GmoStatus = NormalizeGmoStatus(request.GmoStatus),
            AllergenStatus = NormalizeAllergenStatus(request.AllergenStatus),
            AllergenFreeFromDetail = request.AllergenFreeFromDetail?.Trim() ?? string.Empty,
            McpdHvpFreeDetail = request.McpdHvpFreeDetail?.Trim() ?? string.Empty,
            HalalCertified = request.HalalCertified,
            HalalCompliantAccepted = request.HalalCompliantAccepted,
            CountryRdSite = request.CountryRdSite?.Trim() ?? string.Empty,
            CountryManufacturing = request.CountryManufacturing?.Trim() ?? string.Empty,
            CountryInUse = request.CountryInUse?.Trim() ?? string.Empty,
            RegulatoryRequirement = request.RegulatoryRequirement == "yes" ? "yes" : "na",
            RegulatoryRequirementDetail = request.RegulatoryRequirementDetail?.Trim() ?? string.Empty,
            CustomerDeadline = request.CustomerDeadline,
            ShareToken = Guid.NewGuid().ToString("N"),
            Status = "submitted",
            CreatedBy = request.CreatedBy?.Trim() ?? string.Empty,
            CreatedAt = now,
            UpdatedAt = now,
        };

        db.SampleRequests.Add(row);
        await db.SaveChangesAsync();

        return Ok(MapDetail(row));
    }

    [HttpGet("share/{token}")]
    public async Task<ActionResult<object>> GetByShareToken(string token)
    {
        if (string.IsNullOrWhiteSpace(token))
            return NotFound(new { message = "Sample request link is invalid or has expired." });

        var normalized = token.Trim();
        var row = await db.SampleRequests.AsNoTracking()
            .FirstOrDefaultAsync(s => s.ShareToken == normalized);
        if (row is null)
            return NotFound(new { message = "Sample request link is invalid or has expired." });

        return Ok(MapDetail(row));
    }

    async Task<string> NextRequestNumberAsync(DateOnly dateRequested)
    {
        var datePart = dateRequested.ToString("yyyyMMdd");
        var prefix = $"SR-{datePart}-";
        var latest = await db.SampleRequests.AsNoTracking()
            .Where(s => s.RequestNumber.StartsWith(prefix))
            .OrderByDescending(s => s.RequestNumber)
            .Select(s => s.RequestNumber)
            .FirstOrDefaultAsync();

        var next = 1;
        if (!string.IsNullOrWhiteSpace(latest))
        {
            var tail = latest[prefix.Length..];
            if (int.TryParse(tail, out var n)) next = n + 1;
        }
        return $"{prefix}{next:D4}";
    }

    static string NormalizeProjectScope(string value) =>
        string.Equals(value, "ongoing", StringComparison.OrdinalIgnoreCase) ? "ongoing" : "new";

    static string NormalizeRequestType(string value) => value?.ToLowerInvariant() switch
    {
        "repeat" => "repeat",
        "modification" => "modification",
        _ => "new_submission",
    };

    static string NormalizeGmoStatus(string value) => value?.ToLowerInvariant() switch
    {
        "required" => "required",
        "not_required" => "not_required",
        _ => "na",
    };

    static string NormalizeAllergenStatus(string value) => value?.ToLowerInvariant() switch
    {
        "not_concerned" => "not_concerned",
        "free_from" => "free_from",
        _ => "na",
    };

    static List<SampleRequestProductSampleDto> DeserializeSamples(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<List<SampleRequestProductSampleDto>>(json, JsonOptions) ?? [];
        }
        catch
        {
            return [];
        }
    }

    static object MapSummary(SampleRequest row) => new
    {
        row.Id,
        requestNumber = row.RequestNumber,
        row.CompanyId,
        dateRequested = row.DateRequested,
        contactPersonName = row.ContactPersonName,
        companyRequested = row.CompanyRequested,
        customerName = row.CustomerName,
        projectName = row.ProjectName,
        shareToken = row.ShareToken,
        row.Status,
        createdAt = row.CreatedAt,
    };

    static object MapDetail(SampleRequest row) => new
    {
        row.Id,
        requestNumber = row.RequestNumber,
        row.CompanyId,
        dateRequested = row.DateRequested,
        contactEmployeeId = row.ContactEmployeeId,
        contactPersonName = row.ContactPersonName,
        companyRequested = row.CompanyRequested,
        customerExternalId = row.CustomerExternalId,
        customerName = row.CustomerName,
        isNewCustomer = row.IsNewCustomer,
        projectScope = row.ProjectScope,
        requestType = row.RequestType,
        modificationDetails = row.ModificationDetails,
        projectName = row.ProjectName,
        deliveryUnit = row.DeliveryUnit,
        expectedQtyPerYear = row.ExpectedQtyPerYear,
        expectedPrice = row.ExpectedPrice,
        expectedSalesAmountPerYear = row.ExpectedSalesAmountPerYear,
        productCategory = row.ProductCategory,
        productGroup = row.ProductGroup,
        productSamples = DeserializeSamples(row.ProductSamplesJson),
        waterSoluble = row.WaterSoluble,
        oilSoluble = row.OilSoluble,
        flavourNatural = row.FlavourNatural,
        flavourNaturalIdentical = row.FlavourNaturalIdentical,
        flavourArtificial = row.FlavourArtificial,
        quantityRequested = row.QuantityRequested,
        quantityUom = row.QuantityUom,
        targetProducts = row.TargetProducts,
        gmoStatus = row.GmoStatus,
        allergenStatus = row.AllergenStatus,
        allergenFreeFromDetail = row.AllergenFreeFromDetail,
        mcpdHvpFreeDetail = row.McpdHvpFreeDetail,
        halalCertified = row.HalalCertified,
        halalCompliantAccepted = row.HalalCompliantAccepted,
        countryRdSite = row.CountryRdSite,
        countryManufacturing = row.CountryManufacturing,
        countryInUse = row.CountryInUse,
        regulatoryRequirement = row.RegulatoryRequirement,
        regulatoryRequirementDetail = row.RegulatoryRequirementDetail,
        customerDeadline = row.CustomerDeadline,
        shareToken = row.ShareToken,
        row.Status,
        row.CreatedBy,
        createdAt = row.CreatedAt,
        updatedAt = row.UpdatedAt,
    };
}
