using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CompaniesController(BisyncDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> GetAll() =>
        Ok(await db.Companies
            .AsNoTracking()
            .OrderBy(c => c.Name)
            .Select(c => new
            {
                c.Id,
                c.Name,
                c.Brn,
                c.GstTin,
                c.CountryCode,
                c.AddressLine1,
                c.AddressLine2,
                c.City,
                c.StateProvince,
                c.Postcode,
                c.Phone,
                c.Fax,
                c.Email,
                c.Active,
                locationCount = c.Locations.Count,
            })
            .ToListAsync());

    [HttpGet("{id:int}")]
    public async Task<ActionResult<Company>> GetById(int id)
    {
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id);
        return company is null ? NotFound() : Ok(company);
    }

    [HttpPost]
    public async Task<ActionResult<Company>> Create([FromBody] Company company)
    {
        db.Companies.Add(company);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = company.Id }, company);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<Company>> Update(int id, [FromBody] Company updated)
    {
        var company = await db.Companies.FindAsync(id);
        if (company is null) return NotFound();
        company.Name = updated.Name;
        company.Brn = updated.Brn;
        company.GstTin = updated.GstTin;
        company.CountryCode = updated.CountryCode;
        company.AddressLine1 = updated.AddressLine1;
        company.AddressLine2 = updated.AddressLine2;
        company.City = updated.City;
        company.StateProvince = updated.StateProvince;
        company.Postcode = updated.Postcode;
        company.Phone = updated.Phone;
        company.Fax = updated.Fax;
        company.Email = updated.Email;
        company.Active = updated.Active;
        await db.SaveChangesAsync();
        return Ok(company);
    }
}

[ApiController]
[Route("api/[controller]")]
public class UsersController(BisyncDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> GetAll()
    {
        var users = await db.AppUsers.AsNoTracking().OrderBy(u => u.FullName).ToListAsync();
        var companies = await db.Companies.AsNoTracking().ToDictionaryAsync(c => c.Id, c => c.Name);
        var locations = await db.Locations.AsNoTracking().ToDictionaryAsync(l => l.Id, l => l.Name);

        return Ok(users.Select(u =>
        {
            var locationIds = ParseLocationIds(u.LocationIdsJson);
            return new
            {
                u.Id,
                u.FullName,
                u.Email,
                u.Role,
                u.Phone,
                u.Active,
                u.AccessJson,
                u.CompanyId,
                companyName = u.CompanyId is int cid && companies.TryGetValue(cid, out var cn) ? cn : null,
                locationIds,
                locationNames = locationIds
                    .Where(id => locations.ContainsKey(id))
                    .Select(id => locations[id])
                    .ToList(),
                locationIdsJson = u.LocationIdsJson,
            };
        }));
    }

    [HttpPost]
    public async Task<ActionResult<AppUser>> Create([FromBody] UserUpsertRequest request)
    {
        if (request.CompanyId is null) return BadRequest("Company is required.");
        if (!await ValidateLocationsAsync(request.CompanyId.Value, request.LocationIdsJson))
            return BadRequest("One or more locations do not belong to the selected company.");

        var user = new AppUser
        {
            FullName = request.FullName,
            Email = request.Email,
            Role = request.Role,
            Phone = request.Phone,
            Active = request.Active,
            AccessJson = request.AccessJson ?? """{"modules":[]}""",
            CompanyId = request.CompanyId,
            LocationIdsJson = request.LocationIdsJson ?? "[]",
        };
        db.AppUsers.Add(user);
        await db.SaveChangesAsync();
        return Ok(user);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<AppUser>> Update(int id, [FromBody] UserUpsertRequest request)
    {
        if (request.CompanyId is null) return BadRequest("Company is required.");
        if (!await ValidateLocationsAsync(request.CompanyId.Value, request.LocationIdsJson))
            return BadRequest("One or more locations do not belong to the selected company.");

        var user = await db.AppUsers.FindAsync(id);
        if (user is null) return NotFound();
        user.FullName = request.FullName;
        user.Email = request.Email;
        user.Role = request.Role;
        user.Phone = request.Phone;
        user.Active = request.Active;
        user.AccessJson = request.AccessJson ?? user.AccessJson;
        user.CompanyId = request.CompanyId;
        user.LocationIdsJson = request.LocationIdsJson ?? "[]";
        await db.SaveChangesAsync();
        return Ok(user);
    }

    static List<int> ParseLocationIds(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try
        {
            return JsonSerializer.Deserialize<List<int>>(json) ?? [];
        }
        catch
        {
            return [];
        }
    }

    async Task<bool> ValidateLocationsAsync(int companyId, string? locationIdsJson)
    {
        var locationIds = ParseLocationIds(locationIdsJson);
        if (locationIds.Count == 0) return true;
        var validIds = await db.Locations
            .AsNoTracking()
            .Where(l => l.CompanyId == companyId)
            .Select(l => l.Id)
            .ToListAsync();
        return locationIds.All(validIds.Contains);
    }
}

public record UserUpsertRequest(
    string FullName,
    string Email,
    string Role,
    string Phone,
    bool Active,
    string? AccessJson,
    int? CompanyId,
    string? LocationIdsJson
);

public record LocationConfigUpdate(
    int? CompanyId,
    string Name,
    string AddressLine1,
    string AddressLine2,
    string City,
    string StateProvince,
    string Postcode,
    int? PrincipalContactUserId
);
