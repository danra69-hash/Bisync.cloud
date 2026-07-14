using Bisync.Api.Data;
using Bisync.Api.Models;
using Bisync.Api.Tenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Bisync.Api.Services;

/// <summary>Records entity inserts/updates/deletes. Viewing (reads) are never logged.</summary>
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

        // Avoid recursive noise from archive host / background without user.
        var entries = context.ChangeTracker.Entries()
            .Where(e => e.State is EntityState.Added or EntityState.Modified or EntityState.Deleted)
            .Where(e => !SkipEntityTypes.Contains(e.Metadata.ClrType.Name))
            .ToList();
        if (entries.Count == 0) return;

        // Fire-and-forget via scope so we don't block SaveChanges if audit DB is slow.
        var snapshot = entries.Select(Summarize).ToList();
        var httpContext = http.HttpContext;
        _ = Task.Run(async () =>
        {
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                var audit = scope.ServiceProvider.GetRequiredService<ISystemAuditService>();
                var ops = scope.ServiceProvider.GetRequiredService<BisyncDbContext>();

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

                // Collapse many entity rows into one audit event per SaveChanges batch.
                var byType = snapshot
                    .GroupBy(s => s.EntityType)
                    .Select(g => new
                    {
                        entityType = g.Key,
                        added = g.Count(x => x.State == "Added"),
                        modified = g.Count(x => x.State == "Modified"),
                        deleted = g.Count(x => x.State == "Deleted"),
                        keys = g.Select(x => x.EntityKey).Where(k => !string.IsNullOrEmpty(k)).Take(20).ToArray(),
                    })
                    .ToList();

                var summary = string.Join("; ", byType.Select(b =>
                    $"{b.entityType}: +{b.added} ~{b.modified} -{b.deleted}"));

                await audit.RecordAsync(new SystemAuditWriteRequest(
                    SystemAuditCategories.DbUpdate,
                    "SaveChanges",
                    Truncate($"DB update — {summary}", 1000),
                    companyId,
                    companyName,
                    country,
                    userId,
                    email,
                    name,
                    byType.Count == 1 ? byType[0].entityType : "Batch",
                    byType.Count == 1 && byType[0].keys.Length == 1 ? byType[0].keys[0] : null,
                    new { entities = byType }));
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[SystemAudit] SaveChanges capture failed: {ex.Message}");
            }
        });
    }

    static (string EntityType, string State, string? EntityKey) Summarize(EntityEntry entry)
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
        return (type, state, key);
    }

    static string Truncate(string value, int max) =>
        value.Length <= max ? value : value[..max];
}
