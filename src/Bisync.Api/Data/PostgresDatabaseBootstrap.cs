using Npgsql;

namespace Bisync.Api.Data;

/// <summary>
/// Ensures a PostgreSQL database exists before EF EnsureCreated runs.
/// EnsureCreated will attempt CREATE DATABASE when the target DB is missing, which
/// fails with 42501 when the app role lacks CREATEDB (common on native Windows Postgres).
/// </summary>
public static class PostgresDatabaseBootstrap
{
    public static async Task EnsureExistsAsync(string connectionString, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
            return;

        var target = new NpgsqlConnectionStringBuilder(connectionString);
        var dbName = target.Database;
        if (string.IsNullOrWhiteSpace(dbName))
            return;

        // Fast path: already reachable.
        try
        {
            await using var probe = new NpgsqlConnection(connectionString);
            await probe.OpenAsync(ct);
            return;
        }
        catch (PostgresException ex) when (ex.SqlState == "3D000")
        {
            // database does not exist — create below
        }
        catch (PostgresException)
        {
            throw;
        }

        if (!IsSafeDatabaseName(dbName))
            throw new InvalidOperationException($"Refusing to create database with unsafe name '{dbName}'.");

        var admin = new NpgsqlConnectionStringBuilder(connectionString) { Database = "postgres" };
        try
        {
            await using var conn = new NpgsqlConnection(admin.ConnectionString);
            await conn.OpenAsync(ct);

            await using (var existsCmd = conn.CreateCommand())
            {
                existsCmd.CommandText = "SELECT 1 FROM pg_database WHERE datname = @name";
                existsCmd.Parameters.AddWithValue("name", dbName);
                if (await existsCmd.ExecuteScalarAsync(ct) is not null)
                    return;
            }

            await using var createCmd = conn.CreateCommand();
            createCmd.CommandText = $"CREATE DATABASE \"{dbName.Replace("\"", "\"\"")}\"";
            await createCmd.ExecuteNonQueryAsync(ct);
            Console.WriteLine($"[Postgres] Created database '{dbName}'.");
        }
        catch (PostgresException ex) when (ex.SqlState == "42501")
        {
            throw new InvalidOperationException(
                $"PostgreSQL denied CREATE DATABASE for '{dbName}' (role lacks CREATEDB). "
                + "Start the Docker Postgres from this repo (docker compose up -d), or run "
                + ".\\scripts\\setup-local-postgres.ps1 with a superuser password so bisync / "
                + "bisync_archive / bisync_audit already exist. "
                + $"Original error: {ex.MessageText}",
                ex);
        }
        catch (Exception ex) when (ex is not InvalidOperationException)
        {
            throw new InvalidOperationException(
                $"Could not ensure PostgreSQL database '{dbName}' exists. "
                + "Check that Postgres is running on the connection host/port "
                + "(prefer: docker compose up -d). "
                + $"Details: {ex.Message}",
                ex);
        }
    }

    static bool IsSafeDatabaseName(string name) =>
        System.Text.RegularExpressions.Regex.IsMatch(name, @"^[A-Za-z_][A-Za-z0-9_]*$");
}
