using Bisync.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

public static class BatchNumberGenerator
{
    public static async Task<string> GenerateAsync(BisyncDbContext db, int productId, string productCode)
    {
        var prefix = string.IsNullOrWhiteSpace(productCode) ? $"P{productId}" : productCode.Trim();
        var producedCount = await db.ProductProductionLogs
            .CountAsync(l => l.ProductId == productId && l.EntryType == "produced");

        for (var seq = producedCount + 1; seq <= producedCount + 9999; seq++)
        {
            var candidate = $"{prefix}-B{seq:D4}";
            var exists = await db.ProductProductionLogs
                .AnyAsync(l => l.BatchNumber == candidate);
            if (!exists)
                return candidate;
        }

        return $"{prefix}-B{Guid.NewGuid().ToString("N")[..6].ToUpperInvariant()}";
    }
}
