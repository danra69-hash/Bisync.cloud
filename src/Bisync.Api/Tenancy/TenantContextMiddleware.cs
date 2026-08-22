using System.Security.Claims;
using Bisync.Api.Auth;
using Bisync.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Bisync.Api.Tenancy;

/// <summary>
/// Resolves company/user identity for the request.
///
/// Primary path: validated JWT claims (issued by /api/auth/login). The company a
/// non-admin sees is fixed in the token and cannot be changed by any header.
///
/// Legacy path: X-Bisync-User-Id / X-Bisync-Company-Id headers, honoured ONLY while
/// Auth:AllowLegacyHeaders is true and only when no token was presented. This exists
/// so the API can be deployed before every client has been updated.
///
/// Identity is always read from the shared control-plane connection.
/// </summary>
public sealed class TenantContextMiddleware(RequestDelegate next)
{
    public const string CompanyHeader = "X-Bisync-Company-Id";
    public const string UserHeader = "X-Bisync-User-Id";

    public async Task InvokeAsync(
        HttpContext http,
        TenantContext tenant,
        ITenantConnectionResolver resolver,
        IOptions<TenantAuthOptions> authOptions,
        ILogger<TenantContextMiddleware> log)
    {
        var identity = http.User?.Identity;
        var authenticated = identity is { IsAuthenticated: true };

        if (authenticated)
        {
            ApplyTokenClaims(http.User!, tenant);
        }
        else if (authOptions.Value.AllowLegacyHeaders)
        {
            await ApplyLegacyHeadersAsync(http, tenant, resolver);

            if (tenant.UserId is > 0)
            {
                log.LogWarning(
                    "Legacy header identity accepted for user {UserId} on {Path}. " +
                    "This client has not been updated to send a bearer token.",
                    tenant.UserId, http.Request.Path.Value);
            }
        }

        // A platform admin may switch company via header. Everyone else is locked
        // to the company in their token, regardless of what they send.
        if (tenant.IsPlatformAdmin
            && TryParsePositiveInt(http.Request.Headers[CompanyHeader].FirstOrDefault(), out var headerCompany))
        {
            tenant.CompanyId = headerCompany;
        }
        else if (tenant.IsPlatformAdmin
                 && tenant.CompanyId is null or <= 0
                 && TryParsePositiveInt(http.Request.Query["companyId"].FirstOrDefault(), out var queryCompany))
        {
            tenant.CompanyId = queryCompany;
        }

        await next(http);
    }

    static void ApplyTokenClaims(ClaimsPrincipal principal, TenantContext tenant)
    {
        var sub = principal.FindFirstValue(ClaimTypes.NameIdentifier)
                  ?? principal.FindFirstValue("sub");
        if (TryParsePositiveInt(sub, out var userId))
            tenant.UserId = userId;

        tenant.IsPlatformAdmin =
            principal.FindFirstValue(BisyncRoles.PlatformAdminClaim) == "1";

        if (TryParsePositiveInt(principal.FindFirstValue(BisyncRoles.CompanyClaim), out var companyId))
            tenant.CompanyId = companyId;
    }

    /// <summary>Pre-JWT behaviour, retained only for the transition window.</summary>
    static async Task ApplyLegacyHeadersAsync(
        HttpContext http,
        TenantContext tenant,
        ITenantConnectionResolver resolver)
    {
        if (!TryParsePositiveInt(http.Request.Headers[UserHeader].FirstOrDefault(), out var userId))
            return;

        tenant.UserId = userId;

        var options = new DbContextOptionsBuilder<BisyncDbContext>()
            .UseNpgsql(resolver.DefaultOperationalConnection)
            .Options;
        await using var db = new BisyncDbContext(options);

        var user = await db.AppUsers.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
        if (user is null)
            return;

        tenant.IsPlatformAdmin = BisyncRoles.IsPlatformAdminRole(user.Role);

        if (user.CompanyId is > 0)
            tenant.CompanyId = user.CompanyId;
    }

    static bool TryParsePositiveInt(string? raw, out int value)
    {
        value = 0;
        return !string.IsNullOrWhiteSpace(raw)
            && int.TryParse(raw.Trim(), out value)
            && value > 0;
    }
}
