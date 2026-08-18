namespace Bisync.Api.Tenancy;

public static class TenantQuery
{
    /// <summary>
    /// Legacy resolver used by non-ledger APIs. Prefer tenant context; an explicit
    /// company id is only honoured when the request has no tenant company yet.
    /// Ledger / Books endpoints use <see cref="AccountingAccess"/> instead.
    /// </summary>
    public static int? ResolveCompanyId(ITenantContext tenant, int? explicitCompanyId = null)
        => tenant.CompanyId is > 0 ? tenant.CompanyId : explicitCompanyId is > 0 ? explicitCompanyId : tenant.CompanyId;

    /// <summary>
    /// Strict company predicate after Phase 0 backfill.
    /// Platform admins with no company selected see all; others fail closed.
    /// </summary>
    public static bool AllowsAllCompanies(ITenantContext tenant, int? resolvedCompanyId)
        => resolvedCompanyId is null && tenant.IsPlatformAdmin;
}
