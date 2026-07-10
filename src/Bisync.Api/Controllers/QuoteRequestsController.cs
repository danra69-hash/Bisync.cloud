using System.Text.Json;
using Bisync.Api.Contracts;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/quote-requests")]
public class QuoteRequestsController(BisyncDbContext db) : ControllerBase
{
    static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> List([FromQuery] int? companyId = null)
    {
        var query = db.QuoteRequests
            .AsNoTracking()
            .Include(q => q.Vendors)
            .Include(q => q.Lines)
            .AsQueryable();

        if (companyId is int cid)
            query = query.Where(q => q.CompanyId == cid);

        var rows = await query
            .OrderByDescending(q => q.CreatedAt)
            .ToListAsync();

        return Ok(rows.Select(MapSummary));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<object>> Get(int id)
    {
        var rfq = await LoadAsync(id, tracking: false);
        if (rfq is null) return NotFound(new { message = "Request for quote not found." });
        return Ok(await MapDetailAsync(rfq));
    }

    [HttpPost]
    public async Task<ActionResult<object>> Create([FromBody] CreateQuoteRequestDto request)
    {
        if (request.CompanyId <= 0)
            return BadRequest(new { message = "Company is required." });
        if (request.Vendors.Count == 0)
            return BadRequest(new { message = "Add at least one vendor." });
        if (request.Lines.Count == 0)
            return BadRequest(new { message = "Add at least one component line." });

        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == request.CompanyId);
        if (company is null)
            return BadRequest(new { message = "Company not found." });

        var now = DateTime.UtcNow;
        var rfq = new QuoteRequest
        {
            RfqNumber = await NextRfqNumberAsync(),
            CompanyId = request.CompanyId,
            LocationIdsJson = JsonSerializer.Serialize(request.LocationExternalIds ?? [], JsonOptions),
            Status = "open",
            Notes = request.Notes?.Trim() ?? string.Empty,
            CreatedBy = request.CreatedBy?.Trim() ?? string.Empty,
            CreatedAt = now,
            UpdatedAt = now,
        };

        var sort = 0;
        foreach (var line in request.Lines)
        {
            var kind = string.Equals(line.Kind, "other", StringComparison.OrdinalIgnoreCase) ? "other" : "principal";
            var name = line.ComponentName.Trim();
            if (string.IsNullOrWhiteSpace(name))
                return BadRequest(new { message = "Each line needs a component name." });

            rfq.Lines.Add(new QuoteRequestLine
            {
                Kind = kind,
                SortOrder = sort++,
                ComponentId = line.ComponentId,
                ComponentExternalId = line.ComponentExternalId?.Trim() ?? string.Empty,
                ComponentName = name,
                Specification = line.Specification?.Trim() ?? string.Empty,
                PrincipalUom = string.IsNullOrWhiteSpace(line.PrincipalUom) ? "" : line.PrincipalUom.Trim(),
                RequestedQty = line.RequestedQty,
                VendorResponsesJson = "{}",
            });
        }

        foreach (var vendorDto in request.Vendors)
        {
            Vendor? existing = null;
            if (!string.IsNullOrWhiteSpace(vendorDto.VendorExternalId))
            {
                existing = await db.Vendors.FirstOrDefaultAsync(v =>
                    v.ExternalId.ToLower() == vendorDto.VendorExternalId.Trim().ToLower());
            }
            else if (vendorDto.VendorId is int vid)
            {
                existing = await db.Vendors.FirstOrDefaultAsync(v => v.Id == vid);
            }

            if (vendorDto.IsNewVendor && existing is null)
            {
                var name = vendorDto.VendorName.Trim();
                if (string.IsNullOrWhiteSpace(name))
                    return BadRequest(new { message = "New vendor requires a company name." });
                if (string.IsNullOrWhiteSpace(vendorDto.ContactPerson))
                    return BadRequest(new { message = $"Contact person is required for {name}." });
                if (string.IsNullOrWhiteSpace(vendorDto.Email) && string.IsNullOrWhiteSpace(vendorDto.Mobile))
                    return BadRequest(new { message = $"Email or mobile is required for {name}." });

                var nameTaken = await db.Vendors.AnyAsync(v => v.Name.ToLower() == name.ToLower());
                if (nameTaken)
                    return Conflict(new { message = $"Vendor name '{name}' already exists." });

                existing = new Vendor
                {
                    ExternalId = await NextVendorExternalIdAsync(),
                    Name = name,
                    Type = "offline",
                    Brn = string.Empty,
                    Products = string.Empty,
                    City = string.Empty,
                    State = string.Empty,
                    Address = string.Empty,
                    ContactPerson = vendorDto.ContactPerson.Trim(),
                    ContactPosition = string.Empty,
                    Mobile = vendorDto.Mobile?.Trim() ?? string.Empty,
                    Email = vendorDto.Email?.Trim() ?? string.Empty,
                    ProductPolicyTag = "non-halal",
                    Engaged = false,
                    ContactsJson = "[]",
                };
                db.Vendors.Add(existing);
                await db.SaveChangesAsync();
            }

            if (existing is null)
                return BadRequest(new { message = "Could not resolve one of the selected vendors." });

            rfq.Vendors.Add(new QuoteRequestVendor
            {
                VendorId = existing.Id,
                VendorExternalId = existing.ExternalId,
                VendorName = existing.Name,
                ContactPerson = string.IsNullOrWhiteSpace(vendorDto.ContactPerson)
                    ? existing.ContactPerson
                    : vendorDto.ContactPerson.Trim(),
                Email = string.IsNullOrWhiteSpace(vendorDto.Email) ? existing.Email : vendorDto.Email.Trim(),
                Mobile = string.IsNullOrWhiteSpace(vendorDto.Mobile) ? existing.Mobile : vendorDto.Mobile.Trim(),
                IsNewVendor = vendorDto.IsNewVendor,
                ShareToken = Guid.NewGuid().ToString("N"),
                Status = "pending",
            });
        }

        db.QuoteRequests.Add(rfq);
        await db.SaveChangesAsync();

        var created = await LoadAsync(rfq.Id, tracking: false);
        return Ok(await MapDetailAsync(created!));
    }

