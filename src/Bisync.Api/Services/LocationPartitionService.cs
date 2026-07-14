using System.Data;
using System.Text.RegularExpressions;
using Bisync.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

/// <summary>
/// Phase 1: convert hot inventory tables to LIST partitions by LocationExternalId,
/// then ensure a child partition exists for each location.
/// </summary>
public class LocationPartitionService(BisyncDbContext db, ILogger<LocationPartitionService> logger)
{
    static readonly string[] PartitionedTables =
    [
        "InventoryMovements",
        "InventoryPurchases",
        "ProductProductionLogs",
        "WastageEntries",
    ];

    /// <summary>
    /// Ensures LocationExternalId columns + backfill, then converts parents to LIST partitions
    /// when not already partitioned. Safe to call repeatedly.
    /// </summary>
    public async Task EnsureLocationListPartitionsAsync(CancellationToken ct = default)
    {
        await EnsureLocationExternalIdColumnsAsync(ct);
        await BackfillLocationExternalIdsAsync(ct);

        foreach (var table in PartitionedTables)
        {
            if (!await TableExistsAsync(table, ct))
            {
                logger.LogDebug("Skip partition conversion; table {Table} missing", table);
                continue;
            }

            if (await IsPartitionedAsync(table, ct))
                continue;

            try
            {
                await ConvertToListPartitionAsync(table, ct);
                logger.LogInformation("Converted {Table} to LIST partition by LocationExternalId", table);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Could not convert {Table} to LIST partitions; will retry next startup", table);
            }
        }
    }

    public async Task EnsurePartitionsForLocationAsync(string locationExternalId, CancellationToken ct = default)
    {
        var loc = locationExternalId.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(loc))
            return;

        var suffix = SanitizeSuffix(loc);
        // Values bound via format %L — still sanitize quotes for the DO-block literal path.
        var escaped = loc.Replace("'", "''");

