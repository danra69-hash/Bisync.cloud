using Bisync.Api.Data;
using Bisync.Api.Models;
using Bisync.Api.Tenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Bisync.Api.Services;

/// <summary>
/// Records entity inserts/updates/deletes into Audit Trail with domain activity types.
/// Viewing (reads) are never logged. Every persisted change is listed.
/// </summary>
public sealed class SystemAuditSaveChangesInterceptor(
    IServiceScopeFactory scopeFactory,
    IHttpContextAccessor http) : SaveChangesInterceptor
{
    static readonly HashSet<string> SkipEntityTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        nameof(SystemAuditEvent),
        nameof(ArchivedSystemAuditEvent),
        nameof(DevQaRun),
        nameof(StockCardArchiveRun),
        nameof(TenantRollupSnapshot),
    };

    public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
    {
        Capture(eventData.Context);
        return base.SavingChanges(eventData, result);
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        Capture(eventData.Context);
        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    void Capture(DbContext? context)
    {
        if (context is null || context is SystemAuditDbContext)
            return;

        var entries = context.ChangeTracker.Entries()
            .Where(e => e.State is EntityState.Added or EntityState.Modified or EntityState.Deleted)
            .Where(e => !SkipEntityTypes.Contains(e.Metadata.ClrType.Name))
            .ToList();
        if (entries.Count == 0) return;

        var snapshot = entries.Select(Summarize).ToList();
        var physicalBucket = SystemAuditService.DatabaseNameFromConnection(context.Database.GetConnectionString());
        var httpContext = http.HttpContext;

        _ = Task.Run(async () =>
        {
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                var audit = scope.ServiceProvider.GetRequiredService<ISystemAuditService>();
                var ops = scope.ServiceProvider.GetRequiredService<BisyncDbContext>();
                var connections = scope.ServiceProvider.GetRequiredService<ITenantConnectionResolver>();

                int? userId = null;
                int? companyId = null;
                if (httpContext is not null)
                {
                    if (int.TryParse(httpContext.Request.Headers[TenantContextMiddleware.UserHeader].FirstOrDefault(), out var u) && u > 0)
                        userId = u;
                    if (int.TryParse(httpContext.Request.Headers[TenantContextMiddleware.CompanyHeader].FirstOrDefault(), out var c) && c > 0)
                        companyId = c;
                }

                string? email = null, name = null, companyName = null, country = null;
                if (userId is > 0)
                {
                    var user = await ops.AppUsers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == userId.Value);
                    if (user is not null)
                    {
                        email = user.Email;
                        name = user.FullName;
                        companyId ??= user.CompanyId;
                    }
                }
                if (companyId is > 0)
                {
                    var company = await ops.Companies.AsNoTracking().FirstOrDefaultAsync(x => x.Id == companyId.Value);
                    if (company is not null)
                    {
                        companyName = company.Name;
                        country = company.CountryCode;
                    }
                }

                // Prefer logical tenant bucket (bisync_c_{id}) over shared physical "bisync".
                var databaseBucket = companyId is > 0
                    ? connections.ResolveDatabaseBucketName(companyId)
                    : physicalBucket ?? connections.ResolveDatabaseBucketName(null);

                // One audit row per activity type so the trail is filterable by business title.
                var byActivity = snapshot
                    .GroupBy(s => s.ActivityType)
                    .OrderBy(g => g.Key)
                    .ToList();

                foreach (var group in byActivity)
                {
                    var byType = group
                        .GroupBy(s => s.EntityType)
                        .Select(g => new
                        {
                            entityType = g.Key,
                            added = g.Count(x => x.State == "Added"),
                            modified = g.Count(x => x.State == "Modified"),
                            deleted = g.Count(x => x.State == "Deleted"),
                            keys = g.Select(x => x.EntityKey).Where(k => !string.IsNullOrEmpty(k)).Take(20).ToArray(),
                            statuses = g.Select(x => x.StatusHint).Where(s => !string.IsNullOrWhiteSpace(s)).Distinct().Take(8).ToArray(),
                            details = g.Select(x => x.DetailHint).Where(d => !string.IsNullOrWhiteSpace(d)).Distinct().Take(12).ToArray(),
                        })
                        .ToList();

                    var summaryParts = byType.Select(b =>
                    {
                        if (b.details.Length > 0)
                            return string.Join("; ", b.details);
                        var core = $"{b.entityType}: +{b.added} ~{b.modified} -{b.deleted}";
                        if (b.statuses.Length > 0)
                            core += $" [{string.Join(", ", b.statuses)}]";
                        return core;
                    });
                    var summary = Truncate($"{group.Key} — {string.Join("; ", summaryParts)}", 1000);

                    await audit.RecordAsync(new SystemAuditWriteRequest(
                        group.Key,
                        "SaveChanges",
                        summary,
                        companyId,
                        companyName,
                        country,
                        userId,
                        email,
                        name,
                        byType.Count == 1 ? byType[0].entityType : "Batch",
                        byType.Count == 1 && byType[0].keys.Length == 1 ? byType[0].keys[0] : null,
                        new { activityType = group.Key, entities = byType },
                        DatabaseBucket: databaseBucket));
                }
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[SystemAudit] SaveChanges capture failed: {ex.Message}");
            }
        });
    }

    static (string EntityType, string State, string? EntityKey, string StatusHint, string ActivityType, string? DetailHint) Summarize(EntityEntry entry)
    {
        var type = entry.Metadata.ClrType.Name;
        var state = entry.State.ToString();
        string? key = null;
        try
        {
            var props = entry.Properties.Where(p => p.Metadata.IsPrimaryKey()).ToList();
            if (props.Count > 0)
                key = string.Join(":", props.Select(p => p.CurrentValue?.ToString() ?? p.OriginalValue?.ToString() ?? ""));
        }
        catch
        {
            // ignore
        }

        var statusHint = SystemAuditActivityTypes.ReadStatusHint(entry);
        var activityType = SystemAuditActivityTypes.ClassifyEntity(type, statusHint);
        var detailHint = ReadDetailHint(entry, type, state);
        return (type, state, key, statusHint, activityType, detailHint);
    }

    static string? ReadDetailHint(EntityEntry entry, string entityType, string state)
    {
        try
        {
            var verb = state switch
            {
                nameof(EntityState.Added) => "created",
                nameof(EntityState.Modified) => "updated",
                nameof(EntityState.Deleted) => "deleted",
                _ => state.ToLowerInvariant(),
            };

            if (string.Equals(entityType, nameof(Product), StringComparison.OrdinalIgnoreCase))
            {
                var name = ReadString(entry, "Name");
                var productId = ReadString(entry, "ProductId");
                var isSub = ReadBool(entry, "IsSubProduct") == true;
                var isVariableProduct = ReadBool(entry, "IsVariableProduct") == true;
                var isVariableComponent = ReadBool(entry, "IsVariableComponent") == true;
                var kind = isSub
                    ? "Sub-product"
                    : isVariableComponent
                        ? "Variable component"
                        : isVariableProduct
                            ? "Variable product"
                            : "Product";
                var label = string.IsNullOrWhiteSpace(name) ? "(unnamed)" : name.Trim();
                var idPart = string.IsNullOrWhiteSpace(productId) ? "" : $" ({productId.Trim()})";
                return $"{kind} {verb}: \"{label}\"{idPart}";
            }

            if (string.Equals(entityType, "Ingredient", StringComparison.OrdinalIgnoreCase)
                || string.Equals(entityType, "Component", StringComparison.OrdinalIgnoreCase))
            {
                var name = ReadString(entry, "Name") ?? ReadString(entry, "ComponentName");
                var code = ReadString(entry, "ComponentId") ?? ReadString(entry, "Code");
                if (!string.IsNullOrWhiteSpace(name) || !string.IsNullOrWhiteSpace(code))
                {
                    var label = string.IsNullOrWhiteSpace(name) ? "(unnamed)" : name.Trim();
                    var idPart = string.IsNullOrWhiteSpace(code) ? "" : $" ({code.Trim()})";
                    return $"Smart component {verb}: \"{label}\"{idPart}";
                }
            }

            if (string.Equals(entityType, nameof(AppUser), StringComparison.OrdinalIgnoreCase))
            {
                var email = ReadString(entry, "Email");
                var fullName = ReadString(entry, "FullName");
                if (!string.IsNullOrWhiteSpace(email) || !string.IsNullOrWhiteSpace(fullName))
                    return $"User {verb}: {fullName ?? "—"} ({email ?? "—"})";
            }

            if (string.Equals(entityType, nameof(Company), StringComparison.OrdinalIgnoreCase))
            {
                var name = ReadString(entry, "Name");
                var code = ReadString(entry, "Code");
                if (!string.IsNullOrWhiteSpace(name))
                    return $"Company {verb}: \"{name.Trim()}\"{(string.IsNullOrWhiteSpace(code) ? "" : $" ({code.Trim()})")}";
            }
        }
        catch
        {
            // ignore detail enrichment failures
        }

        return null;
    }

    static string? ReadString(EntityEntry entry, string propertyName)
    {
        var prop = entry.Properties.FirstOrDefault(p =>
            string.Equals(p.Metadata.Name, propertyName, StringComparison.OrdinalIgnoreCase));
        if (prop is null) return null;
        var value = prop.CurrentValue ?? prop.OriginalValue;
        return value?.ToString();
    }

    static bool? ReadBool(EntityEntry entry, string propertyName)
    {
        var prop = entry.Properties.FirstOrDefault(p =>
            string.Equals(p.Metadata.Name, propertyName, StringComparison.OrdinalIgnoreCase));
        if (prop is null) return null;
        var value = prop.CurrentValue ?? prop.OriginalValue;
        return value switch
        {
            bool b => b,
            string s when bool.TryParse(s, out var parsed) => parsed,
            _ => null,
        };
    }

    static string Truncate(string value, int max) =>
        value.Length <= max ? value : value[..max];
}
