namespace Bisync.Api.Models;

/// <summary>
/// Control-plane registry: maps a company to its operational database connection.
/// Empty ConnectionString = shared default (legacy / not yet provisioned).
/// PlacementMode: shared | shard | dedicated (AWS/5k default is shared or shard).
/// </summary>
public class TenantConnection
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    /// <summary>Logical database name, e.g. bisync_c_12 or bisync_s_003.</summary>
    public string DatabaseName { get; set; } = string.Empty;
    /// <summary>Optional override connection string. Empty = use default shared connection.</summary>
    public string ConnectionString { get; set; } = string.Empty;
    /// <summary>Archive database name, e.g. bisync_c_12_archive.</summary>
    public string ArchiveDatabaseName { get; set; } = string.Empty;
    /// <summary>Archive connection string. Empty = derive from operational or shared archive.</summary>
    public string ArchiveConnectionString { get; set; } = string.Empty;
    /// <summary>shared | shard | dedicated — see TenantPlacementMode.</summary>
    public string PlacementMode { get; set; } = "shared";
    /// <summary>1-based shard index when PlacementMode is shard; otherwise 0.</summary>
    public int ShardId { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
