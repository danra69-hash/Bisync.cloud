using Bisync.Api.Data;
using Bisync.Api.Models;
using Bisync.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/dev-console/auth")]
public class DevConsoleAuthController(
    BisyncDbContext db,
    DevConsoleAuthService auth,
    IConfiguration config,
    IWebHostEnvironment env,
    ISystemAuditService systemAudit) : ControllerBase
{
    bool IsConsoleEnabled()
    {
        if (env.IsDevelopment()) return true;
        if (string.Equals(config["DEV_CONSOLE_ENABLED"], "true", StringComparison.OrdinalIgnoreCase))
            return true;
        var host = Request.Host.Host;
        return string.Equals(host, "localhost", StringComparison.OrdinalIgnoreCase)
            || host is "127.0.0.1" or "::1";
    }

    ActionResult? GuardEnabled() => IsConsoleEnabled() ? null : NotFound();

    [HttpGet("config")]
    public ActionResult<object> Config()
    {
        var blocked = GuardEnabled();
        if (blocked is not null) return blocked;
        return Ok(new
        {
            googleClientId = config["DevConsole:GoogleClientId"] ?? "",
            googleRequired = auth.GoogleConfigured || !auth.CanSkipGoogle,
            allowPasswordOnly = auth.CanSkipGoogle,
            allowedDomains = auth.AllowedDomains,
            rootEmail = auth.RootEmail,
        });
    }

    public record PasswordLoginRequest(string Email, string Password);

    [HttpPost("password")]
    public async Task<ActionResult<object>> PasswordLogin([FromBody] PasswordLoginRequest request, CancellationToken ct)
    {
        var blocked = GuardEnabled();
        if (blocked is not null) return blocked;

        await auth.EnsureRootUserAsync(ct);
        var (ticket, error) = await auth.CreatePasswordTicketAsync(request.Email ?? "", request.Password ?? "", ct);
        if (error is not null || ticket?.DevTeamUser is null)
            return Unauthorized(new { message = error ?? "Login failed." });

        return Ok(new
        {
            passwordTicket = ticket.Ticket,
            expiresAt = ticket.ExpiresAt,
            email = ticket.DevTeamUser.Email,
            fullName = ticket.DevTeamUser.FullName,
            googleRequired = auth.GoogleConfigured || !auth.CanSkipGoogle,
            allowPasswordOnly = auth.CanSkipGoogle,
            googleClientId = config["DevConsole:GoogleClientId"] ?? "",
        });
    }

    public record GoogleCompleteRequest(string PasswordTicket, string GoogleIdToken);

    [HttpPost("google")]
    public async Task<ActionResult<object>> CompleteGoogle([FromBody] GoogleCompleteRequest request, CancellationToken ct)
    {
        var blocked = GuardEnabled();
        if (blocked is not null) return blocked;

        var (session, user, error) = await auth.CompleteWithGoogleAsync(
            request.PasswordTicket ?? "",
            request.GoogleIdToken ?? "",
            ct);
        if (error is not null || session is null || user is null)
            return Unauthorized(new { message = error ?? "Google Sign-In failed." });

        return Ok(SessionPayload(session, user));
    }

    public record PasswordOnlyCompleteRequest(string PasswordTicket);

    [HttpPost("password-only")]
    public async Task<ActionResult<object>> CompletePasswordOnly(
        [FromBody] PasswordOnlyCompleteRequest request,
        CancellationToken ct)
    {
        var blocked = GuardEnabled();
        if (blocked is not null) return blocked;

        var (session, user, error) = await auth.CompletePasswordOnlyAsync(request.PasswordTicket ?? "", ct);
        if (error is not null || session is null || user is null)
            return Unauthorized(new { message = error ?? "Login failed." });

        return Ok(SessionPayload(session, user));
    }

    [HttpGet("me")]
    public async Task<ActionResult<object>> Me(CancellationToken ct)
    {
        var blocked = GuardEnabled();
        if (blocked is not null) return blocked;

        var token = Request.Headers[DevConsoleAuthService.TokenHeader].FirstOrDefault();
        var (user, session) = await auth.ResolveSessionAsync(token, ct);
        if (user is null || session is null)
            return Unauthorized(new { message = "Dev Console session required." });

        return Ok(new
        {
            email = user.Email,
            fullName = user.FullName,
            isRoot = user.IsRoot,
            expiresAt = session.ExpiresAt,
            googleVerified = !string.IsNullOrWhiteSpace(session.GoogleEmail),
        });
    }

    [HttpPost("logout")]
    public async Task<ActionResult> Logout(CancellationToken ct)
    {
        var blocked = GuardEnabled();
        if (blocked is not null) return blocked;

        var token = Request.Headers[DevConsoleAuthService.TokenHeader].FirstOrDefault();
        await auth.RevokeSessionAsync(token, ct);
        return NoContent();
    }

    [HttpGet("team")]
    public async Task<ActionResult<object>> ListTeam(CancellationToken ct)
    {
        var (err, actor) = await RequireRootAsync(ct);
        if (err is not null) return err;

        var rows = await db.DevTeamUsers.AsNoTracking()
            .OrderByDescending(u => u.IsRoot)
            .ThenBy(u => u.Email)
            .Select(u => new
            {
                u.Id,
                u.Email,
                u.FullName,
                u.Active,
                u.IsRoot,
                hasGoogle = u.GoogleSubject != null && u.GoogleSubject != "",
                u.CreatedAt,
                u.CreatedByEmail,
                u.UpdatedAt,
            })
            .ToListAsync(ct);

        return Ok(new { users = rows, actorEmail = actor!.Email });
    }

    public record UpsertTeamUserRequest(string Email, string FullName, string? Password, bool? Active);

    [HttpPost("team")]
    public async Task<ActionResult<object>> CreateTeamUser([FromBody] UpsertTeamUserRequest request, CancellationToken ct)
    {
        var (err, actor) = await RequireRootAsync(ct);
        if (err is not null) return err;

        var email = (request.Email ?? "").Trim().ToLowerInvariant();
        if (!auth.IsAllowedEmailDomain(email))
            return BadRequest(new { message = $"Email must end with @{string.Join(" or @", auth.AllowedDomains)}." });
        if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 8)
            return BadRequest(new { message = "Password must be at least 8 characters." });
        if (await db.DevTeamUsers.AnyAsync(u => u.Email == email, ct))
            return Conflict(new { message = "That email is already on the Dev Team list." });

        var user = new DevTeamUser
        {
            Email = email,
            FullName = (request.FullName ?? "").Trim(),
            PasswordHash = AppPasswordHasher.Hash(request.Password),
            Active = true,
            IsRoot = false,
            CreatedAt = DateTime.UtcNow,
            CreatedByEmail = actor!.Email,
        };
        if (string.IsNullOrWhiteSpace(user.FullName))
            user.FullName = email.Split('@')[0];

        db.DevTeamUsers.Add(user);
        await db.SaveChangesAsync(ct);
        return Ok(new { id = user.Id, email = user.Email, fullName = user.FullName, active = user.Active, isRoot = user.IsRoot });
    }

    [HttpPut("team/{id:int}")]
    public async Task<ActionResult<object>> UpdateTeamUser(int id, [FromBody] UpsertTeamUserRequest request, CancellationToken ct)
    {
        var (err, actor) = await RequireRootAsync(ct);
        if (err is not null) return err;

        var user = await db.DevTeamUsers.FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user is null) return NotFound();

        if (!string.IsNullOrWhiteSpace(request.FullName))
            user.FullName = request.FullName.Trim();

        if (!string.IsNullOrWhiteSpace(request.Password))
        {
            if (request.Password.Length < 8)
                return BadRequest(new { message = "Password must be at least 8 characters." });
            user.PasswordHash = AppPasswordHasher.Hash(request.Password);
        }

        if (request.Active is bool active)
        {
            if (user.IsRoot && !active)
                return BadRequest(new { message = "Root account cannot be deactivated." });
            user.Active = active;
        }

        // Email changes only for non-root, and must stay on allowlist.
        if (!user.IsRoot && !string.IsNullOrWhiteSpace(request.Email))
        {
            var email = request.Email.Trim().ToLowerInvariant();
            if (!auth.IsAllowedEmailDomain(email))
                return BadRequest(new { message = $"Email must end with @{string.Join(" or @", auth.AllowedDomains)}." });
            if (!string.Equals(email, user.Email, StringComparison.OrdinalIgnoreCase)
                && await db.DevTeamUsers.AnyAsync(u => u.Email == email && u.Id != id, ct))
                return Conflict(new { message = "That email is already on the Dev Team list." });
            user.Email = email;
        }

        user.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return Ok(new { id = user.Id, email = user.Email, fullName = user.FullName, active = user.Active, isRoot = user.IsRoot });
    }

    [HttpDelete("team/{id:int}")]
    public async Task<ActionResult> DeleteTeamUser(int id, CancellationToken ct)
    {
        var (err, _) = await RequireRootAsync(ct);
        if (err is not null) return err;

        var user = await db.DevTeamUsers.FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user is null) return NotFound();
        if (user.IsRoot)
            return BadRequest(new { message = "Root account cannot be deleted." });

        var sessions = await db.DevConsoleSessions.Where(s => s.DevTeamUserId == id).ToListAsync(ct);
        db.DevConsoleSessions.RemoveRange(sessions);
        var tickets = await db.DevConsolePasswordTickets.Where(t => t.DevTeamUserId == id).ToListAsync(ct);
        db.DevConsolePasswordTickets.RemoveRange(tickets);
        db.DevTeamUsers.Remove(user);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    public record GhostEnterRequest(int CompanyId, int LocationId);

    /// <summary>
    /// Open the main app as Super User scoped to a company + location (Ghost Support).
    /// </summary>
    [HttpPost("ghost-enter")]
    public async Task<ActionResult<object>> GhostEnter([FromBody] GhostEnterRequest request, CancellationToken ct)
    {
        var (err, actor) = await RequireDevSessionAsync(ct);
        if (err is not null) return err;

        if (request.CompanyId <= 0 || request.LocationId <= 0)
            return BadRequest(new { message = "Company and Location are required." });

        var company = await db.Companies.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == request.CompanyId, ct);
        if (company is null)
            return BadRequest(new { message = "Company not found." });
        if (!company.Active)
            return BadRequest(new { message = "Company is inactive." });

        var location = await db.Locations.AsNoTracking()
            .FirstOrDefaultAsync(l => l.Id == request.LocationId, ct);
        if (location is null)
            return BadRequest(new { message = "Location not found." });
        if (location.CompanyId != company.Id)
            return BadRequest(new { message = "Location does not belong to the selected company." });

        var rootEmail = auth.RootEmail;
        var appUser = await db.AppUsers.AsNoTracking()
            .Include(u => u.Employee)
            .FirstOrDefaultAsync(u => u.Email.ToLower() == rootEmail, ct);
        if (appUser is null || !appUser.Active)
            return StatusCode(500, new { message = $"Super User account ({rootEmail}) is missing or inactive." });

        // Always expose Super Admin permissions for Ghost Support (do not mutate DB).
        var accessJson = SuperAdminAccess.BuildJson();
        var companies = await db.Companies.AsNoTracking().ToDictionaryAsync(c => c.Id, c => c.Name, ct);
        var locations = await db.Locations.AsNoTracking().ToDictionaryAsync(l => l.Id, l => l.Name, ct);
        var locationIds = ParseLocationIds(appUser.LocationIdsJson);

        await systemAudit.RecordAsync(new SystemAuditWriteRequest(
            Category: "Login",
            Action: "GhostEnter",
            Summary: $"Ghost Support enter by {actor!.Email} → {company.Name} / {location.Name}",
            CompanyId: company.Id,
            CompanyName: company.Name,
            CountryCode: company.CountryCode,
            UserId: appUser.Id,
            UserEmail: appUser.Email,
            UserName: appUser.FullName,
            EntityType: "GhostSupport",
            EntityKey: $"{company.Id}:{location.Id}",
            Details: new
            {
                actorEmail = actor.Email,
                actorName = actor.FullName,
                companyId = company.Id,
                companyName = company.Name,
                locationId = location.Id,
                locationExternalId = location.ExternalId,
                locationName = location.Name,
            },
            LocationId: location.Id,
            LocationExternalId: location.ExternalId,
            LocationName: location.Name), ct);

        return Ok(new
        {
            user = new
            {
                appUser.Id,
                appUser.EmployeeId,
                employeeCode = appUser.Employee?.EmployeeCode,
                fullName = appUser.FullName,
                email = appUser.Email,
                role = "Super Admin",
                phone = appUser.Phone,
                active = appUser.Active,
                accessJson,
                companyId = company.Id,
                companyName = company.Name,
                locationIds,
                locationNames = locationIds
                    .Where(id => locations.ContainsKey(id))
                    .Select(id => locations[id])
                    .ToList(),
                locationIdsJson = appUser.LocationIdsJson,
            },
            company = new { company.Id, company.Name, company.CountryCode },
            location = new
            {
                location.Id,
                location.ExternalId,
                location.Name,
                location.CompanyId,
            },
            actorEmail = actor.Email,
        });
    }

    async Task<(ActionResult? Error, DevTeamUser? Actor)> RequireDevSessionAsync(CancellationToken ct)
    {
        var blocked = GuardEnabled();
        if (blocked is not null) return (blocked, null);

        await auth.EnsureRootUserAsync(ct);
        var token = Request.Headers[DevConsoleAuthService.TokenHeader].FirstOrDefault();
        var (user, _) = await auth.ResolveSessionAsync(token, ct);
        if (user is null)
            return (Unauthorized(new { message = "Dev Console session required." }), null);
        return (null, user);
    }

    async Task<(ActionResult? Error, DevTeamUser? Actor)> RequireRootAsync(CancellationToken ct)
    {
        var (err, user) = await RequireDevSessionAsync(ct);
        if (err is not null) return (err, null);
        if (!user!.IsRoot && !string.Equals(user.Email, auth.RootEmail, StringComparison.OrdinalIgnoreCase))
            return (StatusCode(403, new { message = "Only the root Dev Console account can manage the team." }), null);
        return (null, user);
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

    static object SessionPayload(DevConsoleSession session, DevTeamUser user) => new
    {
        token = session.Token,
        expiresAt = session.ExpiresAt,
        email = user.Email,
        fullName = user.FullName,
        isRoot = user.IsRoot,
    };
}
