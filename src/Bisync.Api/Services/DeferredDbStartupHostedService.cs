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

            // Wipe non-user demo/seed residue after seeders so customer DBs stay clean
            // and sandbox leftovers (SC Demo, FIFO demo, catalog seeds) cannot linger.
            try
            {
                var purged = await DemoResiduePurger.PurgeAsync(db, logger, cancellationToken);
                if (purged.Total > 0)
                    logger.LogInformation("Demo residue purge removed {Count} row(s).", purged.Total);
            }
            catch (Exception purgeEx)
            {
                logger.LogError(purgeEx, "Demo residue purge failed; continuing startup");
            }

            var locationSubscriptions = sp.GetRequiredService<LocationSubscriptionService>();
            await locationSubscriptions.EnsureSchemaAsync();
            try
            {
                await locationSubscriptions.HealBillingLockSideEffectsAsync(cancellationToken);
            }
            catch (Exception billEx)
            {
                logger.LogError(billEx, "Billing-lock side-effect heal failed; continuing startup");
            }
            await HrStartup.InitializeAsync(db);
            await StockCardArchiveStartup.InitializeAsync(sp);
            await SystemAuditStartup.InitializeAsync(sp);
            await TagSuggestionStartup.InitializeAsync(sp);
            await sp.GetRequiredService<DevConsoleAuthService>().EnsureRootUserAsync();
            await sp.GetRequiredService<SalesModuleClientUpdateService>().SeedBundledIfEmptyAsync();

            var partitions = sp.GetRequiredService<LocationPartitionService>();
            await partitions.EnsureLocationListPartitionsAsync();
            await partitions.EnsurePartitionsForAllLocationsAsync();

            try
            {
                var healed = await sp.GetRequiredService<ReceivedPurchaseStockHealer>()
                    .HealMissingReceivedStockAsync(cancellationToken, fullScan: true);
                if (healed > 0)
                    logger.LogInformation("Healed received stock for {Count} purchase order(s).", healed);
            }
            catch (Exception healEx)
            {
                logger.LogError(healEx, "Received stock heal failed; continuing startup");
            }

            try
            {
                var categoryHealed = await ProductCategoryHealer.ApplyAsync(db, logger, cancellationToken);
                if (categoryHealed > 0)
                    logger.LogInformation(
                        "Healed Category/Group on {Count} Soft Drink product(s) (e.g. Ginger Ale).",
                        categoryHealed);
            }
            catch (Exception categoryEx)
            {
                logger.LogError(categoryEx, "Product category heal failed; continuing startup");
            }

            try
            {
                // Shared DB already combined in SchemaPatcher; fan-out to provisioned tenant DBs.
                var depositLinesRemoved = await PurchaseOrderDepositCombinerMigrator
                    .ApplyAcrossProvisionedTenantsAsync(db, logger, cancellationToken);
                if (depositLinesRemoved > 0)
                    logger.LogInformation(
                        "Combined returnable deposits on provisioned tenants; removed {Count} duplicate line(s).",
                        depositLinesRemoved);
            }
            catch (Exception depositEx)
            {
                logger.LogError(depositEx, "Returnable deposit combine (provisioned) failed; continuing startup");
            }

            try
            {
                var purged = await sp.GetRequiredService<CreditNoteService>()
                    .PurgeErroneousTinyQuantityAsync(cancellationToken);
                if (purged > 0)
                    logger.LogInformation(
                        "Purged {Count} erroneous tiny-qty credit note(s) (< {MinQty}).",
                        purged,
                        CreditNoteService.MinAllowedCreditQuantity);
            }
            catch (Exception purgeEx)
            {
                logger.LogError(purgeEx, "Tiny credit-note purge failed; continuing startup");
            }

            logger.LogInformation("Deferred DB startup: complete");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Deferred DB startup failed (API remains up)");
        }
    }
}
