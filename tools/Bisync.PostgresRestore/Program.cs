using System.Diagnostics;
using Microsoft.Extensions.Configuration;
using Npgsql;

var root = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", ".."));
var apiDir = Path.Combine(root, "src", "Bisync.Api");
var skipArchive = args.Contains("--skip-archive", StringComparer.OrdinalIgnoreCase);

var config = new ConfigurationBuilder()
    .SetBasePath(apiDir)
    .AddJsonFile("appsettings.json", optional: false)
    .AddJsonFile("appsettings.Development.json", optional: true)
    .AddEnvironmentVariables()
    .Build();

static string ApplyDbPassword(string? connectionString, string? password)
{
    if (string.IsNullOrWhiteSpace(connectionString))
        return connectionString ?? string.Empty;
    if (string.IsNullOrEmpty(password) || connectionString.Contains("Password=", StringComparison.OrdinalIgnoreCase))
        return connectionString;
    var separator = connectionString.TrimEnd().EndsWith(';') ? string.Empty : ";";
    return $"{connectionString}{separator}Password={password}";
}

var dbPassword = config["DB_PASSWORD"];
var defaultConnection = ApplyDbPassword(config.GetConnectionString("DefaultConnection"), dbPassword);
var archiveConnection = ApplyDbPassword(config.GetConnectionString("ArchiveConnection"), dbPassword);

if (string.IsNullOrWhiteSpace(defaultConnection))
    throw new InvalidOperationException("DefaultConnection is not configured.");

var mainSqlPath = Path.Combine(apiDir, "bisync-postgres-latest.sql");
var archiveSqlPath = Path.Combine(apiDir, "bisync-archive-postgres-latest.sql");

if (!File.Exists(mainSqlPath))
    throw new FileNotFoundException($"Missing {mainSqlPath}. Run publish-postgres-db.ps1 on the source machine first.");

await VerifyConnectionAsync(defaultConnection, "bisync");
await RestoreDatabaseAsync(defaultConnection, mainSqlPath);

if (!skipArchive && File.Exists(archiveSqlPath) && !string.IsNullOrWhiteSpace(archiveConnection))
{
    try
    {
        await VerifyConnectionAsync(archiveConnection, "bisync_archive");
        await RestoreDatabaseAsync(archiveConnection, archiveSqlPath);
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine($"Skipped archive restore: {ex.Message}");
    }
}

Console.WriteLine("PostgreSQL restore complete.");

static async Task VerifyConnectionAsync(string connectionString, string label)
{
    await using var connection = new NpgsqlConnection(connectionString);
    await connection.OpenAsync();
    await using var cmd = new NpgsqlCommand("SELECT 1", connection);
    await cmd.ExecuteScalarAsync();
    Console.WriteLine($"Connected to {label}.");
}

static async Task RestoreDatabaseAsync(string connectionString, string sqlPath)
{
    var builder = new NpgsqlConnectionStringBuilder(connectionString)
    {
        Host = string.IsNullOrWhiteSpace(connectionString) ? "127.0.0.1" : new NpgsqlConnectionStringBuilder(connectionString).Host,
    };
    if (string.Equals(builder.Host, "localhost", StringComparison.OrdinalIgnoreCase))
        builder.Host = "127.0.0.1";

    var psql = ResolvePsql();
    var psi = new ProcessStartInfo
    {
        FileName = psql,
        RedirectStandardError = true,
        UseShellExecute = false,
    };
    psi.ArgumentList.Add("-h");
    psi.ArgumentList.Add(builder.Host ?? "127.0.0.1");
    psi.ArgumentList.Add("-p");
    psi.ArgumentList.Add(builder.Port.ToString());
    psi.ArgumentList.Add("-U");
    psi.ArgumentList.Add(builder.Username ?? "bisync");
    psi.ArgumentList.Add("-d");
    psi.ArgumentList.Add(builder.Database ?? "bisync");
    psi.ArgumentList.Add("-v");
    psi.ArgumentList.Add("ON_ERROR_STOP=1");
    psi.ArgumentList.Add("-f");
    psi.ArgumentList.Add(sqlPath);

    if (!string.IsNullOrEmpty(builder.Password))
        psi.Environment["PGPASSWORD"] = builder.Password;

    Console.WriteLine($"Restoring {builder.Database} from {sqlPath} ...");
    using var process = Process.Start(psi) ?? throw new InvalidOperationException("Failed to start psql.");
    var stderr = await process.StandardError.ReadToEndAsync();
    await process.WaitForExitAsync();
    if (process.ExitCode != 0)
        throw new InvalidOperationException($"psql restore failed for {builder.Database}: {stderr}");

    Console.WriteLine($"Restored {builder.Database}.");
}

static string ResolvePsql()
{
    var pathEnv = Environment.GetEnvironmentVariable("PATH") ?? string.Empty;
    foreach (var dir in pathEnv.Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries))
    {
        var candidate = Path.Combine(dir, "psql.exe");
        if (File.Exists(candidate))
            return candidate;
    }

    var programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
    var installs = Directory.Exists(Path.Combine(programFiles, "PostgreSQL"))
        ? Directory.GetDirectories(Path.Combine(programFiles, "PostgreSQL"))
        : [];
    foreach (var install in installs.OrderDescending(StringComparer.OrdinalIgnoreCase))
    {
        var candidate = Path.Combine(install, "bin", "psql.exe");
        if (File.Exists(candidate))
            return candidate;
    }

    throw new FileNotFoundException("psql not found.");
}