    async Task<string> NextRfqNumberAsync()
    {
        var year = DateTime.UtcNow.Year;
        var prefix = $"RFQ-{year}-";
        var latest = await db.QuoteRequests.AsNoTracking()
            .Where(q => q.RfqNumber.StartsWith(prefix))
            .OrderByDescending(q => q.RfqNumber)
            .Select(q => q.RfqNumber)
            .FirstOrDefaultAsync();

        var next = 1;
        if (!string.IsNullOrWhiteSpace(latest))
        {
            var tail = latest[prefix.Length..];
            if (int.TryParse(tail, out var n)) next = n + 1;
        }
        return $"{prefix}{next:D4}";
    }

    async Task<string> NextVendorExternalIdAsync()
    {
        var ids = await db.Vendors.AsNoTracking().Select(v => v.ExternalId).ToListAsync();
        var max = 0;
        foreach (var id in ids)
        {
            if (id.Length > 1 && int.TryParse(id.TrimStart('V', 'v'), out var n))
                max = Math.Max(max, n);
        }
        return $"V{max + 1:D3}";
    }

    async Task<QuoteRequest?> LoadAsync(int id, bool tracking)
    {
        var query = db.QuoteRequests
            .Include(q => q.Vendors)
            .Include(q => q.Lines)
            .AsQueryable();
        if (!tracking) query = query.AsNoTracking();
        return await query.FirstOrDefaultAsync(q => q.Id == id);
    }

    object MapSummary(QuoteRequest rfq) => new
    {
        rfq.Id,
        rfqNumber = rfq.RfqNumber,
        rfq.CompanyId,
        locationIds = DeserializeStringList(rfq.LocationIdsJson),
        rfq.Status,
        rfq.Notes,
        rfq.CreatedBy,
        createdAt = rfq.CreatedAt,
        updatedAt = rfq.UpdatedAt,
        vendorCount = rfq.Vendors.Count,
        lineCount = rfq.Lines.Count,
        submittedCount = rfq.Vendors.Count(v => v.Status == "submitted"),
        vendors = rfq.Vendors.Select(v => new
        {
            v.Id,
            v.VendorExternalId,
            vendorName = v.VendorName,
            v.Status,
            submittedAt = v.SubmittedAt,
            shareToken = v.ShareToken,
        }),
        lines = rfq.Lines
            .OrderBy(l => l.SortOrder)
            .Select(l => new
            {
                l.Id,
                l.Kind,
                componentName = l.ComponentName,
                specification = l.Specification,
                principalUom = l.PrincipalUom,
                requestedQty = l.RequestedQty,
                vendorResponses = DeserializeResponses(l.VendorResponsesJson),
            }),
    };

    async Task<object> MapDetailAsync(QuoteRequest rfq)
    {
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == rfq.CompanyId);
        var locationIds = DeserializeStringList(rfq.LocationIdsJson);
        var locations = locationIds.Count == 0
            ? []
            : await db.Locations.AsNoTracking()
                .Where(l => locationIds.Contains(l.ExternalId))
                .ToListAsync();

