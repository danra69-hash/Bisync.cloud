using System.Text.Json;
using Bisync.Api.Contracts;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Bisync.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/sales-module")]
public class SalesModuleController(
    BisyncDbContext db,
    SalesModuleCalendarSyncService calendarSync) : ControllerBase
{
    static readonly JsonSerializerOptions JsonOpts = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    static readonly HashSet<string> AllowedStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "Prospect", "Engaged", "Active", "Inactive", "Closed",
    };

    [HttpGet("customers")]
    public async Task<ActionResult<IEnumerable<object>>> GetCustomers(
        [FromQuery] int companyId,
        [FromQuery] int? engagedUserId = null,
        CancellationToken ct = default)
    {
        if (companyId <= 0) return BadRequest(new { message = "companyId is required." });

        var q = db.SalesModuleCustomers.AsNoTracking().Where(c => c.CompanyId == companyId && c.Active);
        if (engagedUserId is > 0)
            q = q.Where(c => c.EngagedUserId == engagedUserId.Value);

        var rows = await q.OrderByDescending(c => c.CreatedAt).ToListAsync(ct);
        return Ok(rows.Select(MapCustomer));
    }

    [HttpPost("customers")]
    public async Task<ActionResult<object>> CreateCustomer([FromBody] UpsertSalesModuleCustomerRequest request, CancellationToken ct)
    {
        var error = ValidateCustomer(request);
        if (error is not null) return BadRequest(new { message = error });

        var externalId = string.IsNullOrWhiteSpace(request.ExternalId)
            ? await NextCustomerExternalIdAsync(request.CompanyId, ct)
            : request.ExternalId.Trim();

        if (await db.SalesModuleCustomers.AnyAsync(c => c.ExternalId.ToLower() == externalId.ToLower(), ct))
            return Conflict(new { message = $"Customer id {externalId} already exists." });

        var customer = MapToCustomer(new SalesModuleCustomer(), request, externalId);
        customer.CreatedAt = DateTime.UtcNow;
        db.SalesModuleCustomers.Add(customer);
        await db.SaveChangesAsync(ct);
        return Ok(MapCustomer(customer));
    }

    [HttpPut("customers/{externalId}")]
    public async Task<ActionResult<object>> UpdateCustomer(
        string externalId,
        [FromBody] UpsertSalesModuleCustomerRequest request,
        CancellationToken ct)
    {
        var error = ValidateCustomer(request);
        if (error is not null) return BadRequest(new { message = error });

        var customer = await db.SalesModuleCustomers.FirstOrDefaultAsync(c => c.ExternalId == externalId, ct);
        if (customer is null) return NotFound();

        MapToCustomer(customer, request, customer.ExternalId);
        await db.SaveChangesAsync(ct);
        return Ok(MapCustomer(customer));
    }

    [HttpGet("appointments")]
    public async Task<ActionResult<IEnumerable<object>>> GetAppointments(
        [FromQuery] int companyId,
        [FromQuery] int? engagedUserId = null,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        CancellationToken ct = default)
    {
        if (companyId <= 0) return BadRequest(new { message = "companyId is required." });

        var rangeStart = from ?? new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var rangeEnd = to ?? rangeStart.AddMonths(2);

        var q = db.SalesModuleAppointments.AsNoTracking()
            .Where(a => a.CompanyId == companyId && a.StartsAt < rangeEnd && a.EndsAt >= rangeStart);
        if (engagedUserId is > 0)
            q = q.Where(a => a.EngagedUserId == engagedUserId.Value);

        var appointments = await q.OrderBy(a => a.StartsAt).ToListAsync(ct);
        var customerIds = appointments.Select(a => a.SalesModuleCustomerId).Distinct().ToList();
        var customers = await db.SalesModuleCustomers.AsNoTracking()
            .Where(c => customerIds.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, ct);

        return Ok(appointments.Select(a => MapAppointment(a, customers.GetValueOrDefault(a.SalesModuleCustomerId))));
    }

    [HttpPost("appointments")]
    public async Task<ActionResult<object>> CreateAppointment(
        [FromBody] UpsertSalesModuleAppointmentRequest request,
        CancellationToken ct)
    {
        var error = ValidateAppointment(request);
        if (error is not null) return BadRequest(new { message = error });

        var customer = await db.SalesModuleCustomers.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == request.SalesModuleCustomerId && c.CompanyId == request.CompanyId, ct);
        if (customer is null) return BadRequest(new { message = "Sales Module customer not found." });

        var row = new SalesModuleAppointment
        {
            CompanyId = request.CompanyId,
            SalesModuleCustomerId = request.SalesModuleCustomerId,
            Title = request.Title.Trim(),
            Notes = (request.Notes ?? string.Empty).Trim(),
            StartsAt = DateTime.SpecifyKind(request.StartsAt, DateTimeKind.Utc),
            EndsAt = DateTime.SpecifyKind(request.EndsAt, DateTimeKind.Utc),
            Location = (request.Location ?? string.Empty).Trim(),
            EngagedUserId = request.EngagedUserId,
            EngagedUserEmail = (request.EngagedUserEmail ?? string.Empty).Trim().ToLowerInvariant(),
            CreatedAt = DateTime.UtcNow,
        };
        db.SalesModuleAppointments.Add(row);
        await db.SaveChangesAsync(ct);

        await calendarSync.PushCreateAsync(row, customer, ct);

        return Ok(MapAppointment(row, customer));
    }

    [HttpDelete("appointments/{id:int}")]
    public async Task<ActionResult> DeleteAppointment(int id, CancellationToken ct)
    {
        var row = await db.SalesModuleAppointments.FirstOrDefaultAsync(a => a.Id == id, ct);
        if (row is null) return NotFound();

        await calendarSync.PushDeleteAsync(row, ct);

        db.SalesModuleAppointments.Remove(row);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("calendar-sync")]
    public async Task<ActionResult<object>> GetCalendarSync(CancellationToken ct)
    {
        var settings = await calendarSync.GetOrCreateAsync(ct);
        return Ok(calendarSync.ToPublicDto(settings));
    }

    async Task<string> NextCustomerExternalIdAsync(int companyId, CancellationToken ct)
    {
        var existing = await db.SalesModuleCustomers.AsNoTracking()
            .Where(c => c.CompanyId == companyId)
            .Select(c => c.ExternalId)
            .ToListAsync(ct);
        var max = 0;
        foreach (var id in existing)
        {
            var digits = new string(id.Where(char.IsDigit).ToArray());
            if (int.TryParse(digits, out var n) && n > max) max = n;
        }
        return $"SMC-{max + 1:D4}";
    }

    static string? ValidateCustomer(UpsertSalesModuleCustomerRequest request)
    {
        if (request.CompanyId <= 0) return "Company is required.";
        if (string.IsNullOrWhiteSpace(request.CompanyName)) return "Company name is required.";
        if (!AllowedStatuses.Contains(request.Status?.Trim() ?? string.Empty))
            return "Status must be Prospect, Engaged, Active, Inactive, or Closed.";
        if (request.Contacts.Count == 0 || request.Contacts.All(c => string.IsNullOrWhiteSpace(c.Name)))
            return "At least one contact person is required.";
        return null;
    }

    static string? ValidateAppointment(UpsertSalesModuleAppointmentRequest request)
    {
        if (request.CompanyId <= 0) return "Company is required.";
        if (request.SalesModuleCustomerId <= 0) return "Customer is required.";
        if (string.IsNullOrWhiteSpace(request.Title)) return "Title is required.";
        if (request.EndsAt <= request.StartsAt) return "End time must be after start time.";
        return null;
    }

    static SalesModuleCustomer MapToCustomer(SalesModuleCustomer customer, UpsertSalesModuleCustomerRequest request, string externalId)
    {
        customer.CompanyId = request.CompanyId;
        customer.ExternalId = externalId;
        customer.CompanyName = request.CompanyName.Trim();
        customer.BrandsJson = JsonSerializer.Serialize(
            request.Brands
                .Where(b => !string.IsNullOrWhiteSpace(b.Name))
                .Select(b => new { name = b.Name.Trim(), count = Math.Max(0, b.Count) }),
            JsonOpts);
        customer.ContactsJson = JsonSerializer.Serialize(
            request.Contacts
                .Where(c => !string.IsNullOrWhiteSpace(c.Name))
                .Select(c => new
                {
                    id = string.IsNullOrWhiteSpace(c.Id) ? Guid.NewGuid().ToString("N")[..8] : c.Id.Trim(),
                    name = c.Name.Trim(),
                    position = (c.Position ?? string.Empty).Trim(),
                    email = (c.Email ?? string.Empty).Trim(),
                    mobile = (c.Mobile ?? string.Empty).Trim(),
                }),
            JsonOpts);
        customer.Status = request.Status.Trim();
        customer.LastContactDate = request.LastContactDate.HasValue
            ? DateTime.SpecifyKind(request.LastContactDate.Value, DateTimeKind.Utc)
            : null;
        customer.LastDiscussionBrief = (request.LastDiscussionBrief ?? string.Empty).Trim();
        customer.EngagedUserId = request.EngagedUserId;
        customer.EngagedUserEmail = (request.EngagedUserEmail ?? string.Empty).Trim().ToLowerInvariant();
        customer.EngagedUserName = (request.EngagedUserName ?? string.Empty).Trim();
        customer.Active = request.Active;
        return customer;
    }

    static object MapCustomer(SalesModuleCustomer c) => new
    {
        c.Id,
        c.CompanyId,
        c.ExternalId,
        c.CompanyName,
        brands = ParseJson(c.BrandsJson),
        contacts = ParseJson(c.ContactsJson),
        c.Status,
        createdAt = c.CreatedAt,
        lastContactDate = c.LastContactDate,
        c.LastDiscussionBrief,
        c.EngagedUserId,
        c.EngagedUserEmail,
        c.EngagedUserName,
        c.Active,
    };

    static object MapAppointment(SalesModuleAppointment a, SalesModuleCustomer? customer) => new
    {
        a.Id,
        a.CompanyId,
        a.SalesModuleCustomerId,
        customerName = customer?.CompanyName ?? string.Empty,
        customerExternalId = customer?.ExternalId ?? string.Empty,
        a.Title,
        a.Notes,
        startsAt = a.StartsAt,
        endsAt = a.EndsAt,
        a.Location,
        a.EngagedUserId,
        a.EngagedUserEmail,
        createdAt = a.CreatedAt,
        outlookEventId = a.OutlookEventId,
        outlookWebLink = string.IsNullOrWhiteSpace(a.OutlookWebLink) ? null : a.OutlookWebLink,
        outlookSynced = !string.IsNullOrWhiteSpace(a.OutlookEventId),
        outlookSyncError = string.IsNullOrWhiteSpace(a.OutlookSyncError) ? null : a.OutlookSyncError,
        outlookSyncedAt = a.OutlookSyncedAt,
    };

    static object ParseJson(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<object>(json) ?? Array.Empty<object>();
        }
        catch
        {
            return Array.Empty<object>();
        }
    }
}
