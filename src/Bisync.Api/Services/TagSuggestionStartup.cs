using Bisync.Api.Data;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Bisync.Api.Services;

public static class TagSuggestionStartup
{
    public const string DatabaseName = "bisync_tag_suggestions";
    public const decimal MinProbability = 50m;
    public const int RebuildLocalHour = 3;

    public static async Task InitializeAsync(IServiceProvider services)
    {
        var config = services.GetRequiredService<IConfiguration>();
        var conn = ApplyPassword(
            config.GetConnectionString("TagSuggestionConnection")
            ?? DeriveDatabase(config.GetConnectionString("DefaultConnection") ?? string.Empty, DatabaseName),
            config["DB_PASSWORD"]);

        try
        {
            await PostgresDatabaseBootstrap.EnsureExistsAsync(conn);
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[TagSuggestion] ensure database: {ex.Message}");
        }

        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TagSuggestionDbContext>();
        try
        {
            await db.Database.EnsureCreatedAsync();
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[TagSuggestion] schema init failed: {ex.Message}");
            return;
        }

        try
        {
            var rebuild = scope.ServiceProvider.GetRequiredService<ComponentVendorTagSuggestionService>();
            await rebuild.RebuildEmptyCountriesAsync();
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[TagSuggestion] initial rebuild skipped: {ex.Message}");
        }
    }

    public static string ResolveConnection(IConfiguration config) =>
        ApplyPassword(
            config.GetConnectionString("TagSuggestionConnection")
            ?? DeriveDatabase(config.GetConnectionString("DefaultConnection") ?? string.Empty, DatabaseName),
            config["DB_PASSWORD"]);

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
