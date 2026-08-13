using Bisync.Api.Contracts;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Bisync.Api.Services;
using Bisync.Api.Tenancy;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LocationsController(
    BisyncDbContext db,
    LocationSubscriptionService locationSubscriptions,
    LocationCatalogInheritanceService catalogInheritance,
    LocationPartitionService locationPartitions) : ControllerBase
{
    static object MapLocationConfig(Location l)
    {
        var countryCode = l.Company?.CountryCode ?? "MY";
        var timeZoneId = string.IsNullOrWhiteSpace(l.TimeZoneId)
            ? OrgClock.ResolveTimeZoneId(countryCode, l.StateProvince)
            : l.TimeZoneId;
        var hasLogo = !string.IsNullOrWhiteSpace(l.LogoBase64);
        return new
        {
            l.Id,
            l.ExternalId,
            l.Name,
            l.CompanyId,
            companyName = l.Company?.Name,
            countryCode,
            timeZoneId,
            l.Active,
            companyActive = l.Company != null && l.Company.Active,
            l.AddressLine1,
            l.AddressLine2,
            l.City,
            l.StateProvince,
            l.Postcode,
            l.PrincipalContactUserId,
            principalContactName = l.PrincipalContact?.FullName,
            l.SecondaryContactUserId,
            secondaryContactName = l.SecondaryContact?.FullName,
            businessTypesJson = CompanyProfileRules.ResolveProfileJson(l.BusinessTypesJson, l.Company?.BusinessTypesJson),
            vendorPolicyTagsJson = CompanyProfileRules.ResolveProfileJson(l.VendorPolicyTagsJson, l.Company?.VendorPolicyTagsJson),
            modulesJson = CompanyModuleRules.ResolveModulesJson(l.ModulesJson, l.Company?.ModulesJson),
            modulesOverridden = CompanyModuleRules.LocationModulesOverridden(l.ModulesJson),
            profileOverridden = CompanyModuleRules.LocationProfileIsOverridden(l.BusinessTypesJson, l.VendorPolicyTagsJson, l.ModulesJson),
            openingHoursJson = string.IsNullOrWhiteSpace(l.OpeningHoursJson) ? "{}" : l.OpeningHoursJson,
            deliveryAllowTimeEnabled = l.DeliveryAllowTimeEnabled,
            deliveryAllowPeriodsJson = string.IsNullOrWhiteSpace(l.DeliveryAllowPeriodsJson) ? "[]" : l.DeliveryAllowPeriodsJson,
            physicalSiteKey = l.PhysicalSiteKey ?? string.Empty,
            conceptLabel = string.IsNullOrWhiteSpace(l.ConceptLabel) ? l.Name : l.ConceptLabel,
            conceptSortOrder = l.ConceptSortOrder,
            logoFileName = l.LogoFileName ?? string.Empty,
            logoContentType = l.LogoContentType ?? string.Empty,
            logoBase64 = hasLogo ? (l.LogoBase64 ?? string.Empty) : string.Empty,
            logoSet = hasLogo,
        };
    }

    async Task<Location?> LoadLocationConfigAsync(int id) =>
        await db.Locations
            .AsNoTracking()
            .Include(l => l.Company)
            .Include(l => l.PrincipalContact)
            .Include(l => l.SecondaryContact)
            .FirstOrDefaultAsync(l => l.Id == id);

    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> GetAll([FromQuery] bool includeInactive = false)
    {
        var query = db.Locations
            .AsNoTracking()
            .Include(l => l.Company)
            .AsQueryable();

        if (!includeInactive)
        {
            query = query.Where(l =>
                l.Active
                && (l.Company == null || l.Company.Active));
        }

        return Ok(await query
            .OrderBy(l => l.Name)
            .Select(l => new
            {
                l.Id,
                l.ExternalId,
                l.Name,
                l.Address,
                l.CompanyId,
                l.Active,
                companyActive = l.Company != null && l.Company.Active,
                l.AddressLine1,
                l.AddressLine2,
                l.City,
                l.StateProvince,
                l.Postcode,
                l.PrincipalContactUserId,
                l.SalesToday,
                l.SalesWtd,
                l.SalesMtd,
                l.SalesYtd,
                l.SalesPrevToday,
                l.SalesPrevWtd,
                l.SalesPrevMtd,
                l.SalesPrevYtd,
                l.CoversToday,
                l.CoversWtd,
                l.CoversMtd,
                l.CoversYtd,
                l.CoversPrevToday,
                l.CoversPrevWtd,
                l.CoversPrevMtd,
                l.CoversPrevYtd,
                physicalSiteKey = l.PhysicalSiteKey,
                conceptLabel = string.IsNullOrWhiteSpace(l.ConceptLabel) ? l.Name : l.ConceptLabel,
                conceptSortOrder = l.ConceptSortOrder,
            })
            .ToListAsync());
    }

    [HttpGet("config")]
    public async Task<ActionResult<IEnumerable<object>>> GetConfig([FromQuery] bool includeInactive = false)
    {
        var query = db.Locations
            .AsNoTracking()
            .Include(l => l.Company)
            .Include(l => l.PrincipalContact)
            .Include(l => l.SecondaryContact)
            .AsQueryable();

        if (!includeInactive)
        {
            query = query.Where(l =>
                l.Active
                && (l.Company == null || l.Company.Active));
        }

        var locations = await query
            .OrderBy(l => l.Name)
            .ToListAsync();

        return Ok(locations.Select(MapLocationConfig));
    }

    [HttpPost("config")]
    public async Task<ActionResult<object>> CreateConfig([FromBody] LocationConfigCreate body)
    {
        if (body.CompanyId is null)
            return BadRequest(new { message = "Company is required." });

        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == body.CompanyId);
        if (company is null)
            return BadRequest(new { message = "Company not found." });

        var businessTypesJson = CompanyProfileRules.NormalizeLocationProfileForStorage(body.BusinessTypesJson, company.BusinessTypesJson);
        var vendorPolicyTagsJson = CompanyProfileRules.NormalizeLocationProfileForStorage(body.VendorPolicyTagsJson, company.VendorPolicyTagsJson, ignoreCase: true);
        var modulesJson = CompanyModuleRules.NormalizeLocationModulesForStorage(body.ModulesJson, company.ModulesJson);
        var effectiveBusinessTypesJson = CompanyProfileRules.ResolveProfileJson(businessTypesJson, company.BusinessTypesJson);
        var effectiveVendorPolicyTagsJson = CompanyProfileRules.ResolveProfileJson(vendorPolicyTagsJson, company.VendorPolicyTagsJson);

        var validationError = CompanyProfileRules.Validate(effectiveBusinessTypesJson, effectiveVendorPolicyTagsJson);
        if (validationError is not null)
            return BadRequest(new { message = validationError });
        var businessSubsetError = CompanyModuleRules.ValidateLocationBusinessTypesSubset(businessTypesJson, company.BusinessTypesJson);
        if (businessSubsetError is not null)
            return BadRequest(new { message = businessSubsetError });
        var modulesError = CompanyModuleRules.ValidateLocationModules(modulesJson, company.ModulesJson);
        if (modulesError is not null)
            return BadRequest(new { message = modulesError });

        var logoError = LogoUploadRules.NormalizeAndValidate(
            body.LogoFileName,
            body.LogoContentType,
            body.LogoBase64,
            "Location",
            out var logoFileName,
            out var logoContentType,
            out var logoBase64);
        if (logoError is not null)
            return BadRequest(new { message = logoError });

        var inheritRequested = body.CopyComponents
            || body.CopyVendorsAndVendorProducts
            || body.CopyProducts;
        int? inheritSourceCompanyId = null;
        string? inheritSourceLocationExternalId = null;
        if (inheritRequested)
        {
            if (body.InheritFromCompanyId is not int sourceCompanyId || sourceCompanyId <= 0)
                return BadRequest(new { message = "Inheritance requires a source company." });
            if (string.IsNullOrWhiteSpace(body.InheritFromLocationExternalId))
                return BadRequest(new { message = "Inheritance requires a source location." });

            var sourceLocId = body.InheritFromLocationExternalId.Trim();
            var sourceOk = await db.Locations.AsNoTracking().AnyAsync(l =>
                l.CompanyId == sourceCompanyId
                && l.ExternalId.ToLower() == sourceLocId.ToLower());
            if (!sourceOk)
                return BadRequest(new { message = "Source location was not found for the selected company." });

            inheritSourceCompanyId = sourceCompanyId;
            inheritSourceLocationExternalId = sourceLocId;
        }

        await DatabaseSchemaHelper.TryResyncIdentitySequenceAsync(db, "Locations");

        var externalId = await GenerateUniqueExternalIdAsync(body.Name);
        var loc = new Location
        {
            ExternalId = externalId,
            Name = body.Name.Trim(),
            CompanyId = body.CompanyId,
            Active = body.Active,
            AddressLine1 = body.AddressLine1 ?? string.Empty,
            AddressLine2 = body.AddressLine2 ?? string.Empty,
            City = body.City ?? string.Empty,
            StateProvince = body.StateProvince ?? string.Empty,
            Postcode = body.Postcode ?? string.Empty,
            PrincipalContactUserId = body.PrincipalContactUserId,
            SecondaryContactUserId = body.SecondaryContactUserId,
            BusinessTypesJson = businessTypesJson,
            VendorPolicyTagsJson = vendorPolicyTagsJson,
            ModulesJson = modulesJson,
            OpeningHoursJson = string.IsNullOrWhiteSpace(body.OpeningHoursJson) ? "{}" : body.OpeningHoursJson.Trim(),
            DeliveryAllowTimeEnabled = body.DeliveryAllowTimeEnabled,
            DeliveryAllowPeriodsJson = string.IsNullOrWhiteSpace(body.DeliveryAllowPeriodsJson) ? "[]" : body.DeliveryAllowPeriodsJson.Trim(),
            PhysicalSiteKey = (body.PhysicalSiteKey ?? string.Empty).Trim(),
            ConceptLabel = (body.ConceptLabel ?? string.Empty).Trim(),
            ConceptSortOrder = body.ConceptSortOrder ?? 0,
            Address = string.Join(", ", new[] { body.AddressLine1, body.City, body.StateProvince, body.Postcode }.Where(s => !string.IsNullOrWhiteSpace(s))),
            LogoFileName = logoFileName,
            LogoContentType = logoContentType,
            LogoBase64 = logoBase64,
        };
        OrgClock.AssignLocationTimeZone(loc, company.CountryCode);

        db.Locations.Add(loc);
        await db.SaveChangesAsync();

        try
        {
            await locationPartitions.EnsurePartitionsForLocationAsync(loc.ExternalId);
        }
        catch
        {
            // Best-effort: inventory writes also ensure partitions.
        }

        LocationCatalogInheritanceResult? inheritanceResult = null;
        string? inheritanceError = null;
        if (inheritRequested
            && inheritSourceCompanyId is int validatedSourceCompanyId
            && !string.IsNullOrWhiteSpace(inheritSourceLocationExternalId))
        {
            try
            {
                inheritanceResult = await catalogInheritance.ApplyAsync(
                    loc,
                    new LocationCatalogInheritanceRequest(
                        validatedSourceCompanyId,
                        inheritSourceLocationExternalId,
                        body.CopyComponents,
                        body.CopyVendorsAndVendorProducts,
                        body.CopyProducts));
            }
            catch (Exception ex)
            {
                inheritanceError = ex.Message;
            }
        }

        try
        {
            if (loc.CompanyId is int companyId)
                await locationSubscriptions.ActivateFreeTrialForCompanyAsync(companyId);
        }
        catch
        {
            // Best-effort: rollup / panel can backfill trial rows.
        }

        var saved = await LoadLocationConfigAsync(loc.Id);
        if (saved is null)
        {
            return Ok(new
            {
                loc.Id,
                loc.ExternalId,
                loc.Name,
                loc.CompanyId,
                inheritance = inheritanceResult,
                inheritanceError,
            });
        }

        var mapped = MapLocationConfig(saved);
        if (inheritanceResult is null && inheritanceError is null)
            return Ok(mapped);

        // Attach inheritance summary without changing the core LocationConfig shape for clients.
        var json = JsonSerializer.SerializeToNode(mapped) as JsonObject ?? new JsonObject();
        if (inheritanceResult is not null)
        {
            json["inheritance"] = JsonSerializer.SerializeToNode(new
            {
                componentsCopied = inheritanceResult.ComponentsCopied,
                vendorsCopied = inheritanceResult.VendorsCopied,
                vendorProductsCopied = inheritanceResult.VendorProductsCopied,
                productsCopied = inheritanceResult.ProductsCopied,
                mode = inheritanceResult.Mode,
            });
        }
        if (inheritanceError is not null)
            json["inheritanceError"] = inheritanceError;
        return Ok(json);
    }

    [HttpPut("{id:int}/config")]
    public async Task<ActionResult<object>> UpdateConfig(int id, [FromBody] LocationConfigUpdate body)
    {
        if (body.CompanyId is null)
            return BadRequest(new { message = "Company is required." });

        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == body.CompanyId);
        if (company is null)
            return BadRequest(new { message = "Company not found." });

        var businessTypesJson = CompanyProfileRules.NormalizeLocationProfileForStorage(body.BusinessTypesJson, company.BusinessTypesJson);
        var vendorPolicyTagsJson = CompanyProfileRules.NormalizeLocationProfileForStorage(body.VendorPolicyTagsJson, company.VendorPolicyTagsJson, ignoreCase: true);
        var modulesJson = CompanyModuleRules.NormalizeLocationModulesForStorage(body.ModulesJson, company.ModulesJson);
        var effectiveBusinessTypesJson = CompanyProfileRules.ResolveProfileJson(businessTypesJson, company.BusinessTypesJson);
        var effectiveVendorPolicyTagsJson = CompanyProfileRules.ResolveProfileJson(vendorPolicyTagsJson, company.VendorPolicyTagsJson);

        var validationError = CompanyProfileRules.Validate(effectiveBusinessTypesJson, effectiveVendorPolicyTagsJson);
        if (validationError is not null)
            return BadRequest(new { message = validationError });
        var businessSubsetError = CompanyModuleRules.ValidateLocationBusinessTypesSubset(businessTypesJson, company.BusinessTypesJson);
        if (businessSubsetError is not null)
            return BadRequest(new { message = businessSubsetError });
        var modulesError = CompanyModuleRules.ValidateLocationModules(modulesJson, company.ModulesJson);
        if (modulesError is not null)
            return BadRequest(new { message = modulesError });

        // Logo fields are optional on update: omit to keep the existing logo; send empty to clear.
        var logoProvided = body.LogoFileName is not null
            || body.LogoContentType is not null
            || body.LogoBase64 is not null;
        string? logoFileName = null;
        string? logoContentType = null;
        string? logoBase64 = null;
        if (logoProvided)
        {
            var logoError = LogoUploadRules.NormalizeAndValidate(
                body.LogoFileName,
                body.LogoContentType,
                body.LogoBase64,
                "Location",
                out var normalizedFileName,
                out var normalizedContentType,
                out var normalizedBase64);
            if (logoError is not null)
                return BadRequest(new { message = logoError });
            logoFileName = normalizedFileName;
            logoContentType = normalizedContentType;
            logoBase64 = normalizedBase64;
        }

        var loc = await db.Locations.FindAsync(id);
        if (loc is null) return NotFound();
        var previousActive = loc.Active;
        loc.CompanyId = body.CompanyId;
        loc.Name = body.Name;
        loc.Active = body.Active;
        loc.AddressLine1 = body.AddressLine1;
        loc.AddressLine2 = body.AddressLine2;
        loc.City = body.City;
        loc.StateProvince = body.StateProvince;
        loc.Postcode = body.Postcode;
        loc.PrincipalContactUserId = body.PrincipalContactUserId;
        loc.SecondaryContactUserId = body.SecondaryContactUserId;
        loc.BusinessTypesJson = businessTypesJson;
        loc.VendorPolicyTagsJson = vendorPolicyTagsJson;
        loc.ModulesJson = modulesJson;
        if (body.OpeningHoursJson is not null)
            loc.OpeningHoursJson = string.IsNullOrWhiteSpace(body.OpeningHoursJson) ? "{}" : body.OpeningHoursJson.Trim();
        loc.DeliveryAllowTimeEnabled = body.DeliveryAllowTimeEnabled;
        if (body.DeliveryAllowPeriodsJson is not null)
            loc.DeliveryAllowPeriodsJson = string.IsNullOrWhiteSpace(body.DeliveryAllowPeriodsJson) ? "[]" : body.DeliveryAllowPeriodsJson.Trim();
        if (body.PhysicalSiteKey is not null)
            loc.PhysicalSiteKey = body.PhysicalSiteKey.Trim();
        if (body.ConceptLabel is not null)
            loc.ConceptLabel = body.ConceptLabel.Trim();
        if (body.ConceptSortOrder is not null)
            loc.ConceptSortOrder = body.ConceptSortOrder.Value;
        if (logoProvided)
        {
            loc.LogoFileName = logoFileName ?? string.Empty;
            loc.LogoContentType = logoContentType ?? string.Empty;
            loc.LogoBase64 = logoBase64 ?? string.Empty;
        }
        loc.Address = string.Join(", ", new[] { body.AddressLine1, body.City, body.StateProvince, body.Postcode }.Where(s => !string.IsNullOrWhiteSpace(s)));
        OrgClock.AssignLocationTimeZone(loc, company.CountryCode);
        await db.SaveChangesAsync();

        // Keep Tenant Rollups Current status aligned with Platform Config Active.
        if (previousActive != body.Active || !body.Active)
        {
            try
            {
                await locationSubscriptions.SyncLocationActiveStatusAsync(
                    body.CompanyId.Value,
                    loc.ExternalId,
                    body.Active);
            }
            catch
            {
                // Best-effort: rollup refresh also backfills deactivated status.
            }
        }

        var saved = await LoadLocationConfigAsync(loc.Id);
        return saved is null ? Ok(new { loc.Id, loc.Name, loc.CompanyId }) : Ok(MapLocationConfig(saved));
    }

    static string SlugifyLocationName(string name)
    {
        var chars = name.ToLowerInvariant()
            .Where(c => char.IsLetterOrDigit(c) || c == ' ' || c == '-')
            .ToArray();
        var slug = new string(chars).Trim().Replace(' ', '-');
        while (slug.Contains("--", StringComparison.Ordinal))
            slug = slug.Replace("--", "-", StringComparison.Ordinal);
        return string.IsNullOrWhiteSpace(slug) ? "location" : slug;
    }

    async Task<string> GenerateUniqueExternalIdAsync(string name)
    {
        var baseSlug = SlugifyLocationName(name);
        var candidate = baseSlug;
        var suffix = 2;
        while (await db.Locations.AnyAsync(l => l.ExternalId == candidate))
        {
            candidate = $"{baseSlug}-{suffix}";
            suffix++;
        }
        return candidate;
    }

    [HttpGet("{externalId}")]
    public async Task<ActionResult<Location>> GetById(string externalId)
    {
        var loc = await db.Locations.FirstOrDefaultAsync(l => l.ExternalId == externalId);
        return loc is null ? NotFound() : Ok(loc);
    }

    static object MapDeliveryLocation(DeliveryLocation d) => new
    {
        d.Id,
        externalId = d.ExternalId,
        locationExternalId = d.LocationExternalId,
        companyId = d.CompanyId,
        name = d.Name,
        addressLine1 = d.AddressLine1,
        addressLine2 = d.AddressLine2,
        city = d.City,
        stateProvince = d.StateProvince,
        postcode = d.Postcode,
        active = d.Active,
        createdAt = d.CreatedAt,
        updatedAt = d.UpdatedAt,
    };

    async Task<string> GenerateUniqueDeliveryExternalIdAsync(string locationExternalId, string name)
    {
        var baseSlug = $"{locationExternalId}-dl-{SlugifyLocationName(name)}";
        var candidate = baseSlug;
        var suffix = 2;
        while (await db.DeliveryLocations.AnyAsync(d => d.ExternalId == candidate))
        {
            candidate = $"{baseSlug}-{suffix}";
            suffix++;
        }
        return candidate;
    }

    static string? ValidateDeliveryLocationRequest(DeliveryLocationUpsertRequest body)
    {
        if (string.IsNullOrWhiteSpace(body.Name))
            return "Name of Delivery Location is required.";
        if (string.IsNullOrWhiteSpace(body.AddressLine1))
            return "Address Line 1 is required.";
        if (string.IsNullOrWhiteSpace(body.City))
            return "City is required.";
        if (string.IsNullOrWhiteSpace(body.StateProvince))
            return "State is required.";
        if (string.IsNullOrWhiteSpace(body.Postcode))
            return "PostCode is required.";
        return null;
    }

    /// <summary>List delivery locations for a company and/or parent outlet(s) — used by PO filters.</summary>
    [HttpGet("delivery-locations")]
    public async Task<ActionResult<IEnumerable<object>>> ListDeliveryLocations(
        [FromQuery] int? companyId = null,
        [FromQuery] string? locationExternalIds = null,
        [FromQuery] bool includeInactive = false)
    {
        var query = db.DeliveryLocations.AsNoTracking().AsQueryable();
        if (companyId is int cid)
            query = query.Where(d => d.CompanyId == cid);
        var outletIds = (locationExternalIds ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(id => id.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        if (outletIds.Count > 0)
            query = query.Where(d => outletIds.Contains(d.LocationExternalId));
        if (!includeInactive)
            query = query.Where(d => d.Active);

        var rows = await query
            .OrderBy(d => d.Name)
            .ThenBy(d => d.Id)
            .ToListAsync();
        return Ok(rows.Select(MapDeliveryLocation));
    }

    [HttpGet("{externalId}/delivery-locations")]
    public async Task<ActionResult<IEnumerable<object>>> ListDeliveryLocationsForOutlet(
        string externalId,
        [FromQuery] bool includeInactive = false)
    {
        var outlet = await db.Locations.AsNoTracking()
            .FirstOrDefaultAsync(l => l.ExternalId == externalId);
        if (outlet is null) return NotFound(new { message = "Location not found." });

        var query = db.DeliveryLocations.AsNoTracking()
            .Where(d => d.LocationExternalId == outlet.ExternalId);
        if (!includeInactive)
            query = query.Where(d => d.Active);

        var rows = await query.OrderBy(d => d.Name).ThenBy(d => d.Id).ToListAsync();
        return Ok(rows.Select(MapDeliveryLocation));
    }

    [HttpPost("{externalId}/delivery-locations")]
    public async Task<ActionResult<object>> CreateDeliveryLocation(
        string externalId,
        [FromBody] DeliveryLocationUpsertRequest body)
    {
        var outlet = await db.Locations.AsNoTracking()
            .FirstOrDefaultAsync(l => l.ExternalId == externalId);
        if (outlet is null) return NotFound(new { message = "Location not found." });

        var validationError = ValidateDeliveryLocationRequest(body);
        if (validationError is not null)
            return BadRequest(new { message = validationError });

        var now = DateTime.UtcNow;
        var row = new DeliveryLocation
        {
            ExternalId = await GenerateUniqueDeliveryExternalIdAsync(outlet.ExternalId, body.Name),
            LocationExternalId = outlet.ExternalId,
            CompanyId = outlet.CompanyId,
            Name = body.Name.Trim(),
            AddressLine1 = body.AddressLine1.Trim(),
            AddressLine2 = (body.AddressLine2 ?? string.Empty).Trim(),
            City = body.City.Trim(),
            StateProvince = body.StateProvince.Trim(),
            Postcode = body.Postcode.Trim(),
            Active = body.Active ?? true,
            CreatedAt = now,
            UpdatedAt = now,
        };
        db.DeliveryLocations.Add(row);
        await db.SaveChangesAsync();
        return Ok(MapDeliveryLocation(row));
    }

    [HttpPut("delivery-locations/{id:int}")]
    public async Task<ActionResult<object>> UpdateDeliveryLocation(
        int id,
        [FromBody] DeliveryLocationUpsertRequest body)
    {
        var row = await db.DeliveryLocations.FirstOrDefaultAsync(d => d.Id == id);
        if (row is null) return NotFound(new { message = "Delivery location not found." });

        var validationError = ValidateDeliveryLocationRequest(body);
        if (validationError is not null)
            return BadRequest(new { message = validationError });

        row.Name = body.Name.Trim();
        row.AddressLine1 = body.AddressLine1.Trim();
        row.AddressLine2 = (body.AddressLine2 ?? string.Empty).Trim();
        row.City = body.City.Trim();
        row.StateProvince = body.StateProvince.Trim();
        row.Postcode = body.Postcode.Trim();
        if (body.Active is bool active)
            row.Active = active;
        row.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(MapDeliveryLocation(row));
    }

    [HttpDelete("delivery-locations/{id:int}")]
    public async Task<IActionResult> DeleteDeliveryLocation(int id)
    {
        var row = await db.DeliveryLocations.FirstOrDefaultAsync(d => d.Id == id);
        if (row is null) return NotFound(new { message = "Delivery location not found." });
        row.Active = false;
        row.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return NoContent();
    }
}

[ApiController]
[Route("api/[controller]")]
public class MenuController(BisyncDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<MenuItem>>> GetAll([FromQuery] string? category = null)
    {
        var q = db.MenuItems.AsQueryable();
        if (!string.IsNullOrEmpty(category))
            q = q.Where(m => m.Category == category);
        return Ok(await q.OrderByDescending(m => m.Revenue).ToListAsync());
    }
}

[ApiController]
[Route("api/[controller]")]
public class VendorsController(BisyncDbContext db) : ControllerBase
{
    static readonly JsonSerializerOptions ContactJsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    static readonly HashSet<string> AllowedDeliveryDays = new(StringComparer.OrdinalIgnoreCase)
    {
        "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
    };

    static string SerializeEngagedLocationIds(IEnumerable<string>? locationIds)
    {
        var normalized = (locationIds ?? Enumerable.Empty<string>())
            .Select(id => id?.Trim() ?? string.Empty)
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        return JsonSerializer.Serialize(normalized);
    }

    static string SerializeDeliveryDays(IEnumerable<string>? days)
    {
        var order = new[] { "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday" };
        var selected = new HashSet<string>(
            (days ?? Enumerable.Empty<string>())
                .Select(d => d?.Trim().ToLowerInvariant() ?? string.Empty)
                .Where(d => AllowedDeliveryDays.Contains(d)),
            StringComparer.OrdinalIgnoreCase);
        return JsonSerializer.Serialize(order.Where(selected.Contains).ToList());
    }

    static string? ValidateMinOrderAmount(decimal? amount)
    {
        if (amount is null) return null;
        if (amount < 0) return "Min order amount cannot be negative.";
        return null;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<Vendor>>> GetAll(
        [FromQuery] bool? engaged = null,
        [FromQuery] int? companyId = null)
    {
        var q = db.Vendors.AsQueryable();
        if (engaged.HasValue)
            q = q.Where(v => v.Engaged == engaged.Value);
        if (companyId is int cid && cid > 0)
            q = q.Where(v => v.CompanyId == null || v.CompanyId == cid);
        return Ok(await q.OrderByDescending(v => v.Engaged).ThenBy(v => v.Name).ToListAsync());
    }

    [HttpPost]
    public async Task<ActionResult<Vendor>> Create([FromBody] CreateVendorRequest request)
    {
        var externalId = request.ExternalId.Trim().ToUpperInvariant();
        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(externalId))
            return BadRequest(new { message = "Vendor ID is required." });
        if (string.IsNullOrWhiteSpace(name))
            return BadRequest(new { message = "Vendor name is required." });

        var idTaken = await db.Vendors.AnyAsync(v => v.ExternalId.ToLower() == externalId.ToLower());
        if (idTaken)
            return Conflict(new { message = "Vendor ID already exists." });

        var nameTaken = await db.Vendors.AnyAsync(v => v.Name.ToLower() == name.ToLower());
        if (nameTaken)
            return Conflict(new { message = "Vendor name already exists." });

        var policyError = VendorPolicyRules.ValidateProductPolicyTag(request.ProductPolicyTag);
        if (policyError is not null)
            return BadRequest(new { message = policyError });

        var minOrderError = ValidateMinOrderAmount(request.MinOrderAmount);
        if (minOrderError is not null)
            return BadRequest(new { message = minOrderError });

        int? companyId = null;
        if (request.CompanyId is int requestedCompanyId && requestedCompanyId > 0)
        {
            var companyExists = await db.Companies.AsNoTracking()
                .AnyAsync(c => c.Id == requestedCompanyId);
            if (!companyExists)
                return BadRequest(new { message = "Company not found." });
            companyId = requestedCompanyId;
        }

        var vendor = new Vendor
        {
            CompanyId = companyId,
            ExternalId = externalId,
            Name = name,
            Type = string.IsNullOrWhiteSpace(request.Type) ? "offline" : request.Type.Trim().ToLowerInvariant(),
            Brn = request.Brn.Trim(),
            Products = request.Products.Trim(),
            City = request.City.Trim(),
            State = request.State.Trim(),
            Postcode = request.Postcode.Trim(),
            Address = request.Address.Trim(),
            ContactPerson = request.ContactPerson.Trim(),
            ContactPosition = request.ContactPosition.Trim(),
            Mobile = request.Mobile.Trim(),
            Email = request.Email.Trim(),
            ProductPolicyTag = request.ProductPolicyTag.Trim().ToLowerInvariant(),
            AllowPartialDelivery = request.AllowPartialDelivery,
            EngagedLocationIdsJson = SerializeEngagedLocationIds(request.EngagedLocationIds),
            MinOrderAmount = request.MinOrderAmount,
            DeliveryDaysJson = SerializeDeliveryDays(request.DeliveryDays),
            ContactsJson = JsonSerializer.Serialize(new[]
            {
                new VendorContactRequest
                {
                    Name = request.ContactPerson.Trim(),
                    Position = request.ContactPosition.Trim(),
                    Mobile = request.Mobile.Trim(),
                    Email = request.Email.Trim(),
                    IsDefault = true,
                }
            }, ContactJsonOptions),
            Engaged = false,
            Active = true,
        };

        db.Vendors.Add(vendor);
        await db.SaveChangesAsync();
        return Ok(vendor);
    }

    [HttpPut("{externalId}")]
    public async Task<ActionResult<Vendor>> Update(string externalId, [FromBody] UpdateVendorRequest request)
    {
        var vendor = await db.Vendors.FirstOrDefaultAsync(v => v.ExternalId == externalId);
        if (vendor is null) return NotFound();

        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(name))
            return BadRequest(new { message = "Vendor name is required." });

        var nameTaken = await db.Vendors.AnyAsync(v => v.Id != vendor.Id && v.Name.ToLower() == name.ToLower());
        if (nameTaken)
            return Conflict(new { message = "Vendor name already exists." });

        var policyError = VendorPolicyRules.ValidateProductPolicyTag(request.ProductPolicyTag);
        if (policyError is not null)
            return BadRequest(new { message = policyError });

        var minOrderError = ValidateMinOrderAmount(request.MinOrderAmount);
        if (minOrderError is not null)
            return BadRequest(new { message = minOrderError });

        vendor.Name = name;
        vendor.Type = string.IsNullOrWhiteSpace(request.Type) ? "offline" : request.Type.Trim().ToLowerInvariant();
        vendor.Brn = request.Brn.Trim();
        vendor.Products = request.Products.Trim();
        vendor.City = request.City.Trim();
        vendor.State = request.State.Trim();
        vendor.Postcode = request.Postcode.Trim();
        vendor.Address = request.Address.Trim();
        vendor.ContactPerson = request.ContactPerson.Trim();
        vendor.ContactPosition = request.ContactPosition.Trim();
        vendor.Mobile = request.Mobile.Trim();
        vendor.Email = request.Email.Trim();
        vendor.ProductPolicyTag = request.ProductPolicyTag.Trim().ToLowerInvariant();
        vendor.AllowPartialDelivery = request.AllowPartialDelivery;
        vendor.MinOrderAmount = request.MinOrderAmount;
        if (request.EngagedLocationIds is not null)
            vendor.EngagedLocationIdsJson = SerializeEngagedLocationIds(request.EngagedLocationIds);
        if (request.DeliveryDays is not null)
            vendor.DeliveryDaysJson = SerializeDeliveryDays(request.DeliveryDays);
        vendor.ContactsJson = JsonSerializer.Serialize(
            SyncDefaultContact(vendor),
            ContactJsonOptions);

        await db.SaveChangesAsync();
        return Ok(vendor);
    }

    [HttpGet("{externalId}/tagged-components")]
    public async Task<ActionResult<object>> GetTaggedComponents(string externalId, [FromQuery] int? companyId = null)
    {
        var vendor = await db.Vendors.AsNoTracking().FirstOrDefaultAsync(v => v.ExternalId == externalId);
        if (vendor is null) return NotFound();

        var tagged = await DeactivationGuardService.FindComponentsTaggedToVendorAsync(
            db, vendor.ExternalId, companyId ?? vendor.CompanyId);
        return Ok(new
        {
            vendorExternalId = vendor.ExternalId,
            vendorName = vendor.Name,
            taggedComponents = tagged.Select(MapTaggedComponent),
        });
    }

    [HttpPost("{externalId}/untag-components")]
    public async Task<ActionResult<object>> UntagComponents(string externalId, [FromBody] UntagVendorComponentsRequest? body = null)
    {
        var vendor = await db.Vendors.FirstOrDefaultAsync(v => v.ExternalId == externalId);
        if (vendor is null) return NotFound();

        var vendorProductIds = await db.VendorProducts.AsNoTracking()
            .Where(p => p.VendorExternalId == vendor.ExternalId)
            .Select(p => p.ExternalId)
            .ToListAsync();
        if (vendorProductIds.Count == 0)
            return Ok(new { untagged = 0, remaining = Array.Empty<object>() });

        var tagged = await DeactivationGuardService.FindComponentsTaggedToVendorAsync(
            db, vendor.ExternalId, body?.CompanyId ?? vendor.CompanyId);
        var selectedIds = body?.ComponentIds?
            .Where(id => id > 0)
            .ToHashSet();
        var targets = selectedIds is { Count: > 0 }
            ? tagged.Where(t => selectedIds.Contains(t.Id)).ToList()
            : tagged.ToList();

        var untagged = 0;
        foreach (var target in targets)
        {
            var ingredient = await db.Ingredients.FirstOrDefaultAsync(i => i.Id == target.Id);
            if (ingredient is null) continue;
            ingredient.DetailConfigJson = DeactivationGuardService.UntagVendorProductsFromDetailConfig(
                ingredient.DetailConfigJson,
                vendorProductIds);
            ingredient.UpdatedAt = DateTime.UtcNow;
            untagged++;
        }

        await db.SaveChangesAsync();

        var remaining = await DeactivationGuardService.FindComponentsTaggedToVendorAsync(
            db, vendor.ExternalId, body?.CompanyId ?? vendor.CompanyId);
        return Ok(new
        {
            untagged,
            remaining = remaining.Select(MapTaggedComponent),
        });
    }

    [HttpPost("{externalId}/set-active")]
    public async Task<ActionResult<object>> SetActive(string externalId, [FromBody] SetVendorActiveRequest request)
    {
        var vendor = await db.Vendors.FirstOrDefaultAsync(v => v.ExternalId == externalId);
        if (vendor is null) return NotFound();

        if (vendor.Active && !request.Active)
        {
            var tagged = await DeactivationGuardService.FindComponentsTaggedToVendorAsync(
                db, vendor.ExternalId, request.CompanyId ?? vendor.CompanyId);
            if (tagged.Count > 0)
            {
                return Conflict(new
                {
                    message = $"Cannot deactivate: {tagged.Count} component(s) are still tagged to vendor products from {vendor.Name}. Untag them first.",
                    code = "vendor_has_tagged_components",
                    taggedComponents = tagged.Select(MapTaggedComponent),
                });
            }
        }

        vendor.Active = request.Active;
        await db.SaveChangesAsync();
        return Ok(vendor);
    }

    static object MapTaggedComponent(TaggedComponentRef row) => new
    {
        id = row.Id,
        componentId = row.ComponentId,
        name = row.Name,
        taggedVendorProductIds = row.TaggedVendorProductIds,
        taggedVendorProductNames = row.TaggedVendorProductNames,
    };

    [HttpPost("{externalId}/engage")]
    public async Task<ActionResult<object>> Engage(string externalId, [FromBody] EngageVendorRequest? body = null)
    {
        var vendor = await db.Vendors.FirstOrDefaultAsync(v => v.ExternalId == externalId);
        if (vendor is null) return NotFound();

        var contacts = NormalizeContacts(body?.Contacts, vendor);
        if (contacts.Count == 0)
            return BadRequest(new { message = "At least one sales contact is required." });

        var defaultContact = contacts.FirstOrDefault(c => c.IsDefault) ?? contacts[0];
        vendor.ContactsJson = JsonSerializer.Serialize(contacts, ContactJsonOptions);
        vendor.ContactPerson = defaultContact.Name;
        vendor.ContactPosition = defaultContact.Position;
        vendor.Mobile = defaultContact.Mobile;
        vendor.Email = defaultContact.Email;

        var requestedBy = body?.RequestedBy?.Trim() ?? string.Empty;

        if (VendorEngagementService.IsOnlineVendor(vendor))
        {
            var linkedCompanyId = await VendorEngagementService.ResolveLinkedCompanyIdAsync(db, vendor);
            if (linkedCompanyId is null)
            {
                return BadRequest(new
                {
                    message = "Online vendors must have a BRN that matches a Bisync company before engage can be requested.",
                });
            }

            vendor.LinkedCompanyId = linkedCompanyId;
            vendor.EngagementStatus = VendorEngagementService.StatusPending;
            vendor.Engaged = false;
            vendor.EngageRequestedAt = DateTime.UtcNow;
            vendor.EngageRequestedBy = requestedBy;
            vendor.EngageApprovedAt = null;
            vendor.EngageApprovedBy = string.Empty;
            vendor.MinOrderAmount = null;
            vendor.DeliveryChargeBelowMin = null;
            vendor.PaymentTerms = string.Empty;
            await db.SaveChangesAsync();

            await UserNotificationService.NotifyCompanyUsersAsync(
                db,
                linkedCompanyId.Value,
                UserNotificationService.TypeVendorEngageRequest,
                $"Engage request from {(string.IsNullOrWhiteSpace(requestedBy) ? "an operator" : requestedBy)}",
                $"{requestedBy} requested to engage {vendor.Name}. Open Operation → Active Sales to approve and set trading conditions.");

            return Ok(vendor);
        }

        vendor.Engaged = true;
        vendor.EngagementStatus = VendorEngagementService.StatusApproved;
        vendor.EngageRequestedAt = DateTime.UtcNow;
        vendor.EngageRequestedBy = requestedBy;
        vendor.EngageApprovedAt = DateTime.UtcNow;
        vendor.EngageApprovedBy = requestedBy;
        await db.SaveChangesAsync();
        return Ok(vendor);
    }

    [HttpGet("engagements/pending")]
    public async Task<ActionResult<IEnumerable<object>>> PendingEngagements([FromQuery] int companyId)
    {
        if (companyId <= 0)
            return BadRequest(new { message = "companyId is required." });

        var rows = await db.Vendors.AsNoTracking()
            .Where(v => v.LinkedCompanyId == companyId
                && v.Type.ToLower() == "online"
                && v.EngagementStatus == VendorEngagementService.StatusPending)
            .OrderByDescending(v => v.EngageRequestedAt)
            .ToListAsync();

        return Ok(rows.Select(VendorEngagementService.MapEngagement));
    }

    [HttpPost("{externalId}/approve-engagement")]
    public async Task<ActionResult<object>> ApproveEngagement(
        string externalId,
        [FromBody] ApproveVendorEngagementRequest request)
    {
        var vendor = await db.Vendors.FirstOrDefaultAsync(v => v.ExternalId == externalId);
        if (vendor is null) return NotFound();
        if (!VendorEngagementService.IsOnlineVendor(vendor))
            return BadRequest(new { message = "Only online vendors require engagement approval." });
        if (!string.Equals(vendor.EngagementStatus, VendorEngagementService.StatusPending, StringComparison.OrdinalIgnoreCase))
            return Conflict(new { message = "No pending engage request for this vendor." });

        var paymentError = VendorEngagementService.ValidatePaymentTerms(request.PaymentTerms);
        if (paymentError is not null)
            return BadRequest(new { message = paymentError });

        if (request.MinOrderAmount < 0)
            return BadRequest(new { message = "Minimum order amount cannot be negative." });
        if (request.DeliveryChargeBelowMin < 0)
            return BadRequest(new { message = "Delivery charge cannot be negative." });

        var approvedBy = request.ApprovedBy?.Trim() ?? string.Empty;
        vendor.MinOrderAmount = request.MinOrderAmount;
        vendor.DeliveryChargeBelowMin = request.DeliveryChargeBelowMin;
        vendor.PaymentTerms = VendorEngagementService.NormalizePaymentTerms(request.PaymentTerms);
        vendor.EngagementStatus = VendorEngagementService.StatusApproved;
        vendor.Engaged = true;
        vendor.EngageApprovedAt = DateTime.UtcNow;
        vendor.EngageApprovedBy = approvedBy;
        vendor.LinkedCompanyId ??= await VendorEngagementService.ResolveLinkedCompanyIdAsync(db, vendor);

        await db.SaveChangesAsync();

        var termsLabel = vendor.PaymentTerms.ToUpperInvariant();
        await UserNotificationService.NotifyEngageRequesterAsync(
            db,
            vendor,
            $"Engage approved · {vendor.Name}",
            $"{vendor.Name} approved engagement. Min order {vendor.MinOrderAmount:0.##}, delivery charge if below min {vendor.DeliveryChargeBelowMin:0.##}, payment {termsLabel}.");

        return Ok(VendorEngagementService.MapEngagement(vendor));
    }

    [HttpPost("{externalId}/reject-engagement")]
    public async Task<ActionResult<object>> RejectEngagement(
        string externalId,
        [FromBody] RejectVendorEngagementRequest? request)
    {
        var vendor = await db.Vendors.FirstOrDefaultAsync(v => v.ExternalId == externalId);
        if (vendor is null) return NotFound();
        if (!string.Equals(vendor.EngagementStatus, VendorEngagementService.StatusPending, StringComparison.OrdinalIgnoreCase))
            return Conflict(new { message = "No pending engage request for this vendor." });

        vendor.EngagementStatus = VendorEngagementService.StatusRejected;
        vendor.Engaged = false;
        vendor.EngageApprovedAt = DateTime.UtcNow;
        vendor.EngageApprovedBy = request?.RejectedBy?.Trim() ?? string.Empty;
        await db.SaveChangesAsync();

        var reason = string.IsNullOrWhiteSpace(request?.Reason)
            ? "No reason provided."
            : request!.Reason.Trim();
        await UserNotificationService.NotifyEngageRequesterAsync(
            db,
            vendor,
            $"Engage declined · {vendor.Name}",
            $"{vendor.Name} declined the engage request. {reason}");

        return Ok(VendorEngagementService.MapEngagement(vendor));
    }

    static List<VendorContactRequest> SyncDefaultContact(Vendor vendor)
    {
        var contacts = ParseStoredContacts(vendor.ContactsJson);
        var defaultContact = new VendorContactRequest
        {
            Name = vendor.ContactPerson,
            Position = vendor.ContactPosition,
            Mobile = vendor.Mobile,
            Email = vendor.Email,
            IsDefault = true,
        };

        if (contacts.Count == 0)
            return [defaultContact];

        var defaultIndex = contacts.FindIndex(c => c.IsDefault);
        if (defaultIndex < 0) defaultIndex = 0;

        contacts[defaultIndex] = defaultContact;
        for (var i = 0; i < contacts.Count; i++)
            contacts[i].IsDefault = i == defaultIndex;

        return contacts;
    }

    static List<VendorContactRequest> ParseStoredContacts(string? contactsJson)
    {
        if (string.IsNullOrWhiteSpace(contactsJson)) return [];
        try
        {
            return JsonSerializer.Deserialize<List<VendorContactRequest>>(contactsJson, ContactJsonOptions) ?? [];
        }
        catch
        {
            return [];
        }
    }

    static List<VendorContactRequest> NormalizeContacts(IReadOnlyList<VendorContactRequest>? submitted, Vendor vendor)
    {
        var contacts = (submitted ?? [])
            .Select(c => new VendorContactRequest
            {
                Name = c.Name.Trim(),
                Position = c.Position.Trim(),
                Mobile = c.Mobile.Trim(),
                Email = c.Email.Trim(),
                IsDefault = c.IsDefault,
            })
            .Where(c => !string.IsNullOrWhiteSpace(c.Name)
                || !string.IsNullOrWhiteSpace(c.Mobile)
                || !string.IsNullOrWhiteSpace(c.Email))
            .ToList();

        if (contacts.Count == 0)
        {
            contacts.Add(new VendorContactRequest
            {
                Name = vendor.ContactPerson.Trim(),
                Position = vendor.ContactPosition.Trim(),
                Mobile = vendor.Mobile.Trim(),
                Email = vendor.Email.Trim(),
                IsDefault = true,
            });
        }

        if (!contacts.Any(c => c.IsDefault))
            contacts[0].IsDefault = true;
        else
        {
            var firstDefault = contacts.FindIndex(c => c.IsDefault);
            for (var i = 0; i < contacts.Count; i++)
                contacts[i].IsDefault = i == firstDefault;
        }

        return contacts;
    }
}

