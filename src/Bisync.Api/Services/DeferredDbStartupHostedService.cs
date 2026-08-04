using Bisync.Api.Data;
using Bisync.Api.Services;
using Bisync.Api.Tenancy;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

/// <summary>
/// Runs seeders / partition warm-up after Kestrel is listening so Cloud Run
/// startup probes succeed even when the control-plane DB needs heavy work
/// (e.g. after a company wipe + ConfigurationSeeder rebuild).
/// </summary>
public sealed class DeferredDbStartupHostedService(
    IServiceScopeFactory scopeFactory,
    ILogger<DeferredDbStartupHostedService> logger) : IHostedService
{
    public Task StartAsync(CancellationToken cancellationToken)
    {
        _ = Task.Run(() => RunAsync(cancellationToken), CancellationToken.None);
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    async Task RunAsync(CancellationToken cancellationToken)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var sp = scope.ServiceProvider;
        var resolver = sp.GetRequiredService<ITenantConnectionResolver>();
        var controlOptions = new DbContextOptionsBuilder<BisyncDbContext>()
            .UseNpgsql(resolver.DefaultOperationalConnection)
            .Options;

        // Identity merge / POS floor-plan table must not block PORT bind.
        try
        {
            await using var mergeDb = new BisyncDbContext(controlOptions);
            await SchemaPatcher.EnsurePosFloorPlansTableAsync(mergeDb);
            await SchemaPatcher.EnsurePosTaxServiceConfigsTableAsync(mergeDb);
            await SchemaPatcher.EnsurePosWaitlistEntriesTableAsync(mergeDb);
            await SchemaPatcher.EnsurePosQrOrdersTableAsync(mergeDb);
            await PlatformOwnerIdentityMigrator.ApplyAsync(mergeDb, logger);
            try
            {
                await PosFloorPlanCanonicalSeeder.EnsureCanonicalAsync(mergeDb, logger);
            }
            catch (Exception floorEx)
            {
                logger.LogError(floorEx, "Canonical floor plan seed failed; continuing startup");
            }
        }
        catch (Exception mergeEx)
        {
            logger.LogError(mergeEx, "Platform owner identity merge / floor-plan table failed; continuing startup");
        }

        try
        {
            await using var db = new BisyncDbContext(controlOptions);

            logger.LogInformation("Deferred DB startup: seeders begin");
            await RevMgmtStartup.InitializeAsync(db);
            await SchemaPatcher.EnsureTenantRegistryAsync(db);
            await DataSeeder.SeedAsync(db);
            await ConfigurationSeeder.SeedAsync(db);
            await ConfigurationSeeder.PatchUserAssignmentsAsync(db);
            await ConfigurationSeeder.PatchSuperAdminPasswordAsync(db);
            try
            {
                await PlatformOwnerIdentityMigrator.ApplyAsync(db, logger);
            }
            catch (Exception mergeEx)
            {
                logger.LogError(mergeEx, "Platform owner identity merge (post-seed) failed; continuing startup");
            }
            await VendorCatalogSeeder.EnsureCatalogVendorsAsync(db);
            await IngredientCatalogSeeder.EnsureCatalogIngredientsAsync(db);
            await sp.GetRequiredService<LocationSubscriptionService>().EnsureSchemaAsync();
            await HrStartup.InitializeAsync(db);
            await StockCardArchiveStartup.InitializeAsync(sp);
            await SystemAuditStartup.InitializeAsync(sp);
            await sp.GetRequiredService<DevConsoleAuthService>().EnsureRootUserAsync();
            await sp.GetRequiredService<SalesModuleClientUpdateService>().SeedBundledIfEmptyAsync();

            var partitions = sp.GetRequiredService<LocationPartitionService>();
            await partitions.EnsureLocationListPartitionsAsync();
            await partitions.EnsurePartitionsForAllLocationsAsync();

            try
            {
                await sp.GetRequiredService<TenantSchemaMigrationService>().FanOutAsync(cancellationToken);
            }
            catch (Exception fanEx)
            {
                logger.LogError(fanEx, "Tenant schema fan-out failed; continuing startup");
            }

            logger.LogInformation("Deferred DB startup: complete");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Deferred DB startup failed (API remains up)");
        }
    }
}
