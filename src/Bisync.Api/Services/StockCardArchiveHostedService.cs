using Bisync.Api.Data;
using Bisync.Api.Tenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Bisync.Api.Services;

public sealed class StockCardArchiveHostedService(
    IServiceScopeFactory scopeFactory,
    IOptions<StockCardArchiveOptions> options,
    ILogger<StockCardArchiveHostedService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!options.Value.RunOnStartup)
            return;

        await RunArchiveAsync(stoppingToken);

        var intervalHours = Math.Max(1, options.Value.IntervalHours);
        using var timer = new PeriodicTimer(TimeSpan.FromHours(intervalHours));
        while (await timer.WaitForNextTickAsync(stoppingToken))
            await RunArchiveAsync(stoppingToken);
    }

    async Task RunArchiveAsync(CancellationToken cancellationToken)
    {
        try
        {
            using var scope = scopeFactory.CreateScope();
            var archiveService = scope.ServiceProvider.GetRequiredService<StockCardArchiveService>();
            await archiveService.ArchiveExpiredRecordsAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Stock card archive job failed.");
        }
    }
}

public static class StockCardArchiveStartup
{
    public static async Task InitializeAsync(IServiceProvider services)
    {
        var resolver = services.GetRequiredService<ITenantConnectionResolver>();
        await PostgresDatabaseBootstrap.EnsureExistsAsync(resolver.DefaultArchiveConnection);

        var archiveDb = services.GetRequiredService<StockCardArchiveDbContext>();
        await archiveDb.Database.EnsureCreatedAsync();

        try
        {
            var opsOptions = new DbContextOptionsBuilder<BisyncDbContext>()
                .UseNpgsql(resolver.DefaultOperationalConnection)
                .Options;
            await using var opsDb = new BisyncDbContext(opsOptions);
            await ComponentIdentityMigrator.RemapArchiveAsync(archiveDb, opsDb);
        }
        catch
        {
            // Best-effort archive ID remap.
        }
    }
}
