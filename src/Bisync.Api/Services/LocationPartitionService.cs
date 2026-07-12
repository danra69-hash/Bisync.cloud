using Bisync.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

/// <summary>
/// Phase 1 scaffolding: when hot tables are converted to LIST-partitioned parents,
/// ensure a partition exists for each location ExternalId. Safe no-op until then.
/// </summary>
public class LocationPartitionService(BisyncDbContext db, ILogger<LocationPartitionService> logger)
{
    static readonly string[] PartitionedTables =
    [
        "InventoryMovements",
        "InventoryPurchases",
        "ProductProductionLogs",
    ];

    public async Task EnsurePartitionsForLocationAsync(string locationExternalId, CancellationToken ct = default)
    {
        var loc = locationExternalId.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(loc))
            return;

        var suffix = SanitizeSuffix(loc);
        var escaped = loc.Replace("'", "''");

        foreach (var table in PartitionedTables)
        {
            var partitionName = $"{table}_loc_{suffix}";
            try
            {
                await db.Database.ExecuteSqlRawAsync($"""
                    DO $$
                    BEGIN
                      IF EXISTS (
                        SELECT 1
                        FROM pg_partitioned_table pt
                        JOIN pg_class c ON c.oid = pt.partrelid
                        WHERE c.relname = lower('{table}')
                      ) THEN
                        EXECUTE format(
                          'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES IN (%L)',
                          '{partitionName}',
                          '{table}',
                          '{escaped}');
                      END IF;
                    END $$;
                    """, ct);
            }
            catch (Exception ex)
            {
                logger.LogDebug(ex, "Partition ensure skipped for {Table}/{Location}", table, loc);
            }
        }
    }

    public async Task EnsurePartitionsForAllLocationsAsync(CancellationToken ct = default)
    {
        var locations = await db.Locations.AsNoTracking()
            .Select(l => l.ExternalId)
            .ToListAsync(ct);
        foreach (var loc in locations)
            await EnsurePartitionsForLocationAsync(loc, ct);
    }

    static string SanitizeSuffix(string locationExternalId)
    {
        var chars = locationExternalId
            .Select(c => char.IsLetterOrDigit(c) ? c : '_')
            .ToArray();
        var s = new string(chars);
        return s.Length > 40 ? s[..40] : s;
    }
}