        foreach (var table in PartitionedTables)
        {
            if (!await TableExistsAsync(table, ct))
                continue;
            if (!await IsPartitionedAsync(table, ct))
                continue;

            var partitionName = $"{table}_loc_{suffix}";
            if (!IsSafePgIdent(partitionName) || !IsSafePgIdent(table))
            {
                logger.LogWarning("Refusing unsafe partition identifier {Partition}", partitionName);
                continue;
            }

            try
            {
                await db.Database.ExecuteSqlRawAsync($"""
                    DO $$
                    BEGIN
                      IF EXISTS (
                        SELECT 1
                        FROM pg_partitioned_table pt
                        JOIN pg_class c ON c.oid = pt.partrelid
                        JOIN pg_namespace n ON n.oid = c.relnamespace
                        WHERE n.nspname = 'public' AND lower(c.relname) = lower('{table}')
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

    async Task EnsureLocationExternalIdColumnsAsync(CancellationToken ct)
    {
        foreach (var table in new[] { "InventoryPurchases", "ProductProductionLogs" })
        {
            if (!await TableExistsAsync(table, ct))
                continue;
            await DatabaseSchemaHelper.EnsureColumnAsync(db, table, "LocationExternalId", "TEXT NOT NULL DEFAULT ''");
        }
    }

    async Task BackfillLocationExternalIdsAsync(CancellationToken ct)
    {
        foreach (var table in new[] { "InventoryPurchases", "ProductProductionLogs" })
        {
            if (!await TableExistsAsync(table, ct))
                continue;
            if (!await DatabaseSchemaHelper.ColumnExistsAsync(db, table, "LocationExternalId"))
                continue;
            if (!await DatabaseSchemaHelper.ColumnExistsAsync(db, table, "LocationIdsJson"))
                continue;

            // First JSON array element, else empty string. Identifier is from our fixed whitelist.
            await db.Database.ExecuteSqlRawAsync($"""
                UPDATE "{table}"
                SET "LocationExternalId" = lower(COALESCE(
                    NULLIF(
                        CASE
                          WHEN "LocationIdsJson" IS NULL OR BTRIM("LocationIdsJson") = '' OR BTRIM("LocationIdsJson") = '[]'
                            THEN ''
                          WHEN "LocationIdsJson" ~ '^\s*\[\s*"'
                            THEN COALESCE((regexp_match("LocationIdsJson", '"([^"]+)"'))[1], '')
                          ELSE ''
                        END,
                        ''
                    ),
                    ''
                ))
                WHERE "LocationExternalId" IS NULL OR BTRIM("LocationExternalId") = '';
                """, ct);
        }
    }

    async Task ConvertToListPartitionAsync(string table, CancellationToken ct)
    {
        if (!IsSafePgIdent(table))
            throw new InvalidOperationException($"Unsafe table name: {table}");

        var legacy = $"{table}_legacy_part";
        if (!IsSafePgIdent(legacy))
            throw new InvalidOperationException($"Unsafe legacy name: {legacy}");

        // Drop FKs that reference or originate from this table (partition parents can't keep simple PKs/FKs the same way).
        await DropForeignKeysTouchingTableAsync(table, ct);

        await db.Database.ExecuteSqlRawAsync($"""ALTER TABLE "{table}" RENAME TO "{legacy}";""", ct);

        // New parent: same columns/defaults/identity, no old PK/unique constraints.
        await db.Database.ExecuteSqlRawAsync($"""
            CREATE TABLE "{table}" (
              LIKE "{legacy}" INCLUDING DEFAULTS INCLUDING GENERATED INCLUDING IDENTITY
            ) PARTITION BY LIST ("LocationExternalId");
            """, ct);

        // Partition key must be part of PK.
        await db.Database.ExecuteSqlRawAsync($"""
            ALTER TABLE "{table}" ADD CONSTRAINT "PK_{table}" PRIMARY KEY ("Id", "LocationExternalId");
            """, ct);

        await db.Database.ExecuteSqlRawAsync($"""
            CREATE TABLE IF NOT EXISTS "{table}_default" PARTITION OF "{table}" DEFAULT;
            """, ct);

        // Create partitions for distinct location values already present + known locations.
        var locationIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        await foreach (var loc in ReadDistinctLocationIdsAsync(legacy, ct))
        {
            if (!string.IsNullOrWhiteSpace(loc))
                locationIds.Add(loc.Trim().ToLowerInvariant());
        }

        var configured = await db.Locations.AsNoTracking().Select(l => l.ExternalId).ToListAsync(ct);
        foreach (var loc in configured)
        {
            if (!string.IsNullOrWhiteSpace(loc))
                locationIds.Add(loc.Trim().ToLowerInvariant());
        }

        foreach (var loc in locationIds)
            await CreatePartitionForValueAsync(table, loc, ct);

        await db.Database.ExecuteSqlRawAsync($"""
            INSERT INTO "{table}" SELECT * FROM "{legacy}";
            """, ct);

        await db.Database.ExecuteSqlRawAsync($"""DROP TABLE "{legacy}";""", ct);

        await DatabaseSchemaHelper.TryResyncIdentitySequenceAsync(db, table);
    }

    async Task CreatePartitionForValueAsync(string table, string locationExternalId, CancellationToken ct)
    {
        var loc = locationExternalId.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(loc))
            return;

        var suffix = SanitizeSuffix(loc);
        var partitionName = $"{table}_loc_{suffix}";
        if (!IsSafePgIdent(partitionName))
            return;

        var escaped = loc.Replace("'", "''");
        await db.Database.ExecuteSqlRawAsync($"""
            DO $$
            BEGIN
              EXECUTE format(
                'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES IN (%L)',
                '{partitionName}',
                '{table}',
                '{escaped}');
            EXCEPTION WHEN duplicate_table OR invalid_object_definition THEN
              NULL;
            END $$;
            """, ct);
    }

    async IAsyncEnumerable<string> ReadDistinctLocationIdsAsync(
        string legacyTable,
        [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken ct)
    {
        var connection = db.Database.GetDbConnection();
        var shouldClose = connection.State != ConnectionState.Open;
        if (shouldClose)
            await connection.OpenAsync(ct);

        try
        {
            await using var command = connection.CreateCommand();
            command.CommandText = $"""SELECT DISTINCT "LocationExternalId" FROM "{legacyTable}" WHERE "LocationExternalId" IS NOT NULL""";
            await using var reader = await command.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                if (!reader.IsDBNull(0))
                    yield return reader.GetString(0);
            }
        }
        finally
        {
            if (shouldClose)
                await connection.CloseAsync();
        }
    }

    async Task DropForeignKeysTouchingTableAsync(string table, CancellationToken ct)
    {
        var connection = db.Database.GetDbConnection();
        var shouldClose = connection.State != ConnectionState.Open;
        if (shouldClose)
            await connection.OpenAsync(ct);

        var drops = new List<(string Schema, string Table, string Constraint)>();
        try
        {
            await using var command = connection.CreateCommand();
            command.CommandText = """
                SELECT n.nspname AS schema_name, c.relname AS table_name, con.conname AS constraint_name
                FROM pg_constraint con
                JOIN pg_class c ON c.oid = con.conrelid
                JOIN pg_namespace n ON n.oid = c.relnamespace
                LEFT JOIN pg_class ref ON ref.oid = con.confrelid
                LEFT JOIN pg_namespace rn ON rn.oid = ref.relnamespace
                WHERE con.contype = 'f'
                  AND n.nspname = 'public'
                  AND (
                    lower(c.relname) = lower(@table)
                    OR (ref.oid IS NOT NULL AND rn.nspname = 'public' AND lower(ref.relname) = lower(@table))
                  )
                """;
            var p = command.CreateParameter();
            p.ParameterName = "@table";
            p.Value = table;
            command.Parameters.Add(p);

            await using var reader = await command.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                drops.Add((reader.GetString(0), reader.GetString(1), reader.GetString(2)));
            }
        }
        finally
        {
            if (shouldClose)
                await connection.CloseAsync();
        }

        foreach (var (schema, tbl, constraint) in drops)
        {
            _ = schema;
            if (!IsSafePgIdent(tbl) || !IsSafePgIdent(constraint))
                continue;
            try
            {
                await db.Database.ExecuteSqlRawAsync(
                    $"""ALTER TABLE "{tbl}" DROP CONSTRAINT IF EXISTS "{constraint}";""", ct);
            }
            catch (Exception ex)
            {
                logger.LogDebug(ex, "Could not drop FK {Constraint} on {Table}", constraint, tbl);
            }
        }
    }

    async Task<bool> TableExistsAsync(string table, CancellationToken ct)
    {
        var connection = db.Database.GetDbConnection();
        var shouldClose = connection.State != ConnectionState.Open;
        if (shouldClose)
            await connection.OpenAsync(ct);
        try
        {
            await using var command = connection.CreateCommand();
            command.CommandText = """
                SELECT EXISTS (
                  SELECT 1 FROM information_schema.tables
                  WHERE table_schema = 'public' AND lower(table_name) = lower(@table)
                )
                """;
            var p = command.CreateParameter();
            p.ParameterName = "@table";
            p.Value = table;
            command.Parameters.Add(p);
            var result = await command.ExecuteScalarAsync(ct);
            return result is bool exists && exists;
        }
        finally
        {
            if (shouldClose)
                await connection.CloseAsync();
        }
    }

    async Task<bool> IsPartitionedAsync(string table, CancellationToken ct)
    {
        var connection = db.Database.GetDbConnection();
        var shouldClose = connection.State != ConnectionState.Open;
        if (shouldClose)
            await connection.OpenAsync(ct);
        try
        {
            await using var command = connection.CreateCommand();
            command.CommandText = """
                SELECT EXISTS (
                  SELECT 1
                  FROM pg_partitioned_table pt
                  JOIN pg_class c ON c.oid = pt.partrelid
                  JOIN pg_namespace n ON n.oid = c.relnamespace
                  WHERE n.nspname = 'public' AND lower(c.relname) = lower(@table)
                )
                """;
            var p = command.CreateParameter();
            p.ParameterName = "@table";
            p.Value = table;
            command.Parameters.Add(p);
            var result = await command.ExecuteScalarAsync(ct);
            return result is bool exists && exists;
        }
        finally
        {
            if (shouldClose)
                await connection.CloseAsync();
        }
    }

    internal static string SanitizeSuffix(string locationExternalId)
    {
        var chars = locationExternalId
            .Select(c => char.IsLetterOrDigit(c) ? c : '_')
            .ToArray();
        var s = new string(chars);
        return s.Length > 40 ? s[..40] : s;
    }

    static bool IsSafePgIdent(string name) =>
        !string.IsNullOrEmpty(name) && Regex.IsMatch(name, @"^[A-Za-z_][A-Za-z0-9_]*$");
}
