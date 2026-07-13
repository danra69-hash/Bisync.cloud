using System.Collections.Concurrent;
using System.Data;
using Microsoft.Extensions.Configuration;
using Npgsql;

namespace Bisync.Api.Tenancy;

public sealed class TenantConnectionResolver : ITenantConnectionResolver
{
    readonly string _defaultOperational;
    readonly string _defaultArchive;
    readonly ConcurrentDictionary<int, CachedTenant> _cache = new();
    readonly object _loadLock = new();

    public TenantConnectionResolver(IConfiguration configuration)
    {
        var dbPassword = configuration["DB_PASSWORD"];
        _defaultOperational = ApplyDbPassword(
            configuration.GetConnectionString("DefaultConnection") ?? string.Empty, dbPassword);
        _defaultArchive = ApplyDbPassword(
            configuration.GetConnectionString("ArchiveConnection") ?? string.Empty, dbPassword);
        if (string.IsNullOrWhiteSpace(_defaultArchive))
            _defaultArchive = DeriveArchiveFromOperational(_defaultOperational, "bisync_archive");
    }

    public string DefaultOperationalConnection => _defaultOperational;
    public string DefaultArchiveConnection => _defaultArchive;

    public string ResolveOperationalConnection(int? companyId)
    {
        if (companyId is null or <= 0)
            return _defaultOperational;

        var cached = GetOrLoad(companyId.Value);
        return string.IsNullOrWhiteSpace(cached.OperationalConnection)
            ? _defaultOperational
            : cached.OperationalConnection;
    }

    public string ResolveArchiveConnection(int? companyId)
    {
        if (companyId is null or <= 0)
            return _defaultArchive;

        var cached = GetOrLoad(companyId.Value);
        if (!string.IsNullOrWhiteSpace(cached.ArchiveConnection))
            return cached.ArchiveConnection;

        if (!string.IsNullOrWhiteSpace(cached.OperationalConnection))
        {
            var archiveDb = string.IsNullOrWhiteSpace(cached.ArchiveDatabaseName)
                ? $"{(string.IsNullOrWhiteSpace(cached.DatabaseName) ? $"bisync_c_{companyId.Value}" : cached.DatabaseName)}_archive"
                : cached.ArchiveDatabaseName;
            return ReplaceDatabase(_defaultOperational, archiveDb);
        }

        return _defaultArchive;
    }

    public void Refresh(int companyId, string? operationalConnection, string? archiveConnection, string? databaseName = null)
    {
        if (companyId <= 0) return;
        _cache[companyId] = new CachedTenant(
            operationalConnection?.Trim() ?? string.Empty,
            archiveConnection?.Trim() ?? string.Empty,
            databaseName?.Trim() ?? $"bisync_c_{companyId}",
            string.IsNullOrWhiteSpace(databaseName) ? $"bisync_c_{companyId}_archive" : $"{databaseName.Trim()}_archive");
    }

    public void Invalidate(int companyId) => _cache.TryRemove(companyId, out _);

    public void InvalidateAll() => _cache.Clear();

    CachedTenant GetOrLoad(int companyId)
    {
        if (_cache.TryGetValue(companyId, out var hit))
            return hit;

        lock (_loadLock)
        {
            if (_cache.TryGetValue(companyId, out hit))
                return hit;

            var loaded = LoadFromControlPlane(companyId);
            _cache[companyId] = loaded;
            return loaded;
        }
    }

    CachedTenant LoadFromControlPlane(int companyId)
    {
        try
        {
            using var conn = new NpgsqlConnection(_defaultOperational);
            conn.Open();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = """
                SELECT "ConnectionString", "DatabaseName",
                       COALESCE("ArchiveConnectionString", ''),
                       COALESCE("ArchiveDatabaseName", '')
                FROM "TenantConnections"
                WHERE "CompanyId" = @companyId
                LIMIT 1
                """;
            cmd.Parameters.AddWithValue("companyId", companyId);
            using var reader = cmd.ExecuteReader(CommandBehavior.SingleRow);
            if (!reader.Read())
                return CachedTenant.Empty(companyId);

            var operational = reader.IsDBNull(0) ? string.Empty : reader.GetString(0);
            var databaseName = reader.IsDBNull(1) ? $"bisync_c_{companyId}" : reader.GetString(1);
            var archiveConn = reader.IsDBNull(2) ? string.Empty : reader.GetString(2);
            var archiveDb = reader.IsDBNull(3) ? string.Empty : reader.GetString(3);
            if (string.IsNullOrWhiteSpace(archiveDb))
                archiveDb = $"{databaseName}_archive";

            return new CachedTenant(operational, archiveConn, databaseName, archiveDb);
        }
        catch
        {
            // Table/columns may not exist yet during very early bootstrap.
            return CachedTenant.Empty(companyId);
        }
    }

    public static string ReplaceDatabase(string connectionString, string databaseName)
    {
        var builder = new NpgsqlConnectionStringBuilder(connectionString)
        {
            Database = databaseName,
        };
        return builder.ConnectionString;
    }

    public static string DeriveArchiveFromOperational(string operationalConnection, string archiveDatabaseName)
        => ReplaceDatabase(operationalConnection, archiveDatabaseName);

    public static string ApplyDbPassword(string? connectionString, string? password)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
            return connectionString ?? string.Empty;
        if (string.IsNullOrEmpty(password) || connectionString.Contains("Password=", StringComparison.OrdinalIgnoreCase))
            return connectionString;
        var separator = connectionString.TrimEnd().EndsWith(';') ? string.Empty : ";";
        return $"{connectionString}{separator}Password={password}";
    }

    sealed record CachedTenant(
        string OperationalConnection,
        string ArchiveConnection,
        string DatabaseName,
        string ArchiveDatabaseName)
    {
        public static CachedTenant Empty(int companyId) =>
            new(string.Empty, string.Empty, $"bisync_c_{companyId}", $"bisync_c_{companyId}_archive");
    }
}
