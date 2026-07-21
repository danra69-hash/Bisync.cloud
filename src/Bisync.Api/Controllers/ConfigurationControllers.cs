using Bisync.Api.Data;
using Bisync.Api.Models;
using Bisync.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CompaniesController(BisyncDbContext db) : ControllerBase
{
    static object MapCompany(Company c, int? locationCount = null)
    {
        var outboundEmail = !string.IsNullOrWhiteSpace(c.SmtpFromEmail)
            ? c.SmtpFromEmail
            : (c.SmtpUsername ?? string.Empty);
        var provider = CompanyOutboundEmailService.IsLikelyEmail(outboundEmail)
            ? CompanyOutboundEmailService.ResolveProvider(outboundEmail)
            : null;

        return new
        {
            c.Id,
            c.Name,
            c.Code,
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
            c.BusinessTypesJson,
            c.VendorPolicyTagsJson,
            c.ModulesJson,
            smtpHost = c.SmtpHost ?? string.Empty,
            smtpPort = c.SmtpPort > 0 ? c.SmtpPort : 587,
            smtpUseSsl = c.SmtpUseSsl,
            smtpUsername = c.SmtpUsername ?? string.Empty,
            smtpFromEmail = c.SmtpFromEmail ?? string.Empty,
            smtpFromName = c.SmtpFromName ?? string.Empty,
            smtpPasswordSet = !string.IsNullOrWhiteSpace(c.SmtpPassword),
            smtpPassword = string.Empty,
            smtpProviderId = provider?.Id ?? string.Empty,
            smtpProviderLabel = provider?.Label ?? string.Empty,
            smtpProviderTip = provider?.Tip ?? string.Empty,
            locationCount = locationCount ?? c.Locations?.Count ?? 0,
        };
    }

    /// <summary>
    /// Auto-configure SMTP from outbound email + password.
    /// Host / port / SSL / username are derived from the email provider (Microsoft, Google, …).
    /// </summary>
    static void ApplySmtpFields(Company target, Company source, bool isCreate)
    {
        var outboundEmail = !string.IsNullOrWhiteSpace(source.SmtpFromEmail)
            ? source.SmtpFromEmail
            : source.SmtpUsername;
        var incomingPassword = source.SmtpPassword;
        string? passwordArg = null;
        if (isCreate || !string.IsNullOrWhiteSpace(incomingPassword))
            passwordArg = (incomingPassword ?? string.Empty).Trim();

        CompanyOutboundEmailService.ApplyAutoSmtp(
            target,
            outboundEmail ?? string.Empty,
            passwordArg,
            source.SmtpFromName);
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> GetAll()
    {
        var rows = await db.Companies
            .AsNoTracking()
            .Include(c => c.Locations)
            .OrderBy(c => c.Name)
            .ToListAsync();
        return Ok(rows.Select(c => MapCompany(c, c.Locations.Count)));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<object>> GetById(int id)
    {
        var company = await db.Companies.AsNoTracking()
            .Include(c => c.Locations)
            .FirstOrDefaultAsync(c => c.Id == id);
        return company is null ? NotFound() : Ok(MapCompany(company, company.Locations.Count));
    }

    [HttpPost]
    public async Task<ActionResult<object>> Create([FromBody] Company company)
    {
        var validationError = CompanyProfileRules.Validate(company.BusinessTypesJson, company.VendorPolicyTagsJson);
        if (validationError is not null) return BadRequest(new { message = validationError });
        var modulesError = CompanyModuleRules.ValidateCompanyModules(company.ModulesJson);
        if (modulesError is not null) return BadRequest(new { message = modulesError });

        await DatabaseSchemaHelper.TryResyncIdentitySequenceAsync(db, "Companies");

        // Normalize SMTP on create (password may be empty until configured).
        ApplySmtpFields(company, company, isCreate: true);

        await CompanyCodeService.EnsureCodeAsync(db, company);
        db.Companies.Add(company);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = company.Id }, MapCompany(company, 0));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<object>> Update(int id, [FromBody] Company updated)
    {
        var validationError = CompanyProfileRules.Validate(updated.BusinessTypesJson, updated.VendorPolicyTagsJson);
        if (validationError is not null) return BadRequest(new { message = validationError });
        var modulesError = CompanyModuleRules.ValidateCompanyModules(updated.ModulesJson);
        if (modulesError is not null) return BadRequest(new { message = modulesError });

        var company = await db.Companies.Include(c => c.Locations).FirstOrDefaultAsync(c => c.Id == id);
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
        company.BusinessTypesJson = updated.BusinessTypesJson;
        company.VendorPolicyTagsJson = updated.VendorPolicyTagsJson;
        company.ModulesJson = updated.ModulesJson;
        ApplySmtpFields(company, updated, isCreate: false);
        await db.SaveChangesAsync();
        return Ok(MapCompany(company, company.Locations.Count));
    }

    public record OutboundEmailTestRequest(
        string ToEmail,
        string? SmtpPassword = null,
        string? SmtpFromEmail = null,
        string? SmtpFromName = null);

    /// <summary>
    /// Send a test message. Mail server is auto-detected from the outbound email address
    /// (Microsoft 365 / Google / Yahoo / …). Password empty = use saved password.
    /// </summary>
    [HttpPost("{id:int}/outbound-email/test")]
    public async Task<ActionResult<object>> TestOutboundEmail(int id, [FromBody] OutboundEmailTestRequest req, CancellationToken ct)
    {
        var company = await db.Companies.FirstOrDefaultAsync(c => c.Id == id, ct);
        if (company is null) return NotFound(new { message = "Company not found." });

        var outboundEmail = !string.IsNullOrWhiteSpace(req.SmtpFromEmail)
            ? req.SmtpFromEmail.Trim()
            : !string.IsNullOrWhiteSpace(company.SmtpFromEmail)
                ? company.SmtpFromEmail.Trim()
                : (company.SmtpUsername ?? string.Empty).Trim();
        var password = !string.IsNullOrWhiteSpace(req.SmtpPassword)
            ? CompanyOutboundEmailService.NormalizePassword(req.SmtpPassword)
            : CompanyOutboundEmailService.NormalizePassword(company.SmtpPassword);
        var fromName = !string.IsNullOrWhiteSpace(req.SmtpFromName)
            ? req.SmtpFromName.Trim()
            : company.SmtpFromName;

        if (!CompanyOutboundEmailService.IsLikelyEmail(outboundEmail))
            return BadRequest(new { message = "A valid outbound email address is required." });
        if (string.IsNullOrWhiteSpace(password))
            return BadRequest(new { message = "Email password is required." });

        var to = (req.ToEmail ?? string.Empty).Trim();
        if (!CompanyOutboundEmailService.IsLikelyEmail(to))
            return BadRequest(new { message = "A valid test recipient email is required." });

        try
        {
            var (used, providerLabel) = await CompanyOutboundEmailService.SendTestAsync(
                outboundEmail,
                password,
                fromName,
                to,
                company.Name,
                ct);

            // Persist the working auto-detected server + credentials used for the test.
            company.SmtpHost = used.Host;
            company.SmtpPort = used.Port;
            company.SmtpUseSsl = used.Security is MailKit.Security.SecureSocketOptions.StartTls
                or MailKit.Security.SecureSocketOptions.SslOnConnect;
            company.SmtpUsername = used.Username;
            company.SmtpFromEmail = used.FromEmail;
            company.SmtpFromName = used.FromName;
            company.SmtpPassword = password;
            await db.SaveChangesAsync(ct);

            return Ok(new
            {
                sent = true,
                to,
                provider = providerLabel,
                smtpHost = used.Host,
                message = $"Test email sent to {to} via {providerLabel}. Check the inbox (and spam) to confirm it works.",
            });
        }
        catch (Exception ex)
        {
            var detail = ex.InnerException?.Message ?? ex.Message;
            return BadRequest(new { message = $"Test email failed: {detail}" });
        }
    }
}

[ApiController]
[Route("api/[controller]")]
public class UsersController(BisyncDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> GetAll()
    {
        var users = await db.AppUsers
            .AsNoTracking()
            .Include(u => u.Employee)
            .OrderBy(u => u.FullName)
            .ToListAsync();
        var companies = await db.Companies.AsNoTracking().ToDictionaryAsync(c => c.Id, c => c.Name);
        var locations = await db.Locations.AsNoTracking().ToDictionaryAsync(l => l.Id, l => l.Name);

        return Ok(users.Select(u => MapUser(u, companies, locations)));
    }

    [HttpGet("available-employees")]
    public async Task<ActionResult<IEnumerable<object>>> GetAvailableEmployees()
    {
        var linkedIds = await db.AppUsers
            .AsNoTracking()
            .Where(u => u.EmployeeId != null)
            .Select(u => u.EmployeeId!.Value)
            .ToListAsync();

        var employees = await db.Employees
            .AsNoTracking()
            .Where(e => !linkedIds.Contains(e.Id))
            .OrderBy(e => e.Name)
            .Select(e => new
            {
                e.Id,
                e.EmployeeCode,
                e.Name,
                e.Email,
                e.Mobile,
                e.Position,
                e.Department,
                e.BisyncEnabled,
            })
            .ToListAsync();

        return Ok(employees);
    }

    [HttpPost]
    public async Task<ActionResult<AppUser>> Create([FromBody] UserUpsertRequest request)
    {
        if (request.EmployeeId is not int employeeId)
            return BadRequest("EmployeeId is required. Create the employee in Human Resources first.");
        if (request.CompanyId is null) return BadRequest("Company is required.");
        if (!await ValidateLocationsAsync(request.CompanyId.Value, request.LocationIdsJson))
            return BadRequest("One or more locations do not belong to the selected company.");

        var employee = await db.Employees.FindAsync(employeeId);
        if (employee is null) return NotFound("Employee not found.");

        if (await db.AppUsers.AnyAsync(u => u.EmployeeId == employeeId))
            return Conflict("This employee already has platform access configured.");

        var user = new AppUser
        {
            EmployeeId = employeeId,
            FullName = employee.Name,
            Email = employee.Email,
            Role = employee.Position,
            Phone = employee.Mobile,
            Active = request.Active,
            AccessJson = request.AccessJson ?? """{"modules":[]}""",
            CompanyId = request.CompanyId,
            LocationIdsJson = request.LocationIdsJson ?? "[]",
        };

        employee.BisyncEnabled = true;
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

        var user = await db.AppUsers.Include(u => u.Employee).FirstOrDefaultAsync(u => u.Id == id);
        if (user is null) return NotFound();

        if (user.EmployeeId is int employeeId)
        {
            var employee = user.Employee ?? await db.Employees.FindAsync(employeeId);
            if (employee is not null)
            {
                user.FullName = employee.Name;
                user.Email = employee.Email;
                user.Role = employee.Position;
                user.Phone = employee.Mobile;
                employee.BisyncEnabled = request.Active;
            }
        }
        else
        {
            user.FullName = request.FullName;
            user.Email = request.Email;
            user.Role = request.Role;
            user.Phone = request.Phone;
        }

        user.Active = request.Active;
        user.AccessJson = request.AccessJson ?? user.AccessJson;
        user.CompanyId = request.CompanyId;
        user.LocationIdsJson = request.LocationIdsJson ?? "[]";
        await db.SaveChangesAsync();
        return Ok(user);
    }

    static object MapUser(AppUser u, Dictionary<int, string> companies, Dictionary<int, string> locations)
    {
        var locationIds = ParseLocationIds(u.LocationIdsJson);
        return new
        {
            u.Id,
            u.EmployeeId,
            employeeCode = u.Employee?.EmployeeCode,
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
    int? EmployeeId,
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
    int? PrincipalContactUserId,
    string BusinessTypesJson,
    string VendorPolicyTagsJson,
    string ModulesJson
);

public record LocationConfigCreate(
    int? CompanyId,
    string Name,
    string AddressLine1,
    string AddressLine2,
    string City,
    string StateProvince,
    string Postcode,
    int? PrincipalContactUserId,
    string? BusinessTypesJson,
    string? VendorPolicyTagsJson,
    string? ModulesJson
);
