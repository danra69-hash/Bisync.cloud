using Bisync.Api.Data;
using Bisync.Api.Models;
using Bisync.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/system-audit")]
public class SystemAuditController(
    SystemAuditDbContext auditDb,
    BisyncDbContext opsDb,
    ISystemAuditService auditService,
    DevConsoleAuthService devConsoleAuth) : ControllerBase
{
    async Task<(ActionResult? Error, AppUser? User, int? CompanyScope)> GuardWithScopeAsync(CancellationToken ct)
    {
        // Dev Console session (developer-only login) can view platform audit.
        var devToken = Request.Headers[DevConsoleAuthService.TokenHeader].FirstOrDefault();
        var (devUser, _) = await devConsoleAuth.ResolveSessionAsync(devToken, ct);
        if (devUser is not null)
        {
            // Map to AppUser when present so company scope helpers still work for non-root staff.
            var linked = await opsDb.AppUsers.AsNoTracking()
                .FirstOrDefaultAsync(u => u.Email.ToLower() == devUser.Email.ToLower(), ct);
            if (devUser.IsRoot || string.Equals(devUser.Email, SuperAdminAccess.SuperAdminEmail, StringComparison.OrdinalIgnoreCase))
                return (null, linked, null);
            return (null, linked, linked?.CompanyId);
        }

        if (!int.TryParse(Request.Headers[Tenancy.TenantContextMiddleware.UserHeader].FirstOrDefault(), out var userId)
            || userId <= 0)
            return (Unauthorized(new { message = "Sign in required to view Audit Trail." }), null, null);

        var user = await opsDb.AppUsers.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (!SystemAuditAccess.IsAuditViewer(user))
            return (StatusCode(403, new { message = "Audit Trail is limited to Super User / System Admin." }), null, null);

        return (null, user, ViewerCompanyScope(user));
    }

    int? ViewerCompanyScope(AppUser? user)
    {
        if (user is null) return null;
        if (string.Equals(user.Email, SuperAdminAccess.SuperAdminEmail, StringComparison.OrdinalIgnoreCase)
            || (user.Role ?? "").Contains("Super Admin", StringComparison.OrdinalIgnoreCase)
            || (user.Role ?? "").Contains("DRA Super Admin", StringComparison.OrdinalIgnoreCase))
            return null;
        return user.CompanyId;
    }

    [HttpGet("months")]
    public async Task<ActionResult<object>> AvailableMonths(
        [FromQuery] int? companyId,
        [FromQuery] int? locationId,
        CancellationToken ct)
    {
        var (blocked, user, companyScope) = await GuardWithScopeAsync(ct);
        if (blocked is not null) return blocked;

        var q = auditDb.SystemAuditEvents.AsNoTracking().AsQueryable();
        if (companyScope is > 0)
            q = q.Where(e => e.CompanyId == companyScope);
        else if (companyId is > 0)
            q = q.Where(e => e.CompanyId == companyId);
        if (locationId is > 0)
            q = q.Where(e => e.LocationId == locationId || e.LocationId == null);

        var months = await q
            .GroupBy(e => new { e.Year, e.Month })
            .Select(g => new { g.Key.Year, g.Key.Month, count = g.Count() })
            .OrderByDescending(x => x.Year).ThenByDescending(x => x.Month)
            .Take(24)
            .ToListAsync(ct);

        // Always include current company-local month so the filter is usable with empty trails.
        var country = companyId is > 0
            ? await opsDb.Companies.AsNoTracking().Where(c => c.Id == companyId).Select(c => c.CountryCode).FirstOrDefaultAsync(ct)
            : user?.CompanyId is > 0
                ? await opsDb.Companies.AsNoTracking().Where(c => c.Id == user!.CompanyId).Select(c => c.CountryCode).FirstOrDefaultAsync(ct)
                : "MY";
        var localNow = CountryTimeZones.ToLocal(DateTime.UtcNow, country ?? "MY");
        if (!months.Any(m => m.Year == localNow.Year && m.Month == localNow.Month))
        {
            months.Insert(0, new { Year = localNow.Year, Month = localNow.Month, count = 0 });
        }

        return Ok(months);
    }

    [HttpGet]
    public async Task<ActionResult<object>> List(
        [FromQuery] int? companyId,
        [FromQuery] int? locationId,
        [FromQuery] int? year,
        [FromQuery] int? month,
        [FromQuery] int take = 300,
        [FromQuery] int skip = 0,
        CancellationToken ct = default)
    {
        var (blocked, user, companyScope) = await GuardWithScopeAsync(ct);
        if (blocked is not null) return blocked;

        if (companyId is null or <= 0)
            return BadRequest(new { message = "Company filter is required." });
        if (locationId is null or <= 0)
            return BadRequest(new { message = "Location filter is required." });
        if (year is null or < 2000 || month is null or < 1 or > 12)
            return BadRequest(new { message = "Month / Year filter is required." });

        if (companyScope is > 0 && companyId != companyScope)
            return StatusCode(403, new { message = "You can only view Audit Trail for your company." });

        var location = await opsDb.Locations.AsNoTracking()
            .FirstOrDefaultAsync(l => l.Id == locationId.Value, ct);
        if (location is null || location.CompanyId != companyId)
            return BadRequest(new { message = "Location does not belong to the selected company." });

        take = Math.Clamp(take, 1, 500);
        skip = Math.Max(0, skip);

        var q = auditDb.SystemAuditEvents.AsNoTracking()
            .Where(e => e.Year == year && e.Month == month && e.CompanyId == companyId)
            .Where(e => e.LocationId == locationId || e.LocationId == null);

        var total = await q.CountAsync(ct);
        var rows = await q
            .OrderByDescending(e => e.OccurredAtUtc)
            .Skip(skip)
            .Take(take)
            .Select(e => new
            {
                e.Id,
                e.OccurredAtUtc,
                e.OccurredAtLocal,
                e.TimeZoneId,
                e.Year,
                e.Month,
                e.Category,
                e.Action,
                e.CompanyId,
                e.CompanyName,
                e.CountryCode,
                e.LocationId,
                e.LocationExternalId,
                e.LocationName,
                e.DatabaseBucket,
                e.UserId,
                e.UserEmail,
                e.UserName,
                e.EntityType,
                e.EntityKey,
                e.Summary,
                e.DetailsJson,
                activityType = e.Category,
                activityDetail = e.Summary,
                effectedDbBucket = e.DatabaseBucket,
            })
            .ToListAsync(ct);

        return Ok(new
        {
            companyId,
            locationId,
            year,
            month,
            total,
            take,
            skip,
            retentionNote = "Audit Trail records continuously 24/7. Live rows keep the last 1 year; older rows are archived.",
            rows,
        });
    }

    public record LogoutAuditRequest(int? UserId, int? CompanyId, string? Reason);

    [HttpPost("logout")]
    public async Task<ActionResult> RecordLogout([FromBody] LogoutAuditRequest? request, CancellationToken ct)
    {
        int? userId = request?.UserId;
        if (userId is null or <= 0
            && int.TryParse(Request.Headers[Tenancy.TenantContextMiddleware.UserHeader].FirstOrDefault(), out var headerUser)
            && headerUser > 0)
            userId = headerUser;

        if (userId is null or <= 0)
            return Ok(new { recorded = false });

        var user = await opsDb.AppUsers.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId.Value, ct);
        if (user is null) return Ok(new { recorded = false });

        int? companyId = request?.CompanyId ?? user.CompanyId;
        Company? company = null;
        if (companyId is > 0)
            company = await opsDb.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == companyId.Value, ct);

        await auditService.RecordLogoutAsync(user, company, request?.Reason, ct);
        return Ok(new { recorded = true });
    }
}
