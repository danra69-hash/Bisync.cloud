using Bisync.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

public static class ProductIdGenerator
{
    public static async Task<string> GenerateAsync(
        BisyncDbContext db,
        string name,
        bool isSubProduct,
        int? excludeId = null)
    {
        var prefix = ComponentIdGenerator.BuildPrefix(name);
        var kind = isSubProduct ? "SUB" : "PRD";
        var baseId = $"{kind}-{prefix}";
        var existing = await db.Products
            .Where(p => p.ProductId.StartsWith(baseId) && (excludeId == null || p.Id != excludeId))
            .Select(p => p.ProductId)
            .ToListAsync();

        for (var seq = 1; seq <= 999; seq++)
        {
            var candidate = $"{baseId}-{seq:D3}";
            if (!existing.Contains(candidate))
                return candidate;
        }

        return $"{baseId}-{Guid.NewGuid().ToString("N")[..6].ToUpperInvariant()}";
    }
}
