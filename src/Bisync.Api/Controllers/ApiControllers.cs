using Bisync.Api.Contracts;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Bisync.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LocationsController(BisyncDbContext db) : ControllerBase
{
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
    public async Task<ActionResult<IEnumerable<object>>> GetConfig() =>
        Ok(await db.Locations
            .AsNoTracking()
            .Include(l => l.Company)
            .Include(l => l.PrincipalContact)
            .OrderBy(l => l.Name)
            .Select(l => new
            {
                l.Id,
                l.ExternalId,
                l.Name,
                l.CompanyId,
                companyName = l.Company != null ? l.Company.Name : null,
                countryCode = l.Company != null ? l.Company.CountryCode : "MY",
                l.AddressLine1,
                l.AddressLine2,
                l.City,
                l.StateProvince,
                l.Postcode,
                l.PrincipalContactUserId,
                principalContactName = l.PrincipalContact != null ? l.PrincipalContact.FullName : null,
            })
            .ToListAsync());

    [HttpPut("{id:int}/config")]
    public async Task<ActionResult<object>> UpdateConfig(int id, [FromBody] LocationConfigUpdate body)
    {
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
        loc.Address = string.Join(", ", new[] { body.AddressLine1, body.City, body.StateProvince, body.Postcode }.Where(s => !string.IsNullOrWhiteSpace(s)));
        await db.SaveChangesAsync();
        return Ok(new { loc.Id, loc.Name, loc.CompanyId });
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
        };

        db.Vendors.Add(vendor);
        await db.SaveChangesAsync();
        return Ok(vendor);
    }

    [HttpPost("{externalId}/engage")]
    public async Task<ActionResult<Vendor>> Engage(string externalId, [FromBody] EngageVendorRequest? body = null)
    {
        var vendor = await db.Vendors.FirstOrDefaultAsync(v => v.ExternalId == externalId);
        if (vendor is null) return NotFound();

        var contacts = NormalizeContacts(body?.Contacts, vendor);
        if (contacts.Count == 0)
            return BadRequest("At least one sales contact is required.");

        var defaultContact = contacts.FirstOrDefault(c => c.IsDefault) ?? contacts[0];
        vendor.ContactsJson = JsonSerializer.Serialize(contacts, ContactJsonOptions);
        vendor.ContactPerson = defaultContact.Name;
        vendor.ContactPosition = defaultContact.Position;
        vendor.Mobile = defaultContact.Mobile;
        vendor.Email = defaultContact.Email;
        vendor.Engaged = true;
        await db.SaveChangesAsync();
        return Ok(vendor);
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
public class IngredientsController(BisyncDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Ingredient>>> GetAll() =>
        Ok(await db.Ingredients.OrderBy(i => i.Name).ToListAsync());

    [HttpPut("{id:int}")]
    public async Task<ActionResult<Ingredient>> Update(int id, [FromBody] Ingredient updated)
    {
        var item = await db.Ingredients.FindAsync(id);
        if (item is null) return NotFound();

        var name = updated.Name.Trim();
        if (string.IsNullOrWhiteSpace(name))
            return BadRequest(new { message = "Component name is required." });

        var nameTaken = await db.Ingredients.AnyAsync(i =>
            i.Id != id && i.Name.ToLower() == name.ToLower());
        if (nameTaken)
            return Conflict(new { message = "A component with this name already exists." });

        item.Name = name;
        item.Category = updated.Category;
        item.Group = updated.Group;
        item.RecipeUom = updated.RecipeUom;
        item.InventoryUom = updated.InventoryUom;
        item.Active = updated.Active;
        item.LastPriceRecipe = updated.LastPriceRecipe;
        item.LastPriceInventory = updated.LastPriceInventory;
        item.StorageJson = updated.StorageJson;
        item.StorageNote = updated.StorageNote ?? string.Empty;
        item.DetailConfigJson = string.IsNullOrWhiteSpace(updated.DetailConfigJson) ? "{}" : updated.DetailConfigJson;
        item.DailyUsage = updated.DailyUsage;
        item.OrderFreqDays = updated.OrderFreqDays;
        item.AttachedProducts = updated.AttachedProducts;
        item.AttachedVendors = updated.AttachedVendors;
        item.LocationsJson = updated.LocationsJson;

        if (string.IsNullOrWhiteSpace(item.ComponentId))
            item.ComponentId = await ComponentIdGenerator.GenerateAsync(db, item.Name, item.Id);

        await db.SaveChangesAsync();
        return Ok(item);
    }

    [HttpPost]
    public async Task<ActionResult<Ingredient>> Create([FromBody] Ingredient ingredient)
    {
        var name = ingredient.Name.Trim();
        if (string.IsNullOrWhiteSpace(name))
            return BadRequest(new { message = "Component name is required." });

        var nameTaken = await db.Ingredients.AnyAsync(i => i.Name.ToLower() == name.ToLower());
        if (nameTaken)
            return Conflict(new { message = "A component with this name already exists." });

        ingredient.Name = name;
        ingredient.ComponentId = string.IsNullOrWhiteSpace(ingredient.ComponentId)
            ? await ComponentIdGenerator.GenerateAsync(db, name)
            : ingredient.ComponentId.Trim();

        var idTaken = await db.Ingredients.AnyAsync(i => i.ComponentId == ingredient.ComponentId);
        if (idTaken)
            ingredient.ComponentId = await ComponentIdGenerator.GenerateAsync(db, name);

        ingredient.DetailConfigJson = string.IsNullOrWhiteSpace(ingredient.DetailConfigJson) ? "{}" : ingredient.DetailConfigJson;

        db.Ingredients.Add(ingredient);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetAll), new { id = ingredient.Id }, ingredient);
    }
}

