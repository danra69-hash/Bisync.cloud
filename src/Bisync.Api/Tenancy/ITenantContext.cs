namespace Bisync.Api.Tenancy;

/// <summary>
/// Request-scoped tenant identity. Resolved from headers / query until JWT auth lands.
/// </summary>
public interface ITenantContext
{
    int? CompanyId { get; }
    int? UserId { get; }
    bool IsPlatformAdmin { get; }
    bool HasCompany { get; }
}

public sealed class TenantContext : ITenantContext
{
    public int? CompanyId { get; set; }
    public int? UserId { get; set; }
    public bool IsPlatformAdmin { get; set; }
    public bool HasCompany => CompanyId is > 0;
}
