namespace Bisync.Api.Tenancy;

public static class TenantQuery
{
    /// <summary>Resolves company from explicit query param, then request tenant context.</summary>
    public static int? ResolveCompanyId(ITenantContext tenant, int? explicitCompanyId = null)
        => explicitCompanyId is > 0 ? explicitCompanyId : tenant.CompanyId;

    /// <summary>
    /// Strict company predicate after Phase 0 backfill.
    /// Platform admins with no company selected see all; others fail closed.
    /// </summary>
    public static bool AllowsAllCompanies(ITenantContext tenant, int? resolvedCompanyId)
        => resolvedCompanyId is null && tenant.IsPlatformAdmin;
}