        return new
        {
            rfq.Id,
            rfqNumber = rfq.RfqNumber,
            rfq.CompanyId,
            locationIds,
            rfq.Status,
            rfq.Notes,
            rfq.CreatedBy,
            createdAt = rfq.CreatedAt,
            updatedAt = rfq.UpdatedAt,
            company = company is null ? null : MapCompany(company),
            locations = locations.Select(MapLocation),
            vendors = rfq.Vendors.Select(v => new
            {
                v.Id,
                v.VendorId,
                v.VendorExternalId,
                vendorName = v.VendorName,
                v.ContactPerson,
                v.Email,
                v.Mobile,
                v.IsNewVendor,
                shareToken = v.ShareToken,
                v.Status,
                submittedAt = v.SubmittedAt,
                submittedBy = v.SubmittedBy,
            }),
            lines = rfq.Lines
                .OrderBy(l => l.SortOrder)
                .Select(l => new
                {
                    l.Id,
                    l.Kind,
                    l.SortOrder,
                    l.ComponentId,
                    componentExternalId = l.ComponentExternalId,
                    componentName = l.ComponentName,
                    specification = l.Specification,
                    principalUom = l.PrincipalUom,
                    requestedQty = l.RequestedQty,
                    vendorResponses = DeserializeResponses(l.VendorResponsesJson),
                }),
        };
    }

    static object MapCompany(Company company) => new
    {
        company.Name,
        company.Brn,
        company.GstTin,
        company.Phone,
        company.Email,
        addressLine1 = company.AddressLine1,
        addressLine2 = company.AddressLine2,
        company.City,
        stateProvince = company.StateProvince,
        company.Postcode,
        countryCode = company.CountryCode,
    };

    static object MapLocation(Location location) => new
    {
        location.Name,
        location.ExternalId,
        addressLine1 = string.IsNullOrWhiteSpace(location.AddressLine1) ? location.Address : location.AddressLine1,
        location.AddressLine2,
        location.City,
        stateProvince = location.StateProvince,
        location.Postcode,
    };

    static List<string> DeserializeStringList(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<List<string>>(json, JsonOptions) ?? [];
        }
        catch
        {
            return [];
        }
    }

    static Dictionary<string, QuoteLineResponseValue> DeserializeResponses(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, QuoteLineResponseValue>>(json, JsonOptions)
                ?? new Dictionary<string, QuoteLineResponseValue>();
        }
        catch
        {
            return new Dictionary<string, QuoteLineResponseValue>();
        }
    }

    public class QuoteLineResponseValue
    {
        public string DeliveryUnitText { get; set; } = string.Empty;
        public decimal Rrp { get; set; }
        public string Notes { get; set; } = string.Empty;
    }
}

[ApiController]
[Route("api/vendor-rfq")]
public class VendorRfqPortalController(BisyncDbContext db) : ControllerBase
{
    static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    [HttpGet("{token}")]
    public async Task<ActionResult<object>> GetByToken(string token)
    {
        var vendorRow = await LoadVendorByTokenAsync(token, tracking: false);
        if (vendorRow is null)
            return NotFound(new { message = "Request for quote link is invalid or has expired." });

        var rfq = await db.QuoteRequests.AsNoTracking()
            .Include(q => q.Lines)
            .FirstOrDefaultAsync(q => q.Id == vendorRow.QuoteRequestId);
        if (rfq is null)
            return NotFound(new { message = "Request for quote not found." });

        return Ok(await BuildPortalViewAsync(rfq, vendorRow));
    }

    [HttpPost("{token}/submit")]
    public async Task<ActionResult<object>> Submit(string token, [FromBody] SubmitQuoteRequestPortalDto request)
    {
        var vendorRow = await LoadVendorByTokenAsync(token, tracking: true);
        if (vendorRow is null)
            return NotFound(new { message = "Request for quote link is invalid or has expired." });

        var rfq = await db.QuoteRequests
            .Include(q => q.Lines)
            .FirstOrDefaultAsync(q => q.Id == vendorRow.QuoteRequestId);
        if (rfq is null)
            return NotFound(new { message = "Request for quote not found." });

        if (request.Responses is null || request.Responses.Count == 0)
            return BadRequest(new { message = "Provide at least one line response." });

        var lineMap = rfq.Lines.ToDictionary(l => l.Id);
        foreach (var response in request.Responses)
        {
            if (!lineMap.TryGetValue(response.LineId, out var line))
                return BadRequest(new { message = $"Unknown line id {response.LineId}." });

            var delivery = response.DeliveryUnitText?.Trim() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(delivery))
                return BadRequest(new { message = $"Delivery unit is required for {line.ComponentName}." });
            if (response.Rrp < 0)
                return BadRequest(new { message = $"Price must be zero or greater for {line.ComponentName}." });

            var bag = DeserializeResponses(line.VendorResponsesJson);
            bag[vendorRow.VendorExternalId] = new QuoteRequestsController.QuoteLineResponseValue
            {
                DeliveryUnitText = delivery,
                Rrp = response.Rrp,
                Notes = response.Notes?.Trim() ?? string.Empty,
            };
            line.VendorResponsesJson = JsonSerializer.Serialize(bag, JsonOptions);
        }

