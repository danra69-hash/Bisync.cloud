using Microsoft.Extensions.Options;

namespace Bisync.Api.Services;

public sealed class NutritionLibrarySyncHostedService(
    IServiceScopeFactory scopeFactory,
    IOptions<NutritionLibraryOptions> options,
    ILogger<NutritionLibrarySyncHostedService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var opts = options.Value;
        if (opts.RunOnStartup)
        {
            // Let the API finish booting / schema patch before first sync.
            try
            {
                await Task.Delay(TimeSpan.FromSeconds(20), stoppingToken);
                await RunCheckAsync(forceIfEmpty: true, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Initial nutrition library sync failed.");
            }
        }

        var intervalHours = Math.Max(1, opts.CheckIntervalHours);
        using var timer = new PeriodicTimer(TimeSpan.FromHours(intervalHours));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await RunCheckAsync(forceIfEmpty: opts.SyncWhenEmpty, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Scheduled nutrition library sync failed.");
            }
        }
    }

    async Task RunCheckAsync(bool forceIfEmpty, CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var sync = scope.ServiceProvider.GetRequiredService<NutritionLibrarySyncService>();
        var db = scope.ServiceProvider.GetRequiredService<Data.BisyncDbContext>();
        var empty = !await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions
            .AnyAsync(db.NutritionLibraryFoods, ct);
        if (empty && forceIfEmpty)
        {
            logger.LogInformation("Nutrition library empty — running initial USDA sync.");
            await sync.SyncAsync(force: true, ct);
            return;
        }

        logger.LogInformation("Checking USDA nutrition library for updates.");
        await sync.SyncAsync(force: false, ct);
    }
}
