namespace Bisync.Api.Models;

/// <summary>
/// Control-plane registry: maps a company to its operational database connection.
/// Phase 2/3 — today all rows can point at the shared Bisync connection string.
/// </summary>
public class TenantConnection
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    /// <summary>Logical database name, e.g. bisync_c_12.</summary>
    public string DatabaseName { get; set; } = string.Empty;
    /// <summary>Optional override connection string. Empty = use default shared connection.</summary>
    public string ConnectionString { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
