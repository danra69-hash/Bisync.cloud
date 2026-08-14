namespace Bisync.Api.Tenancy;

/// <summary>
/// Control-plane resolver: maps companyId → operational / archive connection strings.
/// Empty TenantConnection.ConnectionString means shared default (legacy tenants).
/// </summary>
public interface ITenantConnectionResolver
{
    string DefaultOperationalConnection { get; }
    string DefaultArchiveConnection { get; }

    string ResolveOperationalConnection(int? companyId);
    string ResolveArchiveConnection(int? companyId);

    /// <summary>
    /// Logical DB bucket name for Audit Trail / ops UI (e.g. <c>bisync_c_12</c>),
    /// even when the physical connection still points at shared <c>bisync</c>.
    /// </summary>
    string ResolveDatabaseBucketName(int? companyId);

    /// <summary>Refresh cache after provision or registry change.</summary>
    void Refresh(int companyId, string? operationalConnection, string? archiveConnection, string? databaseName = null);

    void Invalidate(int companyId);
    void InvalidateAll();
}
