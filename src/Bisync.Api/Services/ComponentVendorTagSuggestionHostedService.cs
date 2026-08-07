namespace Bisync.Api.Services;

/// <summary>
/// Rebuilds the platform-wide component→vendor-product suggestion catalog.
/// Checks every few minutes so each country runs near 03:00 local time.
/// </summary>
public sealed class ComponentVendorTagSuggestionHostedService(
    IServiceScopeFactory scopeFactory,
    ILogger<ComponentVendorTagSuggestionHostedService> logger) : BackgroundService
{
    static readonly TimeSpan PollInterval = TimeSpan.FromMinutes(10);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Short delay so deferred startup can create the suggestion DB first.
        try
        {
            await Task.Delay(TimeSpan.FromMinutes(2), stoppingToken);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            return;
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                var service = scope.ServiceProvider.GetRequiredService<ComponentVendorTagSuggestionService>();
                await service.RebuildDueCountriesAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Component tag suggestion rebuild tick failed.");
            }

            try
            {
                await Task.Delay(PollInterval, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }
    }
}
