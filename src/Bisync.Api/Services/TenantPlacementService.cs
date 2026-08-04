using Bisync.Api.Data;
using Bisync.Api.Models;
using Bisync.Api.Tenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Bisync.Api.Services;

/// <summary>
/// Assigns Shared / Shard / Dedicated placement for a company in the control-plane registry.
/// Does not CREATE DATABASE for shared; shard/dedicated provisioning is layered on later.
/// </summary>
public sealed class TenantPlacementService(
    BisyncDbContext controlDb,
    IOptions<TenancyOptions> tenancyOptions)
{
    public async Task<TenantConnection> EnsureRegistryAsync(int companyId, CancellationToken ct = default)
    {
        if (companyId <= 0) throw new ArgumentOutOfRangeException(nameof(companyId));

        var opts = tenancyOptions.Value;
        var existing = await controlDb.TenantConnections
            .FirstOrDefaultAsync(t => t.CompanyId == companyId, ct);
        if (existing is not null)
            return existing;

        var mode = TenantPlacementMode.IsKnown(opts.DefaultPlacementMode)
            ? opts.DefaultPlacementMode.Trim().ToLowerInvariant()
            : TenantPlacementMode.Shared;

        var shardId = 0;
        var databaseName = string.Empty;
        var connectionString = string.Empty;

        if (mode == TenantPlacementMode.Shard)
        {
            var count = Math.Max(1, opts.ShardCount);
            shardId = ((companyId - 1) % count) + 1;
            databaseName = $"{opts.ShardDatabasePrefix}{shardId:D3}";
            // Connection string filled when shard DB is provisioned; empty = still on shared until then.
            connectionString = string.Empty;
        }
        else if (mode == TenantPlacementMode.Dedicated)
        {
            databaseName = $"bisync_c_{companyId}";
        }
        else
        {
            mode = TenantPlacementMode.Shared;
            databaseName = string.Empty;
        }

        var row = new TenantConnection
        {
            CompanyId = companyId,
            PlacementMode = mode,
            ShardId = shardId,
            DatabaseName = databaseName,
            ArchiveDatabaseName = string.IsNullOrEmpty(databaseName) ? string.Empty : $"{databaseName}_archive",
            ConnectionString = connectionString,
            ArchiveConnectionString = string.Empty,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        controlDb.TenantConnections.Add(row);
        await controlDb.SaveChangesAsync(ct);
        return row;
    }
}
