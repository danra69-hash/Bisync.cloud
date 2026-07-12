using Bisync.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

public static class ComponentIdGenerator
{
    public static string BuildPrefix(string name)
    {
        var alpha = new string(name.Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant();
        return alpha.Length <= 6 ? alpha : alpha[..6];
    }

    public static async Task<string> GenerateAsync(
        BisyncDbContext db,
        string name,
        int? excludeId = null,
        int? companyId = null)
    {
        var prefix = BuildPrefix(name);
        var baseId = $"CMP-{prefix}";
        var existingQuery = db.Ingredients
            .Where(i => i.ComponentId.StartsWith(baseId) && (excludeId == null || i.Id != excludeId));
        if (companyId is int cid)
            existingQuery = existingQuery.Where(i => i.CompanyId == cid);

        var existing = await existingQuery
            .Select(i => i.ComponentId)
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
