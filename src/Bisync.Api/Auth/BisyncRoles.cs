
namespace Bisync.Api.Auth;

/// <summary>
/// Single definition of what counts as a platform administrator.
/// Previously this logic lived inline in TenantContextMiddleware; it is now shared
/// between token issuance and token consumption so the two can never disagree.
/// </summary>
public static class BisyncRoles
{
    public const string PlatformAdminClaim = "bisync:platform_admin";
    public const string CompanyClaim = "bisync:company";
    public const string RoleClaim = "bisync:role";

    public static bool IsPlatformAdminRole(string? role)
    {
        var r = (role ?? string.Empty).Trim();
        if (r.Length == 0) return false;

        return r.Contains("Super Admin", StringComparison.OrdinalIgnoreCase)
            || r.Contains("Dev Team", StringComparison.OrdinalIgnoreCase)
            || r.Equals("DRA Super Admin", StringComparison.OrdinalIgnoreCase);
    }
}



