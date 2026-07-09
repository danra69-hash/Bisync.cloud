using System.Text.Json;
using Bisync.Api.Contracts;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/b2b-customers")]
public class B2bCustomersController(BisyncDbContext db) : ControllerBase
{
    static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    [HttpGet]
    public async Task<ActionResult<IEnumerable<B2bCustomer>>> GetAll([FromQuery] int? companyId = null)
    {
        var q = db.B2bCustomers.AsQueryable();
        if (companyId.HasValue)
            q = q.Where(c => c.CompanyId == companyId.Value);
        return Ok(await q.OrderBy(c => c.CompanyName).ToListAsync());
    }

    [HttpPost]
    public async Task<ActionResult<B2bCustomer>> Create([FromBody] UpsertB2bCustomerRequest request)
    {
        var validation = ValidateRequest(request);
        if (validation is not null) return BadRequest(new { message = validation });

        var externalId = request.ExternalId.Trim().ToUpperInvariant();
        if (await db.B2bCustomers.AnyAsync(c => c.ExternalId.ToLower() == externalId.ToLower()))
            return Conflict(new { message = "Customer ID already exists." });

        var customer = MapToEntity(new B2bCustomer(), request, externalId);
        db.B2bCustomers.Add(customer);
        await db.SaveChangesAsync();
        return Ok(customer);
    }

    [HttpPut("{externalId}")]
    public async Task<ActionResult<B2bCustomer>> Update(string externalId, [FromBody] UpsertB2bCustomerRequest request)
    {
        var customer = await db.B2bCustomers.FirstOrDefaultAsync(c => c.ExternalId == externalId);
        if (customer is null) return NotFound();

        var validation = ValidateRequest(request);
        if (validation is not null) return BadRequest(new { message = validation });

        MapToEntity(customer, request, customer.ExternalId);
        await db.SaveChangesAsync();
        return Ok(customer);
    }

    static string? ValidateRequest(UpsertB2bCustomerRequest request)
    {
        if (request.CompanyId <= 0) return "Company is required.";
        if (string.IsNullOrWhiteSpace(request.ExternalId)) return "Customer ID is required.";
        if (string.IsNullOrWhiteSpace(request.CompanyName)) return "Company name is required.";
        if (request.Contacts.Count == 0) return "At least one contact person is required.";
        if (!request.Contacts.Any(c => !string.IsNullOrWhiteSpace(c.Name)))
            return "Contact person name is required.";
        return null;
    }

    static B2bCustomer MapToEntity(B2bCustomer customer, UpsertB2bCustomerRequest request, string externalId)
    {
        customer.CompanyId = request.CompanyId;
        customer.ExternalId = externalId;
        customer.CompanyName = request.CompanyName.Trim();
        customer.Brn = request.Brn.Trim();
        customer.Address = request.Address.Trim();
        customer.City = request.City.Trim();
        customer.State = request.State.Trim();
        customer.Postcode = request.Postcode.Trim();
        customer.Phone = request.Phone.Trim();
        customer.Fax = request.Fax.Trim();
        customer.Email = request.Email.Trim();
        customer.Active = request.Active;
        customer.ContactsJson = JsonSerializer.Serialize(
            request.Contacts.Select(c => new
            {
                id = string.IsNullOrWhiteSpace(c.Id) ? Guid.NewGuid().ToString("N")[..8] : c.Id.Trim(),
                name = c.Name.Trim(),
                position = c.Position.Trim(),
                mobile = c.Mobile.Trim(),
                email = c.Email.Trim(),
                isDefault = c.IsDefault,
            }),
            JsonOptions);
        customer.TaggedProductIdsJson = JsonSerializer.Serialize(request.TaggedProductIds.Distinct(), JsonOptions);
        customer.TaggedProductAliasIdsJson = JsonSerializer.Serialize(request.TaggedProductAliasIds.Distinct(), JsonOptions);
        customer.TaggedB2bProductUnitsJson = JsonSerializer.Serialize(
            request.TaggedB2bProductUnits
                .Where(unit => unit.ProductId > 0 && !string.IsNullOrWhiteSpace(unit.UnitKey))
                .Select(unit => new
                {
                    productId = unit.ProductId,
                    aliasId = unit.AliasId,
                    unitKey = unit.UnitKey.Trim(),
                })
                .DistinctBy(unit => $"{unit.productId}:{unit.aliasId}:{unit.unitKey}"),
            JsonOptions);
        customer.PurchaseHistoryJson = JsonSerializer.Serialize(request.PurchaseHistory, JsonOptions);
        return customer;
    }
}

[ApiController]
[Route("api/pos-customers")]
public class PosCustomersController(BisyncDbContext db) : ControllerBase
{
    static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    [HttpGet]
    public async Task<ActionResult<IEnumerable<PosCustomer>>> GetAll([FromQuery] int? companyId = null)
    {
        var q = db.PosCustomers.AsQueryable();
        if (companyId.HasValue)
            q = q.Where(c => c.CompanyId == companyId.Value);
        return Ok(await q.OrderBy(c => c.Name).ToListAsync());
    }

    [HttpPost]
    public async Task<ActionResult<PosCustomer>> Create([FromBody] UpsertPosCustomerRequest request)
    {
        var validation = ValidateRequest(request);
        if (validation is not null) return BadRequest(new { message = validation });

        var externalId = request.ExternalId.Trim().ToUpperInvariant();
        if (await db.PosCustomers.AnyAsync(c => c.ExternalId.ToLower() == externalId.ToLower()))
            return Conflict(new { message = "Customer ID already exists." });

        var customer = MapToEntity(new PosCustomer(), request, externalId);
        db.PosCustomers.Add(customer);
        await db.SaveChangesAsync();
        return Ok(customer);
    }

    [HttpPut("{externalId}")]
    public async Task<ActionResult<PosCustomer>> Update(string externalId, [FromBody] UpsertPosCustomerRequest request)
    {
        var customer = await db.PosCustomers.FirstOrDefaultAsync(c => c.ExternalId == externalId);
        if (customer is null) return NotFound();

        var validation = ValidateRequest(request);
        if (validation is not null) return BadRequest(new { message = validation });

        MapToEntity(customer, request, customer.ExternalId);
        await db.SaveChangesAsync();
        return Ok(customer);
    }

    static string? ValidateRequest(UpsertPosCustomerRequest request)
    {
        if (request.CompanyId <= 0) return "Company is required.";
        if (string.IsNullOrWhiteSpace(request.ExternalId)) return "Customer ID is required.";
        if (string.IsNullOrWhiteSpace(request.Name)) return "Customer name is required.";
        return null;
    }

    static PosCustomer MapToEntity(PosCustomer customer, UpsertPosCustomerRequest request, string externalId)
    {
        customer.CompanyId = request.CompanyId;
        customer.ExternalId = externalId;
        customer.Name = request.Name.Trim();
        customer.Address = request.Address.Trim();
        customer.City = request.City.Trim();
        customer.State = request.State.Trim();
        customer.Postcode = request.Postcode.Trim();
        customer.Phone = request.Phone.Trim();
        customer.Fax = request.Fax.Trim();
        customer.Email = request.Email.Trim();
        customer.Active = request.Active;
        customer.LoyaltySummaryJson = JsonSerializer.Serialize(request.LoyaltySummary, JsonOptions);
        customer.CouponSummaryJson = JsonSerializer.Serialize(request.CouponSummary, JsonOptions);
        customer.ActivityHistoryJson = JsonSerializer.Serialize(request.ActivityHistory, JsonOptions);
        return customer;
    }
}
