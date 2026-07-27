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

        // Prefer EF entity inserts over hand-maintained column lists so newly added NOT NULL
        // columns (Code, PreferredLanguage, TimeZoneId, …) cannot break tenant bootstrap.
        try
        {
            if (!await tenantDb.Companies.AnyAsync(c => c.Id == company.Id, ct))
            {
                tenantDb.Companies.Add(CloneCompanyForSeed(company));
                await tenantDb.SaveChangesAsync(ct);
            }

            if (owner is not null && !await tenantDb.AppUsers.AnyAsync(u => u.Id == owner.Id, ct))
            {
                tenantDb.AppUsers.Add(CloneAppUserForSeed(owner));
                await tenantDb.SaveChangesAsync(ct);
            }

            var seededLocations = false;
            foreach (var loc in locations)
            {
                if (await tenantDb.Locations.AnyAsync(l => l.Id == loc.Id, ct))
                    continue;
                tenantDb.Locations.Add(CloneLocationForSeed(loc, company.CountryCode, owner?.Id));
                seededLocations = true;
            }

            if (seededLocations)
                await tenantDb.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex)
        {
            throw new InvalidOperationException(
                $"Tenant seed failed: {FormatExceptionChain(ex)}", ex);
        }

        await SchemaPatcher.EnsureTenantRegistryAsync(tenantDb);
        await DatabaseSchemaHelper.TryResyncIdentitySequenceAsync(tenantDb, "Companies");
        await DatabaseSchemaHelper.TryResyncIdentitySequenceAsync(tenantDb, "Locations");
        await DatabaseSchemaHelper.TryResyncIdentitySequenceAsync(tenantDb, "AppUsers");
    }

    static string FormatExceptionChain(Exception ex)
    {
        var parts = new List<string>();
        for (var cur = ex; cur is not null; cur = cur.InnerException)
        {
            var msg = cur.Message?.Trim();
            if (!string.IsNullOrWhiteSpace(msg) && !parts.Contains(msg, StringComparer.Ordinal))
                parts.Add(msg);
        }
        return parts.Count == 0 ? ex.GetType().Name : string.Join(" → ", parts);
    }

    /// <summary>
    /// Npgsql rejects DateTime Kind=Unspecified for timestamptz columns.
    /// Control-plane reads often come back Unspecified — normalize before tenant seed.
    /// </summary>
    static DateTime? AsUtc(DateTime? value)
    {
        if (value is null) return null;
        var dt = value.Value;
        return dt.Kind switch
        {
            DateTimeKind.Utc => dt,
            DateTimeKind.Local => dt.ToUniversalTime(),
            _ => DateTime.SpecifyKind(dt, DateTimeKind.Utc),
        };
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

    static string NormalizeCompanyCode(Company company)
    {
        var code = string.IsNullOrWhiteSpace(company.Code)
            ? ComponentIdentityRules.DeriveCompanyCodeCandidate(company.Name)
            : company.Code.Trim().ToUpperInvariant();
        if (code.Length > ComponentIdentityRules.CompanyCodeLength)
            code = code[..ComponentIdentityRules.CompanyCodeLength];
        if (code.Length < ComponentIdentityRules.CompanyCodeLength)
            code = code.PadRight(ComponentIdentityRules.CompanyCodeLength, 'X');
        return code;
    }

    static Company CloneCompanyForSeed(Company company) => new()
    {
        Id = company.Id,
        Name = company.Name,
        Code = NormalizeCompanyCode(company),
        Brn = company.Brn ?? string.Empty,
        GstTin = company.GstTin ?? string.Empty,
        CountryCode = string.IsNullOrWhiteSpace(company.CountryCode) ? "MY" : company.CountryCode,
        AddressLine1 = company.AddressLine1 ?? string.Empty,
        AddressLine2 = company.AddressLine2 ?? string.Empty,
        City = company.City ?? string.Empty,
        StateProvince = company.StateProvince ?? string.Empty,
        Postcode = company.Postcode ?? string.Empty,
        Phone = company.Phone ?? string.Empty,
        Fax = company.Fax ?? string.Empty,
        Email = company.Email ?? string.Empty,
        Active = company.Active,
        RegisteredAt = AsUtc(company.RegisteredAt),
        LogoFileName = company.LogoFileName ?? string.Empty,
        LogoContentType = company.LogoContentType ?? string.Empty,
        LogoBase64 = company.LogoBase64 ?? string.Empty,
        SmtpProviderMode = string.IsNullOrWhiteSpace(company.SmtpProviderMode) ? "auto" : company.SmtpProviderMode,
        SmtpHost = company.SmtpHost ?? string.Empty,
        SmtpPort = company.SmtpPort <= 0 ? 587 : company.SmtpPort,
        SmtpUseSsl = company.SmtpUseSsl,
        SmtpUsername = company.SmtpUsername ?? string.Empty,
        SmtpPassword = company.SmtpPassword ?? string.Empty,
        SmtpFromEmail = company.SmtpFromEmail ?? string.Empty,
        SmtpFromName = company.SmtpFromName ?? string.Empty,
        GraphTenantId = company.GraphTenantId ?? string.Empty,
        GraphClientId = company.GraphClientId ?? string.Empty,
        GraphClientSecret = company.GraphClientSecret ?? string.Empty,
        BusinessTypesJson = company.BusinessTypesJson ?? "[]",
        VendorPolicyTagsJson = company.VendorPolicyTagsJson ?? "[]",
        ModulesJson = company.ModulesJson ?? "[]",
    };

    static AppUser CloneAppUserForSeed(AppUser user) => new()
    {
        Id = user.Id,
        // Employees are not copied into the fresh tenant DB; drop the FK to avoid 23503.
        EmployeeId = null,
        FullName = user.FullName ?? string.Empty,
        Email = user.Email ?? string.Empty,
        Role = user.Role ?? string.Empty,
        Phone = user.Phone ?? string.Empty,
        Active = user.Active,
        AccessJson = string.IsNullOrWhiteSpace(user.AccessJson) ? """{"modules":[]}""" : user.AccessJson,
        CompanyId = user.CompanyId,
        LocationIdsJson = string.IsNullOrWhiteSpace(user.LocationIdsJson) ? "[]" : user.LocationIdsJson,
        PasswordHash = user.PasswordHash,
        ActivationToken = user.ActivationToken,
        ActivationTokenExpiresAt = AsUtc(user.ActivationTokenExpiresAt),
        PreferredLanguage = string.IsNullOrWhiteSpace(user.PreferredLanguage) ? "en" : user.PreferredLanguage,
        PhoneCountryCode = user.PhoneCountryCode,
        EulaVersion = user.EulaVersion,
        AcceptedEulaAt = AsUtc(user.AcceptedEulaAt),
        PrivacyPolicyVersion = user.PrivacyPolicyVersion,
        AcceptedPrivacyPolicyAt = AsUtc(user.AcceptedPrivacyPolicyAt),
        DpaVersion = user.DpaVersion,
        AcceptedDpaAt = AsUtc(user.AcceptedDpaAt),
    };

    static Location CloneLocationForSeed(Location loc, string? companyCountryCode, int? seededOwnerUserId) => new()
    {
        Id = loc.Id,
        ExternalId = loc.ExternalId ?? string.Empty,
        Name = loc.Name ?? string.Empty,
        Address = loc.Address ?? string.Empty,
        CompanyId = loc.CompanyId,
        AddressLine1 = loc.AddressLine1 ?? string.Empty,
        AddressLine2 = loc.AddressLine2 ?? string.Empty,
        City = loc.City ?? string.Empty,
        StateProvince = loc.StateProvince ?? string.Empty,
        Postcode = loc.Postcode ?? string.Empty,
        // Only keep contact FKs that point at the seeded owner — other users are not copied.
        PrincipalContactUserId = loc.PrincipalContactUserId is int p && p == seededOwnerUserId ? p : null,
        SecondaryContactUserId = loc.SecondaryContactUserId is int s && s == seededOwnerUserId ? s : null,
        BusinessTypesJson = loc.BusinessTypesJson ?? "[]",
        VendorPolicyTagsJson = loc.VendorPolicyTagsJson ?? "[]",
        ModulesJson = loc.ModulesJson ?? "[]",
        OpeningHoursJson = string.IsNullOrWhiteSpace(loc.OpeningHoursJson) ? "{}" : loc.OpeningHoursJson,
        TimeZoneId = string.IsNullOrWhiteSpace(loc.TimeZoneId)
            ? OrgClock.ResolveTimeZoneId(companyCountryCode, loc.StateProvince)
            : loc.TimeZoneId,
    };

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