[ApiController]
[Route("api/[controller]")]
public class IngredientsController(
    BisyncDbContext db,
    ITenantContext tenant,
    SplitUseService splitUse,
    IngredientUsageMetricsService usageMetrics,
    StockCardService stockCardService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> GetAll(
        [FromQuery] int? companyId = null,
        [FromQuery] string? locationIds = null,
        CancellationToken cancellationToken = default)
    {
        var cid = TenantQuery.ResolveCompanyId(tenant, companyId);
        IQueryable<Ingredient> query = db.Ingredients.AsNoTracking();
        if (cid is int id)
            query = query.Where(i => i.CompanyId == id);
        else if (!TenantQuery.AllowsAllCompanies(tenant, cid))
            return Ok(Array.Empty<object>());

        var ingredients = await query.OrderBy(i => i.Name).ToListAsync(cancellationToken);
        if (ingredients.Count == 0)
            return Ok(Array.Empty<object>());

        var locationIdList = (locationIds ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (locationIdList.Count == 0 && cid is int companyForLocs)
        {
            locationIdList = await db.Locations.AsNoTracking()
                .Where(l => l.CompanyId == companyForLocs)
                .Select(l => l.ExternalId)
                .ToListAsync(cancellationToken);
        }

        var metrics = cid is int companyForMetrics
            ? await usageMetrics.ComputeAsync(companyForMetrics, locationIdList, cancellationToken)
            : new IngredientUsageMetricsResult(
                new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase),
                new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase),
                IngredientUsageMetricsService.LookbackDays);

        var onHandByKey = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
        if (locationIdList.Count > 0)
        {
            var stockRows = await stockCardService.ListAsync(
                cid,
                locationIdList,
                "component",
                "recipe",
                period: null,
                cancellationToken);
            foreach (var row in stockRows)
            {
                onHandByKey.TryGetValue(row.ItemKey, out var existing);
                onHandByKey[row.ItemKey] = existing + row.OnHandQty;
            }
        }

        var componentIds = ingredients
            .Select(i => i.ComponentId)
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        var purchasedComponentIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (componentIds.Count > 0)
        {
            IQueryable<InventoryPurchase> purchaseQuery = db.InventoryPurchases.AsNoTracking()
                .Where(p => componentIds.Contains(p.ComponentId));
            if (cid is int purchaseCompanyId)
                purchaseQuery = purchaseQuery.Where(p => p.CompanyId == null || p.CompanyId == purchaseCompanyId);
            var purchased = await purchaseQuery
                .Select(p => p.ComponentId)
                .Distinct()
                .ToListAsync(cancellationToken);
            foreach (var purchasedId in purchased)
                purchasedComponentIds.Add(purchasedId);
        }

        return Ok(ingredients.Select(i =>
        {
            metrics.DailyUsageByComponentId.TryGetValue(i.ComponentId, out var computedUsage);
            metrics.OrderFreqDaysByComponentId.TryGetValue(i.ComponentId, out var computedFreq);
            onHandByKey.TryGetValue(i.ComponentId, out var onHand);
            var dailyUsage = computedUsage > 0 ? computedUsage : i.DailyUsage;
            var orderFreq = computedFreq > 0 ? computedFreq : i.OrderFreqDays;
            var parStock = i.ParStock > 0
                ? i.ParStock
                : (dailyUsage > 0 && orderFreq > 0 ? dailyUsage * orderFreq : 0m);
            var parStockUom = !string.IsNullOrWhiteSpace(i.ParStockUom)
                ? i.ParStockUom
                : i.RecipeUom;

            return new
            {
                i.Id,
                i.CompanyId,
                i.ComponentId,
                i.Name,
                i.Category,
                i.Group,
                i.RecipeUom,
                i.InventoryUom,
                i.LastPriceRecipe,
                i.LastPriceInventory,
                dailyUsage,
                orderFreqDays = orderFreq,
                parStock,
                parStockUom,
                onHandQty = onHand,
                hasPurchaseRecord = purchasedComponentIds.Contains(i.ComponentId),
                metricsLookbackDays = metrics.LookbackDays,
                dailyUsageAuto = computedUsage > 0,
                orderFreqAuto = computedFreq > 0,
                i.StorageJson,
                i.StorageNote,
                i.DetailConfigJson,
                i.AttachedProducts,
                i.AttachedVendors,
                i.Active,
                i.LocationsJson,
                i.CreatedAt,
                i.UpdatedAt,
            };
        }));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<Ingredient>> Update(int id, [FromBody] Ingredient updated)
    {
        var item = await db.Ingredients.FindAsync(id);
        if (item is null) return NotFound();

        var nameError = ComponentIdentityRules.ValidateName(updated.Name);
        if (nameError is not null)
            return BadRequest(new { message = nameError });

        var name = ComponentIdentityRules.NormalizeName(updated.Name);
        var companyId = item.CompanyId ?? TenantQuery.ResolveCompanyId(tenant, updated.CompanyId);
        if (companyId is null)
            return BadRequest(new { message = "Company is required for components." });

        var nameTaken = await db.Ingredients.AnyAsync(i =>
            i.Id != id
            && i.CompanyId == companyId
            && i.Name.ToLower() == name.ToLower());
        if (nameTaken)
            return Conflict(new { message = "A component with this name already exists for this company." });

        item.CompanyId = companyId;
        item.Name = name;
        item.Category = IngredientCatalogNormalizer.NormalizeCategory(updated.Category);
        item.Group = IngredientCatalogNormalizer.NormalizeGroup(updated.Group);
        item.RecipeUom = updated.RecipeUom;
        item.InventoryUom = updated.InventoryUom;
        if (item.Active && !updated.Active)
        {
            var deactivateError = await DeactivationGuardService.ValidateComponentDeactivationAsync(db, item);
            if (deactivateError is not null)
                return Conflict(new { message = deactivateError, code = "component_deactivate_blocked" });
        }
        item.Active = updated.Active;
        item.LastPriceRecipe = updated.LastPriceRecipe;
        item.LastPriceInventory = updated.LastPriceInventory;
        item.StorageJson = updated.StorageJson;
        item.StorageNote = updated.StorageNote ?? string.Empty;
        item.DailyUsage = updated.DailyUsage;
        item.OrderFreqDays = updated.OrderFreqDays;
        item.ParStock = updated.ParStock;
        item.ParStockUom = updated.ParStockUom?.Trim() ?? string.Empty;
        item.AttachedProducts = updated.AttachedProducts;
        item.AttachedVendors = updated.AttachedVendors;
        item.LocationsJson = updated.LocationsJson;
        item.UpdatedAt = DateTime.UtcNow;

        if (!ComponentIdentityRules.IsValidComponentId(item.ComponentId))
        {
            var code = await CompanyCodeService.ResolveCodeAsync(db, companyId.Value);
            item.ComponentId = await ComponentIdGenerator.GenerateAsync(db, code, companyId, item.Id);
        }

        await using var transaction = await db.Database.BeginTransactionAsync();
        try
        {
            item.DetailConfigJson = await splitUse.NormalizeIngredientConfigAsync(
                item,
                companyId.Value,
                updated.DetailConfigJson);
            await db.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        await ProductCostRecalculator.RecalculateForComponentAsync(db, item.ComponentId);
        return Ok(item);
    }

    [HttpPost]
    public async Task<ActionResult<Ingredient>> Create([FromBody] Ingredient ingredient)
    {
        var nameError = ComponentIdentityRules.ValidateName(ingredient.Name);
        if (nameError is not null)
            return BadRequest(new { message = nameError });

        var name = ComponentIdentityRules.NormalizeName(ingredient.Name);
        var companyId = TenantQuery.ResolveCompanyId(tenant, ingredient.CompanyId);
        if (companyId is null)
            return BadRequest(new { message = "Company is required for components." });

        var nameTaken = await db.Ingredients.AnyAsync(i =>
            i.CompanyId == companyId
            && i.Name.ToLower() == name.ToLower());
        if (nameTaken)
            return Conflict(new { message = "A component with this name already exists for this company." });

        var code = await CompanyCodeService.ResolveCodeAsync(db, companyId.Value);
        ingredient.CompanyId = companyId;
        ingredient.Name = name;
        IngredientCatalogNormalizer.ApplyTo(ingredient);
        ingredient.ComponentId = await ComponentIdGenerator.GenerateAsync(db, code, companyId);
        if (string.IsNullOrWhiteSpace(ingredient.ParStockUom))
            ingredient.ParStockUom = ingredient.RecipeUom ?? string.Empty;

        var submittedDetailConfig = ingredient.DetailConfigJson;
        ingredient.DetailConfigJson = "{}";
        ingredient.CreatedAt = DateTime.UtcNow;
        ingredient.UpdatedAt = DateTime.UtcNow;

        await using var transaction = await db.Database.BeginTransactionAsync();
        try
        {
            // Persist the parent first so its ComponentId is reserved before any
            // Split Use child IDs are generated (avoids parent/child ID collisions).
            db.Ingredients.Add(ingredient);
            await db.SaveChangesAsync();

            ingredient.DetailConfigJson = await splitUse.NormalizeIngredientConfigAsync(
                ingredient,
                companyId.Value,
                submittedDetailConfig);
            await db.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        return CreatedAtAction(nameof(GetAll), new { id = ingredient.Id }, ingredient);
    }
}

[ApiController]
[Route("api/[controller]")]
public class PurchaseOrdersController(
    BisyncDbContext db,
    LocationPartitionService locationPartitions,
    SplitUseService splitUse,
    FifoBatchIssueService fifoBatches,
    PreCommittedPoDrawdownService preCommittedDrawdown,
    CreditNoteService creditNotes,
    PurchaseOrderAcceptExpiryService purchaseOrderAcceptExpiry) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> GetAll()
    {
        var orders = await BaseQuery().ToListAsync();
        return Ok(await MapPurchaseOrdersAsync(orders));
    }

    [HttpGet("active")]
    public async Task<ActionResult<IEnumerable<object>>> GetActive([FromQuery] int? companyId)
    {
        // Include Reconciled / Expired so Active Purchase KPIs can bucket PR / accepted / received / reconciled / expired.
        // Commitment Closed masters stay out of this queue.
        await purchaseOrderAcceptExpiry.ExpireOverdueAsync();

        var query = BaseQuery()
            .Where(p => p.Status != PurchaseOrderWorkflow.StatusCommitmentClosed);

        if (companyId is int id)
            query = query.Where(p => p.CompanyId == null || p.CompanyId == id);

        var orderIds = await query.Select(p => p.Id).ToListAsync();
        await PurchaseOrderShareService.BackfillMissingShareTokensAsync(db, orderIds);

        var orders = await BaseQuery()
            .Where(p => orderIds.Contains(p.Id))
            .ToListAsync();
        return Ok(await MapPurchaseOrdersAsync(orders));
    }

    /// <summary>Active pre-committed (blanket) POs available for drawdown / PO Template apply.</summary>
    [HttpGet("committed")]
    public async Task<ActionResult<IEnumerable<object>>> GetCommitted(
        [FromQuery] int? companyId,
        [FromQuery] string? locationExternalIds = null)
    {
        var countryCode = "MY";
        if (companyId is int cid)
        {
            countryCode = await db.Companies.AsNoTracking()
                .Where(c => c.Id == cid)
                .Select(c => c.CountryCode)
                .FirstOrDefaultAsync() ?? "MY";
        }
        var today = OrgClock.TodayLocal(countryCode);
        var query = BaseQuery()
            .Where(p => p.IsPreCommitted && p.Status != PurchaseOrderWorkflow.StatusCommitmentClosed)
            .Where(p =>
                (p.CommitmentStartDate == null || p.CommitmentStartDate <= today)
                && (p.CommitmentEndDate == null || p.CommitmentEndDate >= today));

        if (companyId is int id)
            query = query.Where(p => p.CompanyId == null || p.CompanyId == id);

        var orders = await query.ToListAsync();
        // Only open commitments with remaining qty (tolerate legacy Accepted status until repair runs).
        orders = orders
            .Where(o => PurchaseOrderWorkflow.IsOpenPreCommitmentStatus(o.Status))
            .Where(o => o.Items.Any(i => i.Quantity - i.DrawnQuantity > 0.0001m))
            .ToList();

        var filterLocs = (locationExternalIds ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        if (filterLocs.Count > 0)
        {
            orders = orders
                .Where(o =>
                {
                    var allowed = PurchaseOrderWorkflow.DeserializeLocationIds(o.LocationIdsJson);
                    return allowed.Any(a => filterLocs.Contains(a, StringComparer.OrdinalIgnoreCase));
                })
                .ToList();
        }

        return Ok(await MapPurchaseOrdersAsync(orders));
    }

    /// <summary>
    /// Inbound purchase orders for an online vendor company (shown on Active Sales).
    /// </summary>
    [HttpGet("inbound-sales")]
    public async Task<ActionResult<IEnumerable<object>>> GetInboundSales([FromQuery] int companyId)
    {
        if (companyId <= 0)
            return BadRequest(new { message = "companyId is required." });

        var orders = await OnlineVendorOrderBridge.ListInboundForVendorCompanyAsync(db, companyId);
        return Ok(await MapPurchaseOrdersAsync(orders));
    }

    /// <summary>
    /// In-app vendor approval of an inbound PO (with optional qty/price adjustments).
    /// </summary>
    [HttpPost("{id:int}/vendor-approve")]
    public async Task<ActionResult<object>> VendorApprove(int id, [FromBody] VendorOrderAcceptRequest? request)
    {
        var order = await LoadOrderAsync(id, tracking: true);
        if (order is null) return NotFound();

        if (order.VendorAcceptedAt is not null)
            return Ok(await MapPurchaseOrderAsync(order));

        var vendorApproveCountry = await db.Companies.AsNoTracking()
            .Where(c => c.Id == order.CompanyId)
            .Select(c => c.CountryCode)
            .FirstOrDefaultAsync() ?? "MY";
        var vendorApproveToday = OrgClock.TodayLocal(vendorApproveCountry);
        if (!PurchaseOrderWorkflow.CanVendorAccept(order, vendorApproveToday))
            return Conflict(new { message = "This purchase order can no longer be accepted (vendor accept window expired)." });

        var acceptedBy = request?.AcceptedBy?.Trim();
        if (string.IsNullOrWhiteSpace(acceptedBy))
            acceptedBy = order.VendorName;

        var notes = new List<string>();
        if (request?.Lines is { Count: > 0 })
        {
            var byId = order.Items.ToDictionary(i => i.Id);
            foreach (var patch in request.Lines)
            {
                if (!byId.TryGetValue(patch.Id, out var item)) continue;
                if (patch.Quantity is decimal qty && qty > 0 && qty != item.Quantity)
                {
                    notes.Add($"{item.Name}: qty {item.Quantity:0.####} → {qty:0.####}");
                    item.Quantity = qty;
                }
                if (patch.UnitPrice is decimal price && price >= 0 && price != item.UnitPrice)
                {
                    notes.Add($"{item.Name}: price {item.UnitPrice:0.####} → {price:0.####}");
                    item.UnitPrice = price;
                }
            }
        }

        order.VendorAcceptedAt = DateTime.UtcNow;
        order.VendorAcceptedBy = acceptedBy;
        // Pre-committed masters stay Committed so drawdown matching continues after vendor accept.
        if (!order.IsPreCommitted
            && string.Equals(order.DocumentType, PurchaseOrderWorkflow.DocumentTypePo, StringComparison.OrdinalIgnoreCase)
            && !string.Equals(order.Status, PurchaseOrderWorkflow.StatusReceived, StringComparison.OrdinalIgnoreCase)
            && !string.Equals(order.Status, PurchaseOrderWorkflow.StatusReconciled, StringComparison.OrdinalIgnoreCase))
        {
            order.Status = PurchaseOrderWorkflow.StatusAccepted;
        }

        await db.SaveChangesAsync();

        if (notes.Count > 0)
        {
            await UserNotificationService.NotifyPurchaseOrderAdjustedAsync(
                db,
                order,
                $"Accepted by {acceptedBy} with changes: {string.Join("; ", notes)}");
        }
        else
        {
            await UserNotificationService.NotifyPurchaseOrderAcceptedAsync(db, order);
        }

        var vendor = await OnlineVendorOrderBridge.FindOperatorVendorAsync(db, order);
        if (vendor is not null && VendorEngagementService.IsOnlineVendor(vendor))
        {
            var linkedCompanyId = vendor.LinkedCompanyId
                ?? await VendorEngagementService.ResolveLinkedCompanyIdAsync(db, vendor);
            if (linkedCompanyId is int vendorCompanyId)
            {
                vendor.LinkedCompanyId ??= vendorCompanyId;
                await OnlineVendorOrderBridge.MaterializeSalesSummaryAsync(db, order, vendorCompanyId);
            }
        }

        return Ok(await MapPurchaseOrderAsync(order));
    }

    [HttpPost("{id:int}/ensure-share-token")]
    public async Task<ActionResult<object>> EnsureShareToken(int id)
    {
        var order = await LoadOrderAsync(id, tracking: true);
        if (order is null) return NotFound();

        PurchaseOrderShareService.EnsureShareToken(order);
        await db.SaveChangesAsync();
        return Ok(await MapPurchaseOrderAsync(order));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<object>> GetById(int id)
    {
        await PurchaseOrderShareService.BackfillMissingShareTokensAsync(db, [id]);
        var order = await LoadOrderAsync(id);
        return order is null ? NotFound() : await MapPurchaseOrderAsync(order);
    }

    [HttpPost("batch")]
    public async Task<ActionResult<IEnumerable<object>>> CreateBatch([FromBody] CreatePurchaseOrdersBatchRequest request)
    {
        if (request.Orders is null || request.Orders.Count == 0)
            return BadRequest(new { message = "At least one purchase order is required." });

        await DatabaseSchemaHelper.TryResyncIdentitySequenceAsync(db, "PurchaseOrders");
        await DatabaseSchemaHelper.TryResyncIdentitySequenceAsync(db, "PurchaseOrderItems");

        var existingPoNumbers = await db.PurchaseOrders
            .AsNoTracking()
            .Select(p => p.PoNumber)
            .ToListAsync();
        var reservedPoNumbers = new HashSet<string>(existingPoNumbers, StringComparer.OrdinalIgnoreCase);

        var companyAbbr = "CO";
        var companyCountryCode = "MY";
        if (request.CompanyId is int companyId)
        {
            var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == companyId);
            if (company is not null)
            {
                companyAbbr = PurchaseOrderNumberService.AbbreviateCompanyName(company.Name);
                companyCountryCode = company.CountryCode;
            }
        }

        var locationExternalIds = (request.LocationExternalIds ?? [])
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Select(id => id.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var matchedLocations = locationExternalIds.Count == 0
            ? []
            : await db.Locations
                .AsNoTracking()
                .Where(l => locationExternalIds.Contains(l.ExternalId))
                .ToListAsync();

        var locationAbbr = PurchaseOrderNumberService.ResolveLocationAbbreviation(locationExternalIds, matchedLocations);
        var locationIdsJson = PurchaseOrderWorkflow.SerializeLocationIds(locationExternalIds);
        var deliveryLocationExternalId = (request.DeliveryLocationExternalId ?? string.Empty).Trim();
        if (!string.IsNullOrWhiteSpace(deliveryLocationExternalId))
        {
            var deliveryLoc = await db.DeliveryLocations.AsNoTracking()
                .FirstOrDefaultAsync(d => d.ExternalId == deliveryLocationExternalId && d.Active);
            if (deliveryLoc is null)
                return BadRequest(new { message = "Selected delivery location was not found." });
            if (locationExternalIds.Count > 0
                && !locationExternalIds.Contains(deliveryLoc.LocationExternalId, StringComparer.OrdinalIgnoreCase))
            {
                return BadRequest(new { message = "Delivery location must belong to one of the selected outlets." });
            }
            if (request.CompanyId is int batchCompanyId
                && deliveryLoc.CompanyId is int deliveryCompanyId
                && deliveryCompanyId != batchCompanyId)
            {
                return BadRequest(new { message = "Delivery location does not belong to the selected company." });
            }
        }
        var initiatedBy = request.InitiatedBy?.Trim() ?? string.Empty;
        var approvedBy = request.ApprovedBy?.Trim() ?? string.Empty;
        var primaryLocationState = matchedLocations
            .OrderBy(l => locationExternalIds.FindIndex(id => string.Equals(id, l.ExternalId, StringComparison.OrdinalIgnoreCase)))
            .Select(l => l.StateProvince)
            .FirstOrDefault();
        var localToday = OrgClock.TodayLocal(companyCountryCode, primaryLocationState);

        var created = new List<PurchaseOrder>();
        foreach (var orderRequest in request.Orders)
        {
            var vendorName = orderRequest.VendorName.Trim();
            if (string.IsNullOrWhiteSpace(vendorName))
                return BadRequest(new { message = "Vendor name is required for each purchase order." });

            var items = PurchaseOrderWorkflow.CombineReturnableDepositItems(
                (orderRequest.Items ?? [])
                    .Where(i => !string.IsNullOrWhiteSpace(i.Name) && i.Quantity > 0)
                    .Select(i => new PurchaseOrderItem
                    {
                        ComponentId = i.ComponentId?.Trim() ?? string.Empty,
                        ComponentName = string.IsNullOrWhiteSpace(i.ComponentName) ? i.Name.Trim() : i.ComponentName.Trim(),
                        VendorProductId = i.VendorProductId?.Trim() ?? string.Empty,
                        Name = i.Name.Trim(),
                        Quantity = i.Quantity,
                        UnitPrice = i.UnitPrice,
                        IssuedUnitPrice = i.UnitPrice,
                        Unit = i.Unit.Trim(),
                        ComponentUom = i.ComponentUom?.Trim() ?? i.Unit.Trim(),
                        DeliveryPackage = i.DeliveryPackage.Trim(),
                        IsReturnableDeposit = i.IsReturnableDeposit,
                        ReturnableItemName = i.IsReturnableDeposit
                            ? (string.IsNullOrWhiteSpace(i.ReturnableItemName) ? i.Name.Trim() : i.ReturnableItemName.Trim())
                            : string.Empty,
                    }));

            if (items.Count == 0)
                return BadRequest(new { message = $"Purchase order for {vendorName} has no valid items." });

            var orderDate = orderRequest.OrderDate ?? localToday;
            var poNumber = string.IsNullOrWhiteSpace(orderRequest.PoNumber)
                ? PurchaseOrderNumberService.ReserveNextPoNumber(reservedPoNumbers, companyAbbr, locationAbbr, orderDate)
                : orderRequest.PoNumber.Trim();

            if (!reservedPoNumbers.Add(poNumber))
                return Conflict(new { message = $"Purchase order number {poNumber} already exists." });

            var isPreCommitted = orderRequest.IsPreCommitted;
            if (isPreCommitted)
            {
                if (request.CompanyId is null or <= 0)
                    return BadRequest(new { message = "Company is required for Pre-committed POs (company-level commitment)." });
                if (locationExternalIds.Count == 0)
                    return BadRequest(new { message = "Select at least one location that may draw down this Pre-committed PO." });
                if (orderRequest.CommitmentStartDate is null || orderRequest.CommitmentEndDate is null)
                    return BadRequest(new { message = "Commitment Date from and to are required for Pre-committed POs." });
                if (orderRequest.CommitmentEndDate < orderRequest.CommitmentStartDate)
                    return BadRequest(new { message = "Commitment end date must be on or after the start date." });
            }

            var documentType = isPreCommitted
                ? PurchaseOrderWorkflow.DocumentTypePo
                : PurchaseOrderWorkflow.ResolveDocumentType(orderRequest.DocumentType, orderRequest.Status);
            var status = isPreCommitted
                ? PurchaseOrderWorkflow.StatusCommitted
                : PurchaseOrderWorkflow.ResolveStatus(documentType, orderRequest.Status);

            var order = new PurchaseOrder
            {
                PoNumber = poNumber,
                VendorName = vendorName,
                VendorExternalId = orderRequest.VendorExternalId?.Trim() ?? string.Empty,
                OrderDate = orderDate,
                DeliveryDate = isPreCommitted
                    ? (orderRequest.CommitmentEndDate ?? orderRequest.DeliveryDate ?? localToday.AddDays(3))
                    : (orderRequest.DeliveryDate ?? localToday.AddDays(3)),
                DocumentType = documentType,
                Status = status,
                CompanyId = request.CompanyId,
                LocationIdsJson = locationIdsJson,
                DeliveryLocationExternalId = deliveryLocationExternalId,
                InitiatedBy = initiatedBy,
                ApprovedBy = approvedBy,
                ApprovedAt = documentType == PurchaseOrderWorkflow.DocumentTypePo
                    && !isPreCommitted
                    && !string.IsNullOrWhiteSpace(approvedBy)
                    && !string.Equals(approvedBy, "Pending", StringComparison.OrdinalIgnoreCase)
                    ? DateTime.UtcNow
                    : null,
                VendorShareToken = Guid.NewGuid().ToString("N"),
                IsPreCommitted = isPreCommitted,
                CommitmentStartDate = isPreCommitted ? orderRequest.CommitmentStartDate : null,
                CommitmentEndDate = isPreCommitted ? orderRequest.CommitmentEndDate : null,
                SourceCommittedPurchaseOrderId = isPreCommitted ? null : orderRequest.SourceCommittedPurchaseOrderId,
            };

            if (PurchaseOrderWorkflow.NeedsVendorAcceptWindow(order))
                PurchaseOrderWorkflow.AssignVendorAcceptExpiry(order, orderDate);

            foreach (var item in items)
                order.Items.Add(item);

            db.PurchaseOrders.Add(order);
            created.Add(order);
        }

        await db.SaveChangesAsync();

        // Release orders (non-committed) draw down matching pre-committed blanket qty/price.
        var releaseOrders = created.Where(o => !o.IsPreCommitted).ToList();
        if (releaseOrders.Count > 0)
            await preCommittedDrawdown.ApplyDrawdownsAsync(releaseOrders);

        var ids = created.Select(c => c.Id).ToList();
        await PurchaseOrderShareService.BackfillMissingShareTokensAsync(db, ids);

        var saved = await BaseQuery()
            .Where(p => ids.Contains(p.Id))
            .ToListAsync();

        foreach (var order in saved)
        {
            // Notify online vendors only for issued release POs (not pending PR / not pre-committed masters).
            if (!order.IsPreCommitted && !PurchaseOrderWorkflow.IsPendingApprovalStatus(order.Status))
                await OnlineVendorOrderBridge.NotifyOnlineVendorOfPurchaseOrderAsync(db, order);
        }

        return Ok(await MapPurchaseOrdersAsync(saved));
    }

    [HttpPost("{id:int}/approve")]
    public async Task<ActionResult<object>> Approve(int id, [FromBody] ApprovePurchaseOrderRequest? request)
    {
        var order = await LoadOrderAsync(id, tracking: true);
        if (order is null) return NotFound();
        if (!PurchaseOrderWorkflow.CanApprove(order))
            return Conflict(new { message = "Only pending purchase requests can be approved." });

        order.DocumentType = PurchaseOrderWorkflow.DocumentTypePo;
        order.Status = PurchaseOrderWorkflow.StatusOpen;
        order.ApprovedBy = string.IsNullOrWhiteSpace(request?.ApprovedBy) ? "Approved" : request.ApprovedBy.Trim();
        order.ApprovedAt = DateTime.UtcNow;

        var approveCountry = await db.Companies.AsNoTracking()
            .Where(c => c.Id == order.CompanyId)
            .Select(c => c.CountryCode)
            .FirstOrDefaultAsync() ?? "MY";
        PurchaseOrderWorkflow.AssignVendorAcceptExpiry(order, OrgClock.TodayLocal(approveCountry));

        await db.SaveChangesAsync();
        await UserNotificationService.NotifyPurchaseRequestApprovedAsync(db, order, order.ApprovedBy);
        await OnlineVendorOrderBridge.NotifyOnlineVendorOfPurchaseOrderAsync(db, order);

        return Ok(await MapPurchaseOrderAsync(order));
    }

    [HttpPost("{id:int}/receive")]
    public async Task<ActionResult<object>> Receive(int id, [FromBody] PurchaseOrderWorkflowRequest request)
    {
        var order = await LoadOrderAsync(id, tracking: true);
        if (order is null) return NotFound();
        var allowPartial = await ResolveAllowPartialAsync(order);
        if (!PurchaseOrderWorkflow.CanReceive(order, allowPartial))
            return Conflict(new { message = "Only open (or partially delivered) purchase orders can be received." });

        if (request.Items is null || request.Items.Count == 0)
            return BadRequest(new { message = "At least one line item is required to receive." });

        var vendorDoNumber = request.VendorDoNumber?.Trim() ?? string.Empty;
        var vendorInvoiceNumber = request.VendorInvoiceNumber?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(vendorDoNumber) && string.IsNullOrWhiteSpace(vendorInvoiceNumber))
            return BadRequest(new { message = "Enter a Vendor DO number and/or Vendor Invoice number for the documents received." });

        foreach (var line in request.Items)
        {
            var expiry = line.ProductExpiryDate?.Trim() ?? string.Empty;
            if (!string.IsNullOrWhiteSpace(expiry) && !DateOnly.TryParse(expiry, out _))
                return BadRequest(new { message = "Product expiry date must be a valid calendar date (yyyy-MM-dd)." });
        }

        // Vendor rating (product quality / hygiene) is optional on receive.
        var quality = VendorRatingRules.NormalizeCustomerLevel(request.ProductQualityRating);
        var hygiene = VendorRatingRules.NormalizeCustomerLevel(request.HygieneRating);
        if (!string.IsNullOrWhiteSpace(request.ProductQualityRating) && quality is null)
            return BadRequest(new { message = "Product quality rating must be Satisfied, Acceptable, or Poor." });
        if (!string.IsNullOrWhiteSpace(request.HygieneRating) && hygiene is null)
            return BadRequest(new { message = "Hygiene & cleanliness rating must be Satisfied, Acceptable, or Poor." });

        foreach (var line in request.Items.Where(l => l.ItemId <= 0))
        {
            if (string.IsNullOrWhiteSpace(line.VendorProductId))
                return BadRequest(new { message = "Unordered receive lines require a Vendor Product ID." });
            if (string.IsNullOrWhiteSpace(line.ComponentId))
                return BadRequest(new { message = "Unordered receive lines require a component id." });
            if (string.IsNullOrWhiteSpace(line.Name))
                return BadRequest(new { message = "Unordered receive lines require a product name." });
            if (line.Quantity <= 0)
                return BadRequest(new { message = "Unordered receive lines (freebies / replacements) must have quantity greater than zero." });
        }

        if (allowPartial)
        {
            foreach (var line in request.Items.Where(l => l.ItemId > 0))
            {
                var item = order.Items.FirstOrDefault(i => i.Id == line.ItemId);
                if (item is null) continue;
                var remaining = Math.Max(0m, item.Quantity - item.DeliveredQuantity);
                if (line.Quantity > remaining + 0.0001m)
                    return BadRequest(new
                    {
                        message = $"Received qty for '{item.Name}' cannot exceed remaining {remaining:0.####}."
                    });
            }
        }

        var linkedCnLines = request.Items.Where(l => l.LinkedCreditNoteId is > 0).ToList();
        if (linkedCnLines.Count > 0)
        {
            if (linkedCnLines.Any(l => l.ItemId > 0))
            {
                return BadRequest(new
                {
                    message = "Credit notes can only be linked on additional (unordered) receive lines."
                });
            }

            var duplicateCn = linkedCnLines
                .GroupBy(l => l.LinkedCreditNoteId!.Value)
                .FirstOrDefault(g => g.Count() > 1);
            if (duplicateCn is not null)
            {
                return BadRequest(new
                {
                    message = $"Credit note #{duplicateCn.Key} is linked on more than one receive line."
                });
            }

            var companyIdForCn = order.CompanyId ?? 0;
            if (companyIdForCn <= 0)
                return BadRequest(new { message = "Purchase order has no company — cannot settle credit notes." });

            foreach (var line in linkedCnLines)
            {
                try
                {
                    await creditNotes.ValidateLinkedCreditNoteForReceiveAsync(
                        line.LinkedCreditNoteId!.Value,
                        companyIdForCn,
                        line.VendorProductId ?? string.Empty);
                }
                catch (InvalidOperationException ex)
                {
                    return BadRequest(new { message = ex.Message });
                }
            }
        }

        await using var transaction = await db.Database.BeginTransactionAsync();
        try
        {
            var unorderedError = await EnsureUnorderedReceiveLinesAsync(order, request.Items);
            if (unorderedError is not null)
            {
                await transaction.RollbackAsync();
                return BadRequest(new { message = unorderedError });
            }

            ApplyWorkflowLines(order, request.Items, workflow: "receive");
            order.VendorDoNumber = vendorDoNumber;
            order.VendorInvoiceNumber = vendorInvoiceNumber;
            order.ProductQualityRating = quality ?? string.Empty;
            order.HygieneRating = hygiene ?? string.Empty;
            order.ProductQualityComment = request.ProductQualityComment?.Trim() ?? string.Empty;
            order.HygieneComment = request.HygieneComment?.Trim() ?? string.Empty;
            order.Status = PurchaseOrderWorkflow.StatusReceived;
            order.ReceivedAt = DateTime.UtcNow;

            var locationIds = PurchaseOrderWorkflow.DeserializeLocationIds(order.LocationIdsJson);
            var locationIdsJson = locationIds.Count > 0
                ? order.LocationIdsJson
                : PurchaseOrderWorkflow.SerializeLocationIds(locationIds);
            // Keep original casing from the PO so stock-card location filters match ingredient/purchase ids.
            var locationExternalId = locationIds.Count > 0
                ? locationIds[0].Trim()
                : string.Empty;

            if (!string.IsNullOrEmpty(locationExternalId))
                await locationPartitions.EnsurePartitionsForLocationAsync(locationExternalId);

            var receiptCreatedAt = DateTime.UtcNow;
            var postError = await PostReceivedStockAsync(
                order,
                request.Items,
                allowPartial,
                locationIdsJson,
                locationExternalId,
                receiptCreatedAt,
                remarks: PurchaseOrderWorkflow.StockRemarkReceivedPending);
            if (postError is not null)
            {
                await transaction.RollbackAsync();
                return BadRequest(new { message = postError });
            }

            // Ensure drawdown progress can see receive qty even if a path skipped DeliveredQuantity bump.
            foreach (var item in order.Items)
            {
                if (item.DeliveredQuantity > 0.0001m) continue;
                if (item.ReceivedQuantity is decimal received && received > 0.0001m)
                    item.DeliveredQuantity = DecimalRounding.ToDb(received);
            }

            await db.SaveChangesAsync();

            var receiptPurchases = await db.InventoryPurchases
                .Where(p => p.PurchaseOrderId == order.Id && p.DateCreatedInStock == receiptCreatedAt)
                .ToListAsync();

            // A whole receive must not land as Received with missing stock rows — that is how
            // purchased lines go missing from Stock Card while CN outbound can still post.
            var expectedStockItemIds = request.Items
                .Where(l => l.Quantity > 0)
                .Select(l => order.Items.FirstOrDefault(i => i.Id == l.ItemId))
                .Where(i => i is not null
                    && !i!.IsReturnableDeposit
                    && !string.IsNullOrWhiteSpace(i.ComponentId))
                .Select(i => i!.Id)
                .Distinct()
                .ToList();
            var postedItemIds = receiptPurchases
                .Where(p => p.PurchaseOrderItemId > 0)
                .Select(p => p.PurchaseOrderItemId)
                .ToHashSet();
            var missingStockLines = expectedStockItemIds.Count(id => !postedItemIds.Contains(id));
            if (expectedStockItemIds.Count > 0 && (receiptPurchases.Count == 0 || missingStockLines > 0))
            {
                await transaction.RollbackAsync();
                return BadRequest(new
                {
                    message = missingStockLines > 0 && receiptPurchases.Count > 0
                        ? $"Receive posted stock for only {postedItemIds.Count} of {expectedStockItemIds.Count} delivered line(s). Check component IDs / delivery units and try again."
                        : "Receive did not post any stock for the delivered lines. Check component IDs on each PO line and try again.",
                });
            }

            foreach (var purchase in receiptPurchases)
                await fifoBatches.RecordReceiptFromPurchaseAsync(purchase);

            // Settle linked credit notes against freebie / replacement lines on this receive.
            var companyId = order.CompanyId ?? 0;
            if (companyId > 0)
            {
                foreach (var line in request.Items.Where(l => l.LinkedCreditNoteId is > 0).OrderBy(l => l.ItemId))
                {
                    var item = order.Items.FirstOrDefault(i => i.Id == line.ItemId);
                    var vendorProductId = !string.IsNullOrWhiteSpace(line.VendorProductId)
                        ? line.VendorProductId
                        : item?.VendorProductId;
                    try
                    {
                        await creditNotes.SettleAgainstReplacementReceiveAsync(
                            line.LinkedCreditNoteId!.Value,
                            companyId,
                            order,
                            vendorProductId ?? string.Empty,
                            line.Quantity,
                            cancelledBy: null,
                            replacementPurchaseOrderItemId: line.ItemId > 0 ? line.ItemId : item?.Id);
                    }
                    catch (InvalidOperationException ex)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(new { message = ex.Message });
                    }
                }
            }

            await transaction.CommitAsync();
            return Ok(await MapPurchaseOrderAsync(order, allowPartial));
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    [HttpPost("{id:int}/reconcile")]
    public async Task<ActionResult<object>> Reconcile(int id, [FromBody] PurchaseOrderWorkflowRequest request)
    {
        var order = await LoadOrderAsync(id, tracking: true);
        if (order is null) return NotFound();
        if (!PurchaseOrderWorkflow.CanReconcile(order))
            return Conflict(new { message = "Only received purchase orders can be reconciled." });

        if (request.Items is null || request.Items.Count == 0)
            return BadRequest(new { message = "At least one line item is required to reconcile." });

        var allowPartial = await ResolveAllowPartialAsync(order);

        // Quality/hygiene are optional; update at consolidate when provided, otherwise keep receive values.
        var quality = VendorRatingRules.NormalizeCustomerLevel(request.ProductQualityRating);
        var hygiene = VendorRatingRules.NormalizeCustomerLevel(request.HygieneRating);
        if (!string.IsNullOrWhiteSpace(request.ProductQualityRating) && quality is null)
            return BadRequest(new { message = "Product quality rating must be Satisfied, Acceptable, or Poor." });
        if (!string.IsNullOrWhiteSpace(request.HygieneRating) && hygiene is null)
            return BadRequest(new { message = "Hygiene & cleanliness rating must be Satisfied, Acceptable, or Poor." });

        await using var transaction = await db.Database.BeginTransactionAsync();
        ApplyWorkflowLines(order, request.Items, workflow: "reconcile");
        // null = omitted (keep prior); "" / valid level = update (optional rating may be cleared).
        if (request.ProductQualityRating is not null)
            order.ProductQualityRating = quality ?? string.Empty;
        if (request.HygieneRating is not null)
            order.HygieneRating = hygiene ?? string.Empty;
        if (request.ProductQualityComment is not null)
            order.ProductQualityComment = request.ProductQualityComment.Trim();
        if (request.HygieneComment is not null)
            order.HygieneComment = request.HygieneComment.Trim();

        var updatedVendorProductPrices = await VendorProductPriceService.ApplyReconciledPricesAsync(
            db, order.Items, order.Id);

        // Accounting affirmation: clear "received" remarks on stock already posted at receive.
        // Legacy POs received before this policy may have no pending stock — post without remarks.
        var pendingPurchases = await db.InventoryPurchases
            .Where(p => p.PurchaseOrderId == order.Id
                && p.Remarks == PurchaseOrderWorkflow.StockRemarkReceivedPending)
            .ToListAsync();

        if (pendingPurchases.Count > 0)
        {
            foreach (var line in request.Items)
            {
                var item = order.Items.FirstOrDefault(i => i.Id == line.ItemId);
                if (item is null) continue;
                var price = item.ReconciledUnitPrice ?? line.UnitPrice;
                // Ops already posted on-hand at receive; consolidation affirms accounting cost only.
                item.ReconciledQuantity = item.DeliveredQuantity;

                var itemPending = pendingPurchases
                    .Where(p => p.PurchaseOrderItemId == item.Id)
                    .ToList();
                if (itemPending.Count == 0) continue;

                foreach (var purchase in itemPending)
                {
                    if (!item.IsReturnableDeposit && price > 0)
                        purchase.UnitPrice = price;
                    purchase.Remarks = string.Empty;
                }
            }

            foreach (var purchase in pendingPurchases)
                await fifoBatches.UpdateBatchUnitCostFromPurchaseAsync(purchase);
        }
        else
        {
            // Legacy path: stock was not posted at receive — post now as consolidated (no pending remarks).
            var locationIds = PurchaseOrderWorkflow.DeserializeLocationIds(order.LocationIdsJson);
            var locationIdsJson = locationIds.Count > 0
                ? order.LocationIdsJson
                : PurchaseOrderWorkflow.SerializeLocationIds(locationIds);
            var locationExternalId = locationIds.Count > 0
                ? locationIds[0].Trim()
                : string.Empty;

            if (!string.IsNullOrEmpty(locationExternalId))
                await locationPartitions.EnsurePartitionsForLocationAsync(locationExternalId);

            var receiptCreatedAt = DateTime.UtcNow;
            var postError = await PostReceivedStockAsync(
                order,
                request.Items,
                allowPartial,
                locationIdsJson,
                locationExternalId,
                receiptCreatedAt,
                remarks: string.Empty,
                bumpDeliveredQuantity: true);
            if (postError is not null)
                return BadRequest(new { message = postError });

            await db.SaveChangesAsync();
            var receiptPurchases = await db.InventoryPurchases
                .Where(p => p.PurchaseOrderId == order.Id && p.DateCreatedInStock == receiptCreatedAt)
                .ToListAsync();

            var expectedStockItemIds = request.Items
                .Where(l => l.Quantity > 0)
                .Select(l => order.Items.FirstOrDefault(i => i.Id == l.ItemId))
                .Where(i => i is not null
                    && !i!.IsReturnableDeposit
                    && !string.IsNullOrWhiteSpace(i.ComponentId))
                .Select(i => i!.Id)
                .Distinct()
                .ToList();
            var postedItemIds = receiptPurchases
                .Where(p => p.PurchaseOrderItemId > 0)
                .Select(p => p.PurchaseOrderItemId)
                .ToHashSet();
            if (expectedStockItemIds.Count > 0
                && (receiptPurchases.Count == 0
                    || expectedStockItemIds.Any(id => !postedItemIds.Contains(id))))
            {
                await transaction.RollbackAsync();
                return BadRequest(new
                {
                    message = "Reconcile did not post stock for every delivered line. Check component IDs / delivery units and try again.",
                });
            }

            foreach (var purchase in receiptPurchases)
                await fifoBatches.RecordReceiptFromPurchaseAsync(purchase);
        }

        if (allowPartial)
        {
            // Stay active until Final delivery completed — rating not applied yet.
            order.Status = PurchaseOrderWorkflow.StatusPartiallyDelivered;
            order.ReconciledAt = null;
        }
        else
        {
            order.Status = PurchaseOrderWorkflow.StatusReconciled;
            order.ReconciledAt = DateTime.UtcNow;
            order.FinalDeliveryCompletedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return Ok(new
        {
            order = await MapPurchaseOrderAsync(order, allowPartial),
            updatedVendorProductPrices,
        });
    }

    /// <summary>
    /// Posts inbound stock for a receive (or legacy consolidate) shipment.
    /// When <paramref name="remarks"/> is the pending-consolidation remark, ops on-hand is visible on the stock card until accounting consolidates.
    /// </summary>
    async Task<string?> PostReceivedStockAsync(
        PurchaseOrder order,
        List<PurchaseOrderLineWorkflowRequest> lines,
        bool allowPartial,
        string locationIdsJson,
        string locationExternalId,
        DateTime receiptCreatedAt,
        string remarks,
        bool bumpDeliveredQuantity = true)
    {
        foreach (var line in lines)
        {
            var item = order.Items.FirstOrDefault(i => i.Id == line.ItemId);
            if (item is null)
            {
                if (line.ItemId > 0)
                    return $"Receive line item #{line.ItemId} was not found on this purchase order.";
                continue;
            }

            var shipmentQty = line.Quantity;
            if (bumpDeliveredQuantity)
            {
                if (allowPartial)
                {
                    // Unordered freebie / CN-replacement lines have ordered qty 0 — no remaining cap.
                    if (item.Quantity > 0)
                    {
                        var remaining = Math.Max(0m, item.Quantity - item.DeliveredQuantity);
                        if (shipmentQty > remaining + 0.0001m)
                            return $"Received qty for '{item.Name}' cannot exceed remaining {remaining:0.####}.";
                    }
                    item.DeliveredQuantity = DecimalRounding.ToDb(item.DeliveredQuantity + Math.Max(0m, shipmentQty));
                }
                else
                {
                    item.DeliveredQuantity = DecimalRounding.ToDb(Math.Max(0m, shipmentQty));
                }
            }

            var qty = shipmentQty;
            var price = item.ReceivedUnitPrice ?? item.ReconciledUnitPrice ?? line.UnitPrice;
            if (qty <= 0) continue;
            if (item.IsReturnableDeposit) continue;
            if (string.IsNullOrWhiteSpace(item.ComponentId))
                return $"Cannot post stock for '{item.Name}' — component id is missing on the PO line.";

            var uom = string.IsNullOrWhiteSpace(line.ComponentUom)
                ? (string.IsNullOrWhiteSpace(item.ComponentUom) ? item.Unit : item.ComponentUom)
                : line.ComponentUom.Trim();

            var parent = await db.Ingredients.FirstOrDefaultAsync(ingredient =>
                ingredient.ComponentId == item.ComponentId
                && (order.CompanyId == null
                    || ingredient.CompanyId == null
                    || ingredient.CompanyId == order.CompanyId));

            // Step 1: delivery packages → Principal Component qty + unit price
            // (PO line amount ÷ total principal qty, 4dp). Store UOM rounding residual.
            // Quantity is always delivery packages; ComponentUom may be mislabeled as RecipeUom.
            decimal documentAmount = 0m;
            decimal roundingResidual = 0m;
            if (parent is not null)
            {
                var deliveryBasis = string.IsNullOrWhiteSpace(item.Unit)
                    ? item.DeliveryPackage
                    : item.Unit;
                var vendorProductId = (item.VendorProductId ?? string.Empty).Trim();
                var (pathPrincipal, pathPrincipalUom) = await DeliveryPrincipalResolver.ResolvePathPrincipalAsync(
                    db,
                    parent,
                    vendorProductId,
                    deliveryBasis);

                // Prefer delivery UOM as the quantity basis so recipe-labeled ComponentUom
                // cannot short-circuit conversion when packages still need × principal.
                var qtyBasisUom = !string.IsNullOrWhiteSpace(deliveryBasis) ? deliveryBasis : uom;
                var inbound = IngredientUomBridge.ToInboundPrincipal(
                    parent,
                    qty,
                    qtyBasisUom,
                    price,
                    vendorProductId,
                    deliveryBasis,
                    pathPrincipal,
                    pathPrincipalUom);
                qty = inbound.Quantity;
                uom = inbound.Uom;
                price = inbound.UnitPrice;
                documentAmount = inbound.DocumentAmount;
                roundingResidual = inbound.RoundingResidual;
            }
            else
            {
                documentAmount = DecimalRounding.ToDb(shipmentQty * (item.ReceivedUnitPrice ?? item.ReconciledUnitPrice ?? line.UnitPrice));
            }

            try
            {
                if (parent is not null && splitUse.ReadConfig(parent) is not null)
                {
                    await splitUse.PostInboundAsync(
                        parent,
                        qty,
                        uom,
                        price,
                        order.OrderDate,
                        receiptCreatedAt,
                        order.Id,
                        item.Id,
                        order.CompanyId,
                        string.IsNullOrWhiteSpace(locationIdsJson)
                            ? PurchaseOrderWorkflow.SerializeLocationIds(
                                string.IsNullOrEmpty(locationExternalId) ? [] : [locationExternalId])
                            : locationIdsJson,
                        locationExternalId,
                        "purchase-order",
                        item.Id,
                        remarks,
                        documentAmount,
                        roundingResidual);
                    continue;
                }

                db.InventoryPurchases.Add(new InventoryPurchase
                {
                    ComponentId = item.ComponentId,
                    ComponentName = string.IsNullOrWhiteSpace(item.ComponentName) ? item.Name : item.ComponentName,
                    Quantity = qty,
                    Uom = uom,
                    UnitPrice = price,
                    DocumentAmount = documentAmount,
                    RoundingResidual = roundingResidual,
                    DateOrdered = order.OrderDate,
                    DateCreatedInStock = receiptCreatedAt,
                    PurchaseOrderId = order.Id,
                    PurchaseOrderItemId = item.Id,
                    ProductExpiryDate = (item.ProductExpiryDate ?? string.Empty).Trim(),
                    Remarks = remarks ?? string.Empty,
                    CompanyId = order.CompanyId,
                    LocationIdsJson = string.IsNullOrWhiteSpace(locationIdsJson)
                        ? PurchaseOrderWorkflow.SerializeLocationIds(
                            string.IsNullOrEmpty(locationExternalId) ? [] : [locationExternalId])
                        : locationIdsJson,
                    LocationExternalId = locationExternalId,
                });
            }
            catch (InvalidOperationException ex)
            {
                return ex.Message;
            }
        }

        return null;
    }

    /// <summary>
    /// Closes a partially delivered PO. Delivery rating uses final delivered qty/price vs issued PO.
    /// </summary>
    [HttpPost("{id:int}/finalize-delivery")]
    public async Task<ActionResult<object>> FinalizeDelivery(int id)
    {
        var order = await LoadOrderAsync(id, tracking: true);
        if (order is null) return NotFound();
        var allowPartial = await ResolveAllowPartialAsync(order);
        if (!PurchaseOrderWorkflow.CanFinalizeDelivery(order, allowPartial))
            return Conflict(new { message = "Only partially delivered purchase orders can be finalized." });

        order.Status = PurchaseOrderWorkflow.StatusReconciled;
        order.ReconciledAt = DateTime.UtcNow;
        order.FinalDeliveryCompletedAt = DateTime.UtcNow;
        foreach (var item in order.Items)
        {
            // Final snapshot for rating: cumulative delivered vs issued.
            item.ReconciledQuantity = item.DeliveredQuantity;
            if (item.ReconciledUnitPrice is null)
                item.ReconciledUnitPrice = item.ReceivedUnitPrice ?? item.UnitPrice;
        }

        await db.SaveChangesAsync();
        return Ok(await MapPurchaseOrderAsync(order, allowPartial));
    }

    /// <summary>
    /// Correct a Received or Reconciled PO without changing status.
    /// Rewrites linked InventoryPurchases + FIFO batches to match amended delivery qty/price.
    /// </summary>
    [HttpPost("{id:int}/amend")]
    public async Task<ActionResult<object>> Amend(int id, [FromBody] PurchaseOrderWorkflowRequest request)
    {
        var order = await LoadOrderAsync(id, tracking: true);
        if (order is null) return NotFound();

        var phase = (request.Phase ?? string.Empty).Trim().ToLowerInvariant();
        var isReceivedPhase = phase is "received" or "receive";
        var isReconciledPhase = phase is "reconciled" or "reconcile";
        if (!isReceivedPhase && !isReconciledPhase)
            return BadRequest(new { message = "Amend phase must be 'received' or 'reconciled'." });

        if (isReceivedPhase && !PurchaseOrderWorkflow.CanAmendReceived(order))
            return Conflict(new { message = "Only Received / Partially Delivered purchase orders can be amended in the received phase." });
        if (isReconciledPhase && !PurchaseOrderWorkflow.CanAmendReconciled(order))
            return Conflict(new { message = "Only Reconciled purchase orders can be amended in the reconciled phase." });

        if (request.Items is null || request.Items.Count == 0)
            return BadRequest(new { message = "At least one line is required to amend." });
        if (request.Items.Any(l => l.ItemId <= 0))
            return BadRequest(new { message = "Amend cannot add new unordered lines. Correct existing lines only." });
        if (request.Items.Any(l => l.Quantity < 0))
            return BadRequest(new { message = "Amended quantity cannot be negative." });

        var allowPartial = await ResolveAllowPartialAsync(order);
        await using var transaction = await db.Database.BeginTransactionAsync();
        try
        {
            ApplyWorkflowLines(
                order,
                request.Items,
                workflow: isReceivedPhase ? "receive" : "reconcile");

            if (isReconciledPhase)
            {
                // Keep received snapshot aligned with the corrected consolidated truth.
                foreach (var line in request.Items)
                {
                    var item = order.Items.FirstOrDefault(i => i.Id == line.ItemId);
                    if (item is null) continue;
                    item.ReceivedQuantity = line.Quantity;
                    item.ReceivedUnitPrice = line.UnitPrice;
                    if (!allowPartial)
                        item.DeliveredQuantity = DecimalRounding.ToDb(line.Quantity);
                }
            }
            else if (!allowPartial)
            {
                foreach (var line in request.Items)
                {
                    var item = order.Items.FirstOrDefault(i => i.Id == line.ItemId);
                    if (item is null) continue;
                    item.DeliveredQuantity = DecimalRounding.ToDb(line.Quantity);
                }
            }

            if (request.VendorDoNumber is not null)
                order.VendorDoNumber = request.VendorDoNumber.Trim();
            if (request.VendorInvoiceNumber is not null)
                order.VendorInvoiceNumber = request.VendorInvoiceNumber.Trim();
            if (request.ProductQualityRating is not null)
                order.ProductQualityRating = request.ProductQualityRating.Trim();
            if (request.ProductQualityComment is not null)
                order.ProductQualityComment = request.ProductQualityComment.Trim();
            if (request.HygieneRating is not null)
                order.HygieneRating = request.HygieneRating.Trim();
            if (request.HygieneComment is not null)
                order.HygieneComment = request.HygieneComment.Trim();

            var stockError = await RewriteAmendedStockAsync(order, request.Items, isReconciledPhase);
            if (stockError is not null)
            {
                await transaction.RollbackAsync();
                return BadRequest(new { message = stockError });
            }

            await db.SaveChangesAsync();

            List<object>? updatedVendorProductPrices = null;
            if (isReconciledPhase)
            {
                updatedVendorProductPrices = await VendorProductPriceService.ApplyReconciledPricesAsync(
                    db, order.Items, order.Id);
                await db.SaveChangesAsync();
            }

            await transaction.CommitAsync();
            var mapped = await MapPurchaseOrderAsync(order, allowPartial);
            return Ok(new { order = mapped, updatedVendorProductPrices, phase });
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    /// <summary>
    /// Recompute principal qty/price on InventoryPurchases for amended delivery packages.
    /// </summary>
    async Task<string?> RewriteAmendedStockAsync(
        PurchaseOrder order,
        List<PurchaseOrderLineWorkflowRequest> lines,
        bool reconciledPhase)
    {
        foreach (var line in lines)
        {
            var item = order.Items.FirstOrDefault(i => i.Id == line.ItemId);
            if (item is null)
                return $"Amend line item #{line.ItemId} was not found on this purchase order.";
            if (item.IsReturnableDeposit || string.IsNullOrWhiteSpace(item.ComponentId))
                continue;

            var packages = line.Quantity;
            var packagePrice = line.UnitPrice;
            var purchases = await db.InventoryPurchases
                .Where(p => p.PurchaseOrderItemId == item.Id && p.PurchaseOrderId == order.Id)
                .ToListAsync();
            if (purchases.Count == 0)
                continue;

            var parent = await db.Ingredients.FirstOrDefaultAsync(ingredient =>
                ingredient.ComponentId == item.ComponentId
                && (order.CompanyId == null
                    || ingredient.CompanyId == null
                    || ingredient.CompanyId == order.CompanyId));

            decimal stockQty = packages;
            string stockUom = string.IsNullOrWhiteSpace(item.ComponentUom) ? item.Unit : item.ComponentUom;
            decimal stockPrice = packagePrice;
            decimal documentAmount = DecimalRounding.ToDb(packages * packagePrice);
            decimal roundingResidual = 0m;

            if (parent is not null)
            {
                var deliveryBasis = string.IsNullOrWhiteSpace(item.Unit)
                    ? item.DeliveryPackage
                    : item.Unit;
                var (pathPrincipal, pathPrincipalUom) = await DeliveryPrincipalResolver.ResolvePathPrincipalAsync(
                    db,
                    parent,
                    item.VendorProductId,
                    deliveryBasis);
                var inbound = IngredientUomBridge.ToInboundPrincipal(
                    parent,
                    packages,
                    string.IsNullOrWhiteSpace(deliveryBasis) ? stockUom : deliveryBasis,
                    packagePrice,
                    item.VendorProductId,
                    deliveryBasis,
                    pathPrincipal,
                    pathPrincipalUom);
                stockQty = inbound.Quantity;
                stockUom = inbound.Uom;
                stockPrice = inbound.UnitPrice;
                documentAmount = inbound.DocumentAmount;
                roundingResidual = inbound.RoundingResidual;
            }

            // Prefer a single purchase row per PO line; if splits exist, rewrite the first and zero the rest.
            var primary = purchases.OrderBy(p => p.Id).First();
            primary.Quantity = stockQty;
            primary.Uom = stockUom;
            primary.UnitPrice = stockPrice;
            primary.DocumentAmount = documentAmount;
            primary.RoundingResidual = roundingResidual;
            if (reconciledPhase
                && string.Equals(
                    primary.Remarks,
                    PurchaseOrderWorkflow.StockRemarkReceivedPending,
                    StringComparison.Ordinal))
            {
                primary.Remarks = string.Empty;
            }

            foreach (var extra in purchases.Where(p => p.Id != primary.Id))
            {
                extra.Quantity = 0;
                extra.DocumentAmount = 0;
                extra.RoundingResidual = 0;
            }

            await fifoBatches.SyncBatchFromPurchaseAsync(primary);
            if (reconciledPhase)
                await fifoBatches.UpdateBatchUnitCostFromPurchaseAsync(primary);
            foreach (var extra in purchases.Where(p => p.Id != primary.Id))
                await fifoBatches.SyncBatchFromPurchaseAsync(extra);
        }

        return null;
    }

    IQueryable<PurchaseOrder> BaseQuery() =>
        db.PurchaseOrders
            .AsNoTracking()
            .Include(p => p.Items)
            .OrderByDescending(p => p.OrderDate)
            .ThenByDescending(p => p.Id);

    async Task<PurchaseOrder?> LoadOrderAsync(int id, bool tracking = false)
    {
        var query = db.PurchaseOrders.Include(p => p.Items).AsQueryable();
        if (!tracking) query = query.AsNoTracking();
        return await query.FirstOrDefaultAsync(p => p.Id == id);
    }

    async Task<object> MapPurchaseOrderAsync(PurchaseOrder order, bool? allowPartialDelivery = null)
    {
        var mapped = await MapPurchaseOrdersAsync([order], allowPartialDelivery);
        return mapped[0];
    }

    async Task<List<object>> MapPurchaseOrdersAsync(
        IReadOnlyList<PurchaseOrder> orders,
        bool? allowPartialDelivery = null)
    {
        var flags = allowPartialDelivery is bool fixedAllow
            ? orders.ToDictionary(o => o.Id, _ => fixedAllow)
            : await ResolveAllowPartialFlagsAsync(orders);
        var consolidatedByMaster = await ResolveConsolidatedByMasterItemAsync(
            orders.Where(o => o.IsPreCommitted).Select(o => o.Id).ToList());

        var sourceMasterIds = orders
            .Where(o => !o.IsPreCommitted && o.SourceCommittedPurchaseOrderId is > 0)
            .Select(o => o.SourceCommittedPurchaseOrderId!.Value)
            .Distinct()
            .ToList();
        var sourcePoNumberById = sourceMasterIds.Count == 0
            ? new Dictionary<int, string>()
            : await db.PurchaseOrders.AsNoTracking()
                .Where(p => sourceMasterIds.Contains(p.Id))
                .ToDictionaryAsync(p => p.Id, p => p.PoNumber);

        var deliveryIds = orders
            .Select(o => (o.DeliveryLocationExternalId ?? string.Empty).Trim())
            .Where(id => id.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        var deliveryByExternalId = deliveryIds.Count == 0
            ? new Dictionary<string, DeliveryLocation>(StringComparer.OrdinalIgnoreCase)
            : await db.DeliveryLocations.AsNoTracking()
                .Where(d => deliveryIds.Contains(d.ExternalId))
                .ToDictionaryAsync(d => d.ExternalId, StringComparer.OrdinalIgnoreCase);

        var companyIds = orders
            .Where(o => o.CompanyId is > 0)
            .Select(o => o.CompanyId!.Value)
            .Distinct()
            .ToList();
        var countryByCompany = companyIds.Count == 0
            ? new Dictionary<int, string>()
            : await db.Companies.AsNoTracking()
                .Where(c => companyIds.Contains(c.Id))
                .ToDictionaryAsync(c => c.Id, c => c.CountryCode ?? "MY");

        return orders
            .Select(o =>
            {
                DeliveryLocation? delivery = null;
                var deliveryId = (o.DeliveryLocationExternalId ?? string.Empty).Trim();
                if (deliveryId.Length > 0)
                    deliveryByExternalId.TryGetValue(deliveryId, out delivery);
                string? sourcePoNumber = null;
                if (o.SourceCommittedPurchaseOrderId is int sourceId)
                    sourcePoNumberById.TryGetValue(sourceId, out sourcePoNumber);
                var country = "MY";
                if (o.CompanyId is int cid && countryByCompany.TryGetValue(cid, out var code) && !string.IsNullOrWhiteSpace(code))
                    country = code;
                return PurchaseOrderWorkflow.MapOrder(
                    o,
                    flags.GetValueOrDefault(o.Id),
                    consolidatedByMaster.GetValueOrDefault(o.Id),
                    delivery,
                    sourcePoNumber,
                    OrgClock.TodayLocal(country));
            })
            .Cast<object>()
            .ToList();
    }

    /// <summary>
    /// Sums received / delivered qty on release PO lines that drew from each pre-committed master line.
    /// Stock posts at receive (DeliveredQuantity + ReceivedQuantity); prefer cumulative delivered,
    /// fall back to last received / reconciled qty for older rows that never bumped DeliveredQuantity.
    /// </summary>
    async Task<Dictionary<int, Dictionary<int, decimal>>> ResolveConsolidatedByMasterItemAsync(
        IReadOnlyList<int> masterIds)
    {
        var result = new Dictionary<int, Dictionary<int, decimal>>();
        if (masterIds.Count == 0)
            return result;

        var masters = await db.PurchaseOrders.AsNoTracking()
            .Include(p => p.Items)
            .Where(p => masterIds.Contains(p.Id) && p.IsPreCommitted)
            .ToListAsync();

        if (masters.Count == 0)
            return result;

        var masterItemIds = masters.SelectMany(m => m.Items.Select(i => i.Id)).ToHashSet();

        // Link by order-level source id and/or line-level source item id (covers legacy gaps).
        var releases = await db.PurchaseOrders.AsNoTracking()
            .Include(p => p.Items)
            .Where(p => !p.IsPreCommitted && (
                (p.SourceCommittedPurchaseOrderId != null
                    && masterIds.Contains(p.SourceCommittedPurchaseOrderId.Value))
                || p.Items.Any(i => i.SourceCommittedPurchaseOrderItemId != null
                    && masterItemIds.Contains(i.SourceCommittedPurchaseOrderItemId.Value))))
            .ToListAsync();

        var releasesByMaster = new Dictionary<int, List<PurchaseOrder>>();
        foreach (var release in releases)
        {
            var masterId = release.SourceCommittedPurchaseOrderId;
            if (masterId is null or <= 0)
            {
                masterId = release.Items
                    .Where(i => i.SourceCommittedPurchaseOrderItemId is > 0)
                    .Select(i => masters.FirstOrDefault(m =>
                        m.Items.Any(mi => mi.Id == i.SourceCommittedPurchaseOrderItemId))?.Id)
                    .FirstOrDefault(id => id is > 0);
            }
            if (masterId is null or <= 0 || !masterIds.Contains(masterId.Value))
                continue;
            if (!releasesByMaster.TryGetValue(masterId.Value, out var list))
            {
                list = [];
                releasesByMaster[masterId.Value] = list;
            }
            list.Add(release);
        }

        foreach (var master in masters)
        {
            var byItem = master.Items.ToDictionary(i => i.Id, _ => 0m);
            if (!releasesByMaster.TryGetValue(master.Id, out var linked))
            {
                result[master.Id] = byItem;
                continue;
            }

            foreach (var release in linked)
            {
                foreach (var releaseItem in release.Items)
                {
                    if (releaseItem.IsReturnableDeposit) continue;

                    var receivedQty = ResolveReleaseReceivedAgainstCommitment(releaseItem);
                    if (receivedQty <= 0.0001m) continue;

                    PurchaseOrderItem? masterItem = null;
                    if (releaseItem.SourceCommittedPurchaseOrderItemId is int linkedMasterItemId)
                        masterItem = master.Items.FirstOrDefault(mi => mi.Id == linkedMasterItemId);

                    masterItem ??= MatchCommitmentMasterItem(master, releaseItem);
                    if (masterItem is null) continue;

                    byItem[masterItem.Id] = DecimalRounding.ToDb(byItem[masterItem.Id] + receivedQty);
                }
            }

            result[master.Id] = byItem;
        }

        return result;
    }

    /// <summary>
    /// Delivery-package qty received against a commitment from a release line.
    /// Prefer cumulative DeliveredQuantity (bumped at receive); fall back to Received/Reconciled.
    /// </summary>
    static decimal ResolveReleaseReceivedAgainstCommitment(PurchaseOrderItem releaseItem)
    {
        if (releaseItem.DeliveredQuantity > 0.0001m)
            return releaseItem.DeliveredQuantity;
        if (releaseItem.ReceivedQuantity is decimal received && received > 0.0001m)
            return received;
        if (releaseItem.ReconciledQuantity is decimal reconciled && reconciled > 0.0001m)
            return reconciled;
        return 0m;
    }

    static PurchaseOrderItem? MatchCommitmentMasterItem(PurchaseOrder master, PurchaseOrderItem releaseItem)
    {
        var releaseVp = (releaseItem.VendorProductId ?? string.Empty).Trim();
        if (!string.IsNullOrWhiteSpace(releaseVp))
        {
            var byVp = master.Items.FirstOrDefault(mi =>
                string.Equals((mi.VendorProductId ?? string.Empty).Trim(), releaseVp, StringComparison.OrdinalIgnoreCase));
            if (byVp is not null) return byVp;
        }

        var releaseComp = (releaseItem.ComponentId ?? string.Empty).Trim();
        if (!string.IsNullOrWhiteSpace(releaseComp))
        {
            var byComp = master.Items.FirstOrDefault(mi =>
                string.Equals((mi.ComponentId ?? string.Empty).Trim(), releaseComp, StringComparison.OrdinalIgnoreCase));
            if (byComp is not null) return byComp;
        }

        var releaseName = (releaseItem.Name ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(releaseName)) return null;
        return master.Items.FirstOrDefault(mi =>
            string.Equals((mi.Name ?? string.Empty).Trim(), releaseName, StringComparison.OrdinalIgnoreCase));
    }

    async Task<bool> ResolveAllowPartialAsync(PurchaseOrder order)
    {
        var vendorExternalId = (order.VendorExternalId ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(vendorExternalId))
            return false;
        return await db.Vendors.AsNoTracking()
            .Where(v => v.ExternalId == vendorExternalId)
            .Select(v => v.AllowPartialDelivery)
            .FirstOrDefaultAsync();
    }

    async Task<Dictionary<int, bool>> ResolveAllowPartialFlagsAsync(IReadOnlyList<PurchaseOrder> orders)
    {
        var result = orders.ToDictionary(o => o.Id, _ => false);
        var externalIds = orders
            .Select(o => (o.VendorExternalId ?? string.Empty).Trim())
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        if (externalIds.Count == 0)
            return result;

        var vendors = await db.Vendors.AsNoTracking()
            .Where(v => externalIds.Contains(v.ExternalId))
            .Select(v => new { v.ExternalId, v.AllowPartialDelivery })
            .ToListAsync();
        var byExternal = vendors.ToDictionary(
            v => v.ExternalId,
            v => v.AllowPartialDelivery,
            StringComparer.OrdinalIgnoreCase);

        foreach (var order in orders)
        {
            var key = (order.VendorExternalId ?? string.Empty).Trim();
            if (byExternal.TryGetValue(key, out var allow))
                result[order.Id] = allow;
        }

        return result;
    }

    /// <summary>
    /// Inserts unordered PO lines (freebies / credit-note replacements) when receive payload
    /// sends ItemId &lt;= 0 with Vendor Product + Component identity. Assigns new ItemIds in-place.
    /// </summary>
    async Task<string?> EnsureUnorderedReceiveLinesAsync(
        PurchaseOrder order,
        List<PurchaseOrderLineWorkflowRequest> lines)
    {
        var created = new List<(PurchaseOrderLineWorkflowRequest Line, PurchaseOrderItem Item)>();
        foreach (var line in lines.Where(l => l.ItemId <= 0))
        {
            var vendorProductId = line.VendorProductId?.Trim() ?? string.Empty;
            var componentId = line.ComponentId?.Trim() ?? string.Empty;
            var name = line.Name?.Trim() ?? string.Empty;
            var componentName = string.IsNullOrWhiteSpace(line.ComponentName)
                ? name
                : line.ComponentName.Trim();
            var deliveryPackage = (line.DeliveryPackage ?? line.Unit ?? string.Empty).Trim();
            var unit = string.IsNullOrWhiteSpace(line.Unit) ? deliveryPackage : line.Unit.Trim();
            var componentUom = line.ComponentUom?.Trim() ?? string.Empty;

            if (!string.IsNullOrWhiteSpace(order.VendorExternalId) && !string.IsNullOrWhiteSpace(vendorProductId))
            {
                var vendorProduct = await db.VendorProducts.AsNoTracking()
                    .FirstOrDefaultAsync(p => p.ExternalId == vendorProductId);
                if (vendorProduct is not null
                    && !string.Equals(
                        vendorProduct.VendorExternalId?.Trim(),
                        order.VendorExternalId.Trim(),
                        StringComparison.OrdinalIgnoreCase))
                {
                    return $"Vendor product '{vendorProductId}' does not belong to vendor on this PO.";
                }
            }

            // Ordered qty stays 0 — variance = received qty (freebie / replacement not on original order).
            var item = new PurchaseOrderItem
            {
                PurchaseOrderId = order.Id,
                ComponentId = componentId,
                ComponentName = componentName,
                VendorProductId = vendorProductId,
                Name = name,
                Quantity = 0m,
                UnitPrice = DecimalRounding.ToDb(line.UnitPrice),
                IssuedUnitPrice = DecimalRounding.ToDb(line.UnitPrice),
                Unit = unit,
                ComponentUom = componentUom,
                DeliveryPackage = deliveryPackage,
                IsReturnableDeposit = false,
            };
            order.Items.Add(item);
            created.Add((line, item));
        }

        if (created.Count == 0)
            return null;

        await db.SaveChangesAsync();
        foreach (var (line, item) in created)
            line.ItemId = item.Id;
        return null;
    }

    static void ApplyWorkflowLines(
        PurchaseOrder order,
        List<PurchaseOrderLineWorkflowRequest> lines,
        string workflow)
    {
        foreach (var line in lines)
        {
            var item = order.Items.FirstOrDefault(i => i.Id == line.ItemId);
            if (item is null) continue;

            if (workflow == "receive")
            {
                // Keep Quantity / UnitPrice as ordered; store physical receipt separately.
                item.ReceivedQuantity = line.Quantity;
                item.ReceivedUnitPrice = line.UnitPrice;
                item.TaxAmount = line.TaxAmount;
                item.HalalCertNo = line.HalalCertNo?.Trim() ?? string.Empty;
                item.ProductExpiryDate = NormalizeOptionalDate(line.ProductExpiryDate);
                item.ReceivedTemperature = line.ReceivedTemperature;
                if (!string.IsNullOrWhiteSpace(line.ComponentUom))
                    item.ComponentUom = line.ComponentUom.Trim();
            }
            else
            {
                // Shipment qty/price for this consolidate; cumulative DeliveredQuantity updated by caller.
                item.ReconciledQuantity = line.Quantity;
                item.ReconciledUnitPrice = line.UnitPrice;
                if (line.ReceivedTemperature.HasValue)
                    item.ReceivedTemperature = line.ReceivedTemperature;
                if (!string.IsNullOrWhiteSpace(line.ComponentUom))
                    item.ComponentUom = line.ComponentUom.Trim();
            }
        }
    }

    static string NormalizeOptionalDate(string? raw)
    {
        var value = raw?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(value)) return string.Empty;
        return DateOnly.TryParse(value, out var parsed) ? parsed.ToString("yyyy-MM-dd") : value;
    }
}

[ApiController]
[Route("api/vendorproducts")]
public class VendorProductsController(BisyncDbContext db) : ControllerBase
{
    [HttpGet("prices")]
    public async Task<ActionResult<IEnumerable<object>>> GetPrices() =>
        Ok(await db.VendorProductPrices
            .AsNoTracking()
            .OrderBy(p => p.ExternalId)
            .Select(p => new
            {
                id = p.ExternalId,
                deliveryPrice = p.DeliveryPrice,
                updatedAt = p.UpdatedAt,
            })
            .ToListAsync());
}

[ApiController]
[Route("api/[controller]")]
public class InventoryController(
    BisyncDbContext db,
    ITenantContext tenant,
    InventoryAlertComputationService inventoryAlerts) : ControllerBase
{
    /// <summary>
    /// Live inventory alerts for Operations Overview: par-stock near/below and
    /// system cover vs sales-based delivery cycle. Scoped by company/locations.
    /// </summary>
    [HttpGet("alerts")]
    public async Task<ActionResult<IEnumerable<object>>> GetAlerts(
        [FromQuery] int? companyId = null,
        [FromQuery] string? locationIds = null,
        CancellationToken cancellationToken = default)
    {
        var cid = TenantQuery.ResolveCompanyId(tenant, companyId);
        if (cid is not int company)
            return Ok(Array.Empty<object>());

        var locationIdList = (locationIds ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var alerts = await inventoryAlerts.ComputeAsync(company, locationIdList, cancellationToken);
        return Ok(alerts.Select(a => new
        {
            a.Id,
            a.ItemName,
            a.ComponentId,
            a.Stock,
            a.Status,
            a.Threshold,
            alertType = a.AlertType,
            basisLabel = a.BasisLabel,
            detail = a.Detail,
            onHandQty = a.OnHandQty,
            parStock = a.ParStock,
            dailyUsage = a.DailyUsage,
            orderFreqDays = a.OrderFreqDays,
            deliveryCycleDays = a.DeliveryCycleDays,
            daysOfCover = a.DaysOfCover,
            uom = a.Uom,
            expiryDate = a.ExpiryDate,
            daysUntilExpiry = a.DaysUntilExpiry,
            atRiskQty = a.AtRiskQty,
        }));
    }

    [HttpGet("purchases")]
    public async Task<ActionResult<IEnumerable<object>>> GetPurchases([FromQuery] int? companyId)
    {
        IQueryable<InventoryPurchase> query = db.InventoryPurchases.AsNoTracking();
        if (companyId is int id)
            query = query.Where(p => p.CompanyId == null || p.CompanyId == id);

        var rows = await query
            .OrderByDescending(p => p.DateCreatedInStock)
            .ToListAsync();

        return Ok(rows.Select(p => new
        {
            p.Id,
            componentId = p.ComponentId,
            componentName = p.ComponentName,
            quantity = p.Quantity,
            uom = p.Uom,
            unitPrice = p.UnitPrice,
            dateOrdered = p.DateOrdered,
            dateCreatedInStock = p.DateCreatedInStock,
            purchaseOrderId = p.PurchaseOrderId,
            purchaseOrderItemId = p.PurchaseOrderItemId,
            companyId = p.CompanyId,
            locationExternalIds = PurchaseOrderWorkflow.DeserializeLocationIds(p.LocationIdsJson),
            splitSourceType = p.SplitSourceType,
            splitSourceId = p.SplitSourceId,
            splitLineKey = p.SplitLineKey,
            splitParentComponentId = p.SplitParentComponentId,
        }));
    }
}

[ApiController]
[Route("api/[controller]")]
public class RevenueController(BisyncDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<RevenueDataPoint>>> GetByPeriod([FromQuery] string period = "week") =>
        Ok(await db.RevenueDataPoints.Where(r => r.Period == period).OrderBy(r => r.Id).ToListAsync());
}

[ApiController]
[Route("api/[controller]")]
public class ProgressController(BisyncDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<object>> GetProgress()
    {
        var milestones = await db.DevelopmentMilestones.OrderBy(m => m.Id).ToListAsync();
        var total = milestones.Count;
        var completed = milestones.Count(m => m.Status == "completed");
        var overall = total == 0 ? 0 : (int)Math.Round(milestones.Average(m => m.ProgressPercent));

        return Ok(new
        {
            overallPercent = overall,
            completedCount = completed,
            totalCount = total,
            lastUpdated = milestones.Max(m => m.UpdatedAt),
            milestones = milestones.GroupBy(m => m.Phase).Select(g => new
            {
                phase = g.Key,
                items = g.Select(m => new
                {
                    m.Id,
                    m.Title,
                    m.Status,
                    m.ProgressPercent,
                    m.Notes,
                    m.UpdatedAt
                })
            })
        });
    }

    [HttpPatch("{id:int}")]
    public async Task<ActionResult<DevelopmentMilestone>> Update(int id, [FromBody] UpdateMilestoneRequest request)
    {
        var milestone = await db.DevelopmentMilestones.FindAsync(id);
        if (milestone is null) return NotFound();
        if (request.Status is not null) milestone.Status = request.Status;
        if (request.ProgressPercent.HasValue) milestone.ProgressPercent = request.ProgressPercent.Value;
        if (request.Notes is not null) milestone.Notes = request.Notes;
        milestone.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(milestone);
    }
}

public record UpdateMilestoneRequest(string? Status, int? ProgressPercent, string? Notes);

[ApiController]
[Route("api/[controller]")]
public class HealthController : ControllerBase
{
    [HttpGet]
    public IActionResult Get() => Ok(new { status = "healthy", service = "Bisync.cloud API", timestamp = DateTime.UtcNow });
}
