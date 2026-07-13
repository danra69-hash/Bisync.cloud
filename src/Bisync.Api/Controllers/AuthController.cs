using System.Security.Cryptography;
using System.Text.Json;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Bisync.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(
    BisyncDbContext db,
    IEmailSender emailSender,
    IConfiguration configuration,
    IHttpContextAccessor httpContextAccessor) : ControllerBase
{
    public record LoginRequest(string Email, string Password);

    public record RegisterRequest(
        string Surname,
        string GivenName,
        string Email,
        string Mobile,
        string Password,
        string ConfirmPassword);

    public record ConfirmActivationRequest(string Token);

    public record CompleteCompanyOnboardingRequest(int UserId, CompanyOnboardingDto Company);

    public record CompleteLocationOnboardingRequest(int UserId, LocationOnboardingDto Location);

    public class CompanyOnboardingDto
    {
        public string Name { get; set; } = string.Empty;
        public string Brn { get; set; } = string.Empty;
        public string GstTin { get; set; } = string.Empty;
        public string CountryCode { get; set; } = "MY";
        public string AddressLine1 { get; set; } = string.Empty;
        public string AddressLine2 { get; set; } = string.Empty;
        public string City { get; set; } = string.Empty;
        public string StateProvince { get; set; } = string.Empty;
        public string Postcode { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public string Fax { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public bool Active { get; set; } = true;
        public string BusinessTypesJson { get; set; } = "[]";
        public string VendorPolicyTagsJson { get; set; } = "[]";
        public string ModulesJson { get; set; } = "[]";
    }

    public class LocationOnboardingDto
    {
        public string Name { get; set; } = string.Empty;
        public string AddressLine1 { get; set; } = string.Empty;
        public string AddressLine2 { get; set; } = string.Empty;
        public string City { get; set; } = string.Empty;
        public string StateProvince { get; set; } = string.Empty;
        public string Postcode { get; set; } = string.Empty;
    }

    [HttpPost("login")]
    public async Task<ActionResult<object>> Login([FromBody] LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            return BadRequest("Email and password are required.");

        var normalized = request.Email.Trim().ToLowerInvariant();
        var user = await db.AppUsers
            .AsNoTracking()
            .Include(u => u.Employee)
            .FirstOrDefaultAsync(u => u.Email.ToLower() == normalized);

        if (user is null || !user.Active)
            return StatusCode(401, new { message = "Invalid email or password." });

        var passwordValid = AppPasswordHasher.Verify(request.Password, user.PasswordHash);
        if (!passwordValid && string.IsNullOrWhiteSpace(user.PasswordHash))
            passwordValid = request.Password == "Pass@123";

        if (!passwordValid)
            return StatusCode(401, new { message = "Invalid email or password." });

        var companies = await db.Companies.AsNoTracking().ToDictionaryAsync(c => c.Id, c => c.Name);
        var locations = await db.Locations.AsNoTracking().ToDictionaryAsync(l => l.Id, l => l.Name);

        return Ok(MapUser(user, companies, locations));
    }

    [HttpPost("register")]
    public async Task<ActionResult<object>> Register([FromBody] RegisterRequest request)
    {
        var surname = (request.Surname ?? string.Empty).Trim();
        var givenName = (request.GivenName ?? string.Empty).Trim();
        var email = (request.Email ?? string.Empty).Trim().ToLowerInvariant();
        var mobile = (request.Mobile ?? string.Empty).Trim();
        var password = request.Password ?? string.Empty;
        var confirm = request.ConfirmPassword ?? string.Empty;

        if (string.IsNullOrWhiteSpace(surname) || string.IsNullOrWhiteSpace(givenName))
            return BadRequest(new { message = "Surname and given name are required." });
        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@'))
            return BadRequest(new { message = "A valid email address is required." });
        if (string.IsNullOrWhiteSpace(mobile))
            return BadRequest(new { message = "Mobile number is required." });
        if (password.Length < 8)
            return BadRequest(new { message = "Password must be at least 8 characters." });
        if (!string.Equals(password, confirm, StringComparison.Ordinal))
            return BadRequest(new { message = "Password and confirmation do not match." });

        var mobileDigits = NormalizePhoneDigits(mobile);
        if (mobileDigits.Length < 8)
            return BadRequest(new { message = "Enter a valid mobile number." });

        var candidates = await db.AppUsers
            .AsNoTracking()
            .Select(u => new { u.Email, u.Phone })
            .ToListAsync();

        var emailTaken = candidates.Any(u =>
            string.Equals((u.Email ?? string.Empty).Trim(), email, StringComparison.OrdinalIgnoreCase));
        var mobileTaken = candidates.Any(u =>
            NormalizePhoneDigits(u.Phone) == mobileDigits
            && NormalizePhoneDigits(u.Phone).Length >= 8);

        if (emailTaken && mobileTaken)
            return Conflict(new { message = "This email address and mobile number are already registered." });
        if (emailTaken)
            return Conflict(new { message = "This email address is already registered." });
        if (mobileTaken)
            return Conflict(new { message = "This mobile number is already registered." });

        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        var user = new AppUser
        {
            FullName = $"{givenName} {surname}".Trim(),
            Email = email,
            Phone = mobile,
            Role = "Company Admin",
            Active = false,
            AccessJson = """{"modules":[]}""",
            CompanyId = null,
            LocationIdsJson = "[]",
            PasswordHash = AppPasswordHasher.Hash(password),
            ActivationToken = token,
            ActivationTokenExpiresAt = DateTime.UtcNow.AddHours(48),
        };

        await DatabaseSchemaHelper.TryResyncIdentitySequenceAsync(db, "AppUsers");
        db.AppUsers.Add(user);
        await db.SaveChangesAsync();

        var activationUrl = BuildActivationUrl(token);
        var body =
            $"Welcome to Bisync.cloud.\n\n" +
            $"Please confirm your account by opening this link:\n{activationUrl}\n\n" +
            $"This link expires in 48 hours.";

        await emailSender.SendAsync(email, "Confirm your Bisync.cloud account", body);

        return Ok(new
        {
            message = "Registration successful. Confirm your email to activate the account.",
            email,
            activationUrl,
        });
    }

    [HttpPost("confirm-activation")]
    public async Task<ActionResult<object>> ConfirmActivation([FromBody] ConfirmActivationRequest request)
    {
        var token = (request.Token ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(token))
            return BadRequest(new { message = "Activation token is required." });

        var user = await db.AppUsers.FirstOrDefaultAsync(u => u.ActivationToken == token);
        if (user is null)
            return NotFound(new { message = "Invalid or expired activation link." });

        if (user.ActivationTokenExpiresAt is DateTime expires && expires < DateTime.UtcNow)
            return BadRequest(new { message = "This activation link has expired. Please register again." });

        user.Active = true;
        user.ActivationToken = null;
        user.ActivationTokenExpiresAt = null;
        await db.SaveChangesAsync();

        return Ok(new
        {
            message = "Account activated. You can log in now.",
            email = user.Email,
        });
    }

    [HttpPost("complete-company-onboarding")]
    public async Task<ActionResult<object>> CompleteCompanyOnboarding([FromBody] CompleteCompanyOnboardingRequest request)
    {
        if (request.UserId <= 0)
            return BadRequest(new { message = "User is required." });
        if (request.Company is null || string.IsNullOrWhiteSpace(request.Company.Name))
            return BadRequest(new { message = "Company name is required." });

        var user = await db.AppUsers.Include(u => u.Employee).FirstOrDefaultAsync(u => u.Id == request.UserId);
        if (user is null || !user.Active)
            return NotFound(new { message = "User not found or not activated." });
        if (user.CompanyId is not null)
        {
            var existingCompanies = await db.Companies.AsNoTracking().ToDictionaryAsync(c => c.Id, c => c.Name);
            var existingLocations = await db.Locations.AsNoTracking().ToDictionaryAsync(l => l.Id, l => l.Name);
            return Ok(MapUser(user, existingCompanies, existingLocations));
        }

        var dto = request.Company;
        var validationError = CompanyProfileRules.Validate(dto.BusinessTypesJson, dto.VendorPolicyTagsJson);
        if (validationError is not null) return BadRequest(new { message = validationError });
        var modulesError = CompanyModuleRules.ValidateCompanyModules(dto.ModulesJson);
        if (modulesError is not null) return BadRequest(new { message = modulesError });

        var company = new Company
        {
            Name = dto.Name.Trim(),
            Brn = dto.Brn?.Trim() ?? string.Empty,
            GstTin = dto.GstTin?.Trim() ?? string.Empty,
            CountryCode = string.IsNullOrWhiteSpace(dto.CountryCode) ? "MY" : dto.CountryCode.Trim(),
            AddressLine1 = dto.AddressLine1?.Trim() ?? string.Empty,
            AddressLine2 = dto.AddressLine2?.Trim() ?? string.Empty,
            City = dto.City?.Trim() ?? string.Empty,
            StateProvince = dto.StateProvince?.Trim() ?? string.Empty,
            Postcode = dto.Postcode?.Trim() ?? string.Empty,
            Phone = dto.Phone?.Trim() ?? string.Empty,
            Fax = dto.Fax?.Trim() ?? string.Empty,
            Email = dto.Email?.Trim() ?? string.Empty,
            Active = true,
            BusinessTypesJson = dto.BusinessTypesJson ?? "[]",
            VendorPolicyTagsJson = dto.VendorPolicyTagsJson ?? "[]",
            ModulesJson = dto.ModulesJson ?? "[]",
        };

        await DatabaseSchemaHelper.TryResyncIdentitySequenceAsync(db, "Companies");
        db.Companies.Add(company);
        await db.SaveChangesAsync();

        user.CompanyId = company.Id;
        user.Role = string.IsNullOrWhiteSpace(user.Role) ? "Company Admin" : user.Role;
        user.AccessJson = BuildOwnerAccessJson(company.ModulesJson);
        user.LocationIdsJson = "[]";
        await db.SaveChangesAsync();

        var companies = await db.Companies.AsNoTracking().ToDictionaryAsync(c => c.Id, c => c.Name);
        var locations = await db.Locations.AsNoTracking().ToDictionaryAsync(l => l.Id, l => l.Name);
        return Ok(MapUser(user, companies, locations));
    }

    [HttpPost("complete-location-onboarding")]
    public async Task<ActionResult<object>> CompleteLocationOnboarding([FromBody] CompleteLocationOnboardingRequest request)
    {
        if (request.UserId <= 0)
            return BadRequest(new { message = "User is required." });
        if (request.Location is null || string.IsNullOrWhiteSpace(request.Location.Name))
            return BadRequest(new { message = "Location name is required." });

        var user = await db.AppUsers.Include(u => u.Employee).FirstOrDefaultAsync(u => u.Id == request.UserId);
        if (user is null || !user.Active)
            return NotFound(new { message = "User not found or not activated." });
        if (user.CompanyId is null)
            return BadRequest(new { message = "Register a company before adding a location." });

        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == user.CompanyId.Value);
        if (company is null)
            return BadRequest(new { message = "Company not found." });

        var assignedIds = ParseLocationIds(user.LocationIdsJson);
        var companyLocationIds = await db.Locations.AsNoTracking()
            .Where(l => l.CompanyId == company.Id)
            .Select(l => l.Id)
            .ToListAsync();
        if (companyLocationIds.Count > 0 && assignedIds.Any(id => companyLocationIds.Contains(id)))
        {
            var existingCompanies = await db.Companies.AsNoTracking().ToDictionaryAsync(c => c.Id, c => c.Name);
            var existingLocations = await db.Locations.AsNoTracking().ToDictionaryAsync(l => l.Id, l => l.Name);
            return Ok(MapUser(user, existingCompanies, existingLocations));
        }

        var dto = request.Location;
        // Inherit company profile/modules for first onboarding location.
        const string inherit = "[]";
        var businessTypesJson = CompanyProfileRules.NormalizeLocationProfileForStorage(inherit, company.BusinessTypesJson);
        var vendorPolicyTagsJson = CompanyProfileRules.NormalizeLocationProfileForStorage(inherit, company.VendorPolicyTagsJson, ignoreCase: true);
        var modulesJson = CompanyModuleRules.NormalizeLocationModulesForStorage(inherit, company.ModulesJson);
        var effectiveBusinessTypesJson = CompanyProfileRules.ResolveProfileJson(businessTypesJson, company.BusinessTypesJson);
        var effectiveVendorPolicyTagsJson = CompanyProfileRules.ResolveProfileJson(vendorPolicyTagsJson, company.VendorPolicyTagsJson);
        var validationError = CompanyProfileRules.Validate(effectiveBusinessTypesJson, effectiveVendorPolicyTagsJson);
        if (validationError is not null)
            return BadRequest(new { message = validationError });

        await DatabaseSchemaHelper.TryResyncIdentitySequenceAsync(db, "Locations");

        var externalId = await GenerateUniqueLocationExternalIdAsync(dto.Name);

        var loc = new Location
        {
            ExternalId = externalId,
            Name = dto.Name.Trim(),
            CompanyId = company.Id,
            AddressLine1 = dto.AddressLine1?.Trim() ?? string.Empty,
            AddressLine2 = dto.AddressLine2?.Trim() ?? string.Empty,
            City = dto.City?.Trim() ?? string.Empty,
            StateProvince = dto.StateProvince?.Trim() ?? string.Empty,
            Postcode = dto.Postcode?.Trim() ?? string.Empty,
            PrincipalContactUserId = user.Id,
            BusinessTypesJson = businessTypesJson,
            VendorPolicyTagsJson = vendorPolicyTagsJson,
            ModulesJson = modulesJson,
            Address = string.Join(", ", new[] { dto.AddressLine1, dto.City, dto.StateProvince, dto.Postcode }
                .Where(s => !string.IsNullOrWhiteSpace(s))),
        };

        db.Locations.Add(loc);
        await db.SaveChangesAsync();

        if (!assignedIds.Contains(loc.Id))
            assignedIds.Add(loc.Id);
        user.LocationIdsJson = JsonSerializer.Serialize(assignedIds);
        await db.SaveChangesAsync();

        var companies = await db.Companies.AsNoTracking().ToDictionaryAsync(c => c.Id, c => c.Name);
        var locationsMap = await db.Locations.AsNoTracking().ToDictionaryAsync(l => l.Id, l => l.Name);
        return Ok(MapUser(user, companies, locationsMap));
    }

    async Task<string> GenerateUniqueLocationExternalIdAsync(string name)
    {
        var slugBase = new string(name.Trim().ToLowerInvariant().Where(ch => char.IsLetterOrDigit(ch) || ch == '-').ToArray());
        if (string.IsNullOrWhiteSpace(slugBase)) slugBase = "location";
        var candidate = slugBase.Length > 36 ? slugBase[..36] : slugBase;
        var suffix = 2;
        while (await db.Locations.AnyAsync(l => l.ExternalId == candidate))
        {
            candidate = $"{slugBase}-{suffix}";
            if (candidate.Length > 40) candidate = $"{slugBase[..Math.Max(1, 40 - $"-{suffix}".Length)]}-{suffix}";
            suffix++;
        }
        return candidate;
    }

    static string NormalizePhoneDigits(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone)) return string.Empty;
        return new string(phone.Where(char.IsDigit).ToArray());
    }

    string BuildActivationUrl(string token)
    {
        var configured = configuration["App:PublicBaseUrl"]?.Trim().TrimEnd('/');
        if (!string.IsNullOrWhiteSpace(configured))
            return $"{configured}/activate/{token}";

        var request = httpContextAccessor.HttpContext?.Request;
        if (request is not null)
        {
            var origin = $"{request.Scheme}://{request.Host.Value}".TrimEnd('/');
            // Local API is :5299; browser UI is usually Vite :5173 — prefer Origin header when present.
            var headerOrigin = request.Headers.Origin.FirstOrDefault()?.Trim().TrimEnd('/');
            if (!string.IsNullOrWhiteSpace(headerOrigin))
                return $"{headerOrigin}/activate/{token}";
            return $"{origin}/activate/{token}";
        }

        return $"https://bisync-cloud-389272498937.asia-southeast1.run.app/activate/{token}";
    }

    static string BuildOwnerAccessJson(string? modulesJson)
    {
        var modules = new List<string>();
        try
        {
            modules = JsonSerializer.Deserialize<List<string>>(modulesJson ?? "[]") ?? [];
        }
        catch
        {
            modules = [];
        }

        var includeRms = modules.Any(m => string.Equals(m, "RMS", StringComparison.OrdinalIgnoreCase));
        var tasks = new Dictionary<string, bool>(StringComparer.Ordinal);
        if (includeRms)
        {
            foreach (var id in new[]
            {
                "viewOrder", "createEditOrder", "approveOrder", "receiveOrder", "consolidateOrder", "cashPurchase", "orderTemplate",
                "productManagement", "subProductManagement", "offlineSales",
                "stockCard", "inventoryPost", "inventoryConfirmation", "inventoryAdjustment", "creditNote", "wastage", "transfer", "inventoryConfiguration",
                "createEdit", "activateDeactivateVendorProducts", "createEditComponentGroup", "createEditStorageAssignment",
                "viewVendorList", "viewVendorProducts", "activateDeactivateVendor",
                "viewProductSubProduct", "manageCustomers", "customerGroup", "manageSalesOrder", "manageInvoice", "promotionScheduler",
                "viewReports", "accountMapping",
            })
            {
                tasks[id] = true;
            }
        }

        var payload = new Dictionary<string, object?>
        {
            ["modules"] = modules,
            ["rms"] = new Dictionary<string, object?>
            {
                ["enabled"] = includeRms,
                ["tasks"] = tasks,
            },
        };
        return JsonSerializer.Serialize(payload);
    }

    static object MapUser(Models.AppUser u, Dictionary<int, string> companies, Dictionary<int, string> locations)
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
            return System.Text.Json.JsonSerializer.Deserialize<List<int>>(json) ?? [];
        }
        catch
        {
            return [];
        }
    }
}
