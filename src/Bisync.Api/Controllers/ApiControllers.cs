using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

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
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Vendor>>> GetAll([FromQuery] bool? engaged = null)
    {
        var q = db.Vendors.AsQueryable();
        if (engaged.HasValue)
            q = q.Where(v => v.Engaged == engaged.Value);
        return Ok(await q.OrderBy(v => v.Name).ToListAsync());
    }

    [HttpPost("{externalId}/engage")]
    public async Task<ActionResult<Vendor>> Engage(string externalId)
    {
        var vendor = await db.Vendors.FirstOrDefaultAsync(v => v.ExternalId == externalId);
        if (vendor is null) return NotFound();
        vendor.Engaged = true;
        await db.SaveChangesAsync();
        return Ok(vendor);
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
        item.Name = updated.Name;
        item.Category = updated.Category;
        item.Group = updated.Group;
        item.RecipeUom = updated.RecipeUom;
        item.InventoryUom = updated.InventoryUom;
        item.Active = updated.Active;
        item.LastPriceRecipe = updated.LastPriceRecipe;
        item.LastPriceInventory = updated.LastPriceInventory;
        item.StorageJson = updated.StorageJson;
        item.DailyUsage = updated.DailyUsage;
        item.OrderFreqDays = updated.OrderFreqDays;
        await db.SaveChangesAsync();
        return Ok(item);
    }

    [HttpPost]
    public async Task<ActionResult<Ingredient>> Create([FromBody] Ingredient ingredient)
    {
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
