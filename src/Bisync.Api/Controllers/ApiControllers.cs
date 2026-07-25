using Bisync.Api.Contracts;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Bisync.Api.Services;
using Bisync.Api.Tenancy;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LocationsController(BisyncDbContext db, LocationSubscriptionService locationSubscriptions) : ControllerBase
{
    static object MapLocationConfig(Location l) => new
    {
        l.Id,
        l.ExternalId,
        l.Name,
        l.CompanyId,
        companyName = l.Company?.Name,
        countryCode = l.Company?.CountryCode ?? "MY",
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
    };

    async Task<Location?> LoadLocationConfigAsync(int id) =>
        await db.Locations
            .AsNoTracking()
            .Include(l => l.Company)
            .Include(l => l.PrincipalContact)
            .Include(l => l.SecondaryContact)
            .FirstOrDefaultAsync(l => l.Id == id);

    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> GetAll() =>
        Ok(await db.Locations
            .AsNoTracking()
            .OrderBy(l => l.Name)
            .Select(l => new
            {
                l.Id,
                l.ExternalId,
                l.Name,
                l.Address,
                l.CompanyId,
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
            })
            .ToListAsync());

    [HttpGet("config")]
    public async Task<ActionResult<IEnumerable<object>>> GetConfig()
    {
        var locations = await db.Locations
            .AsNoTracking()
            .Include(l => l.Company)
            .Include(l => l.PrincipalContact)
            .Include(l => l.SecondaryContact)
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

        await DatabaseSchemaHelper.TryResyncIdentitySequenceAsync(db, "Locations");

        var externalId = await GenerateUniqueExternalIdAsync(body.Name);
        var loc = new Location
        {
            ExternalId = externalId,
            Name = body.Name.Trim(),
            CompanyId = body.CompanyId,
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
            Address = string.Join(", ", new[] { body.AddressLine1, body.City, body.StateProvince, body.Postcode }.Where(s => !string.IsNullOrWhiteSpace(s))),
        };

        db.Locations.Add(loc);
        await db.SaveChangesAsync();

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
        return saved is null ? Ok(new { loc.Id, loc.ExternalId, loc.Name, loc.CompanyId }) : Ok(MapLocationConfig(saved));
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

        var loc = await db.Locations.FindAsync(id);
        if (loc is null) return NotFound();
        loc.CompanyId = body.CompanyId;
        loc.Name = body.Name;
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
        loc.Address = string.Join(", ", new[] { body.AddressLine1, body.City, body.StateProvince, body.Postcode }.Where(s => !string.IsNullOrWhiteSpace(s)));
        await db.SaveChangesAsync();
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
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Vendor>>> GetAll([FromQuery] bool? engaged = null)
    {
        var q = db.Vendors.AsQueryable();
        if (engaged.HasValue)
            q = q.Where(v => v.Engaged == engaged.Value);
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

        var vendor = new Vendor
        {
            ExternalId = externalId,
            Name = name,
            Type = string.IsNullOrWhiteSpace(request.Type) ? "offline" : request.Type.Trim().ToLowerInvariant(),
            Brn = request.Brn.Trim(),
            Products = request.Products.Trim(),
            City = request.City.Trim(),
            State = request.State.Trim(),
            Address = request.Address.Trim(),
            ContactPerson = request.ContactPerson.Trim(),
            ContactPosition = request.ContactPosition.Trim(),
            Mobile = request.Mobile.Trim(),
            Email = request.Email.Trim(),
            ProductPolicyTag = request.ProductPolicyTag.Trim().ToLowerInvariant(),
            AllowPartialDelivery = request.AllowPartialDelivery,
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

        vendor.Name = name;
        vendor.Type = string.IsNullOrWhiteSpace(request.Type) ? "offline" : request.Type.Trim().ToLowerInvariant();
        vendor.Brn = request.Brn.Trim();
        vendor.Products = request.Products.Trim();
        vendor.City = request.City.Trim();
        vendor.State = request.State.Trim();
        vendor.Address = request.Address.Trim();
        vendor.ContactPerson = request.ContactPerson.Trim();
        vendor.ContactPosition = request.ContactPosition.Trim();
        vendor.Mobile = request.Mobile.Trim();
        vendor.Email = request.Email.Trim();
        vendor.ProductPolicyTag = request.ProductPolicyTag.Trim().ToLowerInvariant();
        vendor.AllowPartialDelivery = request.AllowPartialDelivery;
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
        item.Category = updated.Category;
        item.Group = updated.Group;
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
    PreCommittedPoDrawdownService preCommittedDrawdown) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> GetAll()
    {
        var orders = await BaseQuery().ToListAsync();
        var flags = await ResolveAllowPartialFlagsAsync(orders);
        return Ok(orders.Select(o => PurchaseOrderWorkflow.MapOrder(o, flags.GetValueOrDefault(o.Id))));
    }

    [HttpGet("active")]
    public async Task<ActionResult<IEnumerable<object>>> GetActive([FromQuery] int? companyId)
    {
        var query = BaseQuery()
            .Where(p => p.Status != PurchaseOrderWorkflow.StatusReconciled
                && p.Status != PurchaseOrderWorkflow.StatusCommitmentClosed);

        if (companyId is int id)
            query = query.Where(p => p.CompanyId == null || p.CompanyId == id);

        var orderIds = await query.Select(p => p.Id).ToListAsync();
        await PurchaseOrderShareService.BackfillMissingShareTokensAsync(db, orderIds);

        var orders = await BaseQuery()
            .Where(p => orderIds.Contains(p.Id))
            .ToListAsync();
        var flags = await ResolveAllowPartialFlagsAsync(orders);
        return Ok(orders.Select(o => PurchaseOrderWorkflow.MapOrder(o, flags.GetValueOrDefault(o.Id))));
    }

    /// <summary>Active pre-committed (blanket) POs available for drawdown / PO Template apply.</summary>
    [HttpGet("committed")]
    public async Task<ActionResult<IEnumerable<object>>> GetCommitted(
        [FromQuery] int? companyId,
        [FromQuery] string? locationExternalIds = null)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var query = BaseQuery()
            .Where(p => p.IsPreCommitted && p.Status == PurchaseOrderWorkflow.StatusCommitted)
            .Where(p =>
                (p.CommitmentStartDate == null || p.CommitmentStartDate <= today)
                && (p.CommitmentEndDate == null || p.CommitmentEndDate >= today));

        if (companyId is int id)
            query = query.Where(p => p.CompanyId == null || p.CompanyId == id);

        var orders = await query.ToListAsync();
        // Only those with remaining commitment qty.
        orders = orders
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

        var flags = await ResolveAllowPartialFlagsAsync(orders);
        return Ok(orders.Select(o => PurchaseOrderWorkflow.MapOrder(o, flags.GetValueOrDefault(o.Id))));
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
        var flags = await ResolveAllowPartialFlagsAsync(orders);
        return Ok(orders.Select(o => PurchaseOrderWorkflow.MapOrder(o, flags.GetValueOrDefault(o.Id))));
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

        if (!PurchaseOrderWorkflow.CanVendorAccept(order))
            return Conflict(new { message = "This purchase order can no longer be accepted." });

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
        if (string.Equals(order.DocumentType, PurchaseOrderWorkflow.DocumentTypePo, StringComparison.OrdinalIgnoreCase)
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
        if (request.CompanyId is int companyId)
        {
            var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == companyId);
            if (company is not null)
                companyAbbr = PurchaseOrderNumberService.AbbreviateCompanyName(company.Name);
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
        var initiatedBy = request.InitiatedBy?.Trim() ?? string.Empty;
        var approvedBy = request.ApprovedBy?.Trim() ?? string.Empty;

        var created = new List<PurchaseOrder>();
        foreach (var orderRequest in request.Orders)
        {
            var vendorName = orderRequest.VendorName.Trim();
            if (string.IsNullOrWhiteSpace(vendorName))
                return BadRequest(new { message = "Vendor name is required for each purchase order." });

            var items = (orderRequest.Items ?? [])
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
                })
                .ToList();

            if (items.Count == 0)
                return BadRequest(new { message = $"Purchase order for {vendorName} has no valid items." });

            var orderDate = orderRequest.OrderDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
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
                    ? (orderRequest.CommitmentEndDate ?? orderRequest.DeliveryDate ?? DateOnly.FromDateTime(DateTime.UtcNow.AddDays(3)))
                    : (orderRequest.DeliveryDate ?? DateOnly.FromDateTime(DateTime.UtcNow.AddDays(3))),
                DocumentType = documentType,
                Status = status,
                CompanyId = request.CompanyId,
                LocationIdsJson = locationIdsJson,
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
            // Notify online vendors only for issued POs (not pending PR approval).
            // Pre-committed masters are also shared so the vendor can see the commitment.
            if (!PurchaseOrderWorkflow.IsPendingApprovalStatus(order.Status))
                await OnlineVendorOrderBridge.NotifyOnlineVendorOfPurchaseOrderAsync(db, order);
        }

        var flags = await ResolveAllowPartialFlagsAsync(saved);
        return Ok(saved.Select(o => PurchaseOrderWorkflow.MapOrder(o, flags.GetValueOrDefault(o.Id))));
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

        // Halal certificate number is optional even under a halal org policy.
        var quality = VendorRatingRules.NormalizeCustomerLevel(request.ProductQualityRating);
        var hygiene = VendorRatingRules.NormalizeCustomerLevel(request.HygieneRating);
        if (quality is null)
            return BadRequest(new { message = "Product quality rating is required (Satisfied, Acceptable, or Poor)." });
        if (hygiene is null)
            return BadRequest(new { message = "Hygiene & cleanliness rating is required (Satisfied, Acceptable, or Poor)." });

        if (!allowPartial)
        {
            // Non-partial vendors: receiving short of ordered is still allowed, but consolidates as a full close later.
        }
        else
        {
            foreach (var line in request.Items)
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

        ApplyWorkflowLines(order, request.Items, workflow: "receive");
        order.VendorDoNumber = vendorDoNumber;
        order.VendorInvoiceNumber = vendorInvoiceNumber;
        order.ProductQualityRating = quality;
        order.HygieneRating = hygiene;
        order.ProductQualityComment = request.ProductQualityComment?.Trim() ?? string.Empty;
        order.HygieneComment = request.HygieneComment?.Trim() ?? string.Empty;
        order.Status = PurchaseOrderWorkflow.StatusReceived;
        order.ReceivedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();
        return Ok(await MapPurchaseOrderAsync(order, allowPartial));
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

        // Quality/hygiene can be updated at consolidate if provided; otherwise keep receive values.
        var quality = VendorRatingRules.NormalizeCustomerLevel(request.ProductQualityRating);
        var hygiene = VendorRatingRules.NormalizeCustomerLevel(request.HygieneRating);
        if (quality is null && string.IsNullOrWhiteSpace(order.ProductQualityRating))
            return BadRequest(new { message = "Product quality rating is required (Satisfied, Acceptable, or Poor)." });
        if (hygiene is null && string.IsNullOrWhiteSpace(order.HygieneRating))
            return BadRequest(new { message = "Hygiene & cleanliness rating is required (Satisfied, Acceptable, or Poor)." });

        await using var transaction = await db.Database.BeginTransactionAsync();
        // Capture shipment qtys before cumulative update.
        var shipmentByItemId = request.Items.ToDictionary(l => l.ItemId, l => l.Quantity);
        ApplyWorkflowLines(order, request.Items, workflow: "reconcile");
        if (quality is not null) order.ProductQualityRating = quality;
        if (hygiene is not null) order.HygieneRating = hygiene;
        if (request.ProductQualityComment is not null)
            order.ProductQualityComment = request.ProductQualityComment.Trim();
        if (request.HygieneComment is not null)
            order.HygieneComment = request.HygieneComment.Trim();

        var updatedVendorProductPrices = await VendorProductPriceService.ApplyReconciledPricesAsync(
            db, order.Items, order.Id);

        var locationIds = PurchaseOrderWorkflow.DeserializeLocationIds(order.LocationIdsJson);
        var locationIdsJson = locationIds.Count > 0
            ? order.LocationIdsJson
            : PurchaseOrderWorkflow.SerializeLocationIds(locationIds);
        var locationExternalId = locationIds.Count > 0
            ? locationIds[0].Trim().ToLowerInvariant()
            : string.Empty;

        if (!string.IsNullOrEmpty(locationExternalId))
            await locationPartitions.EnsurePartitionsForLocationAsync(locationExternalId);

        var receiptCreatedAt = DateTime.UtcNow;
        foreach (var line in request.Items)
        {
            var item = order.Items.FirstOrDefault(i => i.Id == line.ItemId);
            if (item is null) continue;

            var shipmentQty = shipmentByItemId.GetValueOrDefault(line.ItemId, line.Quantity);
            if (allowPartial)
            {
                var remaining = Math.Max(0m, item.Quantity - item.DeliveredQuantity);
                if (shipmentQty > remaining + 0.0001m)
                    return BadRequest(new
                    {
                        message = $"Consolidate qty for '{item.Name}' cannot exceed remaining {remaining:0.####}."
                    });
                item.DeliveredQuantity = DecimalRounding.ToDb(item.DeliveredQuantity + Math.Max(0m, shipmentQty));
                item.ReconciledQuantity = item.DeliveredQuantity;
            }
            else
            {
                item.DeliveredQuantity = DecimalRounding.ToDb(Math.Max(0m, shipmentQty));
                item.ReconciledQuantity = item.DeliveredQuantity;
            }

            var qty = shipmentQty;
            var price = item.ReconciledUnitPrice ?? line.UnitPrice;
            if (qty <= 0) continue; // out-of-stock / zero receipt — no inventory post
            var uom = string.IsNullOrWhiteSpace(line.ComponentUom)
                ? (string.IsNullOrWhiteSpace(item.ComponentUom) ? item.Unit : item.ComponentUom)
                : line.ComponentUom.Trim();

            var parent = await db.Ingredients.FirstOrDefaultAsync(ingredient =>
                ingredient.ComponentId == item.ComponentId
                && (order.CompanyId == null || ingredient.CompanyId == order.CompanyId));
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
                        item.Id);
                    continue;
                }

                db.InventoryPurchases.Add(new InventoryPurchase
                {
                    ComponentId = item.ComponentId,
                    ComponentName = string.IsNullOrWhiteSpace(item.ComponentName) ? item.Name : item.ComponentName,
                    Quantity = qty,
                    Uom = uom,
                    UnitPrice = price,
                    DateOrdered = order.OrderDate,
                    DateCreatedInStock = receiptCreatedAt,
                    PurchaseOrderId = order.Id,
                    PurchaseOrderItemId = item.Id,
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
                return BadRequest(new { message = ex.Message });
            }
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

        // Guide step 1: each reconciled inbound line becomes a distinct cost-segregated batch.
        // Only register batches created in this shipment (avoid re-registering prior partial posts).
        var receiptPurchases = await db.InventoryPurchases
            .Where(p => p.PurchaseOrderId == order.Id && p.DateCreatedInStock == receiptCreatedAt)
            .ToListAsync();
        foreach (var purchase in receiptPurchases)
            await fifoBatches.RecordReceiptFromPurchaseAsync(purchase);

        await transaction.CommitAsync();
        return Ok(new
        {
            order = await MapPurchaseOrderAsync(order, allowPartial),
            updatedVendorProductPrices,
        });
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
        var allow = allowPartialDelivery ?? await ResolveAllowPartialAsync(order);
        return PurchaseOrderWorkflow.MapOrder(order, allow);
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
public class InventoryController(BisyncDbContext db) : ControllerBase
{
    [HttpGet("alerts")]
    public async Task<ActionResult<IEnumerable<InventoryAlert>>> GetAlerts() =>
        Ok(await db.InventoryAlerts.OrderBy(a => a.Status).ToListAsync());

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
