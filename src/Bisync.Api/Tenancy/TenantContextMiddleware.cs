using Bisync.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Tenancy;

/// <summary>
/// Resolves company/user from:
/// 1. X-Bisync-Company-Id / X-Bisync-User-Id headers (preferred)
/// 2. companyId query string (legacy UI)
/// Platform Super Admin / Dev Team users may omit company (cross-tenant reads).
/// </summary>
public sealed class TenantContextMiddleware(RequestDelegate next)
{
    public const string CompanyHeader = "X-Bisync-Company-Id";
    public const string UserHeader = "X-Bisync-User-Id";

    public async Task InvokeAsync(HttpContext http, TenantContext tenant, BisyncDbContext db)
    {
        if (TryParsePositiveInt(http.Request.Headers[UserHeader].FirstOrDefault(), out var userId))
        {
            tenant.UserId = userId;
            var user = await db.AppUsers.AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == userId);
            if (user is not null)
            {
                var role = (user.Role ?? string.Empty).Trim();
                tenant.IsPlatformAdmin =
                    role.Contains("Super Admin", StringComparison.OrdinalIgnoreCase)
                    || role.Contains("Dev Team", StringComparison.OrdinalIgnoreCase)
                    || role.Equals("DRA Super Admin", StringComparison.OrdinalIgnoreCase);

                if (!tenant.IsPlatformAdmin && user.CompanyId is > 0)
                    tenant.CompanyId ??= user.CompanyId;
            }
        }

        if (TryParsePositiveInt(http.Request.Headers[CompanyHeader].FirstOrDefault(), out var headerCompany))
            tenant.CompanyId = headerCompany;
        else if (TryParsePositiveInt(http.Request.Query["companyId"].FirstOrDefault(), out var queryCompany))
            tenant.CompanyId ??= queryCompany;

        await next(http);
    }

    static bool TryParsePositiveInt(string? raw, out int value)
    {
        value = 0;
        return !string.IsNullOrWhiteSpace(raw)
            && int.TryParse(raw.Trim(), out value)
            && value > 0;
    }
}
