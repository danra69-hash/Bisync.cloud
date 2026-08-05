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
    ISystemAuditService systemAudit,
    IEmailSender emailSender,
    IHttpContextAccessor httpContextAccessor) : ControllerBase
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
            teamTypes = DevConsoleTabAccess.TeamTypes,
            tabs = DevConsoleTabAccess.AllTabs,
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
            position = user.Position,
            teamType = user.TeamType,
            isRoot = user.IsRoot,
            mustChangePassword = user.MustChangePassword,
            accessTabs = user.IsRoot
                ? DevConsoleTabAccess.AllTabs.ToList()
                : DevConsoleTabAccess.ParseTabs(user.AccessJson),
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

    public record ChangePasswordRequest(string CurrentPassword, string NewPassword);

    [HttpPost("change-password")]
    public async Task<ActionResult<object>> ChangePassword([FromBody] ChangePasswordRequest request, CancellationToken ct)
    {
        var (err, user) = await RequireDevSessionAsync(ct);
        if (err is not null) return err;

        var (ok, error) = await auth.ChangePasswordAsync(
            user!,
            request.CurrentPassword ?? "",
            request.NewPassword ?? "",
            ct);
        if (!ok)
            return BadRequest(new { message = error ?? "Could not change password." });

        return Ok(new { message = "Password updated." });
    }

    public record ForgotPasswordRequest(string Email);

    [HttpPost("forgot-password")]
    public async Task<ActionResult<object>> ForgotPassword([FromBody] ForgotPasswordRequest request, CancellationToken ct)
    {
        var blocked = GuardEnabled();
        if (blocked is not null) return blocked;

        var email = (request.Email ?? "").Trim().ToLowerInvariant();
        // Always return the same message to avoid email enumeration.
        const string responseMessage = "If that email is on the Dev Team list, a reset link has been sent.";

        if (!auth.IsAllowedEmailDomain(email))
            return Ok(new { message = responseMessage });

        var user = await db.DevTeamUsers.FirstOrDefaultAsync(u => u.Email == email, ct);
        if (user is null || !user.Active || !user.HasPassword)
            return Ok(new { message = responseMessage });

        var token = auth.IssuePasswordResetToken(user);
        await db.SaveChangesAsync(ct);

        var resetUrl = BuildDevConsoleUrl($"reset/{token}");
        await emailSender.SendAsync(
            user.Email,
            "Reset your Bisync Dev Console password",
            $"Hello {user.FullName},\n\n" +
            $"Reset your Dev Console password using this link:\n{resetUrl}\n\n" +
            $"This link expires in 24 hours.\n\n" +
            $"If you did not request this, you can ignore this email.",
            ct);

        return Ok(new { message = responseMessage, resetUrl });
    }

    public record TokenPasswordRequest(string Token, string Password);

    [HttpPost("accept-invite")]
    public async Task<ActionResult<object>> AcceptInvite([FromBody] TokenPasswordRequest request, CancellationToken ct)
    {
        var blocked = GuardEnabled();
        if (blocked is not null) return blocked;

        var (user, error) = await auth.AcceptInviteAsync(request.Token ?? "", request.Password ?? "", ct);
        if (error is not null || user is null)
            return BadRequest(new { message = error ?? "Could not activate account." });

        return Ok(new
        {
            message = "Account activated. You can sign in to Dev Console now.",
            email = user.Email,
            fullName = user.FullName,
        });
    }

    [HttpPost("reset-password")]
    public async Task<ActionResult<object>> ResetPassword([FromBody] TokenPasswordRequest request, CancellationToken ct)
    {
        var blocked = GuardEnabled();
        if (blocked is not null) return blocked;

        var (user, error) = await auth.ResetPasswordAsync(request.Token ?? "", request.Password ?? "", ct);
        if (error is not null || user is null)
            return BadRequest(new { message = error ?? "Could not reset password." });

        return Ok(new
        {
            message = "Password updated. You can sign in to Dev Console now.",
            email = user.Email,
        });
    }

    [HttpGet("invite/{token}")]
    public async Task<ActionResult<object>> PeekInvite(string token, CancellationToken ct)
    {
        var blocked = GuardEnabled();
        if (blocked is not null) return blocked;

        token = (token ?? "").Trim();
        var user = await db.DevTeamUsers.AsNoTracking()
            .FirstOrDefaultAsync(u => u.InviteToken == token, ct);
        if (user is null)
            return NotFound(new { message = "Invalid or expired invitation link." });
        if (user.InviteTokenExpiresAt is DateTime expires && expires < DateTime.UtcNow)
            return BadRequest(new { message = "This invitation link has expired." });

        return Ok(new { email = user.Email, fullName = user.FullName, position = user.Position, teamType = user.TeamType });
    }

    [HttpGet("reset/{token}")]
    public async Task<ActionResult<object>> PeekReset(string token, CancellationToken ct)
    {
        var blocked = GuardEnabled();
        if (blocked is not null) return blocked;

        token = (token ?? "").Trim();
        var user = await db.DevTeamUsers.AsNoTracking()
            .FirstOrDefaultAsync(u => u.PasswordResetToken == token, ct);
        if (user is null)
            return NotFound(new { message = "Invalid or expired reset link." });
        if (user.PasswordResetTokenExpiresAt is DateTime expires && expires < DateTime.UtcNow)
            return BadRequest(new { message = "This reset link has expired." });

        return Ok(new { email = user.Email, fullName = user.FullName });
    }

    [HttpGet("team")]
    public async Task<ActionResult<object>> ListTeam(CancellationToken ct)
    {
        var (err, actor) = await RequireRootAsync(ct);
        if (err is not null) return err;

        var rows = await db.DevTeamUsers.AsNoTracking()
            .OrderByDescending(u => u.IsRoot)
            .ThenBy(u => u.Email)
            .ToListAsync(ct);

        return Ok(new
        {
            users = rows.Select(u => new
            {
                u.Id,
                u.Email,
                u.FullName,
                u.Position,
                u.TeamType,
                accessTabs = u.IsRoot
                    ? DevConsoleTabAccess.AllTabs.ToList()
                    : DevConsoleTabAccess.ParseTabs(u.AccessJson),
                u.Active,
                u.IsRoot,
                hasPassword = u.HasPassword,
                invitePending = u.InvitePending,
                mustChangePassword = u.MustChangePassword,
                hasGoogle = !string.IsNullOrWhiteSpace(u.GoogleSubject),
                u.CreatedAt,
                u.CreatedByEmail,
                u.UpdatedAt,
            }),
            actorEmail = actor!.Email,
            teamTypes = DevConsoleTabAccess.TeamTypes,
            tabs = DevConsoleTabAccess.AllTabs,
        });
    }

    public record UpsertTeamUserRequest(
        string Email,
        string FullName,
        string? Position,
        string? TeamType,
        string[]? AccessTabs,
        string? Password,
        bool? Active);

    [HttpPost("team")]
    public async Task<ActionResult<object>> CreateTeamUser([FromBody] UpsertTeamUserRequest request, CancellationToken ct)
    {
        var (err, actor) = await RequireRootAsync(ct);
        if (err is not null) return err;

        var email = (request.Email ?? "").Trim().ToLowerInvariant();
        if (!auth.IsAllowedEmailDomain(email))
            return BadRequest(new { message = $"Email must end with @{string.Join(" or @", auth.AllowedDomains)}." });
        if (await db.DevTeamUsers.AnyAsync(u => u.Email == email, ct))
            return Conflict(new { message = "That email is already on the Dev Team list." });

        var fullName = (request.FullName ?? "").Trim();
        if (string.IsNullOrWhiteSpace(fullName))
            fullName = email.Split('@')[0];

        var user = new DevTeamUser
        {
            Email = email,
            FullName = fullName,
            Position = (request.Position ?? "").Trim(),
            TeamType = DevConsoleTabAccess.NormalizeTeamType(request.TeamType),
            AccessJson = DevConsoleTabAccess.BuildAccessJson(request.AccessTabs),
            PasswordHash = "",
            Active = true,
            MustChangePassword = true,
            IsRoot = false,
            CreatedAt = DateTime.UtcNow,
            CreatedByEmail = actor!.Email,
        };

        // Default team password Pass@123 — member must change it after first login.
        // Optional request.Password still allowed for emergency overrides.
        if (!string.IsNullOrWhiteSpace(request.Password))
        {
            if (request.Password.Length < 8)
                return BadRequest(new { message = "Password must be at least 8 characters." });
            user.PasswordHash = AppPasswordHasher.Hash(request.Password);
            user.MustChangePassword = string.Equals(
                request.Password,
                DevConsoleAuthService.DefaultTeamPassword,
                StringComparison.Ordinal);
            user.Active = true;
        }
        else
        {
            auth.ApplyDefaultTeamPassword(user);
        }

        db.DevTeamUsers.Add(user);
        await db.SaveChangesAsync(ct);

        var loginUrl = BuildDevConsoleUrl("");
        await emailSender.SendAsync(
            user.Email,
            "Your Bisync Dev Console access",
            $"Hello {user.FullName},\n\n" +
            $"You have been added to the Bisync Dev Console as {user.TeamType}" +
            (string.IsNullOrWhiteSpace(user.Position) ? "" : $" ({user.Position})") +
            $".\n\n" +
            $"Sign in at:\n{loginUrl}\n\n" +
            $"Email: {user.Email}\n" +
            $"Temporary password: {DevConsoleAuthService.DefaultTeamPassword}\n\n" +
            $"You will be asked to change this password after your first login.\n\n" +
            $"This account is for Dev Console only and is separate from the main Bisync platform.",
            ct);

        return Ok(TeamUserPayload(user));
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

        if (request.Position is not null)
            user.Position = request.Position.Trim();

        if (!string.IsNullOrWhiteSpace(request.TeamType) && !user.IsRoot)
            user.TeamType = DevConsoleTabAccess.NormalizeTeamType(request.TeamType);

        if (request.AccessTabs is not null && !user.IsRoot)
            user.AccessJson = DevConsoleTabAccess.BuildAccessJson(request.AccessTabs);

        if (!string.IsNullOrWhiteSpace(request.Password))
        {
            if (request.Password.Length < 8)
                return BadRequest(new { message = "Password must be at least 8 characters." });
            user.PasswordHash = AppPasswordHasher.Hash(request.Password);
            user.MustChangePassword = string.Equals(
                request.Password,
                DevConsoleAuthService.DefaultTeamPassword,
                StringComparison.Ordinal);
            user.InviteToken = null;
            user.InviteTokenExpiresAt = null;
            user.Active = true;
        }

        if (request.Active is bool active)
        {
            if (user.IsRoot && !active)
                return BadRequest(new { message = "Root account cannot be deactivated." });
            if (active && !user.HasPassword)
                auth.ApplyDefaultTeamPassword(user);
            user.Active = active;
        }

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

        if (user.IsRoot)
            user.AccessJson = DevConsoleTabAccess.AllTabsJson();

        user.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return Ok(TeamUserPayload(user));
    }

    [HttpPost("team/{id:int}/resend-invite")]
    public async Task<ActionResult<object>> ResendInvite(int id, CancellationToken ct)
    {
        var (err, _) = await RequireRootAsync(ct);
        if (err is not null) return err;

        var user = await db.DevTeamUsers.FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user is null) return NotFound();
        if (user.IsRoot)
            return BadRequest(new { message = "Root account does not use the default team password reset." });

        auth.ApplyDefaultTeamPassword(user);
        await db.SaveChangesAsync(ct);

        var loginUrl = BuildDevConsoleUrl("");
        await emailSender.SendAsync(
            user.Email,
            "Your Bisync Dev Console password was reset",
            $"Hello {user.FullName},\n\n" +
            $"Your Dev Console password was reset to the temporary default.\n\n" +
            $"Sign in at:\n{loginUrl}\n\n" +
            $"Email: {user.Email}\n" +
            $"Temporary password: {DevConsoleAuthService.DefaultTeamPassword}\n\n" +
            $"You will be asked to change this password after you sign in.",
            ct);

        return Ok(new
        {
            message = $"Password reset to {DevConsoleAuthService.DefaultTeamPassword}. Member must change it after login.",
            email = user.Email,
            defaultPassword = DevConsoleAuthService.DefaultTeamPassword,
        });
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

        if (!DevConsoleTabAccess.HasTab(actor!.AccessJson, "ghost-support", actor.IsRoot))
            return StatusCode(403, new { message = "Your Dev Console access does not include Ghost Support." });

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

        var accessJson = SuperAdminAccess.BuildJson();
        var locations = await db.Locations.AsNoTracking().ToDictionaryAsync(l => l.Id, l => l.Name, ct);
        var locationIds = ParseLocationIds(appUser.LocationIdsJson);

        await systemAudit.RecordAsync(new SystemAuditWriteRequest(
            Category: "Login",
            Action: "GhostEnter",
            Summary: $"Ghost Support enter by {actor.Email} → {company.Name} / {location.Name}",
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
            return (StatusCode(403, new { message = "Only the Super User can manage the Dev Console team." }), null);
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
        position = user.Position,
        teamType = user.TeamType,
        isRoot = user.IsRoot,
        mustChangePassword = user.MustChangePassword,
        accessTabs = user.IsRoot
            ? DevConsoleTabAccess.AllTabs.ToList()
            : DevConsoleTabAccess.ParseTabs(user.AccessJson),
    };

    static object TeamUserPayload(DevTeamUser user, string? inviteUrl = null) => new
    {
        id = user.Id,
        email = user.Email,
        fullName = user.FullName,
        position = user.Position,
        teamType = user.TeamType,
        accessTabs = user.IsRoot
            ? DevConsoleTabAccess.AllTabs.ToList()
            : DevConsoleTabAccess.ParseTabs(user.AccessJson),
        active = user.Active,
        isRoot = user.IsRoot,
        hasPassword = user.HasPassword,
        invitePending = user.InvitePending,
        mustChangePassword = user.MustChangePassword,
        inviteUrl,
    };

    string BuildDevConsoleUrl(string relativePath)
    {
        var path = relativePath.TrimStart('/');
        var configured = config["App:PublicBaseUrl"]?.Trim().TrimEnd('/');
        if (!string.IsNullOrWhiteSpace(configured))
            return $"{configured}/dev/console/{path}";

        var request = httpContextAccessor.HttpContext?.Request;
        if (request is not null)
        {
            var headerOrigin = request.Headers.Origin.FirstOrDefault()?.Trim().TrimEnd('/');
            if (!string.IsNullOrWhiteSpace(headerOrigin))
                return $"{headerOrigin}/dev/console/{path}";

            var forwardedProto = request.Headers["X-Forwarded-Proto"].FirstOrDefault()?.Split(',').FirstOrDefault()?.Trim();
            var scheme = !string.IsNullOrWhiteSpace(forwardedProto) ? forwardedProto : request.Scheme;
            var host = request.Host.Value ?? string.Empty;
            if (host.Contains("run.app", StringComparison.OrdinalIgnoreCase))
                scheme = "https";
            return $"{scheme}://{host}/dev/console/{path}";
        }

        return $"https://bisync-cloud-389272498937.asia-southeast1.run.app/dev/console/{path}";
    }
}
