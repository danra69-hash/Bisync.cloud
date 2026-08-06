namespace Bisync.Api.Tenancy;

public class TenancyOptions
{
    public const string SectionName = "Tenancy";

    /// <summary>
    /// When true, self-serve flow may create a dedicated operational + archive database.
    /// For AWS/5k readiness this should be treated as enterprise opt-in; prefer
    /// <see cref="DefaultPlacementMode"/> = shared/shard for new tenants.
    /// </summary>
    public bool ProvisionCompanyDatabases { get; set; } = true;

    /// <summary>
    /// Default placement for newly registered companies: shared | shard | dedicated.
    /// Binding AWS target: shared or shard (not dedicated-for-all).
    /// </summary>
    public string DefaultPlacementMode { get; set; } = TenantPlacementMode.Shared;

    /// <summary>
    /// Number of operational shard databases when DefaultPlacementMode is shard (bisync_s_001…).
    /// </summary>
    public int ShardCount { get; set; } = 16;

    /// <summary>
    /// Database name prefix for shards, e.g. bisync_s_001.
    /// </summary>
    public string ShardDatabasePrefix { get; set; } = "bisync_s_";

    /// <summary>
    /// When true, startup/deploy fan-out runs SchemaPatcher on every distinct operational DB
    /// registered in TenantConnections (required before multi-DB AWS cutover).
    /// </summary>
    public bool FanOutSchemaMigrations { get; set; } = true;

    /// <summary>
    /// Max tenant DBs to patch per startup pass (avoid blocking forever on huge registries).
    /// </summary>
    public int SchemaFanOutBatchSize { get; set; } = 50;
}
