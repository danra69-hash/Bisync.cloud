using Bisync.Api.Data;
using Bisync.Api.Services;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Bisync.Api.Services;

public static class SystemAuditStartup
{
    public const string DatabaseName = "bisync_audit";

    public static async Task InitializeAsync(IServiceProvider services)
    {
        var config = services.GetRequiredService<IConfiguration>();
        var conn = ApplyPassword(
            config.GetConnectionString("AuditConnection")
            ?? DeriveDatabase(config.GetConnectionString("DefaultConnection") ?? string.Empty, DatabaseName),
            config["DB_PASSWORD"]);

        await EnsureDatabaseExistsAsync(conn);

        await using var scope = services.CreateAsyncScope();
        var auditDb = scope.ServiceProvider.GetRequiredService<SystemAuditDbContext>();
        try
        {
            await auditDb.Database.EnsureCreatedAsync();
            await EnsureAuditColumnsAsync(auditDb);
            var archive = scope.ServiceProvider.GetRequiredService<ISystemAuditService>();
            await archive.ArchiveOlderThanOneYearAsync();
        }
        catch (Exception ex)
        {
            // Do not block API boot if the audit DB is temporarily unreachable.
            Console.Error.WriteLine($"[SystemAudit] schema init failed: {ex.Message}");
        }
    }

    static async Task EnsureAuditColumnsAsync(SystemAuditDbContext auditDb)
    {
        foreach (var table in new[] { "SystemAuditEvents", "ArchivedSystemAuditEvents" })
        {
            await DatabaseSchemaHelper.TryAddColumnAsync(auditDb, table, "LocationId", "integer NULL");
            await DatabaseSchemaHelper.TryAddColumnAsync(auditDb, table, "LocationExternalId", "character varying(64) NULL");
            await DatabaseSchemaHelper.TryAddColumnAsync(auditDb, table, "LocationName", "character varying(256) NULL");
            await DatabaseSchemaHelper.TryAddColumnAsync(auditDb, table, "DatabaseBucket", "character varying(128) NULL");
        }

        try
        {
            await auditDb.Database.ExecuteSqlRawAsync(
                """CREATE INDEX IF NOT EXISTS "IX_SystemAuditEvents_LocationId" ON "SystemAuditEvents" ("LocationId");""");
        }
        catch
        {
            // ignore
        }

        // OccurredAtLocal is a wall-clock local time (DateTimeKind.Unspecified). Npgsql rejects
        // Unspecified values for timestamptz, which broke login audit writes.
        foreach (var table in new[] { "SystemAuditEvents", "ArchivedSystemAuditEvents" })
        {
            try
            {
                // table name is from a fixed allow-list above (not user input)
                await auditDb.Database.ExecuteSqlRawAsync(
                    "ALTER TABLE \"" + table + "\" ALTER COLUMN \"OccurredAtLocal\" TYPE timestamp without time zone "
                    + "USING (\"OccurredAtLocal\" AT TIME ZONE 'UTC');");
            }
            catch
            {
                // ignore — already timestamp without time zone, or table missing
            }
        }
    }

    static async Task EnsureDatabaseExistsAsync(string connectionString)
    {
        try
        {
            var builder = new NpgsqlConnectionStringBuilder(connectionString);
            var dbName = builder.Database;
            if (string.IsNullOrWhiteSpace(dbName)) return;

            builder.Database = "postgres";
            await using var conn = new NpgsqlConnection(builder.ConnectionString);
            await conn.OpenAsync();
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT 1 FROM pg_database WHERE datname = @name";
            cmd.Parameters.AddWithValue("name", dbName);
            var exists = await cmd.ExecuteScalarAsync();
            if (exists is not null) return;

            await using var create = conn.CreateCommand();
            create.CommandText = $"CREATE DATABASE \"{dbName.Replace("\"", "\"\"")}\"";
            await create.ExecuteNonQueryAsync();
            Console.WriteLine($"[SystemAudit] Created database '{dbName}'.");
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[SystemAudit] ensure database: {ex.Message}");
        }
    }

    public static string ApplyPassword(string? connectionString, string? password)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
            return connectionString ?? string.Empty;
        if (string.IsNullOrEmpty(password) || connectionString.Contains("Password=", StringComparison.OrdinalIgnoreCase))
            return connectionString;
        var separator = connectionString.TrimEnd().EndsWith(';') ? string.Empty : ";";
        return $"{connectionString}{separator}Password={password}";
    }

    public static string DeriveDatabase(string operationalConnection, string databaseName)
    {
        if (string.IsNullOrWhiteSpace(operationalConnection))
            return $"Host=localhost;Port=5432;Database={databaseName};Username=bisync;Password=bisync";
        var builder = new NpgsqlConnectionStringBuilder(operationalConnection) { Database = databaseName };
        return builder.ConnectionString;
    }
}

public sealed class SystemAuditArchiveHostedService(IServiceScopeFactory scopeFactory, ILogger<SystemAuditArchiveHostedService> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Daily retention sweep — keep live audit ≤ 1 year.
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(TimeSpan.FromHours(24), stoppingToken);
                await using var scope = scopeFactory.CreateAsyncScope();
                var audit = scope.ServiceProvider.GetRequiredService<ISystemAuditService>();
                await audit.ArchiveOlderThanOneYearAsync(stoppingToken);
                logger.LogInformation("System audit archive sweep completed.");
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "System audit archive sweep failed.");
            }
        }
    }
}