[ApiController]
[Route("api/[controller]")]
public class PurchaseOrdersController(BisyncDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> GetAll() =>
        Ok(await db.PurchaseOrders
            .AsNoTracking()
            .Include(p => p.Items)
            .OrderByDescending(p => p.OrderDate)
            .Select(p => new
            {
                p.Id,
                poNumber = p.PoNumber,
                vendorName = p.VendorName,
                orderDate = p.OrderDate,
                deliveryDate = p.DeliveryDate,
                status = p.Status,
                items = p.Items.Select(i => new
                {
                    i.Id,
                    i.Name,
                    i.Quantity,
                    i.UnitPrice,
                    i.Unit,
                    deliveryPackage = i.DeliveryPackage,
                }),
            })
            .ToListAsync());

    [HttpPost("batch")]
    public async Task<ActionResult<IEnumerable<object>>> CreateBatch([FromBody] CreatePurchaseOrdersBatchRequest request)
    {
        if (request.Orders is null || request.Orders.Count == 0)
            return BadRequest(new { message = "At least one purchase order is required." });

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
                    Name = i.Name.Trim(),
                    Quantity = i.Quantity,
                    UnitPrice = i.UnitPrice,
                    Unit = i.Unit.Trim(),
                    DeliveryPackage = i.DeliveryPackage.Trim(),
                })
                .ToList();

            if (items.Count == 0)
                return BadRequest(new { message = $"Purchase order for {vendorName} has no valid items." });

            var order = new PurchaseOrder
            {
                PoNumber = string.IsNullOrWhiteSpace(orderRequest.PoNumber)
                    ? await GeneratePoNumberAsync()
                    : orderRequest.PoNumber.Trim(),
                VendorName = vendorName,
                OrderDate = orderRequest.OrderDate ?? DateOnly.FromDateTime(DateTime.UtcNow),
                DeliveryDate = orderRequest.DeliveryDate ?? DateOnly.FromDateTime(DateTime.UtcNow.AddDays(3)),
                Status = string.IsNullOrWhiteSpace(orderRequest.Status) ? "Pending" : orderRequest.Status.Trim(),
            };

            foreach (var item in items)
                order.Items.Add(item);

            db.PurchaseOrders.Add(order);
            created.Add(order);
        }

        await db.SaveChangesAsync();

        return Ok(created.Select(p => new
        {
            p.Id,
            poNumber = p.PoNumber,
            vendorName = p.VendorName,
            orderDate = p.OrderDate,
            deliveryDate = p.DeliveryDate,
            status = p.Status,
            items = p.Items.Select(i => new
            {
                i.Id,
                i.Name,
                i.Quantity,
                i.UnitPrice,
                i.Unit,
                deliveryPackage = i.DeliveryPackage,
            }),
        }));
    }

    async Task<string> GeneratePoNumberAsync()
    {
        var existing = await db.PurchaseOrders
            .AsNoTracking()
            .Select(p => p.PoNumber)
            .ToListAsync();

        var max = existing
            .Select(number =>
            {
                if (!number.StartsWith("PO-", StringComparison.OrdinalIgnoreCase)) return 0;
                return int.TryParse(number[3..], out var parsed) ? parsed : 0;
            })
            .DefaultIfEmpty(0)
            .Max();

        var next = Math.Max(max + 1, 2843);
        var candidate = $"PO-{next}";
        while (existing.Any(n => n.Equals(candidate, StringComparison.OrdinalIgnoreCase)))
        {
            next++;
            candidate = $"PO-{next}";
        }

        return candidate;
    }
}

[ApiController]
[Route("api/[controller]")]
public class InventoryController(BisyncDbContext db) : ControllerBase
{
    [HttpGet("alerts")]
    public async Task<ActionResult<IEnumerable<InventoryAlert>>> GetAlerts() =>
        Ok(await db.InventoryAlerts.OrderBy(a => a.Status).ToListAsync());
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