        vendorRow.Status = "submitted";
        vendorRow.SubmittedAt = DateTime.UtcNow;
        vendorRow.SubmittedBy = string.IsNullOrWhiteSpace(request.SubmittedBy)
            ? vendorRow.ContactPerson
            : request.SubmittedBy.Trim();
        rfq.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        var allStatuses = await db.QuoteRequestVendors.AsNoTracking()
            .Where(v => v.QuoteRequestId == rfq.Id)
            .Select(v => v.Status)
            .ToListAsync();
        rfq.Status = allStatuses.All(s => s == "submitted") ? "completed" : "partial";
        rfq.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        var refreshedVendor = await LoadVendorByTokenAsync(token, tracking: false);
        var refreshedRfq = await db.QuoteRequests.AsNoTracking()
            .Include(q => q.Lines)
            .FirstOrDefaultAsync(q => q.Id == vendorRow.QuoteRequestId);
        return Ok(await BuildPortalViewAsync(refreshedRfq!, refreshedVendor!));
    }

    async Task<QuoteRequestVendor?> LoadVendorByTokenAsync(string token, bool tracking)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;
        var normalized = token.Trim();
        var query = db.QuoteRequestVendors.AsQueryable();
        if (!tracking) query = query.AsNoTracking();
        return await query.FirstOrDefaultAsync(v => v.ShareToken == normalized);
    }

    async Task<object> BuildPortalViewAsync(QuoteRequest rfq, QuoteRequestVendor vendorRow)
    {
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == rfq.CompanyId);
        var locationIds = DeserializeStringList(rfq.LocationIdsJson);
        var locations = locationIds.Count == 0
            ? []
            : await db.Locations.AsNoTracking()
                .Where(l => locationIds.Contains(l.ExternalId))
                .ToListAsync();

        return new
        {
            rfqId = rfq.Id,
            rfqNumber = rfq.RfqNumber,
            status = vendorRow.Status,
            submittedAt = vendorRow.SubmittedAt,
            submittedBy = vendorRow.SubmittedBy,
            canSubmit = vendorRow.Status != "submitted",
            notes = rfq.Notes,
            // Intentionally omit vendor identity and other recipients — each share link is private.
            company = company is null ? null : new
            {
                company.Name,
                company.Brn,
                company.GstTin,
                company.Phone,
                company.Email,
                addressLine1 = company.AddressLine1,
                addressLine2 = company.AddressLine2,
                company.City,
                stateProvince = company.StateProvince,
                company.Postcode,
                countryCode = company.CountryCode,
            },
            locations = locations.Select(l => new
            {
                l.Name,
                l.ExternalId,
                addressLine1 = string.IsNullOrWhiteSpace(l.AddressLine1) ? l.Address : l.AddressLine1,
                l.AddressLine2,
                l.City,
                stateProvince = l.StateProvince,
                l.Postcode,
            }),
            lines = rfq.Lines
                .OrderBy(l => l.SortOrder)
                .Select(l =>
                {
                    var responses = DeserializeResponses(l.VendorResponsesJson);
                    responses.TryGetValue(vendorRow.VendorExternalId, out var mine);
                    return new
                    {
                        l.Id,
                        l.Kind,
                        componentName = l.ComponentName,
                        specification = l.Specification,
                        deliveryUnitText = mine?.DeliveryUnitText ?? string.Empty,
                        rrp = mine?.Rrp ?? 0m,
                        responseNotes = mine?.Notes ?? string.Empty,
                    };
                }),
        };
    }

    static List<string> DeserializeStringList(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<List<string>>(json, JsonOptions) ?? [];
        }
        catch
        {
            return [];
        }
    }

    static Dictionary<string, QuoteRequestsController.QuoteLineResponseValue> DeserializeResponses(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, QuoteRequestsController.QuoteLineResponseValue>>(json, JsonOptions)
                ?? new Dictionary<string, QuoteRequestsController.QuoteLineResponseValue>();
        }
        catch
        {
            return new Dictionary<string, QuoteRequestsController.QuoteLineResponseValue>();
        }
    }
}
