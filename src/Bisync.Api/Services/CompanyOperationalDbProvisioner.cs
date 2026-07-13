using Bisync.Api.Data;
using Bisync.Api.Models;
using Bisync.Api.Tenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Npgsql;

namespace Bisync.Api.Services;

public sealed class CompanyDbProvisionResult
{
    public bool AlreadyProvisioned { get; init; }
    public bool Provisioned { get; init; }
    public bool SkippedByFeatureFlag { get; init; }
    public string DatabaseName { get; init; } = string.Empty;
    public string ArchiveDatabaseName { get; init; } = string.Empty;
    public string Message { get; init; } = string.Empty;
}

/// <summary>
/// Phase 3: CREATE DATABASE bisync_c_{companyId} (+ archive), schema bootstrap, seed company/locations/user,
/// then update control-plane TenantConnections.
/// </summary>
public class CompanyOperationalDbProvisioner(
    ITenantConnectionResolver resolver,
    IOptions<TenancyOptions> tenancyOptions,
    ILogger<CompanyOperationalDbProvisioner> logger)
{
    public async Task<CompanyDbProvisionResult> ProvisionAsync(int companyId, CancellationToken ct = default)
    {
        if (companyId <= 0)
            return new CompanyDbProvisionResult { Message = "Invalid company id." };

        if (!tenancyOptions.Value.ProvisionCompanyDatabases)
        {
            return new CompanyDbProvisionResult
            {
                SkippedByFeatureFlag = true,
                Message = "Tenancy:ProvisionCompanyDatabases is disabled.",
            };
        }

        await using var control = CreateControlContext();
        await SchemaPatcher.EnsureTenantRegistryAsync(control);

        var registry = await control.TenantConnections
            .FirstOrDefaultAsync(t => t.CompanyId == companyId, ct);
        if (registry is null)
        {
            registry = new TenantConnection
            {
                CompanyId = companyId,
                DatabaseName = $"bisync_c_{companyId}",
                ArchiveDatabaseName = $"bisync_c_{companyId}_archive",
                ConnectionString = string.Empty,
                ArchiveConnectionString = string.Empty,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            };
            control.TenantConnections.Add(registry);
            await control.SaveChangesAsync(ct);
        }

        if (!string.IsNullOrWhiteSpace(registry.ConnectionString))
        {
            resolver.Refresh(
                companyId,
                registry.ConnectionString,
                registry.ArchiveConnectionString,
                registry.DatabaseName);
            return new CompanyDbProvisionResult
            {
                AlreadyProvisioned = true,
                DatabaseName = registry.DatabaseName,
                ArchiveDatabaseName = string.IsNullOrWhiteSpace(registry.ArchiveDatabaseName)
                    ? $"{registry.DatabaseName}_archive"
                    : registry.ArchiveDatabaseName,
                Message = "Company database already provisioned.",
            };
        }

        var company = await control.Companies.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == companyId, ct);
        if (company is null)
            return new CompanyDbProvisionResult { Message = "Company not found." };

        var locations = await control.Locations.AsNoTracking()
            .Where(l => l.CompanyId == companyId)
            .ToListAsync(ct);
        var owner = await control.AppUsers.AsNoTracking()
            .Where(u => u.CompanyId == companyId)
            .OrderBy(u => u.Id)
            .FirstOrDefaultAsync(ct);

        var databaseName = string.IsNullOrWhiteSpace(registry.DatabaseName)
            ? $"bisync_c_{companyId}"
            : registry.DatabaseName.Trim();
        if (!IsSafeDatabaseName(databaseName))
            throw new InvalidOperationException($"Unsafe database name: {databaseName}");

        var archiveDatabaseName = string.IsNullOrWhiteSpace(registry.ArchiveDatabaseName)
            ? $"{databaseName}_archive"
            : registry.ArchiveDatabaseName.Trim();
        if (!IsSafeDatabaseName(archiveDatabaseName))
            throw new InvalidOperationException($"Unsafe archive database name: {archiveDatabaseName}");

        await EnsureDatabaseExistsAsync(resolver.DefaultOperationalConnection, databaseName, ct);
        await EnsureDatabaseExistsAsync(resolver.DefaultOperationalConnection, archiveDatabaseName, ct);

        var operationalCs = TenantConnectionResolver.ReplaceDatabase(
            resolver.DefaultOperationalConnection, databaseName);
        var archiveCs = TenantConnectionResolver.ReplaceDatabase(
            resolver.DefaultOperationalConnection, archiveDatabaseName);

        await BootstrapOperationalDatabaseAsync(operationalCs, company, locations, owner, ct);
        await BootstrapArchiveDatabaseAsync(archiveCs, ct);

        registry.DatabaseName = databaseName;
        registry.ArchiveDatabaseName = archiveDatabaseName;
        registry.ConnectionString = operationalCs;
        registry.ArchiveConnectionString = archiveCs;
        registry.IsActive = true;
        registry.UpdatedAt = DateTime.UtcNow;
        await control.SaveChangesAsync(ct);

        resolver.Refresh(companyId, operationalCs, archiveCs, databaseName);
        logger.LogInformation(
            "Provisioned operational DB {Database} and archive {Archive} for company {CompanyId}",
            databaseName, archiveDatabaseName, companyId);

        return new CompanyDbProvisionResult
        {
            Provisioned = true,
            DatabaseName = databaseName,
            ArchiveDatabaseName = archiveDatabaseName,
            Message = "Company operational and archive databases provisioned.",
        };
    }

    async Task BootstrapOperationalDatabaseAsync(
        string connectionString,
        Company company,
        List<Location> locations,
        AppUser? owner,
        CancellationToken ct)
    {
        var options = new DbContextOptionsBuilder<BisyncDbContext>()
            .UseNpgsql(connectionString)
            .Options;

        await using var tenantDb = new BisyncDbContext(options);
        await tenantDb.Database.EnsureCreatedAsync(ct);
        await SchemaPatcher.ApplyAsync(tenantDb);

        // Clean catalogs — new operational DB should start empty for inventory/catalog data.
        // EnsureCreated may leave empty tables; SchemaPatcher may seed global catalogs — strip non-tenant rows.
        await ClearOperationalCatalogsAsync(tenantDb, ct);

        await ClearOperationalCatalogsAsync(tenantDb, ct);

        if (!await tenantDb.Companies.AnyAsync(c => c.Id == company.Id, ct))
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await InsertCompanyRawAsync(conn, company, ct);
        }

        if (owner is not null && !await tenantDb.AppUsers.AnyAsync(u => u.Id == owner.Id, ct))
        {
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await InsertAppUserRawAsync(conn, owner, ct);
        }

        foreach (var loc in locations)
        {
            if (await tenantDb.Locations.AnyAsync(l => l.Id == loc.Id, ct))
                continue;
            await using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync(ct);
            await InsertLocationRawAsync(conn, loc, ct);
        }

        await SchemaPatcher.EnsureTenantRegistryAsync(tenantDb);
        await DatabaseSchemaHelper.TryResyncIdentitySequenceAsync(tenantDb, "Companies");
        await DatabaseSchemaHelper.TryResyncIdentitySequenceAsync(tenantDb, "Locations");
        await DatabaseSchemaHelper.TryResyncIdentitySequenceAsync(tenantDb, "AppUsers");
    }

    static async Task ClearOperationalCatalogsAsync(BisyncDbContext tenantDb, CancellationToken ct)
    {
        // Best-effort wipe of shared catalog seeds so company DBs start clean.
        try
        {
            await tenantDb.Database.ExecuteSqlRawAsync("""DELETE FROM "VendorProducts";""", ct);
            await tenantDb.Database.ExecuteSqlRawAsync("""DELETE FROM "Vendors";""", ct);
            await tenantDb.Database.ExecuteSqlRawAsync("""DELETE FROM "Ingredients";""", ct);
            await tenantDb.Database.ExecuteSqlRawAsync("""DELETE FROM "MenuItems";""", ct);
        }
        catch
        {
            // Tables may not exist yet on a partial schema.
        }
    }

    static async Task InsertCompanyRawAsync(NpgsqlConnection conn, Company company, CancellationToken ct)
    {
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            INSERT INTO "Companies" (
              "Id", "Name", "Brn", "GstTin", "CountryCode",
              "AddressLine1", "AddressLine2", "City", "StateProvince", "Postcode",
              "Phone", "Fax", "Email", "Active",
              "BusinessTypesJson", "VendorPolicyTagsJson", "ModulesJson")
            VALUES (
              @id, @name, @brn, @gst, @cc,
              @a1, @a2, @city, @state, @post,
              @phone, @fax, @email, @active,
              @bt, @vp, @mod)
            ON CONFLICT ("Id") DO NOTHING
            """;
        cmd.Parameters.AddWithValue("id", company.Id);
        cmd.Parameters.AddWithValue("name", company.Name);
        cmd.Parameters.AddWithValue("brn", company.Brn);
        cmd.Parameters.AddWithValue("gst", company.GstTin);
        cmd.Parameters.AddWithValue("cc", company.CountryCode);
        cmd.Parameters.AddWithValue("a1", company.AddressLine1);
        cmd.Parameters.AddWithValue("a2", company.AddressLine2);
        cmd.Parameters.AddWithValue("city", company.City);
        cmd.Parameters.AddWithValue("state", company.StateProvince);
        cmd.Parameters.AddWithValue("post", company.Postcode);
        cmd.Parameters.AddWithValue("phone", company.Phone);
        cmd.Parameters.AddWithValue("fax", company.Fax);
        cmd.Parameters.AddWithValue("email", company.Email);
        cmd.Parameters.AddWithValue("active", company.Active);
        cmd.Parameters.AddWithValue("bt", company.BusinessTypesJson);
        cmd.Parameters.AddWithValue("vp", company.VendorPolicyTagsJson);
        cmd.Parameters.AddWithValue("mod", company.ModulesJson);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    static async Task InsertLocationRawAsync(NpgsqlConnection conn, Location loc, CancellationToken ct)
    {
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            INSERT INTO "Locations" (
              "Id", "ExternalId", "Name", "Address", "CompanyId",
              "AddressLine1", "AddressLine2", "City", "StateProvince", "Postcode",
              "PrincipalContactUserId", "BusinessTypesJson", "VendorPolicyTagsJson", "ModulesJson",
              "SalesToday", "SalesWtd", "SalesMtd", "SalesYtd",
              "SalesPrevToday", "SalesPrevWtd", "SalesPrevMtd", "SalesPrevYtd",
              "CoversToday", "CoversWtd", "CoversMtd", "CoversYtd",
              "CoversPrevToday", "CoversPrevWtd", "CoversPrevMtd", "CoversPrevYtd",
              "ChecksToday", "ChecksWtd", "ChecksMtd", "ChecksYtd",
              "ChecksPrevToday", "ChecksPrevWtd", "ChecksPrevMtd", "ChecksPrevYtd")
            VALUES (
              @id, @ext, @name, @address, @companyId,
              @a1, @a2, @city, @state, @post,
              @principal, @bt, @vp, @mod,
              0, 0, 0, 0,
              0, 0, 0, 0,
              0, 0, 0, 0,
              0, 0, 0, 0,
              0, 0, 0, 0,
              0, 0, 0, 0)
            ON CONFLICT ("Id") DO NOTHING
            """;
        cmd.Parameters.AddWithValue("id", loc.Id);
        cmd.Parameters.AddWithValue("ext", loc.ExternalId);
        cmd.Parameters.AddWithValue("name", loc.Name);
        cmd.Parameters.AddWithValue("address", loc.Address ?? string.Empty);
        cmd.Parameters.AddWithValue("companyId", (object?)loc.CompanyId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("a1", loc.AddressLine1 ?? string.Empty);
        cmd.Parameters.AddWithValue("a2", loc.AddressLine2 ?? string.Empty);
        cmd.Parameters.AddWithValue("city", loc.City ?? string.Empty);
        cmd.Parameters.AddWithValue("state", loc.StateProvince ?? string.Empty);
        cmd.Parameters.AddWithValue("post", loc.Postcode ?? string.Empty);
        cmd.Parameters.AddWithValue("principal", (object?)loc.PrincipalContactUserId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("bt", loc.BusinessTypesJson ?? "[]");
        cmd.Parameters.AddWithValue("vp", loc.VendorPolicyTagsJson ?? "[]");
        cmd.Parameters.AddWithValue("mod", loc.ModulesJson ?? "[]");
        await cmd.ExecuteNonQueryAsync(ct);
    }

    static async Task InsertAppUserRawAsync(NpgsqlConnection conn, AppUser user, CancellationToken ct)
    {
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            INSERT INTO "AppUsers" (
              "Id", "FullName", "Email", "Role", "Phone", "Active",
              "AccessJson", "CompanyId", "LocationIdsJson", "EmployeeId",
              "PasswordHash", "ActivationToken", "ActivationTokenExpiresAt")
            VALUES (
              @id, @name, @email, @role, @phone, @active,
              @access, @companyId, @locs, @emp,
              @pwd, @token, @tokenExp)
            ON CONFLICT ("Id") DO NOTHING
            """;
        cmd.Parameters.AddWithValue("id", user.Id);
        cmd.Parameters.AddWithValue("name", user.FullName);
        cmd.Parameters.AddWithValue("email", user.Email);
        cmd.Parameters.AddWithValue("role", user.Role);
        cmd.Parameters.AddWithValue("phone", user.Phone);
        cmd.Parameters.AddWithValue("active", user.Active);
        cmd.Parameters.AddWithValue("access", user.AccessJson);
        cmd.Parameters.AddWithValue("companyId", (object?)user.CompanyId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("locs", user.LocationIdsJson);
        cmd.Parameters.AddWithValue("emp", (object?)user.EmployeeId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("pwd", (object?)user.PasswordHash ?? DBNull.Value);
        cmd.Parameters.AddWithValue("token", (object?)user.ActivationToken ?? DBNull.Value);
        cmd.Parameters.AddWithValue("tokenExp", (object?)user.ActivationTokenExpiresAt ?? DBNull.Value);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    async Task BootstrapArchiveDatabaseAsync(string archiveConnectionString, CancellationToken ct)
    {
        var options = new DbContextOptionsBuilder<StockCardArchiveDbContext>()
            .UseNpgsql(archiveConnectionString)
            .Options;
        await using var archiveDb = new StockCardArchiveDbContext(options);
        await archiveDb.Database.EnsureCreatedAsync(ct);
    }

    BisyncDbContext CreateControlContext()
    {
        var options = new DbContextOptionsBuilder<BisyncDbContext>()
            .UseNpgsql(resolver.DefaultOperationalConnection)
            .Options;
        return new BisyncDbContext(options);
    }

    static async Task EnsureDatabaseExistsAsync(string templateConnection, string databaseName, CancellationToken ct)
    {
        var adminCs = TenantConnectionResolver.ReplaceDatabase(templateConnection, "postgres");
        await using var conn = new NpgsqlConnection(adminCs);
        await conn.OpenAsync(ct);

        await using (var existsCmd = conn.CreateCommand())
        {
            existsCmd.CommandText = "SELECT 1 FROM pg_database WHERE datname = @name";
            existsCmd.Parameters.AddWithValue("name", databaseName);
            var exists = await existsCmd.ExecuteScalarAsync(ct);
            if (exists is not null)
                return;
        }

        // CREATE DATABASE cannot run inside a transaction; quote identifier safely.
        await using var createCmd = conn.CreateCommand();
        createCmd.CommandText = $"CREATE DATABASE \"{databaseName}\"";
        await createCmd.ExecuteNonQueryAsync(ct);
    }

    static bool IsSafeDatabaseName(string name) =>
        !string.IsNullOrWhiteSpace(name)
        && System.Text.RegularExpressions.Regex.IsMatch(name, @"^[A-Za-z_][A-Za-z0-9_]*$");
}
