using Bisync.Api.Data;
using Bisync.Api.Models;
using Bisync.Api.Tenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Bisync.Api.Services;

/// <summary>
/// Applies SchemaPatcher to every distinct operational database in TenantConnections.
/// Required for AWS multi-DB / shard readiness so deploys do not leave tenant DBs drifted.
/// </summary>
public sealed class TenantSchemaMigrationService(
    ITenantConnectionResolver resolver,
    IOptions<TenancyOptions> tenancyOptions,
    ILogger<TenantSchemaMigrationService> logger)
{
    public async Task FanOutAsync(CancellationToken cancellationToken = default)
    {
        var opts = tenancyOptions.Value;
        if (!opts.FanOutSchemaMigrations)
        {
            logger.LogInformation("Tenancy:FanOutSchemaMigrations is disabled; skipping tenant schema fan-out");
            return;
        }

        var controlOptions = new DbContextOptionsBuilder<BisyncDbContext>()
            .UseNpgsql(resolver.DefaultOperationalConnection)
            .Options;

        await using var control = new BisyncDbContext(controlOptions);
        await SchemaPatcher.EnsureTenantRegistryAsync(control);

        var targets = await control.TenantConnections.AsNoTracking()
            .Where(t => t.IsActive && t.ConnectionString != null && t.ConnectionString != "")
            .OrderBy(t => t.CompanyId)
            .Select(t => new { t.CompanyId, t.ConnectionString, t.DatabaseName, t.PlacementMode })
            .ToListAsync(cancellationToken);

        // Distinct connection strings (shard DBs are shared by many companies).
        var distinct = targets
            .GroupBy(t => t.ConnectionString.Trim(), StringComparer.Ordinal)
            .Select(g => g.First())
            .Take(Math.Max(1, opts.SchemaFanOutBatchSize))
            .ToList();

        logger.LogInformation(
            "Tenant schema fan-out: {Distinct} distinct operational DB(s) (from {Rows} registry rows, batch {Batch})",
            distinct.Count, targets.Count, opts.SchemaFanOutBatchSize);

        foreach (var target in distinct)
        {
            cancellationToken.ThrowIfCancellationRequested();
            try
            {
                var options = new DbContextOptionsBuilder<BisyncDbContext>()
                    .UseNpgsql(target.ConnectionString)
                    .Options;
                await using var tenantDb = new BisyncDbContext(options);
                await tenantDb.Database.EnsureCreatedAsync(cancellationToken);
                await SchemaPatcher.ApplyAsync(tenantDb);
                logger.LogInformation(
                    "Patched operational DB for company {CompanyId} ({DatabaseName}, placement={Placement})",
                    target.CompanyId, target.DatabaseName, target.PlacementMode);
            }
            catch (Exception ex)
            {
                logger.LogError(
                    ex,
                    "Schema fan-out failed for company {CompanyId} database {DatabaseName}",
                    target.CompanyId, target.DatabaseName);
            }
        }
    }
}
