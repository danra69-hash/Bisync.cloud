using System.Diagnostics;
using Microsoft.Extensions.Configuration;
using Npgsql;

var root = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", ".."));
var apiDir = Path.Combine(root, "src", "Bisync.Api");
var outDir = apiDir;

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

await VerifyConnectionAsync(defaultConnection, "bisync");
await DumpDatabaseAsync(defaultConnection, Path.Combine(outDir, "bisync-postgres-latest.sql"));

if (!string.IsNullOrWhiteSpace(archiveConnection))
{
    try
    {
        await VerifyConnectionAsync(archiveConnection, "bisync_archive");
        await DumpDatabaseAsync(archiveConnection, Path.Combine(outDir, "bisync-archive-postgres-latest.sql"));
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine($"Skipped archive export: {ex.Message}");
    }
}

Console.WriteLine("PostgreSQL export complete.");

static async Task VerifyConnectionAsync(string connectionString, string label)
{
    await using var connection = new NpgsqlConnection(connectionString);
    await connection.OpenAsync();
    await using var cmd = new NpgsqlCommand("SELECT 1", connection);
    await cmd.ExecuteScalarAsync();
    Console.WriteLine($"Connected to {label}.");
}

static async Task DumpDatabaseAsync(string connectionString, string outputPath)
{
    var builder = new NpgsqlConnectionStringBuilder(connectionString);
    var pgDump = ResolvePgDump();
    var args = new List<string>
    {
        "-h", builder.Host ?? "localhost",
        "-p", builder.Port.ToString(),
        "-U", builder.Username ?? "bisync",
        "-d", builder.Database ?? "bisync",
        "--no-owner",
        "--no-acl",
        "--clean",
        "--if-exists",
        "-f", outputPath,
    };

    var psi = new ProcessStartInfo
    {
        FileName = pgDump,
        RedirectStandardError = true,
        UseShellExecute = false,
    };
    foreach (var arg in args)
        psi.ArgumentList.Add(arg);

    if (!string.IsNullOrEmpty(builder.Password))
        psi.Environment["PGPASSWORD"] = builder.Password;

    using var process = Process.Start(psi) ?? throw new InvalidOperationException("Failed to start pg_dump.");
    var stderr = await process.StandardError.ReadToEndAsync();
    await process.WaitForExitAsync();
    if (process.ExitCode != 0)
        throw new InvalidOperationException($"pg_dump failed for {builder.Database}: {stderr}");

    SanitizeDumpForCloudSql(outputPath);
    Console.WriteLine($"Exported {outputPath}");
}

static void SanitizeDumpForCloudSql(string outputPath)
{
    var lines = File.ReadAllLines(outputPath);
    var filtered = lines.Where(line =>
        !line.StartsWith("SET transaction_timeout", StringComparison.Ordinal)
        && !line.StartsWith("SET idle_session_timeout", StringComparison.Ordinal)
        && !line.StartsWith("SET statement_timeout", StringComparison.Ordinal)).ToArray();
    File.WriteAllLines(outputPath, filtered);
}

static string ResolvePgDump()
{
    var pathEnv = Environment.GetEnvironmentVariable("PATH") ?? string.Empty;
    foreach (var dir in pathEnv.Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries))
    {
        var candidate = Path.Combine(dir, "pg_dump.exe");
        if (File.Exists(candidate))
            return candidate;
    }

    var programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
    var installs = Directory.Exists(Path.Combine(programFiles, "PostgreSQL"))
        ? Directory.GetDirectories(Path.Combine(programFiles, "PostgreSQL"))
        : [];
    foreach (var install in installs.OrderDescending(StringComparer.OrdinalIgnoreCase))
    {
        var candidate = Path.Combine(install, "bin", "pg_dump.exe");
        if (File.Exists(candidate))
            return candidate;
    }

    throw new FileNotFoundException("pg_dump not found.");
}
