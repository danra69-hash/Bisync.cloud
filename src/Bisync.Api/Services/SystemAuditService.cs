using System.Text.Json;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Bisync.Api.Tenancy;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Bisync.Api.Services;

public interface ISystemAuditService
{
    Task RecordAsync(SystemAuditWriteRequest request, CancellationToken ct = default);
    Task RecordLoginAsync(AppUser user, Company? company, CancellationToken ct = default);
    Task RecordLogoutAsync(AppUser user, Company? company, string? reason = null, CancellationToken ct = default);
    Task RecordComputationAsync(
        string action,
        string summary,
        object? details = null,
        string? entityType = null,
        string? entityKey = null,
        CancellationToken ct = default);
    Task ArchiveOlderThanOneYearAsync(CancellationToken ct = default);
}

public sealed record SystemAuditWriteRequest(
    string Category,
    string Action,
    string Summary,
    int? CompanyId = null,
    string? CompanyName = null,
    string? CountryCode = null,
    int? UserId = null,
    string? UserEmail = null,
    string? UserName = null,
    string? EntityType = null,
    string? EntityKey = null,
    object? Details = null,
    int? LocationId = null,
    string? LocationExternalId = null,
    string? LocationName = null,
    string? DatabaseBucket = null);

public sealed class SystemAuditService(
    SystemAuditDbContext auditDb,
    BisyncDbContext opsDb,
    IHttpContextAccessor http,
    ITenantContext tenant,
    ITenantConnectionResolver connections) : ISystemAuditService
{
    static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false,
    };

    public async Task RecordLoginAsync(AppUser user, Company? company, CancellationToken ct = default)
    {
        await RecordAsync(new SystemAuditWriteRequest(
            SystemAuditCategories.Login,
            "UserLogin",
            $"User logged in: {user.FullName} ({user.Email})",
            company?.Id ?? user.CompanyId,
            company?.Name,
            company?.CountryCode,
            user.Id,
            user.Email,
            user.FullName,
            "AppUser",
            user.Id.ToString(),
            DatabaseBucket: DatabaseNameFromConnection(connections.DefaultOperationalConnection)), ct);
    }

    public async Task RecordLogoutAsync(AppUser user, Company? company, string? reason = null, CancellationToken ct = default)
    {
        var detail = string.IsNullOrWhiteSpace(reason) ? null : new { reason };
        await RecordAsync(new SystemAuditWriteRequest(
            SystemAuditCategories.Logout,
            "UserLogout",
            $"User logged out: {user.FullName} ({user.Email})",
            company?.Id ?? user.CompanyId,
            company?.Name,
            company?.CountryCode,
            user.Id,
            user.Email,
            user.FullName,
            "AppUser",
            user.Id.ToString(),
            detail,
            DatabaseBucket: DatabaseNameFromConnection(connections.DefaultOperationalConnection)), ct);
    }

    public async Task RecordComputationAsync(
        string action,
        string summary,
        object? details = null,
        string? entityType = null,
        string? entityKey = null,
        CancellationToken ct = default)
    {
        var actor = await ResolveActorAsync(ct);
        await RecordAsync(new SystemAuditWriteRequest(
            SystemAuditCategories.Computation,
            action,
            summary,
            actor.CompanyId,
            actor.CompanyName,
            actor.CountryCode,
            actor.UserId,
            actor.UserEmail,
            actor.UserName,
            entityType,
            entityKey,
            details,
            actor.LocationId,
            actor.LocationExternalId,
            actor.LocationName,
            actor.DatabaseBucket), ct);
    }

    public async Task RecordAsync(SystemAuditWriteRequest request, CancellationToken ct = default)
    {
        try
        {
            var actor = await ResolveActorAsync(ct);
            var companyId = request.CompanyId ?? actor.CompanyId;
            var country = request.CountryCode ?? actor.CountryCode;
            var companyName = request.CompanyName ?? actor.CompanyName;
            var locationId = request.LocationId ?? actor.LocationId;
            var locationExternalId = request.LocationExternalId ?? actor.LocationExternalId;
            var locationName = request.LocationName ?? actor.LocationName;
            var databaseBucket = request.DatabaseBucket ?? actor.DatabaseBucket
                ?? DatabaseNameFromConnection(connections.ResolveOperationalConnection(companyId));

            if (string.IsNullOrWhiteSpace(country) && companyId is > 0)
            {
                country = await opsDb.Companies.AsNoTracking()
                    .Where(c => c.Id == companyId)
                    .Select(c => c.CountryCode)
                    .FirstOrDefaultAsync(ct);
            }

            if (string.IsNullOrWhiteSpace(companyName) && companyId is > 0)
            {
                companyName = await opsDb.Companies.AsNoTracking()
                    .Where(c => c.Id == companyId)
                    .Select(c => c.Name)
                    .FirstOrDefaultAsync(ct);
            }

            if ((locationId is null or <= 0) && !string.IsNullOrWhiteSpace(locationExternalId))
            {
                var loc = await opsDb.Locations.AsNoTracking()
                    .FirstOrDefaultAsync(l => l.ExternalId == locationExternalId, ct);
                if (loc is not null)
                {
                    locationId = loc.Id;
                    locationName ??= loc.Name;
                    companyId ??= loc.CompanyId;
                }
            }
            else if (locationId is > 0 && string.IsNullOrWhiteSpace(locationName))
            {
                var loc = await opsDb.Locations.AsNoTracking().FirstOrDefaultAsync(l => l.Id == locationId.Value, ct);
                if (loc is not null)
                {
                    locationName = loc.Name;
                    locationExternalId ??= loc.ExternalId;
                    companyId ??= loc.CompanyId;
                }
            }

            country ??= "MY";
            var utc = DateTime.UtcNow;
            var local = CountryTimeZones.ToLocal(utc, country);
            var tz = CountryTimeZones.ResolveId(country);

            auditDb.SystemAuditEvents.Add(new SystemAuditEvent
            {
                OccurredAtUtc = utc,
                OccurredAtLocal = DateTime.SpecifyKind(local, DateTimeKind.Unspecified),
                TimeZoneId = tz,
                Year = local.Year,
                Month = local.Month,
                Category = request.Category.Trim(),
                Action = Truncate(request.Action, 128) ?? string.Empty,
                CompanyId = companyId,
                CompanyName = Truncate(companyName, 256),
                CountryCode = Truncate(country, 8),
                LocationId = locationId,
                LocationExternalId = Truncate(locationExternalId, 64),
                LocationName = Truncate(locationName, 256),
                DatabaseBucket = Truncate(databaseBucket, 128),
                UserId = request.UserId ?? actor.UserId,
                UserEmail = Truncate(request.UserEmail ?? actor.UserEmail, 256),
                UserName = Truncate(request.UserName ?? actor.UserName, 256),
                EntityType = Truncate(request.EntityType, 128),
                EntityKey = Truncate(request.EntityKey, 128),
                Summary = Truncate(request.Summary, 1000) ?? string.Empty,
                DetailsJson = request.Details is null ? "{}" : JsonSerializer.Serialize(request.Details, JsonOpts),
            });
            await auditDb.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            // Never fail business operations because audit write failed.
            Console.Error.WriteLine($"[SystemAudit] write failed: {ex.Message}");
        }
    }

    public async Task ArchiveOlderThanOneYearAsync(CancellationToken ct = default)
    {
        var cutoffUtc = DateTime.UtcNow.AddYears(-1);
        const int batch = 500;

        while (true)
        {
            var old = await auditDb.SystemAuditEvents
                .Where(e => e.OccurredAtUtc < cutoffUtc)
                .OrderBy(e => e.Id)
                .Take(batch)
                .ToListAsync(ct);
            if (old.Count == 0) break;

            var now = DateTime.UtcNow;
            foreach (var row in old)
            {
                auditDb.ArchivedSystemAuditEvents.Add(new ArchivedSystemAuditEvent
                {
                    OriginalId = row.Id,
                    OccurredAtUtc = row.OccurredAtUtc,
                    OccurredAtLocal = row.OccurredAtLocal,
                    TimeZoneId = row.TimeZoneId,
                    Year = row.Year,
                    Month = row.Month,
                    Category = row.Category,
                    Action = row.Action,
                    CompanyId = row.CompanyId,
                    CompanyName = row.CompanyName,
                    CountryCode = row.CountryCode,
                    LocationId = row.LocationId,
                    LocationExternalId = row.LocationExternalId,
                    LocationName = row.LocationName,
                    DatabaseBucket = row.DatabaseBucket,
                    UserId = row.UserId,
                    UserEmail = row.UserEmail,
                    UserName = row.UserName,
                    EntityType = row.EntityType,
                    EntityKey = row.EntityKey,
                    Summary = row.Summary,
                    DetailsJson = row.DetailsJson,
                    ArchivedAtUtc = now,
                });
            }

            auditDb.SystemAuditEvents.RemoveRange(old);
            await auditDb.SaveChangesAsync(ct);
        }
    }

    async Task<(
        int? UserId,
        string? UserEmail,
        string? UserName,
        int? CompanyId,
        string? CompanyName,
        string? CountryCode,
        int? LocationId,
        string? LocationExternalId,
        string? LocationName,
        string? DatabaseBucket)> ResolveActorAsync(CancellationToken ct)
    {
        int? userId = null;
        if (http.HttpContext is not null
            && int.TryParse(http.HttpContext.Request.Headers[TenantContextMiddleware.UserHeader].FirstOrDefault(), out var headerUser)
            && headerUser > 0)
            userId = headerUser;

        int? companyId = tenant.CompanyId;
        if (companyId is null or <= 0
            && http.HttpContext is not null
            && int.TryParse(http.HttpContext.Request.Headers[TenantContextMiddleware.CompanyHeader].FirstOrDefault(), out var headerCompany)
            && headerCompany > 0)
            companyId = headerCompany;

        string? email = null;
        string? name = null;
        string? companyName = null;
        string? country = null;
        int? locationId = null;
        string? locationExternalId = null;
        string? locationName = null;

        if (userId is > 0)
        {
            var user = await opsDb.AppUsers.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId.Value, ct);
            if (user is not null)
            {
                email = user.Email;
                name = user.FullName;
                companyId ??= user.CompanyId;
            }
        }

        if (companyId is > 0)
        {
            var company = await opsDb.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == companyId.Value, ct);
            if (company is not null)
            {
                companyName = company.Name;
                country = company.CountryCode;
            }
        }

        // Prefer explicit location from selected UI locations when only one is in scope.
        // Location external id may be carried on some payloads; resolve from request query as optional hint.
        var locationHint = http.HttpContext?.Request.Query["locationId"].FirstOrDefault()
            ?? http.HttpContext?.Request.Query["locationExternalId"].FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(locationHint))
        {
            if (int.TryParse(locationHint, out var locId) && locId > 0)
            {
                var loc = await opsDb.Locations.AsNoTracking().FirstOrDefaultAsync(l => l.Id == locId, ct);
                if (loc is not null)
                {
                    locationId = loc.Id;
                    locationExternalId = loc.ExternalId;
                    locationName = loc.Name;
                    companyId ??= loc.CompanyId;
                }
            }
            else
            {
                var loc = await opsDb.Locations.AsNoTracking()
                    .FirstOrDefaultAsync(l => l.ExternalId == locationHint, ct);
                if (loc is not null)
                {
                    locationId = loc.Id;
                    locationExternalId = loc.ExternalId;
                    locationName = loc.Name;
                    companyId ??= loc.CompanyId;
                }
            }
        }

        var databaseBucket = DatabaseNameFromConnection(connections.ResolveOperationalConnection(companyId));
        return (userId, email, name, companyId, companyName, country, locationId, locationExternalId, locationName, databaseBucket);
    }

    public static string? DatabaseNameFromConnection(string? connectionString)
    {
        if (string.IsNullOrWhiteSpace(connectionString)) return null;
        try
        {
            return new NpgsqlConnectionStringBuilder(connectionString).Database;
        }
        catch
        {
            return null;
        }
    }

    static string? Truncate(string? value, int max)
    {
        if (string.IsNullOrEmpty(value)) return value;
        return value.Length <= max ? value : value[..max];
    }
}
