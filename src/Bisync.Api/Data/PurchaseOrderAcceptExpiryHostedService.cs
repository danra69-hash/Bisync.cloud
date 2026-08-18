using Bisync.Api.Services;

namespace Bisync.Api.Data;

public sealed class PurchaseOrderAcceptExpiryHostedService(
    IServiceProvider serviceProvider,
    ILogger<PurchaseOrderAcceptExpiryHostedService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = serviceProvider.CreateAsyncScope();
                var service = scope.ServiceProvider.GetRequiredService<PurchaseOrderAcceptExpiryService>();
                var expired = await service.ExpireOverdueAsync(stoppingToken);
                if (expired > 0)
                    logger.LogInformation("Marked {Count} purchase order(s) expired (vendor accept window lapsed).", expired);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogError(ex, "Failed to process purchase-order vendor accept expiry.");
            }

            await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
        }
    }
}
