using Bisync.Api.Services;

namespace Bisync.Api.Data;

public sealed class SalesOrderLockExpiryHostedService(
    IServiceProvider serviceProvider,
    ILogger<SalesOrderLockExpiryHostedService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = serviceProvider.CreateAsyncScope();
                var salesOrderService = scope.ServiceProvider.GetRequiredService<B2bSalesOrderService>();
                var released = await salesOrderService.ReleaseExpiredLocksAsync(stoppingToken);
                if (released > 0)
                    logger.LogInformation("Released {Count} expired sales-order lock line(s) back to on hand.", released);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogError(ex, "Failed to process expired sales-order locks.");
            }

            await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
        }
    }
}
